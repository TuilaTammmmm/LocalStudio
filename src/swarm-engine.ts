import { spawn, exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { MultiProviderRouter } from './router.js';
import type { DatabaseService } from './db.js';
import type { ChatMessage } from './types.js';

export type SwarmAgent = 'coordinator' | 'coder' | 'critic' | 'harness';
export type SwarmStepStatus = 'active' | 'done' | 'error';

export interface AgentStepEvent {
  type: 'agent_step';
  agent: SwarmAgent;
  status: SwarmStepStatus;
  thought?: string;
  chunk?: string;
  content?: string;
}

export interface HarnessResultEvent {
  type: 'harness_result';
  exitCode: number;
  passed: boolean;
  logs: string;
  command: string;
  timedOut?: boolean;
}

export interface SwarmDoneEvent {
  type: 'done';
  done: boolean;
  summary: {
    iterations: number;
    passed: boolean;
    finalCode?: string;
    harnessLogs?: string;
  };
}

export interface SwarmErrorEvent {
  type: 'error';
  message: string;
}

export interface SwarmChunkEvent {
  type: 'chunk';
  content: string;
}

export type SwarmStreamEvent =
  | AgentStepEvent
  | HarnessResultEvent
  | SwarmDoneEvent
  | SwarmErrorEvent
  | SwarmChunkEvent;

export interface HarnessRunOptions {
  command: string;
  cwd?: string;
  timeoutMs?: number; // default 20000
  signal?: AbortSignal;
}

export interface HarnessRunResult {
  exitCode: number;
  passed: boolean;
  logs: string;
  command: string;
  timedOut?: boolean;
}

/**
 * HarnessRunner executes test and verification commands in workspace
 * with a 20s timeout, Windows taskkill process tree termination,
 * non-interactive environment (CI=true, TERM=dumb), and output truncation.
 */
export class HarnessRunner {
  public static readonly DEFAULT_TIMEOUT_MS = 20000;
  public static readonly MAX_LOG_BYTES = 16384; // 16KB
  public static readonly MAX_LOG_LINES = 60;

  public static readonly DANGEROUS_PATTERNS = [
    /format\s+[a-zA-Z]:/i,
    /format-volume/i,
    /diskpart/i,
    /bcdedit/i,
    /reg\s+delete/i,
    /rmdir\s+.*\/s.*\/q/i,
    /del\s+.*\/f.*\/s.*\/q/i,
    /remove-item.*-(recurse|r).*(c:\\|\$env:systemroot|system32)/i,
    /rm\s+-rf\s+(\/|~|\$HOME|[a-zA-Z]:\\)/i,
    /drop\s+database/i,
  ];

  /**
   * Truncates log output to max bytes and max lines, preserving the most recent tail.
   */
  public static truncateLogs(
    raw: string,
    maxBytes = HarnessRunner.MAX_LOG_BYTES,
    maxLines = HarnessRunner.MAX_LOG_LINES
  ): string {
    if (!raw) return '';
    let text = raw;
    const byteLen = Buffer.byteLength(text, 'utf-8');
    if (byteLen > maxBytes) {
      const buf = Buffer.from(text, 'utf-8');
      text = buf.subarray(buf.length - maxBytes).toString('utf-8');
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1 && firstNewline < 120) {
        text = text.substring(firstNewline + 1);
      }
    }
    const lines = text.split(/\r?\n/);
    if (lines.length > maxLines) {
      text = lines.slice(-maxLines).join('\n');
    }
    return text.trim();
  }

  public static async run(options: HarnessRunOptions): Promise<HarnessRunResult> {
    const { command, cwd = process.cwd(), timeoutMs = HarnessRunner.DEFAULT_TIMEOUT_MS, signal } = options;

    // Check dangerous commands
    for (const pattern of HarnessRunner.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          exitCode: 1,
          passed: false,
          logs: `[HarnessRunner Security]: Command "${command}" was blocked because it matches a dangerous pattern.`,
          command,
          timedOut: false,
        };
      }
    }

    if (signal?.aborted) {
      return {
        exitCode: 1,
        passed: false,
        logs: '[HarnessRunner]: Execution aborted before start.',
        command,
        timedOut: false,
      };
    }

    return new Promise<HarnessRunResult>((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let timer: NodeJS.Timeout | null = null;
      let isSettled = false;

      const isWin = process.platform === 'win32';

      const child = spawn(command, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          CI: 'true',
          TERM: 'dumb',
        },
        windowsHide: true,
      });

      // Non-interactive env: close stdin immediately to avoid hanging prompts
      if (child.stdin) {
        try {
          child.stdin.end();
        } catch {}
      }

      const killProcessTree = () => {
        if (!child.pid) return;
        if (isWin) {
          exec(`taskkill /PID ${child.pid} /T /F`, () => {});
        } else {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }
      };

      timer = setTimeout(() => {
        timedOut = true;
        killProcessTree();
      }, timeoutMs);

      const abortHandler = () => {
        killProcessTree();
        finish(1, false, '[HarnessRunner]: Execution aborted by signal.');
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      const finish = (code: number, passed: boolean, extraLog?: string) => {
        if (isSettled) return;
        isSettled = true;
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abortHandler);

        let combined = stdoutData;
        if (stderrData.trim()) {
          combined += (combined ? '\n' : '') + stderrData;
        }
        if (extraLog) {
          combined += (combined ? '\n' : '') + extraLog;
        }
        const truncated = HarnessRunner.truncateLogs(combined);
        resolve({
          exitCode: code,
          passed,
          logs: truncated,
          command,
          timedOut,
        });
      };

      child.stdout?.on('data', (d) => {
        stdoutData += d.toString();
      });

      child.stderr?.on('data', (d) => {
        stderrData += d.toString();
      });

      child.on('error', (err) => {
        finish(1, false, `[HarnessRunner Error]: ${err.message}`);
      });

      child.on('close', (code) => {
        if (timedOut) {
          finish(
            124,
            false,
            `[HarnessRunner]: Command timed out after ${timeoutMs}ms. Process tree terminated.`
          );
        } else {
          const exitCode = code ?? 0;
          finish(exitCode, exitCode === 0);
        }
      });
    });
  }
}

