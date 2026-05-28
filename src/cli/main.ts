import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Load .env from genesis project directory and from home
const localEnv = join(process.cwd(), '.env');
const homeEnv = join(homedir(), '.genesis', '.env');

if (existsSync(localEnv)) config({ path: localEnv });
if (existsSync(homeEnv)) config({ path: homeEnv, override: false });

import { Command } from 'commander';
import { resolve } from 'node:path';
import { survey } from '../core/survey.js';
import { preAnalyze } from '../core/quality.js';
import { detectDomains } from '../core/analyze.js';
import { deepAnalyze } from '../core/deep-analyze.js';
import { generateAgents, generateReviewer, generateProjectContext } from '../core/generate.js';
import { registerAgents } from '../core/register.js';
import { createProvider } from '../llm/factory.js';
import { displaySurvey, displayApproval, displayBuildResult, spinner, confirm } from './ui.js';
import type { GenesisOptions, DomainAnalysis, TeamProposal } from '../types.js';

const program = new Command();

program
  .name('genesis')
  .description('Every project begins here. Build your AI engineering team from any codebase.')
  .version('0.1.0')
  .argument('[directory]', 'Project directory', '.')
  .option('-y, --yes', 'Skip approval prompt')
  .option('-p, --provider <provider>', 'LLM provider (deepseek, claude, openai, auto)', 'auto')
  .option('--dry-run', 'Show what would be built without writing files')
  .option('--json', 'Output results as JSON')
  .action(async (dir: string, options: { yes?: boolean; provider?: string; dryRun?: boolean; json?: boolean }) => {
    try {
      const targetDir = resolve(dir);

      // Phase 1: Survey
      const s = spinner('Surveying project...');
      const projectSurvey = await survey(targetDir);
      s.succeed('Survey complete');

      if (!options.json) displaySurvey(targetDir, projectSurvey);

      // Phase 2: Pre-analyze
      const preSpinner = spinner('Pre-analyzing code quality...');
      const allFiles = projectSurvey.files;
      const quality = await preAnalyze(targetDir, allFiles, projectSurvey.importGraph);
      preSpinner.succeed('Pre-analysis complete');

      // Phase 3: Connect LLM
      const providerSpinner = spinner('Connecting to LLM...');
      const provider = createProvider(options.provider as 'auto' | 'deepseek' | 'claude' | 'openai');
      providerSpinner.succeed('Connected');

      // Phase 4: Domain detection (Phase A LLM call)
      const domainSpinner = spinner('Identifying domain boundaries...');
      const boundaries = await detectDomains(projectSurvey, quality, provider);
      domainSpinner.succeed(`${boundaries.domains.length} domains identified`);

      // Phase 5: Deep analysis per domain (Phase B LLM calls)
      const analyses: DomainAnalysis[] = [];
      const allBugs: string[] = [];
      let bugSummary = '';

      for (const domain of boundaries.domains) {
        const deepSpinner = spinner(`Analyzing ${domain.name} (${domain.fileCount} files)...`);
        const analysis = await deepAnalyze(targetDir, domain, quality, projectSurvey.language, provider);
        analyses.push(analysis);

        for (const bug of analysis.qualityReport.bugs) {
          allBugs.push(`${bug.path}:${bug.line} — ${bug.detail}`);
        }
        bugSummary += `${analysis.qualityReport.summary}\n`;

        deepSpinner.succeed(`${domain.name}: ${analysis.qualityReport.bugs.length} bugs found`);
      }

      // Phase 6: Proposal
      const proposal: TeamProposal = {
        agents: analyses.map((a) => ({ name: a.agentName, domainAnalysis: a })),
        narrative: generateNarrative(projectSurvey, boundaries),
        warnings: collectWarnings(projectSurvey, quality, analyses),
        estimatedTokens: 0,
      };

      if (!options.json) {
        displayApproval(projectSurvey, analyses, quality);
      }

      // Phase 7: Approval
      if (!options.yes && !options.json) {
        const approved = await confirm('Build?', true);
        if (!approved) {
          console.log('\nAborted. No files were written.');
          process.exit(0);
        }
      }

      // Phase 8: Build
      if (options.dryRun) {
        console.log('\n--- DRY RUN ---');
        for (const agent of proposal.agents) {
          console.log(`  ./prompts/${sanitizeAgentName(agent.domainAnalysis.agentName)}.md`);
        }
        console.log('  ./prompts/reviewer.md');
        console.log('  ./PROJECT-CONTEXT.md');
        console.log('  ./opencode.json');
        console.log('---');
        return;
      }

      const buildSpinner = spinner('Building agent team...');
      const { configPath, registrations, status } = await registerAgents(targetDir, analyses, projectSurvey.name);
      const agentPaths = await generateAgents(targetDir, analyses, projectSurvey.name);
      const reviewerPath = await generateReviewer(targetDir, projectSurvey.name, allBugs, bugSummary);
      const contextPath = await generateProjectContext(targetDir, proposal, projectSurvey);
      buildSpinner.succeed('Team built');

      if (options.json) {
        console.log(JSON.stringify({ agentPaths, reviewerPath, contextPath, configPath, registrations, status }, null, 2));
      } else {
        displayBuildResult({ status, agents: registrations, contextPath, configPath, warnings: proposal.warnings });
      }

    } catch (err) {
      console.error(`\nGenesis failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// Explicit async wrapper ensures Promise resolution on all platforms
const argv = process.argv;
const isDirectInvocation = argv[1]?.includes('genesis') || argv[1]?.includes('cli/main');

if (isDirectInvocation) {
  program.parseAsync(argv).catch((err) => {
    console.error(`Genesis crashed: ${err.message}`);
    process.exit(1);
  });
}

export function buildTeam(options: GenesisOptions): Promise<unknown> {
  return program.parseAsync(['node', 'genesis', options.directory, ...buildArgs(options)]);
}

function buildArgs(options: GenesisOptions): string[] {
  const args: string[] = [];
  if (options.yes) args.push('--yes');
  if (options.provider && options.provider !== 'auto') args.push('--provider', options.provider);
  if (options.dryRun) args.push('--dry-run');
  if (options.output === 'json') args.push('--json');
  return args;
}

function sanitizeAgentName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return normalized || 'agent';
}

function generateNarrative(
  survey: { name: string; language: string; framework?: string },
  boundaries: { domains: { name: string; fileCount: number }[]; merged: { path: string; into: string; reason: string }[] }
): string {
  const domainList = boundaries.domains.map((d) => `- ${d.name}: ${d.fileCount} files`).join('\n');
  const mergedList = boundaries.merged.map((m) => `- ${m.path} → ${m.into}: ${m.reason}`).join('\n');

  return `${survey.name} is a ${survey.language}${survey.framework ? ` (${survey.framework})` : ''} project.

## Domain Structure
${domainList}

${boundaries.merged.length > 0 ? `## Merged Domains\n${mergedList}` : ''}`;
}

function collectWarnings(
  survey: { testStructure?: { passingTests?: number; totalTests: number } },
  quality: { hardcodedSecrets: { path: string }[]; longFiles: { path: string }[]; circularImports: { detail: string }[] },
  analyses: DomainAnalysis[]
): string[] {
  const warnings: string[] = [];

  if (survey.testStructure?.passingTests !== undefined) {
    const failCount = survey.testStructure.totalTests - survey.testStructure.passingTests;
    if (failCount > 0) warnings.push(`${failCount} of ${survey.testStructure.totalTests} tests failing`);
  }

  if (quality.hardcodedSecrets.length > 0) {
    warnings.push(`${quality.hardcodedSecrets.length} hardcoded secrets detected`);
  }

  if (quality.longFiles.length > 0) {
    warnings.push(`${quality.longFiles.length} files exceed 200 lines`);
  }

  for (const c of quality.circularImports) {
    warnings.push(`Circular import: ${c.detail}`);
  }

  for (const a of analyses) {
    if (a.qualityReport.aiSlopConfirmed.length > 0) {
      warnings.push(`${a.agentName}: ${a.qualityReport.aiSlopConfirmed.length} AI slop patterns`);
    }
  }

  return warnings;
}

export { program };
