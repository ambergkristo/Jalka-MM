import { db } from '../server/db.js';
import { resetSimulationState } from '../server/results/matchdaySimulation.js';

await resetSimulationState(db, { seedSchedule: true });

console.log(JSON.stringify({
  status: 'ok',
  message: 'Simulation state reset. Confirmed results, leaderboard rows, group standings, top scorers, and result-agent runs were cleared.'
}, null, 2));

await db.close();
