const links = [
  { href: '/', label: 'Avaleht' },
  { href: '/results', label: 'Tulemused' },
  { href: '/leaderboard', label: 'Edetabel' },
  { href: '/tournament', label: 'Turniir' },
  { href: '/operator', label: 'Operaator' }
];

export function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav className="site-nav" aria-label="Põhinavigatsioon">
      {links.map((link) => (
        <a key={link.href} className={isActive(pathname, link.href) ? 'active' : ''} href={link.href}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
