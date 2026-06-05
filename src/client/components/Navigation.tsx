const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/results', label: 'Results' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/tournament', label: 'Tournament' }
];

export function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
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
