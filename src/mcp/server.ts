#!/usr/bin/env node

// Genesis MCP Server — AI agent team builder as a service.
// Connects via stdio. Works with Claude Code, OpenCode, Cursor, VS Code, Gemini, any MCP client.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Load env from project and home
const localEnv = join(process.cwd(), '.env');
const homeEnv = join(homedir(), '.genesis', '.env');
if (existsSync(localEnv)) config({ path: localEnv });
if (existsSync(homeEnv)) config({ path: homeEnv, override: false });

import { survey } from '../core/survey.js';
import { preAnalyze } from '../core/quality.js';
import { detectDomains } from '../core/analyze.js';
import { deepAnalyze } from '../core/deep-analyze.js';
import { generateAgents, generateReviewer, generateProjectContext } from '../core/generate.js';
import { registerAgents } from '../core/register.js';
import { createProvider } from '../llm/factory.js';

const server = new McpServer(
  { name: 'genesis', version: '0.2.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool: survey_project ───

server.tool(
  'survey_project',
  'Deep survey of a project directory. Returns language, framework, domain boundaries, file counts, dependencies, config files, and test structure.',
  { directory: z.string().describe('Path to project root') },
  async ({ directory }) => {
    const result = await survey(directory);
    const quality = await preAnalyze(directory, result.files, result.importGraph);
    return {
      content: [{ type: 'text', text: JSON.stringify({ survey: result, quality }, null, 2) }],
    };
  }
);

// ─── Tool: propose_team ───

server.tool(
  'propose_team',
  'Analyze a project and propose an AI agent team. Returns domain boundaries, agent designs, quality reports with bugs, security issues, and AI slop detected in the codebase.',
  {
    directory: z.string().describe('Path to project root'),
    provider: z.string().optional().describe('deepseek | claude | openai | auto (default: auto)'),
  },
  async ({ directory, provider = 'auto' }) => {
    const projectSurvey = await survey(directory);
    const quality = await preAnalyze(directory, projectSurvey.files, projectSurvey.importGraph);
    const llm = createProvider(provider as 'auto' | 'deepseek' | 'claude' | 'openai');
    const boundaries = await detectDomains(projectSurvey, quality, llm);

    const analyses = [];
    for (const domain of boundaries.domains) {
      const analysis = await deepAnalyze(directory, domain, quality, projectSurvey.language, projectSurvey.importGraph, llm);
      analyses.push({
        agentName: analysis.agentName,
        domain: domain,
        temperature: analysis.temperature,
        bugCount: analysis.qualityReport.bugs.length,
        securityCount: analysis.qualityReport.securityIssues.length,
        slopCount: analysis.qualityReport.aiSlopConfirmed.length,
        testGaps: analysis.qualityReport.testGaps.length,
        summary: analysis.qualityReport.summary,
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ project: projectSurvey.name, language: projectSurvey.language, framework: projectSurvey.framework, domains: boundaries, agents: analyses }, null, 2),
      }],
    };
  }
);

// ─── Tool: build_team ───

server.tool(
  'build_team',
  'Build the AI agent team. Creates agent .md files in ./prompts/, writes PROJECT-CONTEXT.md, and registers agents in opencode.json.',
  {
    directory: z.string().describe('Path to project root'),
    provider: z.string().optional().describe('deepseek | claude | openai | auto (default: auto)'),
  },
  async ({ directory, provider = 'auto' }) => {
    const projectSurvey = await survey(directory);
    const quality = await preAnalyze(directory, projectSurvey.files, projectSurvey.importGraph);
    const llm = createProvider(provider as 'auto' | 'deepseek' | 'claude' | 'openai');
    const boundaries = await detectDomains(projectSurvey, quality, llm);

    const analyses = [];
    const allBugs: string[] = [];
    let bugSummary = '';

    for (const domain of boundaries.domains) {
      const analysis = await deepAnalyze(directory, domain, quality, projectSurvey.language, projectSurvey.importGraph, llm);
      analyses.push(analysis);
      for (const bug of analysis.qualityReport.bugs) {
        allBugs.push(`${bug.path}:${bug.line} — ${bug.detail}`);
      }
      bugSummary += `${analysis.qualityReport.summary}\n`;
    }

    const proposal = {
      agents: analyses.map((a) => ({ name: a.agentName, domainAnalysis: a })),
      narrative: `${projectSurvey.name} is a ${projectSurvey.language} project.`,
      warnings: [],
      estimatedTokens: 0,
    };

    const { configPath, registrations, status } = await registerAgents(directory, analyses, projectSurvey.name);
    const agentPaths = await generateAgents(directory, analyses, projectSurvey.name);
    const reviewerPath = await generateReviewer(directory, projectSurvey.name, allBugs, bugSummary);
    const contextPath = await generateProjectContext(directory, proposal, projectSurvey);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status,
          agentCount: agentPaths.length,
          agents: registrations.map((r) => ({ name: r.name, path: r.promptPath })),
          reviewer: reviewerPath,
          context: contextPath,
          config: configPath,
          bugsFound: allBugs.length,
        }, null, 2),
      }],
    };
  }
);

// ─── Start ───

const transport = new StdioServerTransport();

process.stderr.write(`Genesis MCP server v0.2.0 starting...\n`);

await server.connect(transport);

process.stderr.write(`Genesis MCP server ready. Available tools: survey_project, propose_team, build_team\n`);
