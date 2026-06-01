import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeletePlayerDialog, ParticipantManagement } from '../client/components/AdminPanel.js';

const rows = [
  {
    id: 'p1',
    display_name: 'Mari Mets',
    first_name: 'Mari',
    last_name: 'Mets',
    status: 'pending',
    contact: 'mari@example.test',
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-02T10:00:00.000Z',
    final_submitted_at: null,
    is_final: 0,
    prediction_count: 83,
    has_bonus_prediction: 0,
    duplicate_name_count: 1
  },
  {
    id: 'p2',
    display_name: 'Jaan Tamm',
    first_name: 'Jaan',
    last_name: 'Tamm',
    status: 'approved',
    contact: null,
    created_at: '2026-01-03T10:00:00.000Z',
    updated_at: '2026-01-04T10:00:00.000Z',
    final_submitted_at: '2026-01-05T10:00:00.000Z',
    is_final: 1,
    prediction_count: 104,
    has_bonus_prediction: 1,
    duplicate_name_count: 1
  },
  {
    id: 'p3',
    display_name: 'Argo',
    first_name: null,
    last_name: null,
    legacy_name_only: 1,
    status: 'disabled',
    contact: null,
    created_at: '2026-01-06T10:00:00.000Z',
    updated_at: null,
    final_submitted_at: null,
    is_final: 0,
    prediction_count: 0,
    has_bonus_prediction: 0,
    duplicate_name_count: 1
  }
] as any;

describe('admin participant management UI', () => {
  it('renders grouped participant sections with counts and complete action labels', () => {
    const html = renderToStaticMarkup(<ParticipantManagement rows={rows} onStatus={() => undefined} onDeleteStart={() => undefined} />);
    expect(html).toContain('Ootel (1)');
    expect(html).toContain('Kinnitatud (1)');
    expect(html).toContain('Keelatud (1)');
    expect(html).toContain('Kinnita osaleja');
    expect(html).toContain('Eemalda testkasutaja');
    expect(html).toContain('Mängud: 104/104');
    expect(html).toContain('Boonused: täidetud');
  });

  it('marks legacy participant records clearly', () => {
    const html = renderToStaticMarkup(<ParticipantManagement rows={rows} onStatus={() => undefined} onDeleteStart={() => undefined} />);
    expect(html).toContain('Vana testkirje');
  });

  it('keeps delete confirmation disabled until the exact display name is entered', () => {
    const html = renderToStaticMarkup(<DeletePlayerDialog row={rows[0]} value="Mari" onChange={() => undefined} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('Kinnita kustutamine');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Mari Mets');
  });
});
