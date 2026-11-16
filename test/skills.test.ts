import { SkillsScanner } from '../src/skills-scanner.js';
import { SkillsRunner } from '../src/skills-runner.js';
import path from 'node:path';
import fs from 'node:fs';

async function run() {
  console.log('Testing SkillsScanner & SkillsRunner...');

  // Create temporary sample skill directory
  const testSkillsDir = path.resolve(process.cwd(), '.test_skills');
  const sampleSkillDir = path.join(testSkillsDir, 'code-review');
  fs.mkdirSync(sampleSkillDir, { recursive: true });

  const skillContent = `---
name: Code Review Expert
description: Scans code for memory leaks, clean code conventions, and bugs.
triggers:
  - /review
  - /code-review
---

You are an elite Senior Engineer. When reviewing code:
1. Identify memory leaks and unbounded allocations.
2. Verify error handling and null-checks.
`;

  fs.writeFileSync(path.join(sampleSkillDir, 'SKILL.md'), skillContent, 'utf-8');

  // 1. Scan (isolated without global)
  const skills = SkillsScanner.scanDirectories([testSkillsDir], false);
  console.log(`Scanned skills count: ${skills.length}`);
  if (skills.length !== 1) {
    throw new Error('Failed to discover sample skill');
  }

  const skill = skills[0];
  console.log(`Discovered: "${skill.name}" with triggers: ${skill.triggers.join(', ')}`);

  // 2. Test slash command match
  const match = SkillsRunner.matchSlashCommand('/review Check this code', skills);
  if (!match || match.skill.id !== 'code-review' || match.cleanPrompt !== 'Check this code') {
    throw new Error('Slash command matching failed');
  }
  console.log(`Matched slash command: ${match.matchedTrigger} -> Prompt: "${match.cleanPrompt}"`);

  // 3. Test prompt composition
  const enriched = SkillsRunner.composeSystemPrompt('Base prompt', match.skill);
  if (!enriched.includes('ACTIVE SKILL: Code Review Expert')) {
    throw new Error('Enriched prompt composition failed');
  }

  // Clean up
  fs.rmSync(testSkillsDir, { recursive: true, force: true });
  console.log('✅ Phase 5 Local Skills Engine verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
