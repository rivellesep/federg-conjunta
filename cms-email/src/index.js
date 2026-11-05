/**
 * Email sign-in for Sveltia CMS, without GitHub accounts for editors.
 *
 * Cloudflare Access sits in front of this Worker and asks editors for a one-time code sent to their
 * email. The Worker then does three things:
 *
 * 1. Serves the CMS (public/admin/) as static assets.
 * 2. Answers the CMS sign-in popup (/auth) with a placeholder token. It is not a secret: it only
 *    works through this Worker, and only with a valid Access session.
 * 3. Proxies the GitHub API (/api/github/*). Each request is checked against the Access JWT, the
 *    placeholder is swapped for a short-lived GitHub App installation token, and only this
 *    repository can be reached. The real token never leaves the Worker.
 *
 * Variables (wrangler.toml or dashboard): GITHUB_APP_ID, GITHUB_INSTALLATION_ID, REPO_OWNER,
 * REPO_NAME, ACCESS_TEAM_DOMAIN, ACCESS_AUD.
 * Secrets: GITHUB_APP_PRIVATE_KEY (the .pem file from GitHub), EDITOR_ALIASES (optional JSON that
 * maps editor emails to the name written in commit messages).
 */

const GITHUB_API = 'https://api.github.com';
const API_PREFIX = '/api/github';
const PLACEHOLDER_TOKEN = 'email-session';

// Repository paths the CMS never needs. GitHub would refuse most of them anyway, because the app
// only has content and pull request permissions; this is a second lock.
const BLOCKED_REPO_PATHS =
  /^\/(hooks|keys|collaborators|invitations|actions|environments|secrets|pages|rulesets|autolinks|transfer|vulnerability-alerts|branches\/[^/]+\/protection)(\/|$)/;

// ---------------------------------------------------------------------------------------------
// Small helpers

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const deny = (status, message) => json({ message }, status);

const base64UrlToBytes = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const bytesToBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const textToBase64Url = (text) => bytesToBase64Url(new TextEncoder().encode(text));

const sha256Hex = async (text) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ---------------------------------------------------------------------------------------------
// Cloudflare Access: verify the JWT that Access adds to every request it lets through

let accessKeys = { fetchedAt: 0, keys: [] };

