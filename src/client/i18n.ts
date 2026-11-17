export type Language = 'en' | 'vi';

export interface Translations {
  // Common
  save: string;
  saved: string;
  cancel: string;
  create: string;
  delete: string;
  open: string;
  close: string;
  active: string;
  backToChat: string;
  online: string;
  offline: string;
  search: string;
  download: string;
  downloaded: string;
  downloading: string;
  browse: string;
  browsing: string;
  noFilesFound: string;
  refresh: string;
  checkUpdate: string;
  checking: string;
  doneAndSave: string;
  language: string;
  english: string;
  vietnamese: string;
  settingsAndHardware: string;
  navAutoRoute: string;
  navModels: string;
  navInference: string;
  navCuda: string;
  navSkills: string;
  navStorage: string;
  navAppearance: string;
  navShortcuts: string;
  navProviders: string;
  navRag: string;
  navAbout: string;

  // Header
  studioTitle: string;
  desktopCore: string;
  vramTooltip: string;
  openTools: string;
  hideTools: string;

  // Left Sidebar
  newChat: string;
  chatHistory: string;
  workspaces: string;
  addProject: string;
  settingsAndSkills: string;
  noChats: string;

  // Chat View & Starters
  whatToBuild: string;
  runningOnHw: string;
  selectOrCreateChat: string;
  pickChatDesc: string;
  quickStarterCodeTitle: string;
  quickStarterCodeDesc: string;
  quickStarterCodePrompt: string;
  quickStarterArchTitle: string;
  quickStarterArchDesc: string;
  quickStarterArchPrompt: string;
  quickStarterThinkTitle: string;
  quickStarterThinkDesc: string;
  quickStarterThinkPrompt: string;
  quickStarterTestTitle: string;
  quickStarterTestDesc: string;
  quickStarterTestPrompt: string;

  // Chat Input & Composer
  askPlaceholder: string;
  visionPlaceholder: string;
  fileMention: string;
  skillSlash: string;
  visionBtn: string;
  send: string;
  stop: string;
  tokens: string;
  autoRoute: string;
  autoRouteDesc: string;
  switchProvider: string;
  providerModels: string;
  useCustomModel: string;
  noMatchingModels: string;
  contextHeader: string;

  // Workspace Tools
  workspaceToolsTitle: string;
  addToolBtn: string;
  noToolActive: string;
  chooseToolDesc: string;
  filesLabel: string;
  filesDesc: string;
  shellLabel: string;
  shellDesc: string;
  webLabel: string;
  webDesc: string;
  ragLabel: string;
  ragDesc: string;
  promptLabel: string;
  promptDesc: string;
  pinnedFiles: string;
  noPinnedFiles: string;
  terminalPlaceholder: string;
  terminalReady: string;
  shellCore: string;
  projectExplorer: string;
  clickToPin: string;
  openInExternalBrowser: string;
  run: string;
  running: string;
  clearLogs: string;
  savePrompt: string;
  promptSaved: string;
  systemPromptDesc: string;
  browserPlaceholder: string;
  ragSearchPlaceholder: string;
  ragSearchBtn: string;
  ragExplanation: string;

  // Settings Tabs & Content
  autoRouteTitle: string;
  autoRouteSubtitle: string;
  fastModel: string;
  coderModel: string;
  reasonerModel: string;
  visionModel: string;
  modelHubTitle: string;
  searchModelsPlaceholder: string;
  allModels: string;
  codingCategory: string;
  reasoningCategory: string;
  visionCategory: string;
  generalCategory: string;
  cudaLiveTitle: string;
  cudaLiveSubtitle: string;
  vramEstimate: string;
  expectedSpeed: string;
  systemRamNeeded: string;
  gpuLayersLabel: string;
  gpuLayersTip: string;
  contextSizeLabel: string;
  cpuThreadsLabel: string;
  flashAttentionLabel: string;
  flashAttentionDesc: string;
  applyModelBtn: string;
  applyModelSuccess: string;
  huggingFaceLink: string;

  // Sampling
  samplingTitle: string;
  samplingSubtitle: string;
  temperatureLabel: string;
  tempStrict: string;
  tempBalanced: string;
  tempCreative: string;
  topPLabel: string;
  maxTokensLabel: string;
  repeatPenaltyLabel: string;
  globalPromptLabel: string;
  saveSamplingBtn: string;

