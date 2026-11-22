import { SwarmEngine, HarnessRunner, type SwarmStreamEvent } from '../src/swarm-engine.js';
import { discoverWorkspaceRules, DEFAULT_SYSTEM_PROMPT, createServer } from '../src/server.js';
import { DatabaseService } from '../src/db.js';
import { LlamaProcessManager } from '../src/llama-process.js';
import { MultiProviderRouter } from '../src/router.js';
import path from 'node:path';
import fs from 'node:fs';

async function run() {
  console.log('Testing SwarmEngine, HarnessRunner, and Rule Discovery...');

  const tempTestDir = path.resolve(process.cwd(), '.data_swarm_test');
  if (fs.existsSync(tempTestDir)) {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempTestDir, { recursive: true });

  try {
    // ==========================================
    // 1. Rule Discovery (.localairules & .cursorrules)
    // ==========================================
    console.log('\n--- Test 1: Rule Discovery ---');
    const emptyRules = discoverWorkspaceRules(tempTestDir);
    if (emptyRules !== null) {
      throw new Error(`Expected null for empty directory, got "${emptyRules}"`);
    }

    // Test .cursorrules discovery
    const cursorRulesPath = path.join(tempTestDir, '.cursorrules');
    fs.writeFileSync(cursorRulesPath, 'Rule 1: Always write TypeScript.\nRule 2: Keep functions pure.');
    const discoveredCursor = discoverWorkspaceRules(tempTestDir);
    if (!discoveredCursor || !discoveredCursor.includes('Always write TypeScript')) {
      throw new Error(`Failed to discover .cursorrules, got "${discoveredCursor}"`);
    }
    console.log('[Rule Discovery]: .cursorrules discovered correctly.');

    // Test .localairules discovery priority over .cursorrules
    const localaiRulesPath = path.join(tempTestDir, '.localairules');
    fs.writeFileSync(localaiRulesPath, 'Priority Rule: LocalAI strict negative constraints.');
    const discoveredLocalAI = discoverWorkspaceRules(tempTestDir);
    if (!discoveredLocalAI || !discoveredLocalAI.includes('Priority Rule: LocalAI strict negative constraints')) {
      throw new Error(`Failed to prioritize .localairules, got "${discoveredLocalAI}"`);
    }
    console.log('[Rule Discovery]: .localairules priority verified.');

    // Test rule truncation to <= 3500 bytes
    const largeRuleContent = 'X'.repeat(5000);
    fs.writeFileSync(localaiRulesPath, largeRuleContent);
    const truncatedRule = discoverWorkspaceRules(tempTestDir);
    if (!truncatedRule || Buffer.byteLength(truncatedRule, 'utf-8') > 3500) {
      throw new Error(`Expected rule <= 3500 bytes, got ${Buffer.byteLength(truncatedRule || '', 'utf-8')}`);
    }
    console.log(`[Rule Discovery]: Large rule file truncated to ${Buffer.byteLength(truncatedRule, 'utf-8')} bytes.`);

    // ==========================================
    // 2. HarnessRunner Tests
    // ==========================================
    console.log('\n--- Test 2: HarnessRunner ---');

    // 2.1 Successful command
    const passResult = await HarnessRunner.run({
      command: 'node -e "console.log(\'TESTS_ALL_PASSED\'); process.exit(0);"',
      cwd: tempTestDir,
      timeoutMs: 5000,
    });
    if (!passResult.passed || passResult.exitCode !== 0 || !passResult.logs.includes('TESTS_ALL_PASSED')) {
      throw new Error(`Expected passResult to succeed, got exitCode=${passResult.exitCode}, logs=${passResult.logs}`);
    }
    console.log('[HarnessRunner]: Successful test execution verified.');

    // 2.2 Failing command
    const failResult = await HarnessRunner.run({
      command: 'node -e "console.error(\'SYNTAX_ERROR_DETECTED\'); process.exit(1);"',
      cwd: tempTestDir,
      timeoutMs: 5000,
    });
    if (failResult.passed || failResult.exitCode !== 1 || !failResult.logs.includes('SYNTAX_ERROR_DETECTED')) {
      throw new Error(`Expected failResult to fail, got exitCode=${failResult.exitCode}, logs=${failResult.logs}`);
    }
    console.log('[HarnessRunner]: Failing test exit code feedback verified.');

    // 2.3 Dangerous command blocking
    const dangerousResult = await HarnessRunner.run({
      command: 'format c: /q',
      cwd: tempTestDir,
    });
    if (dangerousResult.passed || !dangerousResult.logs.includes('dangerous pattern')) {
      throw new Error(`Dangerous command was not blocked! logs=${dangerousResult.logs}`);
    }
    console.log('[HarnessRunner]: Dangerous command sandbox guard verified.');

    // 2.4 Timeout handling with process tree termination
    const startTimeout = Date.now();
    const timeoutResult = await HarnessRunner.run({
      command: 'node -e "setTimeout(() => {}, 30000)"',
      cwd: tempTestDir,
      timeoutMs: 800,
    });
    const elapsed = Date.now() - startTimeout;
    if (!timeoutResult.timedOut || timeoutResult.passed || timeoutResult.exitCode !== 124) {
      throw new Error(`Expected timeout with exitCode 124, got ${timeoutResult.exitCode}, timedOut=${timeoutResult.timedOut}`);
    }
    if (elapsed > 4000) {
      throw new Error(`Timeout took too long to terminate process tree: ${elapsed}ms`);
    }
    console.log(`[HarnessRunner]: Timeout guard verified in ${elapsed}ms with exitCode ${timeoutResult.exitCode}.`);

    // 2.5 Output truncation to 16KB / 60 lines
    const largeLogResult = await HarnessRunner.run({
      command: 'node -e "for(let i=1;i<=200;i++) console.log(\'Line \' + i + \': \' + \'A\'.repeat(150));"',
      cwd: tempTestDir,
      timeoutMs: 5000,
    });
    const logLines = largeLogResult.logs.split('\n');
    const logBytes = Buffer.byteLength(largeLogResult.logs, 'utf-8');
    if (logLines.length > 60) {
      throw new Error(`Expected <= 60 lines, got ${logLines.length}`);
    }
    if (logBytes > 16384) {
      throw new Error(`Expected <= 16384 bytes, got ${logBytes}`);
    }
    if (!largeLogResult.logs.includes('Line 200')) {
      throw new Error('Expected logs to preserve recent tail output.');
    }
    console.log(`[HarnessRunner]: Log output truncation verified (${logLines.length} lines, ${logBytes} bytes, tail preserved).`);

    // ==========================================
    // 3. SwarmEngine Multi-Agent Pipeline
    // ==========================================
    console.log('\n--- Test 3: SwarmEngine Multi-Agent Pipeline ---');

    // 3.1 Successful 1-pass execution
    let callCount = 0;
    const mockSuccessLLM = async function* (prompt: string) {
      callCount++;
      if (prompt.includes('Drafting') || prompt.includes('Task:')) {
        yield { content: 'function add(a: number, b: number): number { return a + b; }' };
      } else if (prompt.includes('Review the code:')) {
        yield { content: 'CRITIQUE_PASS: Implementation is sound and meets all requirements.' };
      } else {
        yield { content: 'Refined code' };
      }
    };

    const swarmSuccess = new SwarmEngine({ customLLM: mockSuccessLLM });
    const events: SwarmStreamEvent[] = [];

    for await (const ev of swarmSuccess.executeStream({
      taskPrompt: 'Implement add(a, b)',
      testCommand: 'node -e "console.log(\'ADD_TEST_PASSED\'); process.exit(0);"',
      workspacePath: tempTestDir,
      maxIterations: 2,
    })) {
      events.push(ev);
    }

    const agentsSeen = new Set(
      events.filter((e) => e.type === 'agent_step').map((e: any) => e.agent)
    );
    if (!agentsSeen.has('coordinator') || !agentsSeen.has('coder') || !agentsSeen.has('critic') || !agentsSeen.has('harness')) {
      throw new Error(`Missing agents in pipeline. Found: ${[...agentsSeen].join(', ')}`);
    }

    const harnessResultEvent = events.find((e) => e.type === 'harness_result') as any;
    if (!harnessResultEvent || !harnessResultEvent.passed) {
      throw new Error('Expected harness_result event to be present and passed');
    }

    const doneEvent = events.find((e) => e.type === 'done') as any;
    if (!doneEvent || !doneEvent.summary.passed) {
      throw new Error('Expected done event with passed=true');
    }
    console.log('[SwarmEngine]: Successful pipeline execution verified across all 4 agents.');

    // 3.2 Iteration Guard (MAX_ITERATIONS = 2 when harness fails repeatedly)
    let refinerRuns = 0;
    const mockFailingLLM = async function* (prompt: string) {
      if (prompt.includes('Review the code:')) {
        yield { content: '- Flaw: Test fails continuously.' };
      } else if (prompt.includes('Provide the refined')) {
        refinerRuns++;
        yield { content: '// Attempt ' + refinerRuns };
      } else {
        yield { content: '// Initial Draft' };
      }
    };

    const swarmFail = new SwarmEngine({ customLLM: mockFailingLLM });
    const failEvents: SwarmStreamEvent[] = [];

    for await (const ev of swarmFail.executeStream({
      taskPrompt: 'Fix stubborn bug',
      testCommand: 'node -e "console.error(\'FAIL_REPEAT\'); process.exit(1);"',
      workspacePath: tempTestDir,
      maxIterations: 2,
    })) {
      failEvents.push(ev);
    }

    const failDoneEvent = failEvents.find((e) => e.type === 'done') as any;
    if (!failDoneEvent) {
      throw new Error('Expected done event on max iterations reached');
    }
    if (failDoneEvent.summary.iterations !== 2) {
      throw new Error(`Expected iterations=2 guard, got ${failDoneEvent.summary.iterations}`);
    }
    if (failDoneEvent.summary.passed !== false) {
      throw new Error('Expected passed=false after max failing iterations');
    }
    console.log('[SwarmEngine]: MAX_ITERATIONS = 2 guard verified when harness fails.');

    // ==========================================
    // 4. Server Endpoint Integration (/api/swarm/execute-stream & Concise Mode)
    // ==========================================
    console.log('\n--- Test 4: Server Endpoint Integration ---');
    const db = new DatabaseService(tempTestDir);
    const llama = new LlamaProcessManager();
    const router = new MultiProviderRouter(db, llama);
    const app = createServer(db, llama, router);

    // Verify DEFAULT_SYSTEM_PROMPT constraints
    if (!DEFAULT_SYSTEM_PROMPT.includes('STRICT NEGATIVE CONSTRAINTS') || !DEFAULT_SYSTEM_PROMPT.includes('Do NOT include greetings')) {
      throw new Error('DEFAULT_SYSTEM_PROMPT missing strict negative constraints.');
    }
    console.log('[Server Prompt]: Strict negative constraint default system prompt verified.');

    // Test /api/swarm/execute-stream validation
    const missingPromptRes = await app.request('/api/swarm/execute-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (missingPromptRes.status !== 400) {
      throw new Error(`Expected 400 for missing prompt, got ${missingPromptRes.status}`);
    }
    db.close();
    console.log('[Server Endpoint]: /api/swarm/execute-stream 400 validation verified.');

    console.log('\n All SwarmEngine, HarnessRunner, and Rule Discovery tests PASSED!');
  } finally {
    if (fs.existsSync(tempTestDir)) {
      try {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

run().catch((err) => {
  console.error('\n SwarmEngine test suite failed:', err);
  process.exit(1);
});
