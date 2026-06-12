export interface NavigationCardData {
  title: string;
  description: string;
  href: string;
  accent: 'gold' | 'blue' | 'green';
}

export const navigationCards: NavigationCardData[] = [
  { title: 'Tulemused', description: 'Mängud, seisud ja ajakava', href: '/results', accent: 'blue' },
  { title: 'Edetabel', description: 'Ennustusliiga kohad ja punktid', href: '/leaderboard', accent: 'gold' },
  { title: 'Turniir', description: 'Alagrupid, play-off ja statistika', href: '/tournament', accent: 'green' }
];
