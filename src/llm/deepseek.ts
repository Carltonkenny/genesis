import type { LLMProvider, ChatMessage, ChatOptions } from '../types.js';
import OpenAI from 'openai';

export class DeepSeekProvider {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey,
      maxRetries: 2,
    });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0]?.message?.content || '';
  }

}
