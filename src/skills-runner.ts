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
      // Limit skill instruction size to prevent blowing past model context limits (max ~1500 chars / ~350 tokens)
      const MAX_SKILL_CHARS = 1500;
      let instructions = (triggeredSkill.systemInstructions || '').trim();
      if (instructions.length > MAX_SKILL_CHARS) {
        instructions = instructions.slice(0, MAX_SKILL_CHARS) + '\n\n...[Hướng dẫn kỹ năng đã được tóm lược để vừa vặn bộ nhớ]...';
      }

      parts.push(
        `\n\n--- ACTIVE SKILL: ${triggeredSkill.name} ---\n${instructions}\n--- END SKILL ---`
      );
    }

    return parts.join('\n\n');
  }
}
