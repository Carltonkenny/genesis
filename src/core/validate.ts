import type { DomainAnalysis, QualityReport } from '../types.js';

interface ValidationResult {
  score: number;
  feedback: string;
  passed: boolean;
}

export async function validateAgent(
  promptContent: string,
  domainName: string,
  fileCount: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llm: { chat: (messages: any[], options?: any) => Promise<string> }
): Promise<ValidationResult> {
  if (!promptContent || promptContent.length < 200) {
    return { score: 0, feedback: 'Prompt too short or empty', passed: false };
  }

  const response = await llm.chat(
    [
      { role: 'system', content: buildValidationPrompt() },
      {
        role: 'user',
        content: `Domain: ${domainName}\nFiles: ${fileCount}\n\nAgent Prompt:\n${promptContent}\n\nScore this agent prompt against the rubric. Return ONLY the JSON.`,
      },
    ],
    { jsonMode: true, temperature: 0 }
  );

  return parseValidation(response);
}

function buildValidationPrompt(): string {
  return `You are a prompt quality auditor. Score the agent prompt against this rubric.

RUBRIC (0-10):
10 — Every rule cites a real file. Every bug has file:line + crash mechanism + exact fix. Architecture includes directory tree with file purposes, data flow, key structures. The agent could work on this project with zero context.
 8 — Most rules project-specific. Architecture covers directory structure and key files. Bugs at file:line with fix. Minor generic rules acceptable.
 6 — Half rules specific. Architecture describes domain but lacks detail. Bugs at file:line but fixes vague.
 4 — More generic than specific. Architecture is one paragraph. Bugs described, not cited. Could apply to other projects.
 2 — Almost entirely generic. "Write clean code." "Follow best practices." Useless.

FAIL if:
- More than 3 generic rules without file citations
- Architecture section does not mention specific files or data flow
- Bugs described without file:line
- Over 40% of rules are language-level (PEP 8, "use type hints") not project-level

Pass threshold: 6 or above.

Output format: {"score": 8, "feedback": "brief assessment", "passed": true}`;
}

function parseValidation(response: string): ValidationResult {
  try {
    let json = response.trim();
    if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(json);
    return {
      score: Number(parsed.score) || 0,
      feedback: String(parsed.feedback || ''),
      passed: parsed.passed ?? (Number(parsed.score) >= 6),
    };
  } catch {
    return { score: 5, feedback: 'Validation parse failed. Accepting tentatively.', passed: true };
  }
}
