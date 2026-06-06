# UI And UX Direction

## Product Feel

The app should feel like a premium football tournament dashboard: fast, public, mobile-first, and easy to scan during match days.

The visual direction may be inspired by the North America 2026 football atmosphere, but must not copy FIFA branding.

Do not use:

- FIFA logo
- World Cup trophy
- Official tournament marks
- Official FIFA or tournament fonts
- Official graphics or key art

Use original abstract stadium, pitch, grid, light, and scoreboard patterns instead.

## Layout Principles

- Mobile-first.
- Public dashboard as the landing page.
- Dense but readable tournament information.
- Clear primary navigation.
- Large touch targets.
- No login-first experience.
- No prediction form UX.
- No deadline countdown UX.
- Public-facing UI copy must be Estonian.
- Internal data status, API status, provider state, audit state, and `partial_official` labels must not be shown on public pages.
- Tournament Center play-off must use a true left/right bracket tree with the final centered.

## Palette

Suggested palette:

- Dark navy background
- White or light cards
- Gold accent
- Blue supporting accent
- Red supporting accent
- Green supporting accent

The design should avoid becoming a one-color navy-only interface. Gold should be an accent, not the entire theme.

## Typography

Suggested fonts:

- Headings: Bebas Neue or Archivo Black
- Body: Inter

Headings should feel event-like and confident. Body text should stay clean and readable for statistics, tables, and match rows.

## Main UX

### Landing Dashboard

The landing page is the main dashboard, not a marketing page.

It should show:

- Today's matches
- Latest results
- Top 5 leaderboard
- Group leaders
- Main navigation

Use big buttons for:

- Results
- Leaderboard
- Tournament

In the Estonian UI these should appear as:

- Tulemused
- Edetabel
- Turniir

### Leaderboard

The leaderboard remains clean and focused:

- Rank
- Player
- Points
- Exact scores
- Correct results
- Hit rate
- Last update, where useful

Avoid visual clutter. Ranking changes can be subtle.

### Player Detail

Player detail is a full-screen route, not a modal.

It should show:

- Player summary
- Total points and rank
- Predicted champion
- Predicted top scorer
- Match prediction sections
- Playoff prediction
- Group predictions

### Group Predictions

Group predictions should use accordions so long prediction data stays manageable on mobile.

### Playoff Prediction

Playoff prediction can be a separate section or page. It should prioritize readability over forcing the entire bracket into a tiny mobile viewport.

### Tournament Center

Tournament Center should group:

- Group standings
- Playoff bracket
- Top scorer standings
- All results

The tournament play-off bracket must not be shown as disconnected stage cards. It should render:

- Left bracket side.
- Centered final.
- Right bracket side.
- Third-place match as a separate center/near-final match.
- Slot labels such as `A1`, `B2`, `Parim 3. koht`, and `1/16-1 võitja` when teams are not known.

The public tournament bracket must be gated by confirmed results. Before group-stage qualifiers are resolved, it must not show pre-filled country names, flags, fake scores, or `Lõppenud` states from demo/mock data.

On mobile, the bracket may use a contained horizontal scroll area or a segmented view. Page-level horizontal overflow is not acceptable.

## Visual Assets

Use original assets and patterns:

- Abstract stadium lighting
- Pitch line patterns
- Scoreboard-inspired panels
- Subtle grid systems
- Team color accents where appropriate

Do not use official tournament assets.