const getAccessKeys = async (teamDomain) => {
  if (Date.now() - accessKeys.fetchedAt < 60 * 60 * 1000 && accessKeys.keys.length) return accessKeys.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs: ${res.status}`);
  const { keys = [] } = await res.json();
  accessKeys = { fetchedAt: Date.now(), keys };
  return keys;
};

/** Returns the signed-in email, or null if the request did not come through Access. */
const verifyAccess = async (request, env) => {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!signaturePart) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;

  const jwk = (await getAccessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  if (!audiences.includes(env.ACCESS_AUD)) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;

  return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
};

// ---------------------------------------------------------------------------------------------
// GitHub App: sign a JWT with the app's private key and exchange it for an installation token

/** GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"). WebCrypto only imports PKCS#8. */
const pemToPkcs8 = (pem) => {
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0)
  );
  if (!isPkcs1) return der;

  // Wrap the PKCS#1 key: SEQUENCE { INTEGER 0, SEQUENCE { rsaEncryption OID, NULL }, OCTET STRING key }
  const length = (n) =>
    n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff];
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...length(der.length), ...der];
  const body = [0x02, 0x01, 0x00, ...algorithm, ...octet];
  return new Uint8Array([0x30, ...length(body.length), ...body]);
};

let installationToken = { token: '', expiresAt: 0 };

const getInstallationToken = async (env) => {
  // Reuse the token until five minutes before it expires (GitHub gives it one hour)
  if (installationToken.token && installationToken.expiresAt - Date.now() > 5 * 60 * 1000) {
    return installationToken.token;
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(env.GITHUB_APP_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${textToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${textToBase64Url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(env.GITHUB_APP_ID) })
  )}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await fetch(`${GITHUB_API}/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${unsigned}.${bytesToBase64Url(signature)}`,
      'User-Agent': 'federg-cms-email',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    // Limit the token to this one repository, whatever else the app might be installed on
    body: JSON.stringify({ repositories: [env.REPO_NAME] }),
  });
  if (!res.ok) throw new Error(`Installation token: ${res.status} ${await res.text()}`);
  const { token, expires_at: expiresAt } = await res.json();
  installationToken = { token, expiresAt: Date.parse(expiresAt) };
  return token;
};

// ---------------------------------------------------------------------------------------------
// Who edited: a name for the commit message, never the email itself (the repository is public)

const editorName = async (email, env) => {
  try {
    const aliases = JSON.parse(env.EDITOR_ALIASES || '{}');
    const alias = Object.entries(aliases).find(([k]) => k.toLowerCase() === email)?.[1];
    if (alias) return alias;
  } catch {
    // A malformed EDITOR_ALIASES falls back to the anonymous label
  }
  return `editor ${(await sha256Hex(email)).slice(0, 8)}`;
};

const signature = (name) => `Edited with the email CMS by ${name}`;

/** Adds the editor's name to the commit messages the CMS sends. */
const tagCommitMessages = (path, method, body, name) => {
  // GraphQL createCommitOnBranch: variables.input.message = { headline, body? }
  if (path === '/graphql' && body?.variables) {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.headline === 'string') {
        node.body = node.body ? `${node.body}\n\n${signature(name)}` : signature(name);
      }
      Object.values(node).forEach(walk);
    };
    walk(body.variables);
  }
  // REST: file commits and pull request merges
  if (method !== 'GET' && body && typeof body === 'object') {
    if (typeof body.message === 'string') body.message += `\n\n${signature(name)}`;
    if (/\/pulls\/\d+\/merge$/.test(path)) {
      body.commit_message = body.commit_message ? `${body.commit_message}\n\n${signature(name)}` : signature(name);
    }
  }
  return body;
};

// ---------------------------------------------------------------------------------------------
// Sign-in popup: the same postMessage handshake as sveltia-cms-auth, with the placeholder token

const signInPage = (origin) =>
  new Response(
    `<!doctype html><html><body><script>
      (() => {
        const origin = ${JSON.stringify(origin)};
        const content = ${JSON.stringify(JSON.stringify({ provider: 'github', token: PLACEHOLDER_TOKEN }))};
        window.addEventListener('message', ({ data, origin: from }) => {
          // Only the CMS served by this same Worker receives the answer
          if (data !== 'authorizing:github' || from !== origin) return;
          window.opener?.postMessage('authorization:github:success:' + content, origin);
        });
        window.opener?.postMessage('authorizing:github', origin);
      })();
    </script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

// ---------------------------------------------------------------------------------------------
// GitHub API proxy

const proxyGitHub = async (request, env, email, url) => {
  // Sveltia treats a custom api_root like GitHub Enterprise and adds /api/v3 to REST calls
  const path = url.pathname.slice(API_PREFIX.length).replace(/^\/api\/v3(?=\/|$)/, '') || '/';
  const method = request.method.toUpperCase();
  const repoPrefix = `/repos/${env.REPO_OWNER}/${env.REPO_NAME}`;
  const name = await editorName(email, env);

  // The CMS asks who is signed in. Answer with the editor, not with the bot behind the token.
  if (path === '/user' && method === 'GET') {
    return json({ id: 0, login: name, name, email: null, avatar_url: '', html_url: '', bot: false });
  }

  const isRepoPath = path === repoPrefix || path.startsWith(`${repoPrefix}/`);
  const isGraphQL = path === '/graphql' && method === 'POST';
  if (!isRepoPath && !isGraphQL) return deny(403, `Not allowed through the email CMS: ${path}`);
  if (isRepoPath && BLOCKED_REPO_PATHS.test(path.slice(repoPrefix.length))) {
    return deny(403, 'Not allowed through the email CMS');
  }
  if (path === repoPrefix && method !== 'GET') return deny(403, 'Not allowed through the email CMS');

  let body = null;
  if (!['GET', 'HEAD'].includes(method)) {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.stringify(tagCommitMessages(path, method, JSON.parse(text), name));
      } catch {
        return deny(400, 'Expected a JSON body');
      }
    }
  }

  const token = await getInstallationToken(env);
  const upstream = await fetch(`${GITHUB_API}${path}${url.search}`, {
    method,
    body,
    headers: {
      Accept: request.headers.get('Accept') || 'application/vnd.github+json',
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'federg-cms-email',
      'X-GitHub-Api-Version': request.headers.get('X-GitHub-Api-Version') || '2022-11-28',
    },
  });

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const h of ['content-type', 'etag', 'last-modified', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Pagination links must point back to this proxy, not to GitHub
  const link = upstream.headers.get('link');
  if (link) headers.set('link', link.replaceAll(GITHUB_API, `${url.origin}${API_PREFIX}`));

  // An installation token has no "permissions" on the repository object, and the CMS refuses to
  // edit without permissions.push. The app can push to this repository, so say so.
  if (path === repoPrefix && method === 'GET' && upstream.ok) {
    const repo = await upstream.json();
    repo.permissions = { admin: false, maintain: false, push: true, triage: true, pull: true };
    return new Response(JSON.stringify(repo), { status: upstream.status, headers });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
};

// ---------------------------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Everything dynamic needs a valid Access session, checked here and not only at the edge
    if (url.pathname === '/auth' || url.pathname.startsWith(`${API_PREFIX}/`)) {
      let email;
      try {
        email = await verifyAccess(request, env);
      } catch {
        return deny(503, 'Could not verify the sign-in. Try again in a minute.');
      }
      if (!email) return deny(401, 'Sign in through Cloudflare Access first');

      if (url.pathname === '/auth') return signInPage(url.origin);

      try {
        return await proxyGitHub(request, env, email, url);
      } catch (error) {
        console.error(error);
        return deny(502, 'GitHub could not be reached through the email CMS');
      }
    }

    if (url.pathname === '/') return Response.redirect(`${url.origin}/admin/`, 302);
    return env.ASSETS.fetch(request);
  },
};
