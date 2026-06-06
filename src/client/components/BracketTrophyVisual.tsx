export function BracketTrophyVisual() {
  return (
    <div className="bracket-trophy" aria-hidden="true">
      <svg className="bracket-trophy-svg" viewBox="0 0 180 220">
        <defs>
          <radialGradient id="trophy-ball-glow" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFF4B8" />
            <stop offset="42%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8F6B18" />
          </radialGradient>
          <linearGradient id="trophy-gold" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE58A" />
            <stop offset="45%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8B6415" />
          </linearGradient>
          <linearGradient id="trophy-shadow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#6C5116" />
            <stop offset="100%" stopColor="#241A09" />
          </linearGradient>
        </defs>

        <ellipse cx="90" cy="202" rx="54" ry="10" fill="rgba(0,0,0,.34)" />
        <path d="M52 174h76l13 24H39l13-24Z" fill="url(#trophy-shadow)" />
        <path d="M61 158h58l9 18H52l9-18Z" fill="url(#trophy-gold)" />
        <path d="M77 112c-4 19-9 34-20 46h66c-11-12-16-27-20-46H77Z" fill="url(#trophy-gold)" />
        <path d="M62 78c4 21 14 37 28 45 14-8 24-24 28-45H62Z" fill="url(#trophy-gold)" />
        <path d="M59 76c-18 2-31 12-35 27-3 13 2 25 13 32 10 6 22 5 32-3l-7-14c-5 4-11 5-16 2-5-4-8-9-6-15 2-7 9-12 21-14l-2-15Z" fill="url(#trophy-gold)" opacity=".82" />
        <path d="M121 76c18 2 31 12 35 27 3 13-2 25-13 32-10 6-22 5-32-3l7-14c5 4 11 5 16 2 5-4 8-9 6-15-2-7-9-12-21-14l2-15Z" fill="url(#trophy-gold)" opacity=".82" />

        <circle cx="90" cy="58" r="36" fill="url(#trophy-ball-glow)" />
        <path d="M90 23c10 9 16 21 16 35S100 84 90 93C80 84 74 72 74 58s6-26 16-35Z" fill="rgba(255,255,255,.18)" />
        <path d="M59 54c18-11 44-11 62 0M63 70c16 7 38 7 54 0M90 23v70M68 35c11 8 16 21 14 46M112 35c-11 8-16 21-14 46" fill="none" stroke="rgba(76,50,9,.46)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M68 102c11 11 33 11 44 0" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 181h70" stroke="rgba(255,255,255,.24)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
