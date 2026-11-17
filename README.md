# ⚡ LocalAI Desktop Studio

> **Privacy-First AI Workstation with CUDA Acceleration, Smart Auto-Routing, GGUF Model Hub & Glassmorphism UI**

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-blue.svg)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-45.3-47848F.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-orange.svg)](https://hono.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![CUDA](https://img.shields.io/badge/CUDA%20Offload-GTX%201650%20(4GB)-green.svg)](https://developer.nvidia.com/cuda-zone)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

**Languages:** [🇬🇧 English](#english) • [🇻🇳 Tiếng Việt](#tiếng-việt)

---

<a id="english"></a>
# 🇬🇧 English Documentation

## 🌟 Overview

**LocalAI Desktop Studio** is a standalone, local-first AI application designed for developers and researchers who demand high responsiveness, privacy, and full control over local Large Language Models (LLMs) with optional cloud fallback.

Optimized specifically for consumer hardware (such as **NVIDIA GeForce GTX 1650 4GB VRAM / 8GB-16GB RAM**), LocalAI dynamically computes optimal GPU layer offloading (`-ngl 99` for 1B-3B models, dynamic hybrid splitting for 7B-8B) with a 1,000MB OS display buffer, completely preventing CUDA Out-Of-Memory (OOM) crashes on Windows.

---

## ✨ Key Features

### 1. ⚡ Embedded `llama.cpp` Runtime (Zero-Terminal Setup)
- **Automatic Lifecycle Control**: Embedded `llama-server.exe` with CUDA 12.x (`ggml-cuda.dll`) and CPU AVX2 runtimes.
- **On-Demand Launching**: Automatically starts the inference server upon sending a message and releases memory when closed without orphaned processes.
- **Dynamic Hot-Reloading**: Seamlessly switches models in VRAM when selecting a different model from the chat bar.
- **Flash Attention**: Enables Flash Attention (`-fa on`) to save up to 30% VRAM.

### 2. 🎛️ GGUF Model Hub & Hardware Tuner
- **HTTP Streaming Downloader**: Direct downloads of quantized GGUF weights (`Q4_K_M`) from Hugging Face CDN endpoints with real-time progress indicators.
- **Permanent Model Management**: Safely delete local model files from `%USERPROFILE%\LocalAI\models` with server unlinking and file-lock protection.
- **Live Strategy Feedback**: Real-time display indicating whether models will execute in **Full GPU Offload** or **Hybrid GPU+CPU**.
- **Centralized Hardware Tuning**: Fine-tune GPU Layers (`-ngl`), Context Size (`-c`), CPU Threads (`-t`), and Flash Attention (`-fa`).

### 3. 🔮 Smart Auto-Model Router & In-Chat Switcher
- **Prompt Intent Analysis**:
  - `[🔮 Auto-Route]`: Automatically analyzes prompt semantics and image attachments.
  - `[⚡ Qwen-3B / Llama-1B]`: Ultra-fast general dialogue (>60 tokens/s).
  - `[💻 Coder-7B]`: Code generation, debugging, and refactoring.
  - `[🧠 DeepSeek-R1]`: Deep reasoning with collapsible `<think>` thought boxes.
  - `[👁️ Vision]`: Multimodal visual reasoning and screenshot inspection.
  - `[🌐 Cloud Provider]`: Seamless fallback to cloud APIs for heavy queries (>6,000 tokens).

### 4. 📂 Workspaces & Unified Developer Sidebar
- **Workspace Isolation**: Separate conversation sessions and project directories.
- **5-in-1 Side Tools**:
  - `Files`: Interactive file browser with `@filename` context injection.
  - `Shell`: Sandboxed PowerShell terminal executing inside project root.
  - `Web`: In-App Browser preview for local servers (`http://localhost:3000`).
  - `RAG`: Offline vector storage monitoring and semantic search.
  - `Prompt`: Workspace-level custom system instructions.

### 5. 💎 Modern Glassmorphic Interface
- Dark Midnight theme built with React 19, TailwindCSS, and Lucide icons.
- Real-time telemetry dashboard: Tokens per second (`t/s`), Time-to-First-Token (`TTFT`), and token counters.
- Full bilingual localization: English & Vietnamese.

---

## 🏗️ Architecture

```
LocalAI/
├── electron/                    # Electron Host Process
│   ├── main.ts                  # Main process lifecycle, single-instance lock
│   └── preload.ts               # Secure context bridge (IPC)
├── build-assets/                # Multi-resolution icons (.ico, .png, .icns)
├── src/
│   ├── client/                  # Frontend (React 19 + Vite + TailwindCSS)
│   │   ├── components/          # Chat, Settings, Workspaces, Sidebars
│   │   ├── App.tsx              # Reactive state orchestration
│   │   └── i18n.ts              # English / Vietnamese translations
│   ├── hardware.ts              # GPU telemetry (nvidia-smi) & memory detection
│   ├── llama-process.ts         # Child process manager for llama-server CUDA
│   ├── auto-router.ts           # Semantic intent classifier
│   ├── model-hub.ts             # GGUF catalog & compatibility calculator
│   ├── model-downloader.ts      # Chunked streaming downloader
│   ├── router.ts                # Multi-provider router & SSE streamer
│   ├── workspace-fs.ts          # Safe filesystem & path-traversal guard
│   ├── db.ts                    # Atomic local JSON database
│   └── server.ts                # Hono REST & SSE API server
├── test/                        # 7-phase automated test suites
├── electron-builder.json        # Windows installer & portable packaging config
└── README.md
```

---

## 💻 System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| **Operating System** | Windows 10 64-bit | Windows 11 64-bit |
| **Processor** | 4-Core CPU (Intel i5 / AMD Ryzen 5) | 6+ Core CPU |
| **System RAM** | 8 GB | 16 GB or higher |
| **Graphics (GPU)** | Integrated Graphics (CPU Mode) | NVIDIA GTX 1650 4GB+ (CUDA) |
| **Available Disk** | 10 GB SSD | 30+ GB SSD (for multiple GGUF models) |

---

## 🚀 Getting Started

### 1. Installation
```powershell
# Clone the repository
git clone https://github.com/TuilaTammmmm/LocalStudio.git
cd LocalStudio

# Install all dependencies
pnpm install
```

### 2. Development Mode
Run Vite and Electron concurrently:
```powershell
pnpm electron:dev
```
*(Or run in browser mode: `pnpm dev:all` $\rightarrow$ open `http://localhost:3000`)*

### 3. Automated Tests
Run all 7 test suites validating backend, security, and hardware detection:
```powershell
pnpm test
```

### 4. Standalone Windows Packaging (.exe)
Build standalone installer and portable packages without requiring Node.js on end-user machines:
```powershell
pnpm electron:build
```
Outputs in `release/`:
- `LocalAI Studio Setup 0.1.0.exe`: Standard NSIS installer with Desktop and Start Menu shortcuts.
- `LocalAI Studio 0.1.0.exe`: Portable standalone executable.

---

<br/>

---

<a id="tiếng-việt"></a>
# 🇻🇳 Tài liệu Tiếng Việt

## 🌟 Giới thiệu tổng quan

**LocalAI Desktop Studio** là ứng dụng AI máy trạm độc lập (Standalone Desktop App) chạy hoàn toàn trên máy tính của bạn, kết hợp sức mạnh suy luận mô hình lớn cục bộ (Local LLMs) với khả năng mở rộng Cloud API khi cần ngữ cảnh lớn.

Được tối ưu hóa chuyên sâu cho cấu hình phần cứng phổ thông (như **NVIDIA GeForce GTX 1650 4GB VRAM / 8GB-16GB RAM**), LocalAI tính toán phân bổ tầng GPU/CPU (`-ngl 21` cho 7B-8B, `-ngl 99` cho 1.5B-3B) với vùng đệm an toàn 1000MB VRAM cho Windows OS, ngăn ngừa triệt để lỗi tràn bộ nhớ đồ họa (CUDA Out-Of-Memory).

---

## ✨ Tính năng nổi bật

### 1. ⚡ Động cơ `llama.cpp` tích hợp sẵn (Không cần gõ Terminal)
- **Tự động quản lý tiến trình**: Đóng gói sẵn `llama-server.exe` cùng bộ thư viện CUDA 12.x (`ggml-cuda.dll`) và CPU AVX2.
- **Kích hoạt theo nhu cầu (On-Demand)**: Tự động khởi chạy engine khi gửi tin nhắn chat, tự động giải phóng tài nguyên khi đóng app, không để lại tiến trình chạy ngầm rác.
- **Hot-Reload VRAM**: Chuyển đổi mô hình mượt mà ngay trên thanh chat mà không cần khởi động lại ứng dụng.
- **Bật Flash Attention**: Hỗ trợ cờ `-fa on` giúp tiết kiệm đến 30% dung lượng VRAM.

### 2. 🎛️ Kho mô hình GGUF & Cài đặt phần cứng
- **Tải trực tiếp qua HTTP Streaming**: Tải các bản lượng tử hóa GGUF (`Q4_K_M`) từ máy chủ Hugging Face với thanh tiến trình real-time.
- **Quản lý & Xóa tệp an toàn**: Lưu trữ tại `%USERPROFILE%\LocalAI\models`, giải phóng file-lock trước khi xóa vĩnh viễn khỏi ổ cứng.
- **Gợi ý phân bổ phần cứng trực tiếp**: Hiển thị dự toán mô hình sẽ chạy ở chế độ **Full GPU Offload** hay **Hybrid GPU+CPU**.
- **Cấu hình phần cứng tập trung**: Tùy chỉnh GPU Layers (`-ngl`), Context Size (`-c`), CPU Threads (`-t`), và Flash Attention (`-fa`).

### 3. 🔮 Bộ định tuyến tự động & Chọn nhanh Model
- **Phân loại câu hỏi thông minh**:
  - `[🔮 Auto-Route]`: Tự động phân tích câu lệnh và hình ảnh đính kèm.
  - `[⚡ Qwen-3B / Llama-1B]`: Trò chuyện thường ngày siêu tốc (>60 tokens/s).
  - `[💻 Coder-7B]`: Chuyên biệt viết mã, kiểm thử và refactor code.
  - `[🧠 DeepSeek-R1]`: Suy luận từng bước với hộp tư duy `<think>` thu gọn/mở rộng.
  - `[👁️ Vision]`: Nhận diện ảnh chụp màn hình và sơ đồ kiến trúc.
  - `[🌐 Cloud Provider]`: Tự động fallback sang Cloud API khi ngữ cảnh vượt ngưỡng (>6000 tokens).

### 4. 📂 Không gian làm việc & Thanh công cụ lập trình
- **Cô lập dự án**: Mỗi Workspace quản lý danh mục tệp và các phiên hội thoại riêng biệt.
- **5 công cụ trong 1**:
  - `Tệp (Files)`: Cây thư mục tương tác, đính kèm ngữ cảnh nhanh bằng `@tên_tệp`.
  - `Shell (Terminal)`: Terminal PowerShell tích hợp cơ chế bảo vệ chống lệnh nguy hiểm (`rmdir`, `format`).
  - `Trình duyệt (Web)`: Xem trước giao diện localhost trực tiếp trong app (`http://localhost:3000`).
  - `RAG`: Theo dõi chỉ mục vector và tìm kiếm ngữ nghĩa offline.
  - `Chỉ dẫn (Prompt)`: Cấu hình system prompt riêng cho từng dự án.

### 5. 💎 Giao diện Glassmorphism hiện đại
- Giao diện Dark Midnight với React 19, TailwindCSS và Lucide icons.
- Đồng hồ đo hiệu năng theo thời gian thực: tốc độ sinh từ (`t/s`), độ trễ token đầu (`TTFT`), và bộ đếm token.
- Hỗ trợ song ngữ hoàn chỉnh: Tiếng Việt & English.

---

## 💻 Yêu cầu hệ thống

| Thành phần | Tối thiểu (Minimum) | Khuyến nghị (Recommended) |
|---|---|---|
| **Hệ điều hành** | Windows 10 64-bit | Windows 11 64-bit |
| **CPU** | 4 Cores (Intel Core i5 / AMD Ryzen 5) | 6+ Cores |
| **RAM** | 8 GB | 16 GB trở lên |
| **GPU** | Tích hợp (chạy CPU mode) | NVIDIA GTX 1650 4GB trở lên (CUDA) |
| **Ổ cứng trống** | 10 GB SSD | 30+ GB SSD (chứa nhiều model GGUF) |

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Cài đặt thư viện
```powershell
# Clone mã nguồn
git clone https://github.com/TuilaTammmmm/LocalStudio.git
cd LocalStudio

# Cài đặt toàn bộ packages
pnpm install
```

### 2. Chạy chế độ phát triển (Development)
```powershell
pnpm electron:dev
```
*(Hoặc chạy giao diện web trên trình duyệt: `pnpm dev:all` $\rightarrow$ truy cập `http://localhost:3000`)*

### 3. Chạy kiểm thử tự động (Unit & Integration Tests)
```powershell
pnpm test
```

### 4. Đóng gói ứng dụng Desktop (.exe)
Tạo file cài đặt độc lập cho người dùng cuối mà không cần cài Node.js hay pnpm:
```powershell
pnpm electron:build
```
Các gói đầu ra nằm trong thư mục `release/`:
- `LocalAI Studio Setup 0.1.0.exe`: Bộ cài đặt Windows tiêu chuẩn (NSIS), tự tạo shortcut Desktop & Start Menu.
- `LocalAI Studio 0.1.0.exe`: Bản Portable chạy trực tiếp không cần cài đặt.

---

## 📄 Bản quyền (License)

Dự án phát hành theo giấy phép mã nguồn mở **MIT License**. Tự do sử dụng, chỉnh sửa và phân phối cho mục đích cá nhân lẫn thương mại.
