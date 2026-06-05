import type { NavigationCardData } from '../data/mock.js';

export function NavigationCards({ items }: { items: NavigationCardData[] }) {
  return (
    <section className="navigation-cards" aria-label="Quick navigation">
      {items.map((item) => (
        <a className={`navigation-card ${item.accent}`} href={item.href} key={item.href}>
          <span>{item.title}</span>
          <strong>{item.description}</strong>
        </a>
      ))}
    </section>
  );
}
