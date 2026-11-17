# 📊 Báo Cáo Phân Tích & So Sánh: LocalAI Studio vs. Các Ứng Dụng AI Hàng Đầu

Tài liệu này đối chiếu **LocalAI Desktop Studio** với 4 nền tảng AI mã nguồn mở/cục bộ hàng đầu thế giới hiện nay: **LM Studio**, **Jan.ai**, **Open WebUI** và **Ollama**. Báo cáo lọc ra các tính năng cốt lõi, tham số lấy mẫu (sampling), kiến trúc prompt và các cải tiến thiết yếu cần tích hợp vào dự án.

---

## 1. Bảng So Sánh Tổng Quan (Feature Comparison Matrix)

| Tiêu chí | LocalAI Studio (Hiện tại) | LM Studio | Jan.ai | Open WebUI | Ollama |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Giao diện & Nền tảng** | Electron + React 19 + Tailwind | Desktop GUI (Proprietary) | Electron Desktop (Mã nguồn mở) | Web App / Docker (Python + Svelte) | CLI Daemon / API |
| **Engine suy luận** | Nhúng `llama-server.exe` (CUDA/CPU) | Tích hợp sẵn `llama.cpp` + MLX | Nhúng `nitro` (llama.cpp engine) | Kết nối Ollama, OpenAI, vLLM | C++ / llama.cpp tích hợp |
| **Quản lý VRAM GPU** | Tính toán tự động `-ngl` theo VRAM | Thanh trượt thủ công từng layer | Tự động phân bổ layer | Tự động qua Ollama | Tự động / Cấu hình Modelfile |
| **Tải Model từ HuggingFace** | Tự nhận diện link .gguf, auto-parse B & Quant | Tìm kiếm trực tiếp trên search bar | Catalog có sẵn + link HF | Qua Ollama pull / URL | Qua lệnh `ollama pull` |
| **Hệ thống Prompt** | Workspace Prompt + Global Prompt | Preset Prompt từng model | Persona / Assistant Preset | 3 tầng: Per-Model, Per-User, Per-Chat | Modelfile `SYSTEM """..."""` |
| **Bộ lọc chống lặp từ** | Repeat Penalty + DRY Sampler | Repeat Penalty, Frequency/Presence | Temperature, Top-P, Penalties | Full OpenAI + Ollama Samplers | Repeat penalty, repeat_last_n |
| **Multi-turn Context Control** | Trượt 10 tin nhắn, cắt `<think>` | Trượt theo Token Budget | Trượt theo Token Count | Tùy biến Context Sliding Window | Tự quản lý qua context window |
| **Bộ công cụ (Tools & Skills)** | Local Skills (`SKILL.md`), Shell, Files | Không có (chỉ chat đơn thuần) | Extension ecosystem (đang phát triển) | Tools, Python Code Runner, Web Search | Modelfile Tools / Function Calling |

---

## 2. Điểm Mạnh Độc Đáo Hiện Có Của LocalAI Studio

So với các ứng dụng khác, LocalAI Studio của bạn sở hữu những thế mạnh khác biệt mà ngay cả LM Studio hay Jan.ai chưa tối ưu sâu:
1. **Tối ưu phần cứng phân khúc phổ thông (GTX 1650 4GB):** Tự động tính toán bộ đệm 1000MB cho Windows OS để không bao giờ bị tràn VRAM (OOM Crash).
2. **Auto-Model Router:** Tự phân loại câu hỏi (Code -> Coder-7B, Toán/Logic -> DeepSeek-R1, Chat nhanh -> 1B/3B, Câu hỏi nặng -> Cloud API).
3. **Sidebar lập trình tích hợp:** Có sẵn Shell PowerShell, File Tree và In-App Web Browser phục vụ xem trước sản phẩm local server.

---

## 3. Các Tính Năng Thiết Yếu Cần Bổ Sung (Học từ LM Studio & Open WebUI)

