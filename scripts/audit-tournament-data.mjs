import { createAuditReport, readTournamentData } from './tournament-data-lib.mjs';

const report = createAuditReport(readTournamentData());

console.log('Tournament data audit');
console.log(`verificationStatus: ${report.verificationStatus}`);
console.log(`sourceName: ${report.sourceName}`);
console.log(`sourceReference: ${report.sourceReference}`);
console.log(`sourceRetrievedAt: ${report.sourceRetrievedAt}`);
console.log(`teamCount: ${report.teamCount}`);
console.log(`groupCount: ${report.groupCount}`);
console.log(`matchCount: ${report.matchCount}`);
console.log(`groupStageMatchCount: ${report.groupStageMatchCount}`);
console.log(`knockoutMatchCount: ${report.knockoutMatchCount}`);
console.log(`unresolvedTeamSlots: ${report.unresolvedTeamSlots}`);
console.log(`unresolvedFixtureDates: ${report.unresolvedFixtureDates}`);
console.log(`unresolvedKickoffTimes: ${report.unresolvedKickoffTimes}`);
console.log(`verifiedGroupStageKickoffTimes: ${report.verifiedGroupStageKickoffTimes}`);
console.log(`unresolvedGroupStageKickoffMatchIds: ${report.unresolvedGroupStageKickoffMatchIds.length ? report.unresolvedGroupStageKickoffMatchIds.join(', ') : 'none'}`);
console.log(`unresolvedKnockoutSlots: ${report.unresolvedKnockoutSlots}`);
console.log(`riskLevel: ${report.riskLevel}`);
console.log(`validation: ${report.valid ? 'passes' : 'fails'}`);
for (const warning of report.warnings) console.log(`warning: ${warning}`);
for (const error of report.errors) console.log(`error: ${error}`);

if (!report.valid) process.exit(1);
