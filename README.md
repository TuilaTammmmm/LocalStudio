# ⚡ LocalAI Desktop Studio

> **Local-First, Privacy-Centric AI Workstation with CUDA Acceleration, Smart Auto-Routing, Multi-Engine Inference & Glassmorphism UI**

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-blue.svg)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-45.3-47848F.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-orange.svg)](https://hono.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![CUDA](https://img.shields.io/badge/CUDA%20Offload-GTX%201650%20(4GB)-green.svg)](https://developer.nvidia.com/cuda-zone)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Giới thiệu tổng quan (Overview)

**LocalAI Desktop Studio** là ứng dụng AI máy trạm độc lập (Standalone Desktop App) chạy hoàn toàn trên máy tính của bạn, kết hợp sức mạnh suy luận mô hình lớn cục bộ (Local LLMs) với khả năng mở rộng Cloud API khi cần ngữ cảnh lớn.

Được tối ưu hóa chuyên sâu cho cấu hình phần cứng phổ thông (như **NVIDIA GeForce GTX 1650 4GB VRAM / 8GB-16GB RAM**), LocalAI tính toán phân bổ tầng GPU/CPU (`-ngl 21` cho 7B-8B, `-ngl 99` cho 1.5B-3B) với vùng đệm an toàn 1000MB VRAM cho Windows OS, ngăn ngừa triệt để lỗi tràn bộ nhớ đồ họa (CUDA Out-Of-Memory).

---

## ✨ Tính năng nổi bật (Key Features)

### 1. 🔮 Bộ định tuyến tự động & Chọn nhanh Model (Auto-Route & Switcher)
- **Chuyển đổi trực tiếp ngay trên thanh chat**:
  - `[🔮 Auto-Route]`: Tự động phân tích câu lệnh (intent) và tệp đính kèm để chọn model tối ưu nhất.
  - `[⚡ Qwen-3B / Llama-1B]`: Trò chuyện thường ngày siêu tốc (>60 tokens/s).
  - `[💻 Coder-7B]`: Chuyên biệt viết mã, gỡ lỗi (debugging) và refactor.
  - `[🧠 DeepSeek-R1]`: Suy luận từng bước với hộp suy nghĩ `<think>` đóng/mở trực quan.
  - `[👁️ Qwen2-VL (Vision)]`: Nhận diện hình ảnh, sơ đồ kiến trúc và OCR code khi đính kèm ảnh.
  - `[🌐 FreeLLM Cloud / OpenAI]`: Tự động fallback sang mô hình lớn 70B+ khi ngữ cảnh vượt ngưỡng (>6000 tokens).

### 2. 🎛️ Trung tâm mô hình & Cài đặt nâng cao (GGUF Model Hub)
- **Tải mô hình chuẩn HTTP Streaming**: Kéo trực tiếp các bản lượng tử hóa GGUF (Q4_K_M) từ máy chủ CDN Hugging Face với thanh tiến trình real-time.
- **Quản lý tệp cục bộ an toàn**: Tự động lưu trữ tại `%USERPROFILE%\LocalAI\models`, hỗ trợ xóa vĩnh viễn tệp mô hình trên đĩa và giải phóng dung lượng ổ cứng tức thì.
- **Phân tầng Modal chuẩn xác**: Phím `ESC` và click backdrop đóng theo thứ tự tầng hộp thoại xác nhận $\rightarrow$ form phụ $\rightarrow$ màn hình cài đặt, không bao giờ thoát nhầm về chat.

### 3. 📂 Không gian làm việc & Công cụ lập trình (Workspaces & Right Sidebar)
- **Cô lập dự án**: Mỗi Workspace quản lý danh mục tệp và các phiên hội thoại riêng biệt.
- **Thanh công cụ bên phải (5 Tabs)**:
  - `Tệp (Files)`: Cây thư mục tương tác, gắn ngữ cảnh nhanh vào prompt bằng cú pháp `@tên_tệp`.
  - `Shell (Terminal)`: Cửa sổ dòng lệnh PowerShell tích hợp sẵn sandbox bảo vệ lệnh nguy hiểm (`rmdir`, `format`).
  - `Trình duyệt (Web)`: Xem trước giao diện localhost trực tiếp trong app.
  - `RAG / Tri thức`: Theo dõi chỉ mục vector và tìm kiếm ngữ nghĩa offline.
  - `Chỉ dẫn (Prompt)`: Cấu hình system prompt riêng cho từng dự án.

### 4. ⚡ Kỹ năng mở rộng & Lệnh gạch chéo (Local Skills)
- Tự động nhận diện các tệp `SKILL.md` từ workspace và thư mục toàn cục (`~/.gemini`, `~/.skills`).
- Kích hoạt kỹ năng bằng lệnh `/review`, `/test`, `/summarize` ngay trong ô soạn thảo.

### 5. 💎 Giao diện Glassmorphism hiện đại
- Thiết kế thanh lịch chuẩn Dark/Midnight Mode với hiệu ứng kính mờ (Backdrop Blur).
- Bảng đồng hồ đo hiệu năng suy luận theo thời gian thực: tốc độ sinh từ (`t/s`), thời gian trễ token đầu (`TTFT`), và bộ đếm token.
- Khung mã nguồn tô màu cú pháp (Syntax Highlighting) với nút sao chép nhanh 1-click.
- Hỗ trợ song ngữ hoàn chỉnh: **Tiếng Việt** và **English**.

---

## 🏗️ Kiến trúc dự án (Architecture)

```
LocalAI/
├── electron/                    # Electron Standalone Host
│   ├── main.ts                  # Main process, lifecycle, freePort, cửa sổ desktop
│   └── preload.ts               # Context bridge an toàn (IPC)
├── build-assets/                # Icon đa độ phân giải (.ico, .png, .icns)
│
├── src/
│   ├── client/                  # Frontend (React 19 + Vite + TailwindCSS + Lucide)
│   │   ├── components/
│   │   │   ├── ChatView.tsx     # Quản lý tin nhắn & render stream SSE
│   │   │   ├── ChatInput.tsx    # Ô soạn thảo, đính kèm ảnh, @ tệp, / kỹ năng
│   │   │   ├── ChatMessageItem.tsx # Render markdown, accordion <think> & code blocks
│   │   │   ├── RightSidebar.tsx # Cây tệp, Terminal sandbox, Web view, RAG
│   │   │   ├── LeftSidebar.tsx  # Danh sách Workspace & lịch sử chat session
│   │   │   ├── Header.tsx       # Telemetry VRAM GPU, Provider Selector & Cài đặt
│   │   │   └── SettingsModal.tsx# Kho tải GGUF, cấu hình Auto-Route, Tuner GPU
│   │   ├── App.tsx              # Reactive state trung tâm
│   │   ├── i18n.ts              # Từ điển dịch Việt - Anh chuẩn
│   │   └── index.css            # Design tokens & animation
│   │
│   ├── hardware.ts              # Đọc thông số GPU qua nvidia-smi & RAM hệ thống
│   ├── llama-process.ts         # Quản lý vòng đời tiến trình llama-server CUDA
│   ├── auto-router.ts           # Phân loại ngữ nghĩa (Code/Reason/Vision/Heavy)
│   ├── model-hub.ts             # Danh mục mô hình GGUF & tính toán tương thích
│   ├── model-downloader.ts      # HTTP streaming chunked downloader từ Hugging Face
│   ├── router.ts                # Multi-Provider Router & SSE generator
│   ├── workspace-fs.ts          # Cây thư mục & bảo vệ chống Path Traversal
│   ├── context-builder.ts       # Đóng gói ngữ cảnh @tệp
│   ├── skills-scanner.ts        # Quét và nạp tệp SKILL.md
│   ├── skills-runner.ts         # Khớp lệnh /slash & chèn system prompt
│   ├── db.ts                    # Cơ sở dữ liệu JSON/SQLite atomic
│   ├── server.ts                # REST & SSE API Server chạy bằng Hono (Port 3001)
│   └── index.ts                 # Điểm khởi động Backend Core
│
├── test/                        # 7 bộ kiểm thử tự động (Unit & Integration)
├── electron-builder.json        # Cấu hình đóng gói Windows Installer (NSIS & Portable)
├── package.json
└── README.md
```

---

## 💻 Yêu cầu hệ thống (System Requirements)

| Thành phần | Tối thiểu (Minimum) | Khuyến nghị (Recommended) |
|---|---|---|
| **Hệ điều hành** | Windows 10/11 64-bit | Windows 11 64-bit |
| **CPU** | 4 Cores (Intel Core i5 / AMD Ryzen 5) | 6+ Cores |
| **RAM** | 8 GB | 16 GB trở lên |
| **GPU** | Tích hợp (chạy CPU mode) | NVIDIA GTX 1650 4GB trở lên (CUDA) |
| **Ổ cứng trống** | 10 GB SSD | 30+ GB SSD (chứa nhiều model GGUF) |
| **Node.js** | v20+ hoặc v24+ | v24.13.0 LTS |
| **Package Manager**| pnpm v9+ hoặc v12+ | pnpm v12.15.0 |

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### 1. Cài đặt thư viện phụ thuộc

```powershell
# Clone mã nguồn
git clone https://github.com/your-username/LocalAI.git
cd LocalAI

# Cài đặt toàn bộ packages
pnpm install
```

### 2. Khởi chạy ứng dụng Desktop (Chế độ phát triển)

Khởi động cùng lúc Vite dev server và Electron standalone với backend nội bộ tự động nạp:

```powershell
pnpm electron:dev
```

*(Hoặc nếu chỉ muốn chạy web trên trình duyệt: `pnpm dev:all` $\rightarrow$ truy cập `http://localhost:3000`)*

### 3. Chạy kiểm thử tự động (Automated Test Suite)

Chạy toàn bộ 7 bộ unit test xác thực backend:

```powershell
pnpm test
```
- ✅ **Phase 1**: Database CRUD & Persistent storage
- ✅ **Phase 2**: Hardware VRAM Detection & Smart Offload algorithm
- ✅ **Phase 3**: Multi-Provider Router & Latency telemetry
- ✅ **Phase 4**: Workspace Filesystem & Path Traversal Security
- ✅ **Phase 5**: Skills Scanner & Slash Command Matcher
- ✅ **Phase 6**: Hono REST & SSE Streaming API
- ✅ **Phase 7**: Auto-Route Intent Classifier (Code, Reason, Vision, Heavy)

---

## 📦 Đóng gói ứng dụng Desktop (Production Build)

Để đóng gói thành tệp chạy `.exe` độc lập cho người dùng cuối mà không cần cài đặt Node.js hay pnpm:

```powershell
pnpm electron:build
```

Sau khi hoàn tất, các gói cài đặt sẵn sàng sử dụng nằm trong thư mục `release/`:
1. **`release/LocalAI Studio Setup 0.1.0.exe`**: Bộ cài đặt chuẩn Windows (NSIS Installer), tạo shortcut Desktop và Start Menu.
2. **`release/LocalAI Studio 0.1.0.exe`**: Bản Portable chạy ngay không cần cài đặt.
3. **`release/win-unpacked/`**: Thư mục binary đã giải nén để kiểm tra chạy thử trực tiếp.

---

## 🧠 Hướng dẫn kết nối mô hình suy luận (Inference Setup)

Ứng dụng hỗ trợ 4 chế độ nhà cung cấp suy luận (Providers):

### 1. FreeLLM API (Khuyên dùng - Nhanh nhất)
- **Không cần GPU mạnh hay cài thêm phần mềm**.
- Vào thanh chat góc dưới bên phải $\rightarrow$ Nhấp nút Provider $\rightarrow$ Chọn **FreeLLM API (High-Performance)**.
- Trò chuyện ngay với hàng trăm mô hình đỉnh cao (Claude 3.5, Gemini 2.5 Flash, Qwen 2.5, DeepSeek R1).

### 2. Local llama.cpp (Offline GPU trực tiếp - Tự động 100%)
- **Tự động nhận diện & Khởi chạy ngầm**: Engine `llama-server.exe` cùng bộ thư viện gia tốc CUDA 12.x (`ggml-cuda.dll`) và CPU AVX2 đã được tích hợp sẵn trong thư mục `bin/` của dự án (hoặc thư mục `%USERPROFILE%\LocalAI\bin\`).
- **Không cần mở terminal gõ lệnh**: 
  - Chỉ cần tải mô hình từ **Cài đặt $\rightarrow$ Model Hub** (ví dụ: `Llama-3.2-1B-Instruct-Q4_K_M.gguf` ~788MB).
  - Khi bạn gửi tin nhắn trong Chat, LocalAI Studio sẽ **tự động kích hoạt `llama-server` ngầm** với các cờ tối ưu GPU tương ứng:
    - `-ngl 99` (offload 100% GPU cho model 1.5B/3B) hoặc `-ngl 21` (hybrid cho model 7B/8B).
    - Tự động bật Flash Attention (`-fa`) tiết kiệm 30% VRAM.
    - Tự động chuyển đổi mô hình (Hot-reload GPU) khi bạn chọn mô hình khác trong chat.
  - Khi đóng ứng dụng, tiến trình `llama-server` sẽ tự động được dọn dẹp sạch sẽ, không để lại tiến trình chạy ngầm.

### 3. Ollama (Local Port 11434)
- Nếu bạn đã cài đặt [Ollama](https://ollama.com/), khởi động Ollama trên máy:
  ```powershell
  ollama run qwen2.5-coder:1.5b
  ```
- Trong LocalAI Studio, bật provider **Ollama** để tự động nhận diện tất cả model hiện có.

### 4. LM Studio (Local Port 1234)
- Bật Local Server trong [LM Studio](https://lmstudio.ai/) (mặc định lắng nghe tại `http://127.0.0.1:1234`).
- LocalAI Studio sẽ tự động chuyển tiếp câu lệnh vào LM Studio.

---

## 🎁 Đóng gói phân phối Standalone (.exe)

Nhờ cấu hình `extraResources` trong `electron-builder.json`, khi chạy:
```powershell
pnpm electron:build
```
Toàn bộ engine suy luận `llama-server.exe` và các thư viện CUDA/CPU được đóng gói trực tiếp vào file cài đặt Windows (`.exe`). Máy tính người dùng cuối:
- Không cần cài Node.js, Git hay pnpm.
- Không cần cài đặt hay build thủ công `llama.cpp`.
- Mở app, tải model GGUF mong muốn từ Model Hub là chạy offline hoàn toàn!

---

## 📄 Bản quyền (License)

Dự án phát hành theo giấy phép mã nguồn mở **MIT License**. Tự do sử dụng, chỉnh sửa và phân phối cho mục đích cá nhân lẫn thương mại.
