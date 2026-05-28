// ─── Project Survey ───

export interface ProjectSurvey {
  name: string;
  language: string;
  framework?: string;
  packageManager: string;
  directories: DirectoryInfo[];
  entryPoints: string[];
  dependencies: Dependency[];
  configFiles: ConfigFile[];
  testStructure?: TestInfo;
  deployArtifacts: DeployInfo[];
  importGraph: ImportEdge[];
  files: string[];
}

export interface DirectoryInfo {
  path: string;
  fileCount: number;
  files: string[];
  subdirectories: DirectoryInfo[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
}

export interface ConfigFile {
  path: string;
  type: 'env' | 'docker' | 'ci' | 'deploy' | 'lint' | 'format' | 'other';
}

export interface TestInfo {
  framework: string;
  directory: string;
  totalTests: number;
  passingTests?: number;
  files: string[];
}

export interface DeployInfo {
  path: string;
  type: 'dockerfile' | 'docker-compose' | 'kubernetes' | 'render' | 'vercel' | 'netlify' | 'other';
}

export interface ImportEdge {
  from: string;
  to: string;
  type: 'direct' | 'dynamic' | 'reexport';
}

// ─── Quality Report ───

export interface QualityReport {
  longFiles: FileFlag[];
  highComplexity: FileFlag[];
  aiSlop: FileFlag[];
  hardcodedSecrets: FileFlag[];
  circularImports: CycleInfo[];
  missingErrorHandling: FileFlag[];
  untestedFiles: string[];
  deadImports: FileFlag[];
}

export interface FileFlag {
  path: string;
  line?: number;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'crash';
}

export interface CycleInfo {
  files: string[];
  detail: string;
}

// ─── Domain Boundaries ───

export interface DomainBoundary {
  name: string;
  paths: string[];
  fileCount: number;
  flags: string[];
}

export interface MergedDomain {
  path: string;
  into: string;
  reason: string;
}

export interface DomainBoundaries {
  domains: DomainBoundary[];
  merged: MergedDomain[];
}

// ─── Domain Analysis (Deep) ───

export interface DomainAnalysis {
  agentName: string;
  domain: DomainBoundary;
  temperature: number;
  permissions: PermissionSet;
  promptContent: string;
  qualityReport: DomainQualityReport;
}

export interface DomainQualityReport {
  bugs: FileFlag[];
  dataFlowIssues: FileFlag[];
  aiSlopConfirmed: FileFlag[];
  qualityIssues: FileFlag[];
  securityIssues: FileFlag[];
  testGaps: string[];
  summary: string;
}

export interface PermissionSet {
  allow: Record<string, string>;   // glob → "allow"
  ask: Record<string, string>;     // glob → "ask"
  deny: Record<string, string>;    // glob → "deny"
}

// ─── Team Proposal ───

export interface TeamProposal {
  agents: ProposedAgent[];
  narrative: string;
  warnings: string[];
  estimatedTokens: number;
}

export interface ProposedAgent {
  name: string;
  domainAnalysis: DomainAnalysis;
}

// ─── Build Result ───

export interface BuildResult {
  status: 'created' | 'merged' | 'unchanged' | 'rejected';
  agents: AgentRegistration[];
  contextPath: string;
  configPath: string;
  warnings: string[];
}

export interface AgentRegistration {
  name: string;
  promptPath: string;
  permissions: PermissionSet;
  temperature: number;
}

// ─── LLM Provider ───

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export type ProviderType = 'deepseek' | 'claude' | 'openai' | 'opencode' | 'auto';

export interface GenesisOptions {
  directory: string;
  provider?: ProviderType;
  yes?: boolean;
  dryRun?: boolean;
  output?: 'files' | 'json';
}
