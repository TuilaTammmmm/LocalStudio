# Session Context & Architectural Decisions

## System Environment Detected
- **GPU**: NVIDIA GeForce GTX 1650 (4096 MiB VRAM), Driver 621.24, CUDA 13.5 / 12.x compatible.
- **RAM**: 8.0 GB System RAM.
- **Node.js**: v24.13.0, pnpm v12.15.0, Python 3.12.10.

## Project: Local AI Desktop Application
- **Inference Engine**:
  - Embedded `llama.cpp` (`llama-server.exe` with CUDA 12 + AVX2 fallback).
  - Multi-Provider Router: Supports FreeLLM API, Custom OpenAI-compatible URLs, OpenRouter, Groq, Ollama.
- **GPU/CPU Offload Policy (GTX 1650 4GB VRAM + 8GB RAM)**:
  - 1.5B - 3B models: 100% GPU offload (`-ngl 99`).
  - 7B - 8B models: Hybrid offload (~18-22 layers to GPU, remainder to CPU with `-t 4`).
  - KV Cache quantization (`-ctk q8_0 -ctv q8_0`) & Flash Attention (`-fa`).
## Backend Core Completed (Hono + TypeScript)
- `src/types.ts`: Core data structures (Workspace, Session, Message, Provider, Skill, HardwareStats).
- `src/db.ts`: Lightweight, zero-dependency persistent JSON storage with atomic writes.
- `src/hardware.ts`: NVIDIA GTX 1650 (4GB) VRAM & CPU monitor with Smart Offload calculator (`-ngl 21` for 8B models, `-ngl 99` for 3B models).
- `src/llama-process.ts`: Pre-configured lifecycle manager for `llama-server.exe` with stdout log parsing, health checking, and graceful shutdown.
- `src/provider-client.ts`: SSE streaming client supporting OpenAI format, FreeLLM API, and reasoning/thinking tokens (`delta.reasoning_content`).
- `src/router.ts`: Multi-provider router with seamless switching between local CUDA and remote/FreeLLM endpoints.
- `src/workspace-fs.ts`: Recursive file tree scanner with smart ignore list (`node_modules`, `.git`, binaries).
- `src/context-builder.ts`: Safe `@file` context injection with token estimator and size limits.
- `src/skills-scanner.ts` & `src/skills-runner.ts`: Scan and execute local `SKILL.md` folders and slash commands (`/review`).
## Frontend Core Completed (React 19 + Vite + Tailwind + Lucide)
- `src/client/App.tsx`: Main application container wiring real-time SSE streaming, hardware stats polling, workspace & session management.
- `src/client/components/Header.tsx`: Top header with inference provider selector (Local CUDA vs FreeLLM), real-time GTX 1650 VRAM gauge, and tools toggle.
- `src/client/components/LeftSidebar.tsx`: Multi-Chat sessions manager grouped by project folder, `+ Add Project Folder`, and `+ New Chat` shortcuts.
- `src/client/components/RightSidebar.tsx`: Collapsible Folder Tools with interactive File Tree Explorer (`[📌]` pin-to-context buttons), RAG offline indexer, and folder system prompt.
- `src/client/components/ChatView.tsx`: Main chat area with auto-scrolling message list.
- `src/client/components/ChatMessageItem.tsx`: Rich message renderer with Collapsible Thinking Process Accordion (`<think>...`), code block copy button, and avatar styling.
- `src/client/components/ChatInput.tsx`: Smart multi-line input box supporting `@file` mention popup, `/skill` slash command autocomplete, context chips, and streaming abort.
- `src/client/components/SettingsModal.tsx`: Comprehensive modal for Local Skills management (scan PC folder, toggle skills), Provider & Keys (FreeLLM API, sync models), and CUDA Offload settings.
- `src/client/components/NewWorkspaceModal.tsx`: Modal to register folders on PC as isolated workspaces.
- `src/model-hub.ts`: LM Studio-style hardware compatibility evaluator (status: 'full-gpu', 'hybrid', 'cpu-only') with recommended `-ngl` layers and speed estimate.
- `src/client/components/ModelHubModal.tsx`: Dedicated Model Discovery & GGUF Tuner Modal featuring curated models, GPU offload slider (`-ngl`), context length (`-c`), and Flash Attention toggle.
- `src/client/components/ChatMessageItem.tsx`: LM Studio-style Generation Stats Bar (`41.2 t/s`, `TTFT: 220ms`, `Tokens: ~X`) rendered below each response.
- Production build verified: `dist/index.html` built cleanly in 11.49s.

- `src/auto-router.ts`: Smart Auto-Model Router that dynamically analyzes prompt intent (Coding vs Reasoning vs Fast Chat vs Heavy Context) to dispatch to the optimal model.
- `src/client/components/BottomDrawer.tsx`: In-App Terminal (PowerShell execution via `/api/terminal/run`) + In-App Browser Preview (`iframe` with live URL navigation).
- `src/client/components/SettingsModal.tsx`: Complete redesign into a 2-Column Settings Studio (Raycast/Linear style) with Auto-Router, Skills, Providers, CUDA, RAG, and Terminal tabs.



- **Local Skills System**:
  - Scanner for local folders containing `SKILL.md` + scripts.
  - Invocation via Slash commands (`/skill-name`) or autonomous tool-calling with Safe Execution prompt.
- **Security**: AES-256 local encrypted vault for API keys & custom headers.