### 3.1. Preset Mô Hình (Model Persona / Agent Preset)
* **Vấn đề hiện tại:** Mỗi khi đổi model (từ Coder sang DeepSeek-R1), người dùng vẫn dùng chung một ô cấu hình.
* **Chuẩn của Open WebUI & LM Studio:** Cho phép lưu cấu hình theo từng Model:
  * Khi chọn **DeepSeek-R1**: Tự đặt Temperature `0.6`, Top-P `0.95`, System Prompt tập trung tư duy từng bước.
  * Khi chọn **Qwen 2.5 Coder**: Tự đặt Temperature `0.2`, Top-P `0.85`, System Prompt tập trung vào code sạch.
  * Khi chọn **General Chat**: Tự đặt Temperature `0.7`, Top-P `0.9`.

### 3.2. Quản lý Context Window thông minh (Token-Budget Trimming)
* **Vấn đề hiện tại:** Đang cắt cố định 10 tin nhắn gần nhất. Nếu 10 tin nhắn đó chứa nhiều code dài, tổng số token có thể vượt quá `ctxSize` (4096), làm model bị đơ hoặc văng lỗi.
* **Chuẩn công nghiệp:** Tính tổng số token của lịch sử; giữ lại System Prompt gốc + các tin nhắn mới nhất vừa khít trong khoảng **`ctxSize - maxTokens - 500`** tokens.

### 3.3. Hiển thị & Thu gọn khối suy nghĩ (`<think>`) chuyên nghiệp
* DeepSeek-R1 sinh ra rất nhiều token `<think>...</think>`. Cần đảm bảo UI luôn ẩn phần này vào một thanh Accordion có thể bấm mở ra, không để chữ suy nghĩ tràn ra ngoài làm rối mắt người dùng.

---

## 4. Bảng Tham Số Lấy Mẫu Chuẩn Cho `llama-server` (Sampling Parameters)

Khi gọi API `/chat/completions` của `llama-server.exe`, đây là bộ tham số chuẩn nhất để vừa **chạy mượt tiếng Việt**, vừa **chấm dứt hiện tượng lặp từ**:

```json
{
  "temperature": 0.6,
  "top_p": 0.9,
  "min_p": 0.05,
  "repeat_penalty": 1.1,
  "repeat_last_n": 256,
  "dry_multiplier": 0.8,
  "dry_base": 1.75,
  "dry_allowed_length": 2,
  "dry_penalty_last_n": 0,
  "max_tokens": 4096
}
```

> [!IMPORTANT]
> **Lưu ý đặc biệt về `dry_penalty_last_n`**:
> Nhiều phiên bản `llama-server` API quy định giá trị này phải là số nguyên không âm `0 <= value <= 2147483647`. Không được gửi `-1` qua API JSON để tránh lỗi HTTP 400 `invalid_request_error`. Đặt `0` hoặc không gửi trường này thì engine sẽ tự động áp dụng phạm vi tối ưu.

---

## 5. Mẫu System Prompt Chuẩn Cho Model Cục Bộ (Đặc biệt cho SLM & Tiếng Việt)

Mô hình nhỏ (1B - 3B - 7B) rất nhạy cảm với System Prompt. Nếu viết quá dài hoặc dùng từ phủ định ("không được..."), mô hình sẽ dễ bị phản tác dụng. 

### Mẫu 1: Dành cho DeepSeek-R1 (Suy luận logic & Tiếng Việt)
```text
Bạn là trợ lý AI hữu ích, thông minh và phản hồi hoàn toàn bằng tiếng Việt.
Nguyên tắc:
1. Luôn sử dụng tiếng Việt tự nhiên, chuẩn ngữ pháp trong toàn bộ câu trả lời.
2. Giữ nguyên thuật ngữ kỹ thuật, code và tên riêng bằng tiếng Anh.
3. Trả lời trực tiếp, rõ ràng, gãy gọn, không thêm lời chào mở đầu hay kết bài thừa.
```

### Mẫu 2: Dành cho Qwen 2.5 Coder (Lập trình chuyên sâu)
```text
You are an expert software developer.
Respond in clear Vietnamese, but keep all programming code, technical identifiers, and markdown syntax in English.
Provide clean, robust, and well-commented code. Point out edge cases directly without unnecessary chatter.
```
