import type { Team } from './types.js';

const GROUPS = Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index));

const SEEDED_TEAMS = [
  ['ARG', 'Argentina', '🇦🇷'], ['BRA', 'Brazil', '🇧🇷'], ['CAN', 'Canada', '🇨🇦'], ['MEX', 'Mexico', '🇲🇽'],
  ['USA', 'United States', '🇺🇸'], ['ESP', 'Spain', '🇪🇸'], ['FRA', 'France', '🇫🇷'], ['ENG', 'England', '🏴'],
  ['GER', 'Germany', '🇩🇪'], ['ITA', 'Italy', '🇮🇹'], ['POR', 'Portugal', '🇵🇹'], ['NED', 'Netherlands', '🇳🇱'],
  ['BEL', 'Belgium', '🇧🇪'], ['CRO', 'Croatia', '🇭🇷'], ['SUI', 'Switzerland', '🇨🇭'], ['DEN', 'Denmark', '🇩🇰'],
  ['URU', 'Uruguay', '🇺🇾'], ['COL', 'Colombia', '🇨🇴'], ['CHI', 'Chile', '🇨🇱'], ['ECU', 'Ecuador', '🇪🇨'],
  ['JPN', 'Japan', '🇯🇵'], ['KOR', 'South Korea', '🇰🇷'], ['AUS', 'Australia', '🇦🇺'], ['IRN', 'Iran', '🇮🇷'],
  ['MAR', 'Morocco', '🇲🇦'], ['SEN', 'Senegal', '🇸🇳'], ['NGA', 'Nigeria', '🇳🇬'], ['EGY', 'Egypt', '🇪🇬'],
  ['GHA', 'Ghana', '🇬🇭'], ['CMR', 'Cameroon', '🇨🇲'], ['RSA', 'South Africa', '🇿🇦'], ['TUN', 'Tunisia', '🇹🇳'],
  ['POL', 'Poland', '🇵🇱'], ['SWE', 'Sweden', '🇸🇪'], ['NOR', 'Norway', '🇳🇴'], ['UKR', 'Ukraine', '🇺🇦'],
  ['AUT', 'Austria', '🇦🇹'], ['CZE', 'Czechia', '🇨🇿'], ['SRB', 'Serbia', '🇷🇸'], ['TUR', 'Turkiye', '🇹🇷'],
  ['QAT', 'Qatar', '🇶🇦'], ['KSA', 'Saudi Arabia', '🇸🇦'], ['UAE', 'United Arab Emirates', '🇦🇪'], ['IRQ', 'Iraq', '🇮🇶'],
  ['CRC', 'Costa Rica', '🇨🇷'], ['PAN', 'Panama', '🇵🇦'], ['JAM', 'Jamaica', '🇯🇲'], ['NZL', 'New Zealand', '🇳🇿']
] as const;

export function createSeededTeams(): Team[] {
  return SEEDED_TEAMS.map(([code, name, flag], index) => ({
    id: code,
    code,
    name,
    flag,
    groupId: GROUPS[Math.floor(index / 4)]
  }));
}