  // Storage
  storageTitle: string;
  storageSubtitle: string;
  modelsFolder: string;
  modelsFolderDesc: string;
  workspaceRoot: string;
  openInExplorer: string;
  cacheTitle: string;
  cacheDesc: string;
  clearCacheBtn: string;

  // Appearance
  appearanceTitle: string;
  appearanceSubtitle: string;
  glassIntensity: string;
  ultraGlass: string;
  ultraGlassDesc: string;
  balancedGlass: string;
  balancedGlassDesc: string;
  solidDark: string;
  solidDarkDesc: string;
  fontSize: string;
  compact: string;
  compactDesc: string;
  defaultFont: string;
  defaultFontDesc: string;
  largeFont: string;
  largeFontDesc: string;

  // Shortcuts
  shortcutsTitle: string;
  shortcutsSubtitle: string;
  chatAndCommands: string;
  toolsAndWorkspace: string;
  sendMessageShortcut: string;
  newLineShortcut: string;
  newChatShortcut: string;
  closeModalShortcut: string;
  toggleToolsShortcut: string;
  slashSkillsShortcut: string;
  referenceFileShortcut: string;
  openSettingsShortcut: string;

  // Providers & Keys
  providersTitle: string;
  baseUrlEndpoint: string;
  apiKeyLabel: string;
  defaultModelLabel: string;
  testAndSyncBtn: string;

  // About
  aboutTitle: string;
  aboutSubtitle: string;
  productionReady: string;
  aboutDesc: string;
  runtimeCore: string;
  inferenceBackend: string;
  desktopWrapper: string;
  currentVersionLatest: string;

  // New Workspace Modal
  addProjectFolderTitle: string;
  addProjectFolderSubtitle: string;
  folderPathLabel: string;
  folderPathPlaceholder: string;
  browseBtn: string;
  browsingBtn: string;
  quickSuggestions: string;
  currentRepo: string;
  desktop: string;
  documents: string;
  projectNameLabel: string;
  projectNamePlaceholder: string;
  createWorkspaceBtn: string;
}

