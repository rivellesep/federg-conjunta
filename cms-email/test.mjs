// Local test of the email CMS Worker with Cloudflare Access and GitHub mocked.
// Run with: npm run cms-email:test
import { generateKeyPairSync, createSign, createVerify, createPublicKey } from 'node:crypto';
import worker from './src/index.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
// Access signing key (served as JWKS) and a GitHub-style PKCS#1 app key
const access = generateKeyPairSync('rsa', { modulusLength: 2048 });
const app = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...access.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const appPem = app.privateKey.export({ type: 'pkcs1', format: 'pem' });

const TEAM = 'test.cloudflareaccess.com';
const AUD = 'aud123';
const env = {
  ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, GITHUB_APP_ID: '42', GITHUB_INSTALLATION_ID: '7',
  GITHUB_APP_PRIVATE_KEY: appPem, REPO_OWNER: 'rivellesep', REPO_NAME: 'federg-conjunta',
  EDITOR_ALIASES: JSON.stringify({ 'ana@example.org': 'Ana' }),
  ASSETS: { fetch: async () => new Response('asset') },
};

const jwt = (claims, key = access.privateKey) => {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const p = b64u(JSON.stringify(claims));
  const s = createSign('RSA-SHA256').update(`${h}.${p}`).sign(key);
  return `${h}.${p}.${b64u(s)}`;
};
const now = Math.floor(Date.now() / 1000);
const good = (email = 'Ana@Example.org') => jwt({ iss: `https://${TEAM}`, aud: [AUD], email, exp: now + 600, nbf: now - 10 });

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push({ url, init });
  if (url === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
  if (url.endsWith('/app/installations/7/access_tokens')) {
    const [h, p, s] = init.headers.Authorization.replace('Bearer ', '').split('.');
    const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(createPublicKey(appPem), Buffer.from(s, 'base64url'));
    if (!ok || JSON.parse(Buffer.from(p, 'base64url')).iss !== '42') return new Response('bad app jwt', { status: 401 });
    return Response.json({ token: 'ghs_TEST', expires_at: new Date(Date.now() + 3600e3).toISOString() }, { status: 201 });
  }
  if (url.startsWith('https://api.github.com/')) {
    if (init.headers.Authorization !== 'token ghs_TEST') return new Response('no token', { status: 401 });
    if (url.endsWith('/repos/rivellesep/federg-conjunta')) return Response.json({ full_name: 'rivellesep/federg-conjunta' });
    return Response.json({ echo: init.body ? JSON.parse(init.body) : null }, {
      headers: { link: '<https://api.github.com/repos/rivellesep/federg-conjunta/pulls?page=2>; rel="next"' },
    });
  }
  throw new Error('unexpected fetch ' + url);
};

const W = 'https://federg-cms-email.example.workers.dev';
const req = (path, { token, method = 'GET', body } = {}) =>
  worker.fetch(new Request(W + path, { method, body: body && JSON.stringify(body), headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} }), env);

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); if (!cond) failed++; };

let r = await req('/api/github/user');
check('no Access JWT -> 401', r.status === 401);
r = await req('/api/github/user', { token: jwt({ iss: `https://${TEAM}`, aud: ['other'], email: 'a@b.c', exp: now + 600 }) });
check('wrong audience -> 401', r.status === 401);
r = await req('/api/github/user', { token: jwt({ iss: `https://${TEAM}`, aud: [AUD], email: 'a@b.c', exp: now - 5 }) });
check('expired -> 401', r.status === 401);
r = await req('/api/github/user', { token: jwt({ iss: 'https://evil.cloudflareaccess.com', aud: [AUD], email: 'a@b.c', exp: now + 600 }) });
check('wrong issuer -> 401', r.status === 401);
r = await req('/api/github/user', { token: jwt({ iss: `https://${TEAM}`, aud: [AUD], email: 'a@b.c', exp: now + 600 }, app.privateKey) });
check('signed with another key -> 401', r.status === 401);

r = await req('/api/github/user', { token: good() });
let j = await r.json();
check('valid JWT, /user is the alias', r.status === 200 && j.login === 'Ana', JSON.stringify(j));
r = await req('/api/github/user', { token: good('someone@else.org') });
j = await r.json();
check('unknown email gets a hashed label, no email leaked', /^editor [0-9a-f]{8}$/.test(j.login) && !JSON.stringify(j).includes('else.org'), j.login);

r = await req('/api/github/api/v3/user', { token: good() });
check('/api/v3 prefix accepted for /user', r.status === 200 && (await r.json()).login === 'Ana');
r = await req('/api/github/api/v3/repos/other/repo', { token: good() });
check('/api/v3 prefix still blocks other repos', r.status === 403);
r = await req('/api/github/api/v3/repos/rivellesep/federg-conjunta', { token: good() });
check('/api/v3 prefix reaches the repo', r.status === 200 && (await r.json()).permissions?.push === true);
r = await req('/api/github/repos/rivellesep/federg-conjunta', { token: good() });
j = await r.json();
check('repo GET adds permissions.push', j.permissions?.push === true);
check('upstream used installation token, never the placeholder', calls.every((c) => !String(c.init.headers?.Authorization ?? '').includes('email-session')));

for (const [p, m] of [['/api/github/repos/other/repo', 'GET'], ['/api/github/repos/rivellesep/federg-conjunta/hooks', 'GET'], ['/api/github/repos/rivellesep/federg-conjunta/collaborators/x', 'PUT'], ['/api/github/repos/rivellesep/federg-conjunta/actions/secrets', 'GET'], ['/api/github/repos/rivellesep/federg-conjunta/branches/main/protection', 'DELETE'], ['/api/github/repos/rivellesep/federg-conjunta', 'DELETE'], ['/api/github/user/repos', 'GET'], ['/api/github/graphql', 'GET']]) {
  r = await req(p, { token: good(), method: m, body: m === 'GET' || m === 'DELETE' ? undefined : {} });
  check(`blocked ${m} ${p.replace('/api/github', '')}`, r.status === 403, String(r.status));
}

r = await req('/api/github/graphql', { token: good(), method: 'POST', body: { query: 'mutation($input: CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}', variables: { input: { message: { headline: 'Create Noticia "x"' } } } } });
j = await r.json();
check('GraphQL commit gets the editor name', j.echo.variables.input.message.body === 'Edited with the email CMS by Ana', JSON.stringify(j.echo.variables.input.message));

r = await req('/api/github/repos/rivellesep/federg-conjunta/pulls/3/merge', { token: good(), method: 'PUT', body: { merge_method: 'squash', commit_title: 'Create Noticia "x"' } });
j = await r.json();
check('squash merge gets the editor name', j.echo.commit_message === 'Edited with the email CMS by Ana');
check('pagination link points to the proxy', r.headers.get('link').startsWith(`<${W}/api/github/repos/`), r.headers.get('link'));

r = await req('/auth', { token: good() });
const html = await r.text();
check('/auth answers with the placeholder for its own origin only', r.status === 200 && html.includes(JSON.stringify(W)) && html.includes('email-session') && !html.includes('ghs_'));
r = await req('/auth');
check('/auth without Access -> 401', r.status === 401);
r = await req('/admin/');
check('static assets served', (await r.text()) === 'asset');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exitCode = failed ? 1 : 0;
