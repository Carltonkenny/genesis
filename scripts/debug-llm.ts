#!/usr/bin/env npx tsx
import { createProvider } from '../src/llm/factory.js';

async function main() {
  const p = createProvider('deepseek');

  const systemPrompt = `You are analyzing a codebase's directory structure to identify natural domain boundaries.
Group files by their responsibilities. Output ONLY valid JSON.

Output format:
{
  "domains": [
    { "name": "backend-api", "paths": ["src/api/", "src/models/"], "fileCount": 22 }
  ],
  "merged": [
    { "path": "src/utils/", "into": "backend-api", "reason": "Only 2 files" }
  ]
}`;

  const userPrompt = `PROJECT: test-small
LANGUAGE: Python (FastAPI)

DIRECTORY STRUCTURE:
  . (5 files)

FILES:
  api.py
  auth.py
  requirements.txt

Identify natural domain boundaries.`;

  const response = await p.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { jsonMode: true, temperature: 0.1 }
  );

  console.log('=== RAW RESPONSE ===');
  console.log(response);
  console.log('=== PARSING ===');

  try {
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    console.log('Domains:', parsed.domains?.length || 0);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('PARSE ERROR:', (e as Error).message);
  }
}

main().catch(e => console.error('FAIL:', e));