export const dictionaries: Record<Language, Translations> = {
  en: {
    save: 'Save',
    saved: 'Saved!',
    cancel: 'Cancel',
    create: 'Create',
    delete: 'Delete',
    open: 'Open',
    close: 'Close',
    active: 'Active',
    backToChat: 'Back to Chat',
    online: 'Online',
    offline: 'Offline',
    search: 'Search...',
    download: 'Download',
    downloaded: 'Downloaded',
    downloading: 'Downloading...',
    browse: 'Browse...',
    browsing: 'Browsing...',
    noFilesFound: 'No files found in workspace',
    refresh: 'Refresh',
    checkUpdate: 'Check for Updates',
    checking: 'Checking...',
    doneAndSave: 'Done & Save',
    language: 'Language',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    settingsAndHardware: 'Settings & Hardware',
    navAutoRoute: 'Auto Model Router',
    navModels: 'Model Hub & Library',
    navInference: 'Sampling & Inference',
    navCuda: 'CUDA & VRAM Hardware',
    navSkills: 'Local Skills & Tools',
    navStorage: 'Storage & System Paths',
    navAppearance: 'Appearance & UI Theme',
    navShortcuts: 'Keyboard Shortcuts',
    navProviders: 'API Keys & Providers',
    navRag: 'Offline RAG & Vectors',
    navAbout: 'About & Updates',

    studioTitle: 'LocalAI Studio',
    desktopCore: 'Standalone Desktop Core',
    vramTooltip: 'NVIDIA GPU VRAM Real-time Gauge',
    openTools: 'Open Tools Panel (Files, Shell, Browser, RAG)',
    hideTools: 'Hide Tools Panel',

    newChat: 'New Chat',
    chatHistory: 'Chat History',
    workspaces: 'Workspaces',
    addProject: 'Add Project',
    settingsAndSkills: 'Settings & Skills',
    noChats: 'No chat sessions yet. Click New Chat to start.',

    whatToBuild: 'What would you like to build today?',
    runningOnHw: 'Running locally on your GTX 1650 (CUDA) or synced with FreeLLM Cloud.',
    selectOrCreateChat: 'Select or Create a Conversation',
    pickChatDesc: 'Pick a chat session on the left or press New Chat to begin.',
    quickStarterCodeTitle: 'Review Project Code',
    quickStarterCodeDesc: 'Check for memory leaks, unhandled exceptions & clean code',
    quickStarterCodePrompt: '/review Please inspect the project source code and suggest performance and architecture improvements!',
    quickStarterArchTitle: 'Analyze Architecture',
    quickStarterArchDesc: 'Explain dependencies, data flow & module boundaries',
    quickStarterArchPrompt: 'Analyze the overall architecture of this workspace, dependency graph, and primary data flow.',
    quickStarterThinkTitle: 'Deep Thinking Mode',
    quickStarterThinkDesc: 'Formulate step-by-step reasoning for complex algorithms',
    quickStarterThinkPrompt: 'Please use step-by-step deep reasoning to solve this complex algorithm problem:',
    quickStarterTestTitle: 'Generate Unit Tests',
    quickStarterTestDesc: 'Create thorough test suites for critical components',
    quickStarterTestPrompt: 'Write comprehensive automated unit tests covering edge cases for this module.',

    askPlaceholder: 'Ask a question, type @ to reference file, or / for skills...',
    visionPlaceholder: 'Ask a question about this image (Qwen2-VL will be dispatched)...',
    fileMention: 'Reference File',
    skillSlash: 'Skill',
    visionBtn: 'Image (Vision)',
    send: 'Send',
    stop: 'Stop',
    tokens: 'tokens',
    autoRoute: '🔮 Auto-Route (Smart)',
    autoRouteDesc: 'Coder / Reasoner / Vision / Fast Chat',
    switchProvider: 'Switch Provider',
    providerModels: 'Available Models',
    useCustomModel: 'Use custom model:',
    noMatchingModels: 'No matching models found.',
    contextHeader: 'Context:',

    workspaceToolsTitle: 'Workspace Tools',
    addToolBtn: 'Add Tool',
    noToolActive: 'Select a Tool',
    chooseToolDesc: 'Choose a tool below to display in this panel',
    filesLabel: 'Files',
    filesDesc: 'Explore project codebase & pin files into context',
    shellLabel: 'Shell',
    shellDesc: 'Run PowerShell terminal commands in workspace',
    webLabel: 'Web',
    webDesc: 'Preview local web applications (localhost:3000)',
    ragLabel: 'RAG',
    ragDesc: 'Semantic vector search across project files',
    promptLabel: 'Prompt',
    promptDesc: 'Custom system prompt for this workspace',
    pinnedFiles: 'Pinned Context Files',
    noPinnedFiles: 'No files pinned yet. Click the pin icon in the file tree.',
    terminalPlaceholder: 'Enter command (e.g. git status, pnpm test)...',
    terminalReady: 'Terminal Ready. Type command below and press Enter.',
    shellCore: 'PowerShell / Shell Core',
    projectExplorer: 'Project Explorer',
    clickToPin: 'Click pin to attach to context',
    openInExternalBrowser: 'Open in external browser',
    run: 'Run',
    running: 'Running...',
    clearLogs: 'Clear',
    savePrompt: 'Save System Prompt',
    promptSaved: 'Prompt saved!',
    systemPromptDesc: 'System prompt overrides default instructions for this specific workspace.',
    browserPlaceholder: 'http://localhost:3000',
    ragSearchPlaceholder: 'Query project documentation & code snippets...',
    ragSearchBtn: 'Retrieve Snippets',
    ragExplanation: 'RAG (Retrieval-Augmented Generation) chunks your local project files, embeds them locally, and injects relevant code snippets into prompts.',

    autoRouteTitle: 'Smart Auto-Model Routing & Vision',
    autoRouteSubtitle: 'Automatically dispatches queries to Coder, Reasoner, Vision, or Cloud models based on intent.',
    fastModel: '⚡ Fast Conversational Model (3B)',
    coderModel: '💻 Specialized Coding Model',
    reasonerModel: '🧠 Deep Reasoning Model (Thinking Active)',
    visionModel: '👁️ Vision & Multimodal Model',
    modelHubTitle: 'Model Hub & Library',
    searchModelsPlaceholder: 'Search GGUF models by name, author, or tag...',
    allModels: 'All',
    codingCategory: '💻 Coding',
    reasoningCategory: '🧠 Reasoning',
    visionCategory: '👁️ Vision',
    generalCategory: '⚡ General',
    cudaLiveTitle: 'NVIDIA CUDA & VRAM Live Calculator',
    cudaLiveSubtitle: 'Dynamically calculates GPU and CPU offload allocation in real time.',
    vramEstimate: 'Estimated VRAM Memory Usage:',
    expectedSpeed: 'Expected Speed:',
    systemRamNeeded: 'Required System RAM:',
    gpuLayersLabel: 'GPU Offload Layers (-ngl):',
    gpuLayersTip: 'Drag the slider to adjust. Status tag and VRAM bar update dynamically.',
    contextSizeLabel: 'Context Window Size (-c):',
    cpuThreadsLabel: 'CPU Threads (-t):',
    flashAttentionLabel: 'Flash Attention (-fa)',
    flashAttentionDesc: 'Saves ~30% VRAM during long generation.',
    applyModelBtn: 'Apply Settings & Set as Active Model',
    applyModelSuccess: 'Settings applied successfully!',
    huggingFaceLink: 'Hugging Face',

    samplingTitle: 'Default Sampling Parameters',
    samplingSubtitle: 'Control creativity, output length, and repetition penalty.',
    temperatureLabel: 'Temperature (Creativity):',
    tempStrict: '0.0 (Strict Code & Math)',
    tempBalanced: '0.7 (Balanced Default)',
    tempCreative: '1.5 (Creative Prose)',
    topPLabel: 'Top-P (Nucleus Sampling):',
    maxTokensLabel: 'Max Output Tokens:',
    repeatPenaltyLabel: 'Repeat Penalty:',
    globalPromptLabel: 'Default Global System Prompt:',
    saveSamplingBtn: 'Save Sampling Defaults',

    storageTitle: 'Storage & System Directories',
    storageSubtitle: 'Manage GGUF models folder, workspace root, and temporary cache.',
    modelsFolder: '📁 GGUF Models Folder:',
    modelsFolderDesc: 'Downloaded or manually copied GGUF files in this folder appear in Model Hub.',
    workspaceRoot: '💻 Active Workspace Root:',
    openInExplorer: 'Open in Explorer',
    cacheTitle: '🧹 App Temporary Cache & Logs',
    cacheDesc: 'Clear session cache and temporary logs to free disk space.',
    clearCacheBtn: 'Clear Cache',

    appearanceTitle: 'Appearance & Glassy UI Theme',
    appearanceSubtitle: 'Customize frosted glass blur, UI font size, and visual contrast.',
    glassIntensity: 'Glassmorphism Intensity:',
    ultraGlass: '🔮 Ultra Glassy',
    ultraGlassDesc: 'Deep 24px blur with glowing borders.',
    balancedGlass: '💎 Balanced Glass',
    balancedGlassDesc: 'Subtle 12px blur balancing performance and aesthetics.',
    solidDark: '⬛ Solid Dark',
    solidDarkDesc: 'High-contrast opaque dark background without blur.',
    fontSize: 'Interface Font Scaling:',
    compact: 'Compact (12px)',
    compactDesc: 'Optimized for high information density.',
    defaultFont: 'Default (13px)',
    defaultFontDesc: 'Standard balanced readability.',
    largeFont: 'Large (14px)',
    largeFontDesc: 'Spacious and easy on the eyes.',

    shortcutsTitle: 'Keyboard Shortcuts Cheat Sheet',
    shortcutsSubtitle: 'Quick shortcuts to boost productivity like Cursor and VS Code.',
    chatAndCommands: 'Chat & Commands',
    toolsAndWorkspace: 'Tools & Workspace',
    sendMessageShortcut: 'Send message',
    newLineShortcut: 'Insert new line',
    newChatShortcut: 'New chat session',
    closeModalShortcut: 'Close modal / Stop stream',
    toggleToolsShortcut: 'Toggle Workspace Tools panel',
    slashSkillsShortcut: 'Open Skills slash menu',
    referenceFileShortcut: 'Reference file (@mention)',
    openSettingsShortcut: 'Open Studio Settings',

    providersTitle: 'API Keys & Inference Providers',
    baseUrlEndpoint: 'Base URL Endpoint:',
    apiKeyLabel: 'API Key:',
    defaultModelLabel: 'Default Model:',
    testAndSyncBtn: 'Test & Sync Models',

    aboutTitle: 'LocalAI Desktop Studio',
    aboutSubtitle: 'v0.1.0 • Embedded llama.cpp & CUDA Engine',
    productionReady: 'Production Ready',
    aboutDesc: 'LocalAI is an independent, standalone local AI workstation engineered for 4GB VRAM GPUs (GTX 1650), featuring smart multi-model routing (Coder, Reasoner, Vision, Cloud) and local tools.',
    runtimeCore: 'Runtime Core:',
    inferenceBackend: 'Inference Backend:',
    desktopWrapper: 'Desktop Wrapper:',
    currentVersionLatest: 'Current version is up to date.',

    addProjectFolderTitle: 'Add Project Folder',
    addProjectFolderSubtitle: 'Attach a local codebase to run AI tools, RAG & Terminal.',
    folderPathLabel: 'Project Folder Path on PC:',
    folderPathPlaceholder: 'e.g. C:\\Tam\\Code\\LocalAI',
    browseBtn: 'Browse...',
    browsingBtn: 'Browsing...',
    quickSuggestions: 'Quick suggestions:',
    currentRepo: '⚡ Current Repo',
    desktop: '🖥️ Desktop',
    documents: '📁 Documents',
    projectNameLabel: 'Workspace Display Name:',
    projectNamePlaceholder: 'e.g. LocalAI Project',
    createWorkspaceBtn: 'Create Workspace',
  },

  vi: {
    save: 'Lưu',
    saved: 'Đã lưu!',
    cancel: 'Hủy',
    create: 'Tạo',
    delete: 'Xóa',
    open: 'Mở',
    close: 'Đóng',
    active: 'Đang dùng',
    backToChat: 'Quay lại Chat',
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
    search: 'Tìm kiếm...',
    download: 'Tải về',
    downloaded: 'Đã tải',
    downloading: 'Đang tải...',
    browse: 'Duyệt...',
    browsing: 'Đang duyệt...',
    noFilesFound: 'Không tìm thấy tệp nào trong workspace',
    refresh: 'Làm mới',
    checkUpdate: 'Kiểm tra bản cập nhật',
    checking: 'Đang kiểm tra...',
    doneAndSave: 'Xong & Lưu',
    language: 'Ngôn ngữ',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    settingsAndHardware: 'Cài đặt & Phần cứng',
    navAutoRoute: 'Định tuyến thông minh',
    navModels: 'Kho mô hình',
    navInference: 'Cấu hình suy luận',
    navCuda: 'Phần cứng đồ họa & VRAM',
    navSkills: 'Kỹ năng cục bộ',
    navStorage: 'Lưu trữ & Thư mục',
    navAppearance: 'Giao diện & Chủ đề',
    navShortcuts: 'Phím tắt thao tác',
    navProviders: 'Nhà cung cấp & API',
    navRag: 'Cơ sở tri thức RAG',
    navAbout: 'Giới thiệu & Cập nhật',

    studioTitle: 'LocalAI Studio',
    desktopCore: 'Nhân máy trạm cục bộ',
    vramTooltip: 'Thước đo VRAM thời gian thực',
    openTools: 'Mở bảng công cụ',
    hideTools: 'Thu gọn bảng công cụ',

    newChat: 'Hội thoại mới',
    chatHistory: 'Lịch sử trò chuyện',
    workspaces: 'Không gian làm việc',
    addProject: 'Thêm dự án',
    settingsAndSkills: 'Cài đặt & Kỹ năng',
    noChats: 'Chưa có cuộc trò chuyện nào. Bấm Hội thoại mới để bắt đầu.',

    whatToBuild: 'Hôm nay bạn muốn xây dựng điều gì?',
    runningOnHw: 'Chạy trực tiếp trên GTX 1650 (CUDA) của bạn hoặc đồng bộ qua FreeLLM Cloud.',
    selectOrCreateChat: 'Chọn hoặc tạo cuộc trò chuyện',
    pickChatDesc: 'Chọn phiên chat bên trái hoặc nhấn Cuộc trò chuyện mới để bắt đầu.',
    quickStarterCodeTitle: 'Đánh giá mã nguồn dự án',
    quickStarterCodeDesc: 'Kiểm tra rò rỉ bộ nhớ, xử lý ngoại lệ và tối ưu code',
    quickStarterCodePrompt: '/review Hãy kiểm tra mã nguồn trong dự án và đề xuất các điểm tối ưu hiệu năng!',
    quickStarterArchTitle: 'Phân tích kiến trúc',
    quickStarterArchDesc: 'Giải thích phụ thuộc, luồng dữ liệu và ranh giới mô-đun',
    quickStarterArchPrompt: 'Phân tích kiến trúc tổng thể của workspace này và luồng xử lý dữ liệu chính.',
    quickStarterThinkTitle: 'Chế độ tư duy sâu',
    quickStarterThinkDesc: 'Tư duy logic từng bước cho thuật toán phức tạp',
    quickStarterThinkPrompt: 'Hãy dùng tư duy logic từng bước (Deep Reasoning) để giải bài toán tối ưu hóa thuật toán sau:',
    quickStarterTestTitle: 'Tạo bộ kiểm thử Unit Test',
    quickStarterTestDesc: 'Xây dựng bộ test hoàn chỉnh cho các thành phần quan trọng',
    quickStarterTestPrompt: 'Viết bộ kiểm thử tự động (Unit Tests) đầy đủ bao phủ các trường hợp biên.',

    askPlaceholder: 'Đặt câu hỏi, gõ @ để trỏ file, hoặc / để gọi kỹ năng...',
    visionPlaceholder: 'Nhập câu hỏi về hình ảnh này (Qwen2-VL sẽ tự động kích hoạt)...',
    fileMention: 'Trỏ tệp',
    skillSlash: 'Kỹ năng',
    visionBtn: 'Ảnh & Thị giác',
    send: 'Gửi',
    stop: 'Dừng',
    tokens: 'tokens',
    autoRoute: '🔮 Tự động định tuyến',
    autoRouteDesc: 'Lập trình / Suy luận / Thị giác / Trò chuyện nhanh',
    switchProvider: 'Đổi Provider',
    providerModels: 'Model khả dụng',
    useCustomModel: 'Dùng model tùy chỉnh:',
    noMatchingModels: 'Không tìm thấy model phù hợp.',
    contextHeader: 'Ngữ cảnh:',

    workspaceToolsTitle: 'Công cụ làm việc',
    addToolBtn: 'Thêm công cụ',
    noToolActive: 'Chọn công cụ làm việc',
    chooseToolDesc: 'Nhấn vào một công cụ bên dưới để bắt đầu làm việc',
    filesLabel: 'Tệp tin',
    filesDesc: 'Duyệt cây thư mục và đính kèm tệp dự án vào ngữ cảnh',
    shellLabel: 'Dòng lệnh',
    shellDesc: 'Thực thi lệnh trực tiếp trong thư mục dự án',
    webLabel: 'Trang Web',
    webDesc: 'Xem trước giao diện web cục bộ (localhost:3000)',
    ragLabel: 'Tri thức RAG',
    ragDesc: 'Tìm kiếm ngữ nghĩa thông minh trong tài liệu dự án',
    promptLabel: 'Chỉ dẫn',
    promptDesc: 'Tùy biến chỉ dẫn cho dự án này',
    pinnedFiles: 'Tệp ngữ cảnh đính kèm',
    noPinnedFiles: 'Chưa có tệp nào được đính kèm. Kéo thả tệp từ cây thư mục hoặc máy tính vào ô chat.',
    terminalPlaceholder: 'Nhập lệnh thực thi... (Enter để chạy, Esc để xóa)',
    terminalReady: 'Dòng lệnh đã sẵn sàng. Nhập lệnh bên dưới và nhấn Enter để thực thi.',
    shellCore: 'Bộ điều khiển dòng lệnh',
    projectExplorer: 'Cây thư mục dự án',
    clickToPin: 'Bấm xem • Kéo vào Chat',
    openInExternalBrowser: 'Mở trong trình duyệt ngoài',
    run: 'Chạy',
    running: 'Đang chạy...',
    clearLogs: 'Xóa log',
    savePrompt: 'Lưu chỉ dẫn',
    promptSaved: 'Đã lưu chỉ dẫn!',
    systemPromptDesc: 'Chỉ dẫn này sẽ áp dụng dành riêng cho dự án hiện tại.',
    browserPlaceholder: 'http://localhost:3000',
    ragSearchPlaceholder: 'Tra cứu tài liệu & đoạn code trong dự án...',
    ragSearchBtn: 'Tìm kiếm',
    ragExplanation: 'Hệ thống tự động chia nhỏ file dự án, nhúng vector cục bộ và trích xuất các đoạn code liên quan nhất vào prompt.',

    autoRouteTitle: 'Tự động định tuyến mô hình thông minh',
    autoRouteSubtitle: 'Tự động phân tích ý định câu hỏi để chuyển tiếp đến mô hình Lập trình, Suy luận, Thị giác hoặc Đám mây.',
    fastModel: '⚡ Mô hình đàm thoại nhanh',
    coderModel: '💻 Mô hình lập trình chuyên sâu',
    reasonerModel: '🧠 Mô hình suy luận sâu',
    visionModel: '👁️ Mô hình thị giác đa phương thức',
    modelHubTitle: 'Thư viện mô hình GGUF',
    searchModelsPlaceholder: 'Tìm kiếm mô hình theo tên, tác giả, hoặc thẻ...',
    allModels: 'Tất cả',
    codingCategory: '💻 Lập trình',
    reasoningCategory: '🧠 Suy luận',
    visionCategory: '👁️ Thị giác',
    generalCategory: '⚡ Đa nhiệm',
    cudaLiveTitle: 'Bộ tính toán CUDA & VRAM thời gian thực',
    cudaLiveSubtitle: 'Tự động tính toán phân bổ bộ nhớ GPU và CPU theo nấc trượt offload.',
    vramEstimate: 'Ước tính tiêu thụ bộ nhớ đồ họa:',
    expectedSpeed: 'Tốc độ dự kiến:',
    systemRamNeeded: 'RAM hệ thống cần:',
    gpuLayersLabel: 'Số lớp nạp vào GPU VRAM:',
    gpuLayersTip: 'Kéo thanh trượt để điều chỉnh. Trạng thái và thanh VRAM sẽ tự động cập nhật.',
    contextSizeLabel: 'Kích thước ngữ cảnh:',
    cpuThreadsLabel: 'Số luồng CPU:',
    flashAttentionLabel: 'Flash Attention',
    flashAttentionDesc: 'Tiết kiệm ~30% VRAM khi tạo văn bản dài.',
    applyModelBtn: 'Áp dụng thông số & Đặt làm mô hình hoạt động',
    applyModelSuccess: 'Đã áp dụng thông số thành công!',
    huggingFaceLink: 'Hugging Face',

    samplingTitle: 'Tham số lấy mẫu mặc định',
    samplingSubtitle: 'Tùy biến độ sáng tạo, độ dài câu trả lời và tần suất lặp từ.',
    temperatureLabel: 'Độ sáng tạo:',
    tempStrict: '0.0 (Chính xác)',
    tempBalanced: '0.7 (Cân bằng mặc định)',
    tempCreative: '1.5 (Sáng tạo)',
    topPLabel: 'Lấy mẫu hạt nhân:',
    maxTokensLabel: 'Độ dài phản hồi tối đa:',
    repeatPenaltyLabel: 'Tránh lặp từ:',
    globalPromptLabel: 'Chỉ dẫn mặc định toàn cục:',
    saveSamplingBtn: 'Lưu cấu hình lấy mẫu',

    storageTitle: 'Lưu trữ & Thư mục hệ thống',
    storageSubtitle: 'Quản lý thư mục chứa GGUF models, workspace data và bộ nhớ tạm.',
    modelsFolder: '📁 Thư mục GGUF Models:',
    modelsFolderDesc: 'Tất cả file .gguf tải về hoặc copy vào thư mục này sẽ tự động xuất hiện trong Model Hub.',
    workspaceRoot: '💻 Thư mục gốc Workspace hiện tại:',
    openInExplorer: 'Mở trong File Explorer',
    cacheTitle: '🧹 Bộ nhớ đệm & File tạm của ứng dụng',
    cacheDesc: 'Xóa session cache và log tạm thời để giải phóng dung lượng ổ cứng.',
    clearCacheBtn: 'Xóa bộ nhớ đệm',

    appearanceTitle: 'Giao diện & Hiệu ứng',
    appearanceSubtitle: 'Tùy biến hiệu ứng mờ kính Frosted Glass, kích thước font chữ và độ tương phản.',
    glassIntensity: 'Mức độ hiệu ứng kính mờ:',
    ultraGlass: '🔮 Kính mờ siêu thực',
    ultraGlassDesc: 'Blur 24px, viền phát sáng sang trọng tối đa.',
    balancedGlass: '💎 Kính mờ cân bằng',
    balancedGlassDesc: 'Blur 12px, hài hòa giữa hiệu năng và thẩm mỹ.',
    solidDark: '⬛ Nền tối đặc tương phản',
    solidDarkDesc: 'Nền tối đặc không làm mờ, tương phản cao, tối ưu pin.',
    fontSize: 'Tỷ lệ cỡ chữ giao diện:',
    compact: 'Nhỏ gọn (12px)',
    compactDesc: 'Tối ưu mật độ hiển thị nhiều code và dữ liệu.',
    defaultFont: 'Mặc định (13px)',
    defaultFontDesc: 'Cỡ chữ chuẩn hài hòa, dễ đọc.',
    largeFont: 'Lớn thoáng (14px)',
    largeFontDesc: 'Thoáng mắt, dễ nhìn từ khoảng cách xa.',

    shortcutsTitle: 'Bảng phím tắt thao tác nhanh',
    shortcutsSubtitle: 'Các phím tắt giúp thao tác nhanh và tiện lợi như Cursor và VS Code.',
    chatAndCommands: 'Chat & Lệnh',
    toolsAndWorkspace: 'Công cụ & Workspace',
    sendMessageShortcut: 'Gửi tin nhắn',
    newLineShortcut: 'Xuống dòng mới',
    newChatShortcut: 'Tạo hội thoại mới',
    closeModalShortcut: 'Đóng modal / Dừng stream',
    toggleToolsShortcut: 'Bật/tắt bảng công cụ làm việc',
    slashSkillsShortcut: 'Mở danh sách kỹ năng qua dấu gạch chéo',
    referenceFileShortcut: 'Đính kèm tệp dự án qua ký tự a còng',
    openSettingsShortcut: 'Mở Cài đặt Studio',

    providersTitle: 'Khóa API & Nhà cung cấp suy luận',
    baseUrlEndpoint: 'Địa chỉ cổng kết nối:',
    apiKeyLabel: 'Khóa API:',
    defaultModelLabel: 'Mô hình mặc định:',
    testAndSyncBtn: 'Kiểm tra & Đồng bộ mô hình',

    aboutTitle: 'LocalAI Desktop Studio',
    aboutSubtitle: 'v0.1.0 • Tích hợp nhân llama.cpp & Động cơ CUDA',
    productionReady: 'Sẵn sàng vận hành',
    aboutDesc: 'LocalAI là nền tảng máy trạm AI cục bộ độc lập, tích hợp bộ tăng tốc phần cứng cho GPU 4GB VRAM (GTX 1650), tự động định tuyến mô hình đa nhiệm và hệ thống kỹ năng cục bộ.',
    runtimeCore: 'Nhân hệ thống:',
    inferenceBackend: 'Động cơ suy luận:',
    desktopWrapper: 'Đóng gói Desktop:',
    currentVersionLatest: 'Phiên bản hiện tại là mới nhất.',

    addProjectFolderTitle: 'Thêm thư mục dự án',
    addProjectFolderSubtitle: 'Gắn mã nguồn cục bộ để dùng các công cụ AI, RAG & Terminal.',
    folderPathLabel: 'Đường dẫn thư mục tuyệt đối trên PC:',
    folderPathPlaceholder: 'Ví dụ: C:\\Tam\\Code\\LocalAI',
    browseBtn: 'Chọn thư mục...',
    browsingBtn: 'Đang mở...',
    quickSuggestions: 'Gợi ý nhanh:',
    currentRepo: '⚡ Dự án hiện tại',
    desktop: '🖥️ Desktop',
    documents: '📁 Documents',
    projectNameLabel: 'Tên hiển thị Workspace:',
    projectNamePlaceholder: 'Ví dụ: LocalAI Project',
    createWorkspaceBtn: 'Tạo Workspace',
  },
};

export const getLanguage = (): Language => {
  const saved = localStorage.getItem('localai_lang');
  return saved === 'en' ? 'en' : 'vi';
};

export const setLanguage = (lang: Language) => {
  localStorage.setItem('localai_lang', lang);
};
