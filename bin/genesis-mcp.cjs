#!/usr/bin/env node

// Genesis MCP launcher — starts the MCP server.
// Usage: npx genesis-mcp
// Connects via stdio. Compatible with Claude Code, OpenCode, Cursor, VS Code, Gemini, any MCP client.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'dist', 'mcp', 'server.js');

try {
  await import(serverPath);
} catch (err) {
  // Fallback for dev: try tsx on the source
  const { spawn } = await import('node:child_process');
  const tsxServer = join(__dirname, '..', 'src', 'mcp', 'server.ts');
  const child = spawn('npx', ['tsx', tsxServer], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
  });

  child.on('error', (e) => {
    console.error('Genesis MCP: Failed to start server:', e.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
