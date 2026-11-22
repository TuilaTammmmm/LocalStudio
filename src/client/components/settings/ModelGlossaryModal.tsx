import React from 'react';
import { X, HelpCircle, Sparkles, ShieldOff, Brain, Code2, Eye, Cpu, Check } from 'lucide-react';

interface ModelGlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: string;
}

export const ModelGlossaryModal: React.FC<ModelGlossaryModalProps> = ({
  isOpen,
  onClose,
  currentLang,
}) => {
  if (!isOpen) return null;

  const terms = [
    {
      icon: <Sparkles className="w-4 h-4 text-sky-400" />,
      badge: 'Chỉ dẫn & Hội thoại',
      techName: 'Instruct / Chat',
      color: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
      description:
        'Mô hình đã được tinh chỉnh qua phương pháp học có giám sát để hiểu câu lệnh, trả lời câu hỏi và đàm thoại tự nhiên như một trợ lý chuyên nghiệp, thay vì chỉ tiếp tục sinh văn bản như các mô hình gốc.',
      recommendation: 'Khuyên dùng cho nhu cầu trò chuyện hằng ngày, hỗ trợ công việc và trợ lý ảo.',
    },
    {
      icon: <Brain className="w-4 h-4 text-purple-400" />,
      badge: 'Suy luận từng bước',
      techName: 'Thinking / Reasoning',
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      description:
        'Mô hình tư duy chuỗi suy luận trước khi trả lời (tương tự DeepSeek-R1). Quá trình suy nghĩ nội tâm được đặt trong thẻ riêng biệt để tự phản biện, phân tích logic trước khi xuất câu trả lời chuẩn xác.',
      recommendation: 'Tối ưu cho bài toán giải thuật, toán học phức tạp, chứng minh logic và kiến trúc mã nguồn.',
    },
    {
      icon: <ShieldOff className="w-4 h-4 text-rose-400" />,
      badge: 'Gỡ bỏ rào cản kiểm duyệt',
      techName: 'Abliterated / Uncensored',
      color: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      description:
        'Phiên bản đã can thiệp vào các tầng trọng số để triệt tiêu các từ chối phản hồi được cài đặt sẵn. Mô hình sẽ không từ chối trả lời, không ngắt quãng và sẵn sàng phản hồi khách quan mọi câu hỏi kỹ thuật.',
      recommendation: 'Rất hữu ích khi viết mã kiểm thử an toàn thông tin, nghiên cứu bảo mật hệ thống hoặc thảo luận chuyên sâu.',
    },
    {
      icon: <Code2 className="w-4 h-4 text-emerald-400" />,
      badge: 'Chuyên biệt lập trình',
      techName: 'Coder / Programming',
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      description:
        'Huấn luyện tập trung trên hàng nghìn tỉ token mã nguồn của hơn 80 ngôn ngữ lập trình. Hiểu sâu cú pháp, quy ước thiết kế, nhận diện lỗi và sinh mã tối ưu hơn nhiều so với các mô hình thông thường.',
      recommendation: 'Lựa chọn số một cho lập trình viên (Qwen2.5-Coder, DeepSeek-Coder).',
    },
    {
      icon: <Eye className="w-4 h-4 text-amber-400" />,
      badge: 'Thị giác & Đa phương thức',
      techName: 'Vision / Multimodal',
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      description:
        'Có khả năng đọc và hiểu trực tiếp hình ảnh, biểu đồ, ảnh chụp màn hình mã lỗi và bản thiết kế giao diện (cần tệp mmproj tương ứng đi kèm).',
      recommendation: 'Dành cho phân tích lỗi qua ảnh chụp màn hình hoặc trích xuất tài liệu dạng hình ảnh.',
    },
    {
      icon: <Cpu className="w-4 h-4 text-teal-400" />,
      badge: 'Bản lượng tử hóa',
      techName: 'Quantization (Q4_K_M, Q8_0)',
      color: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
      description:
        'Kỹ thuật nén trọng số mô hình từ 16-bit xuống 4-bit hoặc 8-bit để giảm dung lượng RAM và VRAM, giúp chạy mượt mà ngay trên máy tính cá nhân:',
      quantList: [
        {
          name: 'Q4_K_M (Chuẩn vàng tối ưu)',
          detail: 'Tiêu tốn ít VRAM nhất, tốc độ sinh từ nhanh nhất, giữ được hơn 99% trí thông minh. Hoàn hảo cho GPU 4GB VRAM.',
        },
        {
          name: 'Q5_K_M / Q6_K',
          detail: 'Độ chính xác cao hơn một chút, cần thêm khoảng 25-35% bộ nhớ VRAM/RAM.',
        },
        {
          name: 'Q8_0',
          detail: 'Độ chính xác tương đương nguyên bản, tiêu tốn nhiều RAM/VRAM nhất và tốc độ sinh chậm hơn.',
        },
      ],
      recommendation: 'Luôn ưu tiên chọn bản Q4_K_M khi tải mô hình.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {currentLang === 'vi' ? 'Hướng dẫn thuật ngữ mô hình' : 'Model Terminology Guide'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {currentLang === 'vi'
                  ? 'Giải thích chi tiết các loại mô hình và định dạng lượng tử hóa'
                  : 'Understanding model tags, behaviors, and quantization'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {terms.map((t, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                    {t.icon}
                  </span>
                  <span className="font-bold text-sm text-white">{t.badge}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${t.color}`}>
                  {t.techName}
                </span>
              </div>

              <p className="text-gray-300 leading-relaxed text-[12px]">{t.description}</p>

              {t.quantList && (
                <div className="space-y-1.5 pt-1 pl-2 border-l-2 border-teal-500/30">
                  {t.quantList.map((q, qIdx) => (
                    <div key={qIdx} className="text-[11px]">
                      <span className="font-bold text-teal-300">{q.name}: </span>
                      <span className="text-gray-400">{q.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-1.5 text-[11px] text-sky-400/90 font-medium pt-1">
                <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{t.recommendation}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#30363d] bg-[#161b22] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
          >
            {currentLang === 'vi' ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
