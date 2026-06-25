export type PredictionLeagueInsightTone = 'gold' | 'purple' | 'green' | 'red' | 'blue';

export interface PredictionLeagueInsightCard {
  id: string;
  title: string;
  badge: string;
  tone: PredictionLeagueInsightTone;
  value: string;
  subject: string;
  detail: string;
  unavailable?: boolean;
}

export interface PredictionLeagueInsightsSection {
  title: string;
  eyebrow: string;
  cards: PredictionLeagueInsightCard[];
}

export interface PredictionLeagueInsights {
  statistics: PredictionLeagueInsightsSection;
  records: PredictionLeagueInsightsSection;
}
