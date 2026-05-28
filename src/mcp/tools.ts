// MCP tool definitions for Genesis server
// Re-exported for use by both CLI and external MCP clients

export const toolDefinitions = {
  survey_project: {
    name: 'survey_project',
    description: 'Deep survey of a project directory. Returns language, framework, module boundaries, dependencies, test structure, and deploy artifacts.',
  },
  propose_team: {
    name: 'propose_team',
    description: 'Analyze a project survey and propose an agent team. Returns agents with domain assignments, file counts, and reasoning.',
  },
  build_team: {
    name: 'build_team',
    description: 'Create agent .md files, PROJECT-CONTEXT.md, and update opencode.json with the approved team.',
  },
} as const;
