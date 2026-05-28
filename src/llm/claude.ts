import type { LLMProvider, ChatMessage, ChatOptions } from '../types.js';

export class ClaudeProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    // Dynamic import for Anthropic SDK
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    // Extract system message
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
