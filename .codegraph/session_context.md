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
