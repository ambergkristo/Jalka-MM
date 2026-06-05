import type { ReactNode } from 'react';

export function Card({ title, eyebrow, children, className = '' }: { title?: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(eyebrow || title) && (
        <div className="card-heading">
          {eyebrow && <p>{eyebrow}</p>}
          {title && <h2>{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}
