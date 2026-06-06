import type { ResultProviderConfig } from './resultProviderConfig.js';

export interface ResultAgentRunPermission {
  allowed: boolean;
  dryRun: boolean;
  status: number;
  error?: string;
}

export interface ManualResultPermission {
  allowed: boolean;
  status: number;
  error?: string;
}

export function getResultAgentRunPermission(input: {
  config: ResultProviderConfig;
  dryRunRequested?: boolean;
  providedSecret?: string;
}): ResultAgentRunPermission {
  const dryRun = input.dryRunRequested === true || input.config.writeMode === 'dry-run';
  if (dryRun) return { allowed: true, dryRun, status: 200 };

  if (input.config.writeMode !== 'live') return { allowed: true, dryRun: false, status: 200 };

  if (!input.config.agentSecret) {
    return {
      allowed: false,
      dryRun: false,
      status: 403,
      error: 'RESULTS_AGENT_SECRET is required for live result-agent writes.'
    };
  }

  if (input.providedSecret !== input.config.agentSecret) {
    return {
      allowed: false,
      dryRun: false,
      status: 403,
      error: 'Invalid results-agent secret.'
    };
  }

  return { allowed: true, dryRun: false, status: 200 };
}

export function getManualResultPermission(input: {
  config: ResultProviderConfig;
  providedSecret?: string;
}): ManualResultPermission {
  if (!input.config.agentSecret) {
    return {
      allowed: false,
      status: 403,
      error: 'RESULTS_AGENT_SECRET is required for manual result confirmation.'
    };
  }

  if (input.providedSecret !== input.config.agentSecret) {
    return {
      allowed: false,
      status: 403,
      error: 'Invalid results-agent secret.'
    };
  }

  return { allowed: true, status: 200 };
}
