import type { LocalSkill } from './types.js';

export interface TriggeredSkillResult {
  skill: LocalSkill;
  matchedTrigger: string;
  cleanPrompt: string;
}

export class SkillsRunner {
  /**
   * Check if a user's prompt begins with a slash command trigger (e.g. "/code-review Check this")
   */
  public static matchSlashCommand(
    prompt: string,
    activeSkills: LocalSkill[]
  ): TriggeredSkillResult | null {
    const trimmed = prompt.trim();
    if (!trimmed.startsWith('/')) return null;

    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    const cleanPrompt = trimmed.slice(firstWord.length).trim();

    for (const skill of activeSkills) {
      if (!skill.enabled) continue;

      for (const trigger of skill.triggers) {
        if (trigger.toLowerCase() === firstWord) {
          return {
            skill,
            matchedTrigger: trigger,
            cleanPrompt,
          };
        }
      }
    }

    return null;
  }

  /**
   * Build enriched system prompt by injecting active skill instructions
   */
  public static composeSystemPrompt(
    baseSystemPrompt = '',
    triggeredSkill?: LocalSkill,
    activeSkills: LocalSkill[] = []
  ): string {
    const parts: string[] = [];

    if (baseSystemPrompt.trim()) {
      parts.push(baseSystemPrompt.trim());
    }

    if (triggeredSkill) {
      parts.push(
        `\n\n--- ACTIVE SKILL: ${triggeredSkill.name} ---\n${triggeredSkill.systemInstructions}\n--- END SKILL ---`
      );
    } else {
      // In autonomous mode, provide a concise summary of available skills to the LLM
      const availableSummaries = activeSkills
        .filter((s) => s.enabled)
        .map((s) => `• ${s.name} (${s.triggers.join(', ')}): ${s.description}`);

      if (availableSummaries.length > 0) {
        parts.push(
          `\n\n[Available Local Skills]:\n${availableSummaries.join('\n')}`
        );
      }
    }

    return parts.join('\n\n');
  }
}
