#!/usr/bin/env node
(async () => {
  await import('../dist/cli/main.js');
})().catch((err) => {
  console.error('GenesisX failed to start:', err.message);
  process.exit(1);
});
