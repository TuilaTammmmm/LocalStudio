# ⚡ LocalAI Desktop Studio (v1.0.5)

> **Máy trạm AI cục bộ độc lập với tăng tốc phần cứng NVIDIA CUDA, nhân Rust siêu tốc, kho mô hình Hugging Face & giao diện Glassmorphism hiện đại.**
> 
> *Standalone, privacy-first local AI workstation powered by bundled llama.cpp CUDA runtime, high-performance Rust core engine, live Hugging Face Hub search, and glassmorphic desktop interface.*

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-blue.svg)](https://microsoft.com/windows)
[![Version](https://img.shields.io/badge/Version-1.0.5-emerald.svg)](package.json)
[![Rust](https://img.shields.io/badge/Rust%20Engine-v0.1.0-orange.svg)](rust-tokenizer)
[![CUDA](https://img.shields.io/badge/CUDA%20Offload-GTX%201650%20(4GB)%20Ready-green.svg)](https://developer.nvidia.com/cuda-zone)
[![Electron](https://img.shields.io/badge/Electron-45.3-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-orange.svg)](https://hono.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

**Ngôn ngữ / Languages:** [🇻🇳 Tiếng Việt](#tiếng-việt) • [🇬🇧 English](#english)

---

<a id="tiếng-việt"></a>
# 🇻🇳 Tài liệu Tiếng Việt

## 🌟 Giới thiệu tổng quan

**LocalAI Desktop Studio v1.0.5** là ứng dụng máy trạm AI máy tính để bàn (Desktop App) hoạt động độc lập, ưu tiên bảo mật dữ liệu cục bộ 100%. Ứng dụng được thiết kế tối ưu hóa chuyên sâu cho phần cứng phổ thông (như **NVIDIA GeForce GTX 1650 4GB VRAM** và **8GB–16GB RAM**), tích hợp sẵn toàn bộ động cơ tính toán ma trận GPU CUDA và nhân **Rust** siêu tốc mà không yêu cầu người dùng phải cài đặt thêm môi trường phức tạp hay gõ lệnh terminal.

---

## ✨ Các tính năng cốt lõi (v1.0.5)

### 1. ⚡ Tích hợp sẵn Nhân GPU CUDA (Bundled llama.cpp Runtime)
- **Đóng gói sẵn 100% trong `bin/`**: Tích hợp trực tiếp `llama-server.exe`, `ggml-cuda.dll`, `cublas64_12.dll`, `cublasLt64_12.dll`, `cudart64_12.dll`.
- **Nhận diện CUDA tự động**: Nhận diện card đồ họa NVIDIA (CUDA0) ngay khi khởi chạy.
- **Tự động phân bổ Layer GPU (`-ngl`)**:
  - Mô hình nhỏ (1B – 3B): Đẩy 100% lên VRAM GPU (`-ngl 99`, tốc độ ~45 – 80 tokens/s).
  - Mô hình vừa (7B – 8B): Chế độ lai Hybrid thông minh (phần lớn layer trên GPU CUDA, phần còn lại trên CPU đa luồng, tốc độ ~10 – 20 tokens/s).
- **Tối ưu bộ nhớ**: Kích hoạt Flash Attention (`-fa`) tiết kiệm ~30% VRAM; tự động giải phóng mô hình khỏi VRAM sau 20 phút không hoạt động để trả lại bộ nhớ cho máy tính.

### 2. 🦀 Nhân Rust siêu tốc (Rust Core Acceleration)
- **Cắt Token thời gian thực (Rust Tokenizer Daemon)**: Viết bằng Rust với thư viện chính thức Hugging Face `tokenizers`, chạy ngầm dạng daemon JSON-RPC qua `stdin/stdout`. Cắt câu và chuyển thành Token ID trong thời gian dưới 1 phần nghìn giây (< 1ms).
- **Tự động tải `tokenizer.json`**: Khi tải model từ Hugging Face, bộ tải tự động quét và tải luôn tệp `tokenizer.json` về thư mục mô hình.
- **Tra cứu RAG ngoại tuyến đa luồng (`🦀 Tăng tốc Rust`)**: Quét và lập chỉ mục toàn bộ mã nguồn dự án, chia cửa sổ trượt 25 dòng và xếp hạng liên quan BM25/Exact Phrase bằng Rust với độ trễ < 5ms (nhanh gấp 30–50 lần JavaScript).

### 3. 🛡️ Chống tràn ngữ cảnh & Bảng phân tích Token (Token Budgeting)
- **Bảo vệ chống lỗi tràn bộ nhớ (Context Overflow Guard)**: Đo lường chính xác dung lượng của System Prompt, tệp đính kèm, lịch sử chat và câu hỏi; tự động gọt dũa lịch sử trò chuyện khi vượt quá độ dài ngữ cảnh (`n_ctx`), loại bỏ triệt để lỗi HTTP 400 (`request exceeds available context size`).
- **Bảng điều khiển Token HUD**: Hiển thị chi tiết số token từng thành phần ngay trên tin nhắn (Hệ thống, Ngữ cảnh, Lịch sử, Người dùng).

### 4. 🌐 Kho mô hình Hugging Face Hub & Đánh giá tài nguyên thời gian thực
- **Tìm kiếm trực tiếp từ Hugging Face Hub**: Tìm kiếm bất kỳ mô hình GGUF nào từ kho Hugging Face (`Qwen2.5-Coder`, `DeepSeek-R1`, `Llama-3.2`, `Gemma-2`, `Phi-4`,...).
- **Đánh giá tương thích theo thời gian thực**: Tự động tính toán dung lượng VRAM và RAM hệ thống khi kéo thanh trượt Layer GPU, báo cáo rõ ràng trạng thái "Đủ tài nguyên" hoặc "Không đủ RAM".
- **Nút từ điển mô hình `(i)`**: Giải thích chi tiết các thuật ngữ `Instruct`, `Abliterated`, `Thinking`, `Coder`, `Vision` và các bản lượng hóa `Q4_K_M`, `Q8_0` bằng tiếng Việt rõ ràng.

### 5. 🔌 Đa kết nối & Cổng kết nối API linh hoạt
- **Local llama.cpp**: Chạy GPU CUDA/CPU offline 100%.
- **Ollama & LM Studio**: Tự động kết nối tới cổng cục bộ (11434 / 1234).
- **Cloud API**: Tương thích chuẩn OpenAI / DeepSeek / vLLM / FreeLLM với nút tự động đọc danh sách mô hình từ khóa API.

### 6. 💾 Ghi nhớ trạng thái toàn diện & Giao diện toàn màn hình
- **Ghi nhớ kích cỡ & vị trí cửa sổ**: Tự động lưu và khôi phục kích cỡ cửa sổ, vị trí trên màn hình và trạng thái phóng to cực đại (`window-state.json`).
- **Ghi nhớ phiên làm việc**: Tự động khôi phục đúng Dự án và Phiên trò chuyện đang mở trước khi tắt ứng dụng.
- **Thanh khay hệ thống (System Tray)**: Thu nhỏ về khay hệ thống khi bấm nút đóng (X), tiếp tục phục vụ tiến trình AI nền mà không làm gián đoạn công việc.
- **Cài đặt Studio toàn màn hình**: Thiết kế rộng rãi, gom toàn bộ nút lưu thành một nút "Lưu thay đổi" duy nhất với thanh điều hướng hoàn tác (Undo/Revert) từng mục đã sửa.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu hệ thống:
- **Hệ điều hành**: Windows 10/11 64-bit.
- **Card đồ họa khuyến nghị**: NVIDIA GeForce GTX 1650 (4GB VRAM) hoặc cao hơn. Driver NVIDIA 535+ (khuyến nghị 621.x trở lên).
- **Node.js**: v20+ và **pnpm**: v9+ (nếu chạy từ mã nguồn).
- **Rust / Cargo**: 1.80+ (dùng để biên dịch engine Rust).

### Các lệnh thực thi:

```bash
# 1. Cài đặt các gói phụ thuộc
pnpm install

# 2. Khởi chạy ứng dụng Desktop đầy đủ (Bao gồm Electron + Server + Vite)
pnpm run dev:all
# hoặc
pnpm run app

# 3. Khởi chạy kiểm thử tự động toàn diện (8/8 bộ kiểm thử)
pnpm test

# 4. Biên dịch toàn bộ (Rust + Server TypeScript + Client React)
pnpm run build

# 5. Đóng gói ứng dụng thành file cài đặt Windows (.exe installer & portable)
pnpm run electron:build
```

---

<a id="english"></a>
# 🇬🇧 English Documentation

## 🌟 Overview

**LocalAI Desktop Studio v1.0.5** is a standalone, local-first AI desktop workstation engineered for high responsiveness, complete privacy, and zero terminal friction. Optimized specifically for consumer hardware (such as **NVIDIA GeForce GTX 1650 4GB VRAM / 8GB-16GB RAM**), LocalAI comes pre-packaged with a native **CUDA 12.x/13.5 llama.cpp runtime** and a **Rust-powered tokenization & RAG core engine**.

---

## ✨ Key Architectural Highlights (v1.0.5)

### 1. ⚡ Embedded CUDA Runtime (`bin/`)
- Pre-bundled with `bin/llama-server.exe`, `ggml-cuda.dll`, `cublas64_12.dll`, `cublasLt64_12.dll`, and `cudart64_12.dll`.
- Auto-detects NVIDIA GPUs (`CUDA0`) with automatic layer offloading (`-ngl 99` for 1B-3B models, dynamic hybrid GPU+CPU splitting for 7B-8B models).
- Supports Flash Attention (`-fa`) and 20-minute idle memory auto-unload.

### 2. 🦀 High-Performance Rust Core Engine
- **Sub-millisecond Tokenization**: Built on Hugging Face's official `tokenizers` crate, running as a long-lived JSON-RPC daemon over `stdin/stdout`.
- **Auto-Download Tokenizers**: Automatically fetches matching `tokenizer.json` files alongside GGUF downloads.
- **Ultra-Fast Offline RAG**: Multi-threaded codebase crawler and 25-line sliding-window BM25 ranker executing in under 5ms (`🦀 Tăng tốc Rust`).

### 3. 🛡️ Dynamic Token Budgeting & Context Overflow Guard
- Measures tokens accurately across System Prompts, RAG context, history, and queries.
- Dynamically trims conversation history before dispatching prompts, completely preventing HTTP 400 context overflow errors.
- Real-time HUD badges detailing token distribution per message.

### 4. 🌐 Hugging Face Hub Live Search & Quant Scanner
- Search GGUF repositories directly from Hugging Face Hub.
- Live VRAM and System RAM compatibility calculation updating dynamically with layer adjustments.
- Built-in Model Glossary modal explaining Instruct, Abliterated, Thinking, and Quantization schemes.

### 5. 🖥️ Native Desktop Persistence
- Persists window geometry (width, height, x, y, isMaximized) via `window-state.json`.
- Restores active workspace, session, sidebar toggles, and settings tabs on launch.
- Minimizes to Windows System Tray on close to keep background servers running smoothly.

---

## 🏗️ Project Structure

```
LocalStudio/
├── bin/                         # Bundled CUDA & Rust binaries (llama-server, rust-tokenizer, DLLs)
├── rust-tokenizer/              # Rust Core Engine crate (tokenizers, RAG search)
│   ├── Cargo.toml
│   └── src/main.rs
├── electron/                    # Electron Host Process
│   ├── main.ts                  # Main process, window state persistence, tray HUD
│   └── preload.ts               # Secure context bridge
├── build-assets/                # Multi-resolution icons (.ico, .png)
├── src/
│   ├── client/                  # Frontend (React 19 + Vite + TailwindCSS)
│   │   ├── components/          # ChatView, SettingsModal, Sidebars, Modals
│   │   ├── App.tsx              # Reactive state orchestration & persistence
│   │   └── i18n.ts              # English & Vietnamese localization
│   ├── hardware.ts              # GPU telemetry (nvidia-smi) & memory detection
│   ├── llama-process.ts         # Child process manager for CUDA llama-server
│   ├── rust-tokenizer.ts        # TypeScript daemon bridge for Rust Engine
│   ├── model-hub.ts             # GGUF catalog & real-time compatibility engine
│   ├── model-downloader.ts      # Chunked streaming downloader with auto-tokenizer
│   ├── token-utils.ts           # Token budgeting & context overflow guards
│   ├── router.ts                # Multi-provider router & pre-inference tokenization
│   ├── workspace-fs.ts          # Safe workspace filesystem & Rust-accelerated RAG
│   ├── db.ts                    # Atomic local database
│   └── server.ts                # Hono REST & SSE streaming server
├── test/                        # 8 automated unit & integration test suites
├── electron-builder.json        # Windows installer & portable packaging configuration
├── package.json                 # v1.0.5 configuration & build scripts
└── README.md                    # Bilingual documentation
```

---

## 🧪 Verification & Testing

LocalAI Studio maintains strict continuous verification:
```bash
# Run all 8 test suites:
pnpm test
```
- ✅ Database Service
- ✅ Hardware Monitor & CUDA Detection
- ✅ Multi-Provider Router
- ✅ Workspace Filesystem & Context Builder
- ✅ Local Skills Engine
- ✅ Hono REST & SSE API Server
- ✅ SwarmEngine & Rule Discovery
- ✅ Rust Tokenizer & Rust RAG Engine

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
