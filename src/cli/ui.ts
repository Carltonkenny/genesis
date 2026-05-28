import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { createInterface } from 'node:readline';
import type { ProjectSurvey, TeamProposal, BuildResult, DomainAnalysis, QualityReport } from '../types.js';

// ─── Box Drawing ───

const box = {
  tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│',
};

function boxTop(): string { return `${box.tl}${box.h.repeat(46)}${box.tr}`; }
function boxSep(): string { return `${box.v}${box.h.repeat(46)}${box.v}`; }
function boxBot(): string { return `${box.bl}${box.h.repeat(46)}${box.br}`; }
function boxLine(text: string, indent = ''): string {
  return `${box.v} ${chalk.reset(text)}${' '.repeat(Math.max(0, 44 - stripAnsi(text).length))}${box.v}`;
}
function boxLineLeft(text: string, leftPad = 2): string {
  const pad = ' '.repeat(leftPad);
  return `${box.v}${pad}${chalk.reset(text)}${' '.repeat(Math.max(0, 46 - stripAnsi(text).length - leftPad))}${box.v}`;
}
function stripAnsi(s: string): string { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

// ─── Spinner ───

interface SimpleSpinner {
  succeed: (msg: string) => void;
  fail: (msg: string) => void;
}

export function spinner(text: string): Ora | SimpleSpinner {
  if (process.stdout.isTTY) {
    return ora({ text, color: 'cyan', spinner: 'dots' }).start();
  }
  process.stdout.write(`  ${text} `);
  let ended = false;
  return {
    succeed(msg: string) { if (!ended) { console.log(`✓ ${msg}`); ended = true; } },
    fail(msg: string) { if (!ended) { console.log(`✗ ${msg}`); ended = true; } },
  };
}

// ─── Survey Display ───

export function displaySurvey(_dir: string, survey: ProjectSurvey): void {
  console.log(chalk.cyan(`\nProject: ${chalk.bold(survey.name)}`));
  console.log(`  Language   ${survey.language}${survey.framework ? ` (${survey.framework})` : ''}`);
  console.log(`  Package    ${survey.packageManager}`);
  console.log(`  Files      ${survey.files.length}`);
  if (survey.entryPoints.length > 0) {
    console.log(`  Entry      ${survey.entryPoints.join(', ')}`);
  }
  console.log();
}

// ─── Approval Display (replaces displayProposal + displayFindings) ───

export function displayApproval(
  survey: ProjectSurvey,
  analyses: DomainAnalysis[],
  quality: QualityReport,
): void {
  console.log();

  // Header box
  console.log(boxTop());
  console.log(boxLine(`  ${chalk.bold(survey.name)} · ${survey.language}${survey.framework ? ` (${survey.framework})` : ''} · ${survey.files.length} files`));
  console.log(boxLine(`  DeepSeek V3 · ~$0.002 · ${analyses.length} domain${analyses.length !== 1 ? 's' : ''}`));
  console.log(boxBot());
  console.log();

  // Dependency graph box
  if (survey.importGraph.length > 0) {
    console.log(boxTop());
    console.log(boxLine('  imports', '1'));

    // Top 10 most imported files
    const importCounts = new Map<string, number>();
    for (const edge of survey.importGraph) {
      importCounts.set(edge.to, (importCounts.get(edge.to) || 0) + 1);
      importCounts.set(edge.from, (importCounts.get(edge.from) || 0) + 1);
    }
    const topImports = [...importCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    for (const [file, count] of topImports) {
      const bar = '█'.repeat(Math.min(count, 15));
      const display = file.length > 28 ? '...' + file.slice(-25) : file;
      const bugs = analyses.flatMap((a) => a.qualityReport.bugs)
        .filter((b) => b.path === file || file.includes(b.path)).length;
      const annotation = bugs > 0 ? ` ${chalk.red('B' + bugs)}` : '';
      console.log(boxLineLeft(`  ${chalk.white(display.padEnd(28))} ${chalk.cyan(bar)} ${count}${annotation}`, 1));
    }

    if (survey.importGraph.length > 10) {
      console.log(boxLineLeft(`  ${chalk.gray(`(${survey.importGraph.length} total edges, top ${topImports.length} shown)`)}`, 1));
    }
  console.log(boxBot());
  console.log();

  // Kanban board — all findings organized by type
  const allBugs = analyses.flatMap((a) => a.qualityReport.bugs);
  const allSecurity = analyses.flatMap((a) => a.qualityReport.securityIssues);
  const totalGaps2 = analyses.reduce((s, a) => s + a.qualityReport.testGaps.length, 0);

  if (allBugs.length > 0 || allSecurity.length > 0 || totalGaps2 > 0) {
    console.log(boxTop());
    console.log(boxLine('  kanban', '1'));
    console.log(boxLine(''));

    if (allBugs.length > 0) {
      console.log(boxLineLeft(`  ${chalk.red('🐛 TO FIX')}  ${allBugs.length} bug${allBugs.length !== 1 ? 's' : ''}`, 1));
      for (const bug of allBugs.slice(0, 5)) {
        const loc = bug.line ? `L${bug.line}` : '';
        console.log(boxLineLeft(`  ${chalk.gray(loc.padEnd(5))} ${bug.detail.substring(0, 36)}`, 3));
      }
      if (allBugs.length > 5) console.log(boxLineLeft(`  ${chalk.gray(`... and ${allBugs.length - 5} more`)}`, 3));
    }

    if (allSecurity.length > 0) {
      console.log(boxLineLeft(`  ${chalk.yellow('🔒 SECURITY')}  ${allSecurity.length} issue${allSecurity.length !== 1 ? 's' : ''}`, 1));
      for (const sec of allSecurity.slice(0, 3)) {
        console.log(boxLineLeft(`  ${sec.detail.substring(0, 38)}`, 3));
      }
    }

    const testGaps2 = analyses.flatMap((a) => a.qualityReport.testGaps);
    if (testGaps2.length > 0) {
      console.log(boxLineLeft(`  ${chalk.gray('🧪 TEST GAPS')}  ${totalGaps2} untested`, 1));
    }

    console.log(boxBot());
    console.log();
  }
  }

  // Files box — tree with findings
  console.log(boxTop());
    console.log(boxLine('  files', '1'));

  for (const analysis of analyses) {
    const da = analysis;
    for (const file of da.domain.paths) {
      const filePath = file.includes('/') || file.includes('\\') ? file : file;
      const domainFiles = da.qualityReport.bugs
        .filter(b => b.path === filePath || b.path.includes(filePath));

      const displayPath = filePath.length > 36 ? '...' + filePath.slice(-33) : filePath;
      const lineCount = getFileLineCount(filePath, survey);
      console.log(boxLineLeft(`  ${chalk.white(displayPath.padEnd(40))}${chalk.gray(lineCount > 0 ? `${lineCount} lines` : '')}`, 1));

      // Bugs on this file
      for (const bug of da.qualityReport.bugs.filter(b => b.path === filePath || filePath.includes(b.path))) {
        const line = bug.line ? `L${bug.line}` : '';
        console.log(boxLineLeft(`  ${chalk.red('🐛')} ${chalk.gray(line.padEnd(5))}${chalk.red(bug.detail)}`, 3));
      }

      // Security issues on this file
      for (const sec of da.qualityReport.securityIssues.filter(s => s.path === filePath || filePath.includes(s.path))) {
        console.log(boxLineLeft(`  ${chalk.yellow('🔒')}       ${chalk.yellow(sec.detail)}`, 3));
      }

      // Test gaps
      for (const gap of da.qualityReport.testGaps) {
        if (gap === filePath || filePath.includes(gap)) {
          console.log(boxLineLeft(`  ${chalk.gray('🧪')}       ${chalk.gray('No test coverage')}`, 3));
        }
      }

      // AI slop
      for (const slop of da.qualityReport.aiSlopConfirmed.filter(s => s.path === filePath || filePath.includes(s.path))) {
        console.log(boxLineLeft(`  ${chalk.magenta('🤖')}       ${chalk.magenta(slop.detail)}`, 3));
      }
    }
  }

  // Summary line
  const totalBugs = analyses.reduce((s, a) => s + a.qualityReport.bugs.length, 0);
  const totalSecrets = quality.hardcodedSecrets.length + analyses.reduce((s, a) => s + a.qualityReport.securityIssues.length, 0);
  const totalGaps = analyses.reduce((s, a) => s + a.qualityReport.testGaps.length, 0);
  const totalSlop = analyses.reduce((s, a) => s + a.qualityReport.aiSlopConfirmed.length, 0);
  const parts: string[] = [];
  if (totalBugs > 0) parts.push(chalk.red(`${totalBugs} bug${totalBugs !== 1 ? 's' : ''}`));
  if (totalSecrets > 0) parts.push(chalk.yellow(`${totalSecrets} secret${totalSecrets !== 1 ? 's' : ''}`));
  if (totalGaps > 0) parts.push(chalk.gray(`${totalGaps} untested`));
  if (totalSlop > 0) parts.push(chalk.magenta(`${totalSlop} AI slop`));

  if (parts.length > 0) {
    console.log(boxLineLeft(`  ${parts.join(' · ')}`, 1));
  }

  console.log(boxBot());
  console.log();

  // Team box
  console.log(boxTop());
    console.log(boxLine('  team', '1'));
  console.log(boxLine(''));

  for (const analysis of analyses) {
    const da = analysis;
    console.log(boxLineLeft(`  ${chalk.bold(da.agentName)}`, 1));
    console.log(boxLineLeft(`  ${chalk.gray('domain')}  ${da.domain.paths.join(', ')}`, 3));
    console.log(boxLineLeft(`  ${chalk.gray('temp')}    ${da.temperature}`, 3));
    console.log(boxLine(''));
  }

  // Reviewer
  console.log(boxLineLeft(`  ${chalk.bold('reviewer')}`, 1));
  console.log(boxLineLeft(`  ${chalk.gray('all files · read-only · 0.1')}`, 3));

  console.log(boxBot());

  // Output paths
  console.log(chalk.gray(`\n  writes to  ./prompts/  ./PROJECT-CONTEXT.md  ./opencode.json\n`));
}

// ─── Build Result ───

export function displayBuildResult(result: BuildResult): void {
  console.log(chalk.green('\nTeam built.\n'));
  console.log(chalk.bold('Created:'));
  for (const agent of result.agents) {
    console.log(chalk.gray(`  ./prompts/${agent.name}.md`));
  }
  console.log(chalk.gray(`  ${result.contextPath}`));
  console.log(chalk.gray(`  ${result.configPath}`));
  console.log();
}

// ─── Confirm ───

export function confirm(question: string, defaultYes = true): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';

  return new Promise((resolve) => {
    rl.question(`${question} ${suffix} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) return resolve(defaultYes);
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

// ─── Helpers ───

function getFileLineCount(filePath: string, survey: ProjectSurvey): number {
  // Simple lookup — we don't track lines in the survey, return 0
  return 0;
}
