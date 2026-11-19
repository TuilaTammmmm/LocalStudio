# Session Context & Architectural Decisions

## System Environment
- **GPU**: NVIDIA GeForce GTX 1650 (4096 MiB VRAM), Driver 621.24, CUDA 13.5 / 12.x compatible.
- **RAM**: 8.0 GB RAM | **Node.js**: v24.13.0, pnpm v12.15.0, Python 3.12.10.

## Core Architecture
- **Inference**: Embedded `llama.cpp` + Multi-Provider Router (Ollama, LM Studio, FreeLLM, Cloud).
- **Offload Policy (GTX 1650)**: 1.5B-3B: 100% GPU (`-ngl 99`). 7B-8B: Hybrid (`-ngl 21`, `-t 4`, `-fa`).
- **Storage**: Dynamic storage directory (`db.getModelsDir()`), lightweight atomic DB (`.data/database.json`).

## Key Decisions & Conventions
- Pure Vietnamese translation without English in parentheses.
- Native folder picker via `@tauri-apps/plugin-dialog` attached to window HWND (never buried behind window).
- Replaced browser `window.confirm` with in-app glassmorphic confirmation modal for model/provider deletion.
- Zero mock models: providers and model hub only list verified files physically present on disk.
- Instant model syncing on download/deletion via `syncLocalModels` and auto-refreshed ChatInput selector.
- Resilient file preview: fallback recursive search by filename inside workspace boundary (`state_machine.md`).
- Dynamic models folder configuration via `GET /api/system-paths` and `POST /api/settings/models-dir`.
- All-in-One installer: Standalone Electron runtime with internal Node.js backend.
- Modal Hierarchy: Strict ESC and backdrop click handling (`deleteConfirmModel` -> `deleteConfirmProvider` -> `isAddingCustomModel` -> `isAddingProvider` -> `onClose`).
- Model Storage: Unified models directory (`%USERPROFILE%\LocalAI\models`), multi-directory discovery, and safe deletion fallback.
- ChatInput UI: Responsive non-wrapping buttons (`whitespace-nowrap shrink-0`) preventing layout overlapping.
- Global Hardware Config: Removed fragile per-model sliders from Model Hub; centralized permanently saved GPU/CPU flags (`-ngl`, `-c`, `-t`, `-fa`) in dedicated "Cấu hình GPU & Phần cứng" tab.
- v1.0.1 Upgrade: Upgraded engine to dynamic hardware auto-scaling (4GB up to 24GB+ VRAM), physical CPU core threading (-t), llama.cpp --context-shift, -fa on, stream <think> parser for DeepSeek-R1, and safe dry_penalty_last_n = 0.
- v1.0.2 Model Stability Fix: Fixed Gemma 2 / DeepSeek Jinja 400 & degradation by enforcing message alternation, prepending system prompt to user for Gemma, lowering local default sampling to temp 0.3 / top-p 0.85, removing destructive dry_multiplier, and extending llama-server readiness timeout to 90s for large models.
- v1.0.3 Smart Presets & Per-Model Config: Added auto-detection engine (Gemma, DeepSeek-R1, Qwen Coder, Llama), database persistence for modelConfigs, per-model settings modal UI with auto-presets button, and instant router parameter binding upon chat.
- v1.0.2 Version Bump & Updater Fix: Upgraded version to 1.0.2 in package.json and AppUpdater, linked official GitHub repo TuilaTammmmm/LocalWorkspace, resilient package.json resolution inside packaged asar, and added direct download button in SettingsModal.
- v1.0.4 Workspace Agent & Auto-Apply Overhaul: Added POST /api/workspaces/:id/file/save API, 1-click 'Lưu vào file' on ChatMessageItem CodeBlocks, auto-apply toggle on ChatInput, auto workspace environment context injection (project name, root path & file tree) into prompts, safe GTX 1650 hardware clamping (<=24 layers, <=4096 ctx for 7B/8B models), auto-restart on hardware setting change (isHardwareConfigChanged), symlink support in SkillsScanner discovering 59 local skills including docx, and docx text extraction in ContextBuilder.
- v1.0.5 Full Master Plan Execution: Implemented APPDATA persistence (%APPDATA%\LocalAI\data) with legacy auto-migration and database.backup.json corruption safeguard to survive updates/reinstalls; 1-click Revert/Undo for file changes via POST /api/workspaces/:id/file/revert and hidden .localai/backups; 1-click terminal 'Hỏi AI sửa lỗi' error dispatch; 20-min idle auto-unload of llama-server from GPU VRAM; Markdown chat session export button in LeftSidebar.
- v1.0.6 Swarm & Anti-Verbosity Suite: SwarmEngine 4-agent sequential pipeline (Coordinator -> Coder -> Critic -> Refiner -> HarnessRunner with MAX_ITERATIONS = 2 guard, 20s timeout, Windows taskkill /PID /T /F, and SSE streaming); anti-verbosity negative constraint prompts; auto .localairules / .cursorrules discovery; [⚡ Ngắn gọn] toggle with concise sampling override (temp 0.2, topP 0.85, repeatPenalty 1.10, maxTokens 1536); AgentWorkshop animated SVG UI with collapsible dock [🌐 💻 🔍 ⚡] and thought drawer; inline Unified Diff Viewer [Code | So sánh]; and keyboard-navigated @file mention dropdown. Verified 8/8 tests passed and packaged installer.
- v1.0.4 Anti-Amnesia, Anti-Repetition & Lazy Context Optimization: Bumped package.json, updater.ts, SettingsModal, and i18n to v1.0.4; implemented 40% History Reservation Quota in router.ts to prevent long prompts/attachments from wiping conversation memory; extended repeat_last_n to 256 and repeat_penalty to 1.10 with standard stop tokens (im_end, eot_id, end_of_turn, User) in provider-client.ts to cure infinite repetition loops; added Lazy Context Injection in server.ts to omit workspace file tree for general non-project questions; wrapped user prompt in anchor sandwich format to eliminate lost-in-the-middle wandering; wired /swarm command to execute via /api/swarm/execute-stream activating real multi-agent pipeline with dynamic coordinator planning. Verified all 8 test suites and production build 100% clean.
- Offline RAG & Custom Skill Integration Complete: Fully wired the previously disconnected Offline Vector RAG tab in RightSidebar with WorkspaceFS.searchWorkspaceRAG (zero VRAM overhead, 25-line sliding windows, BM25 keyword/phrase scoring, and 1-click 'Ghim vào Chat' and 'Xem tệp'); connected GET /api/workspaces/:id/rag/search in server.ts; updated SettingsModal RAG tab with specifications, safety filters, and usage guide; and wired client-side SSE listener for skill_activated to display interactive badge feedback when slash commands are triggered. Verified 8/8 tests and production Vite build passed exit code 0.
