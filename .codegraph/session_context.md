# Session Context & Architectural Decisions

## System Environment
- **GPU**: NVIDIA GeForce GTX 1650 (4096 MiB VRAM), Driver 621.24, CUDA 13.5 / 12.x compatible.
- **RAM**: 8.0 GB RAM | **Node.js**: v24.13.0, pnpm v12.15.0, Python 3.12.10.

## Core Architecture
- **Inference**: Embedded `llama.cpp` + Multi-Provider Router (Ollama, LM Studio, FreeLLM, Cloud).
- **Offload Policy (GTX 1650)**: 1.5B-3B: 100% GPU (`-ngl 99`). 7B-8B: Hybrid (`-ngl 21`, `-t 4`, `-fa`).
- **Storage**: Lightweight atomic JSON database (`.data/database.json`), GGUF storage (`models/`).

## Key Decisions & Conventions
- Pure Vietnamese translation without English in parentheses.
- Deleted providers tracked via `deletedProviderIds` to prevent resurrection.
- `local-llama` hidden from external providers grid; dynamically populates from `models/*.gguf`.
- Left & Right sidebars both support smooth 60fps draggable resizing with localStorage persistence.
- Nested workspace file paths always computed relative to workspace root (fixed file preview).
- Model Hub saves exact `.gguf` filename and checks disk presence dynamically.
- Removed app cache cleanup UI; only PC storage paths with Explorer links are maintained.
- Clipboard image pasting (`Ctrl+V`) supported directly in chat input.
- Folder picker forces foreground focus on Windows; Tauri native dialog preferred.
- Quick folder suggestions removed; inline rename with confirm/cancel for chats and projects.
- Pinned context files strictly scoped to active workspace.
- Added workspace delete action and 1-click models folder opener in Model Hub.
- All-in-One installer: embedded portable runtime & bundled backend into Tauri resources.
