import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DomainAnalysis, BuildResult, AgentRegistration } from '../types.js';

function sanitizeAgentName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return normalized || 'agent';
}

interface OpenCodeConfig {
  $schema?: string;
  default_agent?: string;
  agent?: Record<string, AgentEntry>;
}

interface AgentEntry {
  description?: string;
  mode?: string;
  model?: string;
  prompt?: string;
  temperature?: number;
  tools?: Record<string, boolean>;
  permission?: Record<string, unknown>;
  color?: string;
}

export async function registerAgents(
  dir: string,
  analyses: DomainAnalysis[],
  projectName: string
): Promise<{ configPath: string; registrations: AgentRegistration[]; status: BuildResult['status'] }> {
  const configPath = join(dir, 'opencode.json');

  // Read existing config if present
  let config: OpenCodeConfig = {};
  let status: BuildResult['status'] = 'created';

  try {
    const existing = await readFile(configPath, 'utf-8');
    config = JSON.parse(existing);
    status = 'merged';
  } catch {
    config = { $schema: 'https://opencode.ai/config.json' };
  }

  if (!config.agent) config.agent = {};

  const registrations: AgentRegistration[] = [];

  // Register each agent
  for (const analysis of analyses) {
    let agentName = sanitizeAgentName(analysis.agentName);

    // Avoid overwriting existing agents
    if (config.agent[agentName]) {
      let suffix = 2;
      while (config.agent[`${agentName}-${suffix}`]) suffix++;
      agentName = `${agentName}-${suffix}`;
    }

    analysis.agentName = agentName;

    config.agent[agentName] = {
      description: `${agentName} agent for ${projectName}. Owns ${analysis.domain.fileCount} files in ${analysis.domain.paths.join(', ')}.`,
      mode: 'subagent',
      prompt: `{file:./prompts/${agentName}.md}`,
      temperature: analysis.temperature,
      tools: { write: true, edit: true, bash: true, read: true, glob: true, grep: true },
      permission: {
        edit: analysis.permissions.allow,
      },
    };

    registrations.push({
      name: agentName,
      promptPath: `./prompts/${agentName}.md`,
      permissions: analysis.permissions,
      temperature: analysis.temperature,
    });
  }

  // Always register a reviewer
  const reviewerName = 'reviewer';
  if (!config.agent[reviewerName]) {
    config.agent[reviewerName] = {
      description: `Code reviewer for ${projectName}. Forensic auditor. Read-only.`,
      mode: 'subagent',
      prompt: '{file:./prompts/reviewer.md}',
      temperature: 0.1,
      tools: { write: false, edit: false, bash: true, read: true, glob: true, grep: true },
      permission: {
        edit: { '*': 'deny' },
        bash: { '*': 'allow' },
      },
    };

    registrations.push({
      name: reviewerName,
      promptPath: './prompts/reviewer.md',
      permissions: { allow: {}, ask: {}, deny: { '*': 'deny' } },
      temperature: 0.1,
    });
  }

  // Set default agent to first agent or orchestrator
  if (analyses.length >= 5) {
    const orchName = 'orchestrator';
    if (!config.agent[orchName]) {
      config.agent[orchName] = {
        description: `Orchestrator for ${projectName}. Routes tasks between ${analyses.length} specialist agents.`,
        mode: 'primary',
        temperature: 0.1,
        tools: { write: false, edit: false, bash: true, read: true, glob: true, grep: true },
      };
    }
    config.default_agent = orchName;
  } else {
    config.default_agent = analyses[0]?.agentName || 'reviewer';
  }

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

  return { configPath, registrations, status };
}
