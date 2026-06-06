import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matchRoute } from '../client/App.js';
import { Navigation } from '../client/components/Navigation.js';
import { OperatorPage } from '../client/pages/OperatorPage.js';

describe('operator page', () => {
  it('renders the protected operator unlock screen and route', () => {
    expect(matchRoute('/operator')).toEqual({ name: 'operator' });

    const markup = renderToStaticMarkup(<OperatorPage />);
    expect(markup).toContain('Operaatori ligipääs');
    expect(markup).toContain('Kinnitatud tulemus arvutab edetabeli uuesti.');
    expect(markup).toContain('Kasuta ainult lõpliku tulemuse kinnitamiseks.');
  });

  it('does not expose the operator route in public navigation', () => {
    const markup = renderToStaticMarkup(<Navigation pathname="/" />);
    expect(markup).not.toContain('/operator');
    expect(markup).not.toContain('Operaator');
  });
});
