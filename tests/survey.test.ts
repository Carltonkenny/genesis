import { describe, it, expect } from 'vitest';
import { survey } from '../src/core/survey.js';
import { preAnalyze } from '../src/core/quality.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

describe('Genesis Engine', () => {
  describe('survey()', () => {
    it('detects Python project with requirements.txt', async () => {
      const result = await survey(resolve(fixturesDir, 'tiny'));
      expect(result.language).toBe('Python');
      expect(result.packageManager).toBe('pip');
      expect(result.files).toContain('main.py');
    });

    it('builds file list from project', async () => {
      const result = await survey(resolve(fixturesDir, 'small'));
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('returns valid survey structure', async () => {
      const result = await survey(resolve(fixturesDir, 'medium'));
      expect(result.name).toBeTruthy();
      expect(result.language).toBeTruthy();
      expect(result.directories).toBeDefined();
      expect(result.files).toBeDefined();
    });
  });

  describe('preAnalyze()', () => {
    it('detects AI slop in files with many TODOs', async () => {
      const projectDir = resolve(fixturesDir, 'small');
      const quality = await preAnalyze(projectDir, ['api.py'], []);
      expect(quality.aiSlop.length).toBeGreaterThan(0);
    });
  });
});
