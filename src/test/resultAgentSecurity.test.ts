import { describe, expect, it } from 'vitest';
import { getResultAgentRunPermission } from '../server/results/resultAgentSecurity.js';
import type { ResultProviderConfig } from '../server/results/resultProviderConfig.js';

const baseConfig: ResultProviderConfig = {
  provider: 'mock',
  writeMode: 'mock'
};

describe('result agent run permission', () => {
  it('allows mock mode without a secret', () => {
    expect(getResultAgentRunPermission({ config: baseConfig })).toMatchObject({ allowed: true, dryRun: false, status: 200 });
  });

  it('allows dry-run without live write secret', () => {
    expect(getResultAgentRunPermission({ config: { ...baseConfig, provider: 'sportmonks', writeMode: 'dry-run' } })).toMatchObject({
      allowed: true,
      dryRun: true,
      status: 200
    });
  });

  it('blocks live write mode without configured secret', () => {
    expect(getResultAgentRunPermission({ config: { ...baseConfig, provider: 'sportmonks', writeMode: 'live' } })).toMatchObject({
      allowed: false,
      status: 403,
      error: 'RESULTS_AGENT_SECRET is required for live result-agent writes.'
    });
  });

  it('blocks live write mode with invalid request secret', () => {
    expect(getResultAgentRunPermission({ config: { ...baseConfig, provider: 'sportmonks', writeMode: 'live', agentSecret: 'secret' }, providedSecret: 'wrong' })).toMatchObject({
      allowed: false,
      status: 403,
      error: 'Invalid results-agent secret.'
    });
  });

  it('allows live write mode with matching request secret', () => {
    expect(getResultAgentRunPermission({ config: { ...baseConfig, provider: 'sportmonks', writeMode: 'live', agentSecret: 'secret' }, providedSecret: 'secret' })).toMatchObject({
      allowed: true,
      dryRun: false,
      status: 200
    });
  });
});
