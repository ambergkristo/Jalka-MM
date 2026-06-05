import { InMemoryResultRepository } from './inMemoryResultRepository.js';
import { MockResultProvider } from './mockResultProvider.js';
import { getResultAgentStatus, runResultUpdateCycle } from './resultAgent.js';

const repository = new InMemoryResultRepository();
const provider = new MockResultProvider();

export function getResultsAgentStatus(now = new Date()) {
  return getResultAgentStatus({ repository, provider, now });
}

export function runResultsAgentCycle(now = new Date()) {
  return runResultUpdateCycle({ repository, provider, now });
}
