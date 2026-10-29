export interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

// Same sections as the current federg.org menu
export const nav: NavItem[] = [
  {
    label: 'About FEDERG',
    href: '/about/',
    children: [
      { label: 'What we do', href: '/about/what-we-do/' },
      { label: 'Our members', href: '/about/members/' },
      { label: 'Governance & statutes', href: '/about/governance/' },
      { label: 'Collaborations', href: '/about/collaborations/' },
      { label: 'Why our name matters', href: '/about/why-our-name-matters/' },
      { label: 'Strategic Plan 2026–2029', href: '/about/strategic-plan/' },
    ],
  },
  { label: 'Patient Stories', href: '/patient-stories/' },
  {
    label: 'News & Events',
    children: [
      { label: 'News', href: '/news/' },
      { label: 'Events', href: '/events/' },
      { label: 'FEDERG representations', href: '/representations/' },
      { label: 'Members activities', href: '/members-activities/' },
      { label: 'Useful links', href: '/useful-links/' },
    ],
  },
  { label: 'Contact', href: '/contact/' },
];

export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/federg/' },
  { label: 'Facebook', href: 'https://www.facebook.com/federg' },
  { label: 'Instagram', href: 'https://www.instagram.com/federg2025' },
];