export type LLMStreamFn = (
  prompt: string,
  options: {
    systemPrompt?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    repeatPenalty?: number;
  }
) => AsyncGenerator<{ content?: string; thinking?: string; done?: boolean }>;

export interface SwarmExecuteOptions {
  sessionId?: string;
  taskPrompt: string;
  workspacePath?: string;
  testCommand?: string;
  contextFiles?: Array<{ path: string; content: string }>;
  maxIterations?: number; // default 2
  systemRules?: string;
  sampling?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    repeatPenalty?: number;
  };
  signal?: AbortSignal;
  onEvent?: (event: SwarmStreamEvent) => void;
}

/**
 * SwarmEngine orchestrates a sequential multi-agent pipeline:
 * Coordinator (Planning) -> Drafter (Coder) -> Critic (Reviewer) -> Refiner (Coder) -> HarnessRunner (Test)
 * with a hard limit MAX_ITERATIONS = 2 to prevent runaway loops.
 */
export class SwarmEngine {
  public static readonly MAX_ITERATIONS = 2;

  private router?: MultiProviderRouter;
  private db?: DatabaseService;
  private customLLM?: LLMStreamFn;

  constructor(options?: {
    router?: MultiProviderRouter;
    db?: DatabaseService;
    customLLM?: LLMStreamFn;
  }) {
    this.router = options?.router;
    this.db = options?.db;
    this.customLLM = options?.customLLM;
  }

