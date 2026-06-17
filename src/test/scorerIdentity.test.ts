import { describe, expect, it } from 'vitest';
import { normalizeScorerName, resolveScorerIdentity } from '../domain/scorerIdentity.js';

describe('scorer identity normalization', () => {
  it('preserves canonical scorer names while removing provider event markers', () => {
    expect(normalizeScorerName("Lionel Messi 17'")).toBe('Lionel Messi');
    expect(normalizeScorerName("K. Mbapp\u00e9 90+6'")).toBe('Kylian Mbapp\u00e9');
    expect(normalizeScorerName("Mohamed Salah 45'+2'")).toBe('Mohamed Salah');
    expect(normalizeScorerName("Breel Embolo 17' (p)")).toBe('Breel Embolo');
    expect(normalizeScorerName("D. Bobadilla 7'(OG)")).toBe('D. Bobadilla');
  });

  it('repairs known corrupted production aliases without using string-only equality', () => {
    expect(resolveScorerIdentity({ playerName: 'Livnl Msi' })).toMatchObject({
      playerId: 'lionel-messi',
      playerName: 'Lionel Messi'
    });
    expect(resolveScorerIdentity({ playerName: 'Arling Halnd' })).toMatchObject({
      playerId: 'erling-haaland',
      playerName: 'Erling Haaland'
    });
    expect(resolveScorerIdentity({ playerName: 'Kylian Mbappe' })).toMatchObject({
      playerId: 'kylian-mbappe',
      playerName: 'Kylian Mbapp\u00e9'
    });
  });

  it('keeps accented names intact after unicode normalization', () => {
    expect(normalizeScorerName("Maur\u00edcio 73'")).toBe('Maur\u00edcio');
    expect(normalizeScorerName("V. Gy\u00f6keres 59'")).toBe('Viktor Gy\u00f6keres');
    expect(normalizeScorerName("Maximiliano Ara\u00fajo 80'")).toBe('Maximiliano Ara\u00fajo');
    expect(normalizeScorerName("Leo \u00d8stig\u00e5rd 76'")).toBe('Leo \u00d8stig\u00e5rd');
  });
});
