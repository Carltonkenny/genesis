import { createRequire } from 'node:module';
import type { ChatMessage, ChatOptions } from '../types.js';

const require = createRequire(import.meta.url);

export class ClaudeProvider {
  private client: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const Anthropic = require('@anthropic-ai/sdk');
    this.client = new Anthropic.default({ apiKey });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.1,
    });

    return response.content[0]?.text || '';
  }
}
