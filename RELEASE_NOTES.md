# LocalAI Studio v0.1.0 - Release Notes

> **Initial Standalone Desktop Release: Privacy-First AI Workstation with CUDA Acceleration, Smart Auto-Routing, GGUF Model Hub & Glassmorphic UI**

---

## 🚀 Highlights

LocalAI Studio v0.1.0 is the first official desktop release, transforming LocalAI into a fully self-contained, standalone desktop workstation (`.exe`) for Windows. It delivers 100% offline local inference with embedded NVIDIA CUDA acceleration, intuitive GGUF model downloading, smart multi-model routing, and modern developer workspace tools—requiring zero terminal setup for end users.

---

## ✨ What's New

### 1. ⚡ Embedded `llama.cpp` Runtime & Automated Process Lifecycle
- **Zero-Terminal Experience**: The app bundles `llama-server.exe` with CUDA 12.x (`ggml-cuda.dll`) and CPU AVX2 runtimes.
- **On-Demand Auto-Spawning**: Automatically spawns and warms up the local inference process when a chat prompt is submitted, and gracefully terminates on application exit (preventing orphaned/zombie processes).
- **Dynamic Hot-Reloading**: Seamlessly switches models in VRAM when selecting a different model from the chat switcher bar.
- **Hardware-Aware Offload Engine**: Computes optimal GPU layer offload (`-ngl 99` for 1B-3B models, dynamic hybrid splitting for 7B-8B) with a 1000MB safety buffer to prevent Windows display driver CUDA Out-Of-Memory (OOM) crashes.
- **Flash Attention Optimization**: Enables Flash Attention (`-fa on`) to reduce VRAM memory usage by up to 30%.

### 2. 🎛️ GGUF Model Hub & Hardware Studio
- **Direct Hugging Face Downloads**: Stream and download quantization files (`Q4_K_M`) directly from CDN endpoints with real-time chunked progress tracking.
- **Permanent Model File Management**: Safely delete downloaded GGUF weights with file-lock release and confirmation modal hierarchy.
- **Unified Hardware Tuner**: Dedicated GPU & Hardware settings tab with sliders for GPU Layers (`-ngl`), Context Window (`-c`), CPU Threads (`-t`), and Flash Attention (`-fa`).
- **Live Strategy Indicator**: Real-time feedback calculating whether the active model runs in *Full GPU Offload* or *Hybrid GPU+CPU*.

### 3. 🔮 Smart Auto-Model Router & In-Chat Switcher
- **Semantic Intent Classifier**: Analyzes prompts and attachments to automatically select the optimal model:
  - `[⚡ Qwen / Llama-1B]`: Everyday conversational queries (>60 tokens/sec).
  - `[💻 Coder-7B]`: Code generation, debugging, and refactoring.
  - `[🧠 DeepSeek-R1]`: Step-by-step reasoning with collapsible `<think>` process view.
  - `[👁️ Vision]`: Image and screenshot multimodal analysis.
  - `[🌐 Cloud Fallback]`: Automatic fallback to cloud providers (FreeLLM / OpenAI compatible) for heavy context queries (>6,000 tokens).
- **Interactive Quick-Pill Bar**: Instant one-click model and provider switching directly inside the message composer.

### 4. 📂 Unified Developer Workspace & Sidebars
- **Workspace Isolation**: Manage distinct project directories and conversation sessions.
- **5-in-1 Tools Sidebar**:
  - `Files`: Interactive file tree with `@filename` context injection.
  - `Shell`: Embedded PowerShell terminal with destructive command sandbox protection (`rmdir`, `format`).
  - `Web`: Built-in web preview for local servers (`http://localhost:3000`).
  - `RAG`: Offline vector store indexing status and semantic search overview.
  - `Prompt`: Workspace-specific system instruction customizer.

### 5. 💎 Modern Glassmorphic Interface & Bilingual Support
- **Dark Midnight Glassmorphism**: TailwindCSS design with blurred backdrops and clean typography.
- **Live Telemetry Dashboard**: Real-time metrics showing tokens per second (`t/s`), time to first token (`TTFT`), and total token counter.
- **Markdown & Syntax Highlighting**: Rich Markdown rendering, syntax-highlighted code blocks with 1-click copy.
- **Complete Bilingual Localization**: Instant switching between English and Vietnamese.

---

## 🛠️ Bug Fixes & Improvements

- **llama.cpp Process Arguments**: Fixed `-fa` argument parsing for recent llama.cpp releases by supplying explicit value (`-fa on`).
- **Windows CUDA DLL Resolution**: Updated process launcher to set working directory and prioritize `bin/` path, ensuring proper loading of `ggml-cuda.dll` and runtime dependencies.
- **Hierarchical Modal Navigation**: Fixed keyboard `ESC` and backdrop click handling so that nested confirmation dialogs close first without dismissing parent settings or reverting to chat.
- **Windows File Lock Resolution**: Added server-side process stopping before file unlinking to prevent Windows `EBUSY` file locking errors during model deletion.
- **Settings State Persistence**: Centralized hardware tuning into database storage (`local-llama` provider) to prevent slider resets on model selection or modal reopening.
- **Codebase Clean-Up**: Removed obsolete Tauri 2.0 scaffold files, streamlined build configurations, and added GitHub CI automation.

---

## 💻 System Requirements

| Specification | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 64-bit | Windows 11 64-bit |
| **Processor** | 4-Core CPU (Intel Core i5 / AMD Ryzen 5) | 6+ Core CPU |
| **Memory (RAM)** | 8 GB | 16 GB or higher |
| **Graphics (GPU)** | Integrated Graphics (CPU Mode) | NVIDIA GeForce GTX 1650 4GB+ (CUDA) |
| **Storage** | 10 GB SSD free space | 30+ GB SSD (for multiple GGUF models) |

---

## 📦 Distribution Packages

- **`LocalAI Studio Setup 0.1.0.exe`**: Standard Windows NSIS Installer (Desktop shortcut & Start menu entry).
- **`LocalAI Studio 0.1.0.exe`**: Portable executable (runs without installation).

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial use.
