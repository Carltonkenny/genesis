import type { LLMProvider } from '../types.js';
import type { ProviderType } from '../types.js';
import { DeepSeekProvider } from './deepseek.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';

export function createProvider(type: ProviderType = 'auto'): LLMProvider {
  if (type === 'deepseek') return new DeepSeekProvider();
  if (type === 'claude') return new ClaudeProvider();
  if (type === 'openai') return new OpenAIProvider();

  // Auto-detect
  if (process.env.DEEPSEEK_API_KEY) return new DeepSeekProvider();
  if (process.env.ANTHROPIC_API_KEY) return new ClaudeProvider();
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();

  throw new Error(
    'No LLM provider detected. Set one of:\n' +
    '  DEEPSEEK_API_KEY  (recommended: cheapest, highest quality for analysis)\n' +
    '  ANTHROPIC_API_KEY (Claude)\n' +
    '  OPENAI_API_KEY    (GPT-4o)\n' +
    '\nOr specify: npx genesis . --provider claude'
  );
}

export type { LLMProvider };

