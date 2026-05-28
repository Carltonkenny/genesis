#!/usr/bin/env npx tsx
import { createProvider } from '../src/llm/factory.js';
import { survey } from '../src/core/survey.js';
import { preAnalyze } from '../src/core/quality.js';
import { detectDomains } from '../src/core/analyze.js';
import { deepAnalyze } from '../src/core/deep-analyze.js';
import { generateAgents, generateReviewer, generateProjectContext } from '../src/core/generate.js';
import { registerAgents } from '../src/core/register.js';

const TARGET = process.argv[2] || 'tests/fixtures/small';

async function main() {
  console.log('=== GENESIS PIPELINE TEST ===\n');
  console.log('Target:', TARGET);

  // Step 1: Survey
  console.log('\n--- Phase 1: Survey ---');
  const s = await survey(TARGET);
  console.log(`Language: ${s.language} (${s.framework || 'none'})`);
  console.log(`Files: ${s.files.length}`);
  console.log(`Entry points: ${s.entryPoints.join(', ')}`);

  // Step 2: Pre-analyze
  console.log('\n--- Phase 2: Pre-Analyze ---');
  const quality = await preAnalyze(TARGET, s.files, s.importGraph);
  console.log(`  Long files: ${quality.longFiles.length}`);
  console.log(`  High complexity: ${quality.highComplexity.length}`);
  console.log(`  AI slop: ${quality.aiSlop.length}`);
  console.log(`  Hardcoded secrets: ${quality.hardcodedSecrets.length}`);
  console.log(`  Circular imports: ${quality.circularImports.length}`);

  // Step 3: LLM Provider
  console.log('\n--- Phase 3: LLM Connect ---');
  const provider = createProvider('deepseek');
  console.log('Provider: DeepSeek connected');

  // Step 4: Phase A - Domain Detection
  console.log('\n--- Phase 4: Domain Detection ---');
  const boundaries = await detectDomains(s, quality, provider);
  console.log(`Domains found: ${boundaries.domains.length}`);
  for (const d of boundaries.domains) {
    console.log(`  ${d.name}: ${d.paths.join(', ')} (${d.fileCount} files)`);
  }
  if (boundaries.merged.length > 0) {
    console.log('Merged:');
    for (const m of boundaries.merged) {
      console.log(`  ${m.path} → ${m.into}: ${m.reason}`);
    }
  }

  // Step 5: Phase B - Deep Analysis per domain
  console.log('\n--- Phase 5: Deep Analysis ---');
  const analyses = [];
  const allBugs: string[] = [];
  let bugSummary = '';

  for (const domain of boundaries.domains) {
    console.log(`\n  Analyzing ${domain.name} (${domain.fileCount} files)...`);
    const analysis = await deepAnalyze(TARGET, domain, quality, s.language, s.importGraph, provider);
    console.log(`  Agent: ${analysis.agentName}`);
    console.log(`  Temperature: ${analysis.temperature}`);
    console.log(`  Bugs found: ${analysis.qualityReport.bugs.length}`);
    if (analysis.qualityReport.bugs.length > 0) {
      for (const bug of analysis.qualityReport.bugs) {
        console.log(`    🐛 ${bug.path}:${bug.line} — ${bug.detail}`);
      }
    }
    console.log(`  Security issues: ${analysis.qualityReport.securityIssues.length}`);
    console.log(`  AI slop: ${analysis.qualityReport.aiSlopConfirmed.length}`);
    console.log(`  Test gaps: ${analysis.qualityReport.testGaps.length}`);
    console.log(`  Prompt length: ${analysis.promptContent.length} chars`);
    
    if (analysis.promptContent.length > 0) {
      console.log(`  Prompt preview: ${analysis.promptContent.substring(0, 120)}...`);
    }
    
    analyses.push(analysis);
    for (const bug of analysis.qualityReport.bugs) {
      allBugs.push(`${bug.path}:${bug.line} — ${bug.detail}`);
    }
    bugSummary += analysis.qualityReport.summary + '\n';
  }

  // Step 6: Generate files
  console.log('\n--- Phase 6: Generate Files ---');
  const agentPaths = await generateAgents(TARGET, analyses, s.name);
  console.log(`Agents written: ${agentPaths.length}`);
  for (const p of agentPaths) {
    console.log(`  ${p}`);
  }

  const reviewerPath = await generateReviewer(TARGET, s.name, allBugs, bugSummary);
  console.log(`Reviewer: ${reviewerPath}`);

  const proposal = {
    agents: analyses.map(a => ({ name: a.agentName, domainAnalysis: a })),
    narrative: `${s.name} is a ${s.language} project.`,
    warnings: [],
    estimatedTokens: 0,
  };
  const contextPath = await generateProjectContext(TARGET, proposal, s);
  console.log(`Project context: ${contextPath}`);

  // Step 7: Register
  console.log('\n--- Phase 7: Register ---');
  const { configPath, registrations, status } = await registerAgents(TARGET, analyses, s.name);
  console.log(`Config: ${configPath} (${status})`);
  console.log(`Registered: ${registrations.length} agents`);
  for (const r of registrations) {
    console.log(`  ${r.name} → ${r.promptPath}`);
  }

  console.log('\n=== PIPELINE COMPLETE ===');
  console.log(`Generated ${agentPaths.length} agents + 1 reviewer`);
  console.log(`Found ${allBugs.length} bugs`);
  console.log(`Files written to ${TARGET}/prompts/`);
}

main().catch(e => {
  console.error('PIPELINE FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
