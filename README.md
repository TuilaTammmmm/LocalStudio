# ⚡ LocalAI Desktop Studio

> **Local-First, Privacy-Centric AI Workstation with CUDA Acceleration, Smart Auto-Routing & Glassmorphism UI**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.7-orange.svg)](https://hono.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![CUDA](https://img.shields.io/badge/CUDA-GTX%201650%20(4GB)-green.svg)](https://developer.nvidia.com/cuda-zone)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

**LocalAI Desktop Studio** is a standalone, local AI application designed for developers who want the responsiveness, privacy, and full control of local Large Language Models (LLMs) combined with cloud fallback.

Optimized specifically for consumer GPUs (such as **NVIDIA GeForce GTX 1650 4GB VRAM**), LocalAI dynamically computes layer offloading (`-ngl 21` for 8B models, `-ngl 99` for 3B models) with a strict 1000MB OS display buffer, preventing CUDA Out-Of-Memory (OOM) crashes on Windows.

---

## ✨ Key Features

### 1. 🔮 Smart Auto Model Router & In-Chat Switcher
- **Direct Model Switcher Pill Bar**: Seamlessly toggle directly from the chat interface between:
  - `[🔮 Auto-Route]`: Automatically analyzes prompt intent and attachments.
  - `[⚡ Qwen-3B]`: Ultra-fast local general chat (~40-60 t/s).
  - `[💻 Coder-7B]`: Specialized code review, debugging & refactoring.
  - `[🧠 DeepSeek-R1]`: Deep reasoning with collapsible `<think>` process accordion.
  - `[👁️ Vision (Qwen2-VL)]`: Multimodal analysis triggered by screenshot / image attachments.
  - `[🌐 FreeLLM Cloud]`: 70B+ model fallback for heavy context queries (>6000 tokens).
- **Searchable Model Filter**: Instant lookup for any custom GGUF or remote model.

### 2. 🎛️ Settings Studio & GGUF Model Hub
- Integrated 2-column Glassmorphic Studio:
  - **Auto Model Router Config**: Customize target models for each specialty.
  - **Model Hub & Library**: One-click GGUF downloader with real-time download progress.
  - **Local Skills & Slash Commands**: Auto-detects `SKILL.md` from global paths (`~/.gemini`, `~/.skills`, workspace `.skills`).
  - **Multi-Provider Keys**: Support for llama.cpp, Ollama, and FreeLLM / OpenAI-compatible APIs.
  - **CUDA & VRAM Hardware Gauge**: Live VRAM telemetry and offload calculator.
  - **About & App Updates**: Version inspection and GitHub Releases update checker.

### 3. 📂 Workspace Folders & Unified Folder Tools
- Project folder isolation with multiple chat sessions per workspace.
- **Unified Right Sidebar** with 5 switchable tabs:
  - `Files`: Interactive file tree with one-click `@file` context pinning.
  - `Shell`: Embedded PowerShell terminal executing commands in workspace cwd.
  - `Web`: In-App Browser preview (`http://localhost:3000`).
  - `RAG`: Offline vector store status and semantic search overview.
  - `Prompt`: Workspace-specific system instructions.

### 4. 💎 Ultra-Modern Glassmorphic UI (Glassy & Spacious)
- Refined vertical spacing (`h-14` header, floating bottom composer with safe margins).
- LM Studio inference statistics HUD (`tokens/s`, `TTFT`, `token counter`).
- Mac-style syntax-highlighted code blocks with one-click copy.

---

## 🏗️ Architecture

```
LocalAI/
├── src/
│   ├── client/                  # Frontend (React 19 + Tailwind + Lucide)
│   │   ├── components/
│   │   │   ├── ChatView.tsx     # In-Chat Model Switcher, Auto-Route & Messages
│   │   │   ├── ChatInput.tsx    # Composer with Image Attachment & Slash Skills
│   │   │   ├── ChatMessageItem.tsx # Reasoning <think> accordion & Code blocks
│   │   │   ├── RightSidebar.tsx # Files, Shell (Terminal), Web (Browser), RAG, Prompt
│   │   │   ├── LeftSidebar.tsx  # Workspaces & Session History
│   │   │   ├── Header.tsx       # VRAM Gauge, Provider Switcher & Settings
│   │   │   └── SettingsModal.tsx# Studio Hub, Model Downloader, Updater
│   │   ├── App.tsx              # Root reactive state orchestrator
│   │   └── index.css            # Glassmorphism design tokens & animations
│   │
│   ├── hardware.ts              # NVIDIA CUDA & RAM probing, -ngl calculator
│   ├── llama-process.ts         # llama-server.exe process lifecycle manager
│   ├── auto-router.ts           # Semantic intent classifier (Code/Reason/Vision/Heavy)
│   ├── model-hub.ts             # Curated GGUF catalog & compatibility evaluator
│   ├── model-downloader.ts      # HTTP chunked stream model downloader
│   ├── updater.ts               # App version info & GitHub update checker
│   ├── router.ts                # Multi-Provider SSE streaming & fallback engine
│   ├── workspace-fs.ts          # File tree scanner & tokenizer
│   ├── context-builder.ts       # @file context assembler
│   ├── skills-scanner.ts        # Global & local SKILL.md recursive scanner
│   ├── skills-runner.ts         # Slash command execution & prompt injection
│   ├── db.ts                    # SQLite/JSON persistence layer
│   └── server.ts                # Hono REST & SSE API server (Port 3001)
│
├── test/                        # 7 comprehensive unit & integration test suites
├── models/                      # Local .gguf weights (git-ignored)
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20+ or v24+
- **pnpm**: v9+ or v12+
- **NVIDIA GPU** (Optional but recommended): Driver 520+ with CUDA support.

### 1. Install Dependencies
```powershell
pnpm install
```

### 2. Start Development Servers
Runs both the Hono API server (`port 3001`) and Vite Client (`port 3000`):
```powershell
pnpm dev:all
```
Open **`http://localhost:3000`** in your browser.

### 3. Run Automated Tests
```powershell
pnpm test
```
Runs 7 test suites validating:
- Database CRUD
- Hardware detection & layer offload formulas
- Multi-Provider router & latency sync
- Workspace filesystem tree
- Local skills parser & slash command matcher
- REST & SSE endpoints
- Auto Model Router intent classification (General, Code, Reasoning, Vision)

### 4. Build for Production
```powershell
pnpm build
```

---

## 📦 Desktop App Packaging Roadmap: Tauri 2.0 (Rust)

To package LocalAI into a standalone native desktop app (`.exe`), the recommended target is **Tauri 2.0 with Rust**:

| Criteria | Tauri 2.0 (Rust) | Electron | Node + Browser (Current) |
|---|---|---|---|
| **Binary Size** | **~10 - 15 MB** | ~150 - 200 MB | Requires Node.js installed |
| **Idle Memory (RAM)** | **~35 - 50 MB** | ~200 - 400 MB | Dependent on Chrome tab |
| **llama.cpp Process Control** | **Native Windows Job Objects** (No zombie processes on crash) | ChildProcess wrapper | Node child_process |
| **Frontend Code Reuse** | **100% of current React UI** | 100% of current React UI | 100% |
| **Auto-Updater** | Built-in `@tauri-apps/plugin-updater` | electron-updater | Custom REST updater |

---

## 📄 License
MIT License © 2026 LocalAI Studio.
