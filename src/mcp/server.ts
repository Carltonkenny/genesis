import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { survey } from '../core/survey.js';
import { preAnalyze } from '../core/quality.js';
import { detectDomains } from '../core/analyze.js';
import { deepAnalyze } from '../core/deep-analyze.js';
import { generateAgents, generateReviewer, generateProjectContext } from '../core/generate.js';
import { registerAgents } from '../core/register.js';
import { createProvider } from '../llm/factory.js';

const server = new Server(
  { name: 'genesis', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'survey_project',
      description: 'Deep survey of a project directory. Returns language, framework, domain boundaries, file counts, dependencies, config files, and test structure.',
      inputSchema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Path to project root' },
        },
        required: ['directory'],
      },
    },
    {
      name: 'propose_team',
      description: 'Analyze a project survey and propose an agent team with reasoning for each agent.',
      inputSchema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Path to project root' },
          provider: { type: 'string', description: 'deepseek | claude | openai | auto' },
        },
        required: ['directory'],
      },
    },
    {
      name: 'build_team',
      description: 'Creates agent .md files, PROJECT-CONTEXT.md, and updates opencode.json based on an approved team proposal.',
      inputSchema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Target project directory' },
          provider: { type: 'string', description: 'deepseek | claude | openai | auto' },
        },
        required: ['directory'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const dir = (args as Record<string, unknown>).directory as string;

  try {
    switch (name) {
      case 'survey_project': {
        const result = await survey(dir);
        const files = result.directories.flatMap((d) => collectMCPFiles(d));
        const quality = await preAnalyze(dir, files, result.importGraph);
        return { content: [{ type: 'text', text: JSON.stringify({ survey: result, quality }, null, 2) }] };
      }

      case 'propose_team': {
        const providerType = ((args as Record<string, unknown>).provider as string) || 'auto';
        const projectSurvey = await survey(dir);
        const files = projectSurvey.directories.flatMap((d) => collectMCPFiles(d));
        const quality = await preAnalyze(dir, files, projectSurvey.importGraph);
        const provider = createProvider(providerType as 'auto' | 'deepseek' | 'claude' | 'openai');
        const boundaries = await detectDomains(projectSurvey, quality, provider);

        const analyses = [];
        for (const domain of boundaries.domains) {
          const analysis = await deepAnalyze(dir, domain, quality, projectSurvey.language, provider);
          analyses.push({ name: analysis.agentName, domain: domain, qualityReport: analysis.qualityReport });
        }

        return { content: [{ type: 'text', text: JSON.stringify({ boundaries, analyses }, null, 2) }] };
      }

      case 'build_team': {
        const providerType = ((args as Record<string, unknown>).provider as string) || 'auto';
        const projectSurvey = await survey(dir);
        const files = projectSurvey.directories.flatMap((d) => collectMCPFiles(d));
        const quality = await preAnalyze(dir, files, projectSurvey.importGraph);
        const provider = createProvider(providerType as 'auto' | 'deepseek' | 'claude' | 'openai');
        const boundaries = await detectDomains(projectSurvey, quality, provider);

        const analyses = [];
        const allBugs: string[] = [];
        let bugSummary = '';
        for (const domain of boundaries.domains) {
          const analysis = await deepAnalyze(dir, domain, quality, projectSurvey.language, provider);
          analyses.push(analysis);
          for (const bug of analysis.qualityReport.bugs) {
            allBugs.push(`${bug.path}:${bug.line} — ${bug.detail}`);
          }
          bugSummary += analysis.qualityReport.summary + '\n';
        }

        const agentPaths = await generateAgents(dir, analyses, projectSurvey.name);
        const reviewerPath = await generateReviewer(dir, projectSurvey.name, allBugs, bugSummary);

        const proposal = { agents: analyses.map((a) => ({ name: a.agentName, domainAnalysis: a })), narrative: '', warnings: [], estimatedTokens: 0 };
        const contextPath = await generateProjectContext(dir, proposal, projectSurvey);
        const { configPath, registrations } = await registerAgents(dir, analyses, projectSurvey.name);

        return { content: [{ type: 'text', text: JSON.stringify({ agentPaths, reviewerPath, contextPath, configPath, registrations }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function collectMCPFiles(dir: { files: string[]; subdirectories: unknown[] }): string[] {
  let files = [...dir.files];
  for (const sub of dir.subdirectories) {
    files = files.concat(collectMCPFiles(sub as { files: string[]; subdirectories: unknown[] }));
  }
  return files;
}

main();
