#!/usr/bin/env node

// Genesis MCP launcher — starts the MCP server via stdio.
// Compatible with Claude Code, OpenCode, Cursor, VS Code, Gemini, any MCP client.

(async () => {
  try {
    await import('../dist/mcp/server.js');
  } catch (err) {
    // Fallback: spawn via npx tsx in dev mode
    const { spawn } = await import('node:child_process');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const tsxServer = join(__dirname, '..', 'src', 'mcp', 'server.ts');

    const child = spawn('npx', ['tsx', tsxServer], {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
    });

    child.on('error', (e) => {
      console.error('GenesisX MCP: Failed to start server:', e.message);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
})();