  private async *streamLLM(
    prompt: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      repeatPenalty?: number;
    }
  ): AsyncGenerator<{ content?: string; thinking?: string; done?: boolean }> {
    if (this.customLLM) {
      for await (const chunk of this.customLLM(prompt, options)) {
        yield chunk;
      }
      return;
    }
    if (this.router) {
      for await (const chunk of this.router.executeStatelessStream(prompt, options)) {
        yield chunk;
      }
      return;
    }
    throw new Error('SwarmEngine has neither router nor customLLM configured.');
  }

  public async *executeStream(options: SwarmExecuteOptions): AsyncGenerator<SwarmStreamEvent, void, unknown> {
    const emit = (event: SwarmStreamEvent): SwarmStreamEvent => {
      options.onEvent?.(event);
      return event;
    };

    const maxIterations = Math.min(Math.max(options.maxIterations ?? SwarmEngine.MAX_ITERATIONS, 1), 3);

    // 1. Phase: Coordinator
    yield emit({
      type: 'agent_step',
      agent: 'coordinator',
      status: 'active',
      thought: 'Phân tích yêu cầu và thiết lập kế hoạch giải quyết...',
    });

    let contextBlock = '';
    if (options.contextFiles && options.contextFiles.length > 0) {
      contextBlock = options.contextFiles
        .map((f) => `--- File: ${f.path} ---\n${f.content}\n--- End File ---`)
        .join('\n\n') + '\n\n';
    }

    const rulesDirective = options.systemRules ? `\n\n[PROJECT RULES]:\n${options.systemRules}` : '';

    const coordinatorSystemPrompt = `You are a software architect and technical project lead.
Analyze the user's task and create a concise technical execution plan (3-4 bullet points in Vietnamese).
Focus strictly on:
- Key logic components and formula/algorithm steps
- Edge cases and validation requirements
Keep it concise, under 120 words. Do NOT include pleasantries.`;

    let coordinatorPlan = '';
    try {
      for await (const chunk of this.streamLLM(`Nhiệm vụ:\n${options.taskPrompt}\n\nHãy lập kế hoạch giải quyết ngắn gọn:`, {
        systemPrompt: coordinatorSystemPrompt,
        temperature: 0.2,
        maxTokens: 350,
      })) {
        if (options.signal?.aborted) throw new Error('Swarm execution aborted by user.');
        if (chunk.content) coordinatorPlan += chunk.content;
      }
    } catch {
      coordinatorPlan = `Kế hoạch: Lập trình viên thiết kế giải pháp -> Phản biện rà soát lỗi logic -> Tối ưu hóa code.`;
    }

    const planSummary = coordinatorPlan.trim() || `Kế hoạch: Lập trình viên thiết kế giải pháp -> Phản biện rà soát lỗi logic -> Tối ưu hóa code.`;

    yield emit({
      type: 'agent_step',
      agent: 'coordinator',
      status: 'done',
      thought: planSummary,
    });

    // 2. Phase: Drafter (Coder)
    const coderSystemPrompt = `You are an elite software engineer. Write clean, complete, production-ready code for the task. Output code directly with clear explanations. Handle all edge cases. Do NOT include greetings, conversational preamble, or sign-offs.${rulesDirective}`;
    const drafterPrompt = `${contextBlock}Nhiệm vụ:\n${options.taskPrompt}\n\nKế hoạch phân công:\n${planSummary}\n\nHãy viết mã nguồn giải pháp hoàn chỉnh:`;

    yield emit({
      type: 'agent_step',
      agent: 'coder',
      status: 'active',
      thought: 'Drafting initial implementation...',
    });

    let currentCode = '';
    for await (const chunk of this.streamLLM(drafterPrompt, {
      systemPrompt: coderSystemPrompt,
      ...options.sampling,
    })) {
      if (options.signal?.aborted) throw new Error('Swarm execution aborted by user.');
      if (chunk.content) {
        currentCode += chunk.content;
        yield emit({
          type: 'agent_step',
          agent: 'coder',
          status: 'active',
          chunk: chunk.content,
          content: chunk.content,
        });
        yield emit({
          type: 'chunk',
          content: chunk.content,
        });
      }
    }

    yield emit({
      type: 'agent_step',
      agent: 'coder',
      status: 'done',
      thought: 'Draft implementation completed.',
    });

    // 3. Iteration Loop: Critic -> Refiner -> HarnessRunner
    let lastHarnessResult: HarnessRunResult | null = null;
    let completedSuccessfully = false;
    let executedIterations = 0;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      executedIterations = iteration;
      if (options.signal?.aborted) throw new Error('Swarm execution aborted by user.');

      // 3A. Phase: Critic
      yield emit({
        type: 'agent_step',
        agent: 'critic',
        status: 'active',
        thought: `Reviewing code implementation (iteration ${iteration})...`,
      });

      const criticSystemPrompt = `You are a strict, senior code reviewer. Perform a concise technical critique of the proposed code against the task.
Focus on:
1. Syntax, runtime exceptions, missing imports, unhandled edge cases.
2. Correctness against the user's task requirements.
CONSTRAINTS:
- If the code is correct, robust, and complete, respond with exactly: "CRITIQUE_PASS: Implementation is sound and meets all requirements."
- If there are flaws, concisely list the concrete issues as bullet points (under 150 words). Do NOT rewrite the code.`;

      const criticPrompt = `Task:\n${options.taskPrompt}\n\nProposed Code:\n${currentCode}\n\nReview the code:`;

      let criticFeedback = '';
      for await (const chunk of this.streamLLM(criticPrompt, {
        systemPrompt: criticSystemPrompt,
        temperature: 0.1,
        maxTokens: 512,
      })) {
        if (options.signal?.aborted) throw new Error('Swarm execution aborted by user.');
        if (chunk.content) criticFeedback += chunk.content;
      }

      const isCriticPass = criticFeedback.includes('CRITIQUE_PASS');
      const thoughtSummary = isCriticPass
        ? 'Critique passed: No critical defects found.'
        : criticFeedback.slice(0, 200).replace(/\n/g, ' ');

      yield emit({
        type: 'agent_step',
        agent: 'critic',
        status: 'done',
        thought: thoughtSummary,
      });

      // 3B. Phase: Refiner (Coder)
      const needsRefinement = !isCriticPass || (lastHarnessResult && !lastHarnessResult.passed);
      if (needsRefinement) {
        yield emit({
          type: 'agent_step',
          agent: 'coder',
          status: 'active',
          thought: `Refining implementation to address critique/test feedback (iteration ${iteration})...`,
        });

        const refinerPrompt = `Task:\n${options.taskPrompt}\n\nCurrent Implementation:\n${currentCode}\n\nCritique:\n${criticFeedback}${
          lastHarnessResult && !lastHarnessResult.passed ? `\n\nTest Execution Failures:\n${lastHarnessResult.logs}` : ''
        }\n\nProvide the refined, complete, and fixed code implementation:`;

        let refinedCode = '';
        for await (const chunk of this.streamLLM(refinerPrompt, {
          systemPrompt: coderSystemPrompt,
          ...options.sampling,
        })) {
          if (options.signal?.aborted) throw new Error('Swarm execution aborted by user.');
          if (chunk.content) {
            refinedCode += chunk.content;
            yield emit({
              type: 'agent_step',
              agent: 'coder',
              status: 'active',
              chunk: chunk.content,
              content: chunk.content,
            });
            yield emit({
              type: 'chunk',
              content: chunk.content,
            });
          }
        }

        if (refinedCode.trim()) {
          currentCode = refinedCode;
        }

        yield emit({
          type: 'agent_step',
          agent: 'coder',
          status: 'done',
          thought: 'Refined code generated.',
        });
      }

      // 3C. Phase: HarnessRunner
      if (options.testCommand) {
        yield emit({
          type: 'agent_step',
          agent: 'harness',
          status: 'active',
          thought: `Running verification command: ${options.testCommand}`,
        });

        const harnessResult = await HarnessRunner.run({
          command: options.testCommand,
          cwd: options.workspacePath,
          timeoutMs: 20000,
          signal: options.signal,
        });
        lastHarnessResult = harnessResult;

        yield emit({
          type: 'harness_result',
          exitCode: harnessResult.exitCode,
          passed: harnessResult.passed,
          logs: harnessResult.logs,
          command: options.testCommand,
          timedOut: harnessResult.timedOut,
        });

        if (harnessResult.passed) {
          yield emit({
            type: 'agent_step',
            agent: 'harness',
            status: 'done',
            thought: 'All verification checks passed with exit code 0.',
          });
          completedSuccessfully = true;
          break;
        } else {
          yield emit({
            type: 'agent_step',
            agent: 'harness',
            status: 'error',
            thought: `Verification failed (exit code ${harnessResult.exitCode}). ${
              iteration < maxIterations ? 'Feeding logs to refiner loop.' : 'Reached max iterations limit.'
            }`,
          });
        }
      } else {
        completedSuccessfully = true;
        break;
      }
    }

    // Save final code message to database if session is specified
    if (options.sessionId && this.db) {
      try {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sessionId: options.sessionId,
          role: 'assistant',
          content: currentCode,
          createdAt: Date.now(),
        };
        this.db.addMessage(assistantMsg);
      } catch {}
    }

    // Final Done Event
    yield emit({
      type: 'done',
      done: true,
      summary: {
        iterations: executedIterations,
        passed: completedSuccessfully,
        finalCode: currentCode,
        harnessLogs: lastHarnessResult?.logs,
      },
    });
  }
}
