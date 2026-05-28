export { survey } from './core/survey.js';
export { preAnalyze } from './core/quality.js';
export { detectDomains } from './core/analyze.js';
export { deepAnalyze } from './core/deep-analyze.js';
export { generateAgents, generateReviewer, generateProjectContext } from './core/generate.js';
export { registerAgents } from './core/register.js';
export { buildTeam } from './cli/main.js';

export type {
  ProjectSurvey,
  QualityReport,
  DomainBoundaries,
  DomainAnalysis,
  TeamProposal,
  BuildResult,
  GenesisOptions,
  ProviderType,
} from './types.js';
