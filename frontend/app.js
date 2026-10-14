/**
 * NexusLLM Frontend Controller
 * 
 * FRONTEND RESPONSIBILITIES:
 * 1. UI Rendering: Renders message thread, markdown, code highlighting, and theme.
 * 2. User Input: Auto-resizing textarea, keyboard shortcuts, starter prompt chips.
 * 3. HTTP Communication: Dispatches POST requests to the backend server (/api/chat).
 * 4. Supabase Integration: Connects to Supabase client using public Anon Key.
 * 5. Architectural Inspector: Captures and visualizes the exact payload sent across layers.
 * 6. State Persistence: Stores user preferences and client-safe tokens in localStorage.
 */

// Determine API Base URL
const API_BASE_URL = window.location.protocol === 'file:' 
  ? 'http://localhost:3001' 
  : (window.location.port ? window.location.origin : 'http://localhost:3001');

// App State
const state = {
  messages: [],
  currentConversationId: null,
  provider: localStorage.getItem('nexus_provider') || 'mock',
  model: localStorage.getItem('nexus_model') || 'mock-llm-v1',
  systemPrompt: localStorage.getItem('nexus_sysprompt') || 'You are an intelligent, helpful AI assistant.',
  apiKeys: {
    gemini: localStorage.getItem('nexus_key_gemini') || '',
    openai: localStorage.getItem('nexus_key_openai') || ''
  },
  supabase: {
    url: localStorage.getItem('nexus_supabase_url') || '',
    anonKey: localStorage.getItem('nexus_supabase_anon_key') || '',
    client: null,
    connected: false
  },
  theme: localStorage.getItem('nexus_theme') || 'dark',
  isGenerating: false,
  backendOnline: false,
  lastInspectorData: null
};

// DOM Elements
const DOM = {
  // Navigation & Badges
  backendStatusBadge: document.getElementById('backend-status-badge'),
  backendStatusText: document.getElementById('backend-status-text'),
  backendLatencyTag: document.getElementById('backend-latency-tag'),
  supabaseStatusBadge: document.getElementById('supabase-status-badge'),
  supabaseStatusText: document.getElementById('supabase-status-text'),
  headerProviderIcon: document.getElementById('header-provider-icon'),
  headerModelName: document.getElementById('header-model-name'),
  themeIcon: document.getElementById('theme-icon'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),
  
  // Modals & Triggers
  btnArchitectureModal: document.getElementById('btn-architecture-modal'),
  btnOpenInspector: document.getElementById('btn-open-inspector'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  modalArchitecture: document.getElementById('modal-architecture'),
  modalInspector: document.getElementById('modal-inspector'),
  modalSettings: document.getElementById('modal-settings'),
  
  // Chat feed
  welcomeContainer: document.getElementById('welcome-container'),
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  typingIndicator: document.getElementById('typing-indicator'),
  indicatorLabel: document.getElementById('indicator-label'),
  
  // Input bar
  userPromptInput: document.getElementById('user-prompt-input'),
  btnSendMessage: document.getElementById('btn-send-message'),
  providerSelect: document.getElementById('provider-select'),
  modelSelect: document.getElementById('model-select'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  btnExportChat: document.getElementById('btn-export-chat'),

  // Settings
  settingsProvider: document.getElementById('settings-provider'),
  settingsGeminiKey: document.getElementById('settings-gemini-key'),
  settingsOpenaiKey: document.getElementById('settings-openai-key'),
  settingsSupabaseUrl: document.getElementById('settings-supabase-url'),
  settingsSupabaseAnonKey: document.getElementById('settings-supabase-anon-key'),
  settingsSystemPrompt: document.getElementById('settings-system-prompt'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnResetSettings: document.getElementById('btn-reset-settings'),

  // Inspector
  inspectorReqJson: document.getElementById('inspector-request-json'),
  inspectorResJson: document.getElementById('inspector-response-json'),
  inspectorReqTime: document.getElementById('inspector-req-time'),
  inspectorResTime: document.getElementById('inspector-res-time'),
  metricProvider: document.getElementById('metric-provider'),
  metricModel: document.getElementById('metric-model'),
  metricLlmLatency: document.getElementById('metric-llm-latency'),
  metricTotalTime: document.getElementById('metric-total-time'),
  btnCopyInspector: document.getElementById('btn-copy-inspector'),

  toastContainer: document.getElementById('toast-container')
};

// ==============================================================
// INITIALIZATION
// ==============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initFormValues();
  bindEvents();
  
  // Fetch server configuration & health
  await checkBackendHealth();
  await loadPublicConfig();
  await fetchModels();
  initSupabaseClient();

  // Periodic health ping every 12 seconds
  setInterval(checkBackendHealth, 12000);
});

// ==============================================================
// EVENT BINDINGS
// ==============================================================
function bindEvents() {
  // Theme toggle
  DOM.btnToggleTheme.addEventListener('click', toggleTheme);

  // Send message
  DOM.btnSendMessage.addEventListener('click', handleSendMessage);
  DOM.userPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize textarea
  DOM.userPromptInput.addEventListener('input', () => {
    DOM.userPromptInput.style.height = 'auto';
    DOM.userPromptInput.style.height = Math.min(DOM.userPromptInput.scrollHeight, 180) + 'px';
  });

  // Starter prompts
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      DOM.userPromptInput.value = promptText;
      DOM.userPromptInput.focus();
      handleSendMessage();
    });
  });

  // Provider / Model selection change
  DOM.providerSelect.addEventListener('change', (e) => {
    state.provider = e.target.value;
    localStorage.setItem('nexus_provider', state.provider);
    updateModelDropdown();
    updateHeaderPill();
  });

  DOM.modelSelect.addEventListener('change', (e) => {
    state.model = e.target.value;
    localStorage.setItem('nexus_model', state.model);
    updateHeaderPill();
  });

  // Clear chat
  DOM.btnClearChat.addEventListener('click', () => {
    if (state.messages.length === 0) return;
    if (confirm('Clear the entire conversation history?')) {
      state.messages = [];
      state.currentConversationId = null;
      DOM.chatMessagesContainer.innerHTML = '';
      DOM.chatMessagesContainer.classList.add('hidden');
      DOM.welcomeContainer.classList.remove('hidden');
      showToast('Conversation cleared.', 'success');
    }
  });

  // Export chat
  DOM.btnExportChat.addEventListener('click', exportChatAsMarkdown);

  // Modal Triggers
  DOM.btnArchitectureModal.addEventListener('click', () => openModal(DOM.modalArchitecture));
  DOM.btnOpenInspector.addEventListener('click', () => openModal(DOM.modalInspector));
  DOM.btnOpenSettings.addEventListener('click', () => {
    syncSettingsFields();
    openModal(DOM.modalSettings);
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      if (targetModal) closeModal(targetModal);
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  // Settings save / reset
  DOM.btnSaveSettings.addEventListener('click', saveSettings);
  DOM.btnResetSettings.addEventListener('click', resetSettings);

  // Password visibility toggle
  document.querySelectorAll('.btn-toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁️' : '🙈';
      }
    });
  });

  // Copy Inspector Data
  DOM.btnCopyInspector.addEventListener('click', () => {
    if (!state.lastInspectorData) {
      showToast('No inspector log available yet.', 'error');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(state.lastInspectorData, null, 2));
    showToast('Inspector log copied to clipboard!', 'success');
  });
}

// ==============================================================
// BACKEND & SUPABASE COMMUNICATION
// ==============================================================

/**
 * Load public configuration from backend /api/config
 */
async function loadPublicConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`);
    if (res.ok) {
      const config = await res.json();
      // If server has Supabase configured and client doesn't have an override, adopt it
      if (config.supabaseUrl && !state.supabase.url) {
        state.supabase.url = config.supabaseUrl;
        localStorage.setItem('nexus_supabase_url', config.supabaseUrl);
      }
      if (config.supabaseAnonKey && !state.supabase.anonKey) {
        state.supabase.anonKey = config.supabaseAnonKey;
        localStorage.setItem('nexus_supabase_anon_key', config.supabaseAnonKey);
      }
    }
  } catch {
    // Backend offline or local file mode
  }
}

/**
 * Initialize Supabase client on Frontend
 */
function initSupabaseClient() {
  const url = state.supabase.url;
  const anonKey = state.supabase.anonKey;

  if (window.supabase && url && anonKey) {
    try {
      state.supabase.client = window.supabase.createClient(url, anonKey);
      state.supabase.connected = true;
      updateSupabaseBadge('online', 'Supabase: Connected');
      console.log('⚡ [FRONTEND SUPABASE] Initialized client with Anon Key');
    } catch (e) {
      state.supabase.connected = false;
      updateSupabaseBadge('offline', 'Supabase: Config Error');
    }
  } else {
    state.supabase.connected = false;
    updateSupabaseBadge('offline', 'Supabase: Offline (Local)');
  }
}

function updateSupabaseBadge(statusClass, label) {
  if (DOM.supabaseStatusBadge && DOM.supabaseStatusText) {
    DOM.supabaseStatusBadge.className = `status-badge ${statusClass}`;
    DOM.supabaseStatusText.textContent = label;
  }
}

/**
 * Check backend health & latency
 */
async function checkBackendHealth() {
  const startTime = Date.now();
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
    const latency = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      state.backendOnline = true;
      DOM.backendStatusBadge.className = 'status-badge online';
      DOM.backendStatusText.textContent = 'Backend: Connected';
      DOM.backendLatencyTag.textContent = `${latency}ms`;
      DOM.backendStatusBadge.title = `Node.js Server Online (Uptime: ${data.uptimeSeconds}s)`;

      if (data.supabase?.configured && !state.supabase.connected) {
        updateSupabaseBadge('online', 'Supabase: Connected');
      }
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (err) {
    state.backendOnline = false;
    DOM.backendStatusBadge.className = 'status-badge offline';
    DOM.backendStatusText.textContent = 'Backend: Offline';
    DOM.backendLatencyTag.textContent = '--';
    DOM.backendStatusBadge.title = `Cannot reach ${API_BASE_URL}. Ensure backend/server.js is running!`;
  }
}

/**
 * Fetch available models from backend
 */
async function fetchModels() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/models`);
    if (res.ok) {
      const data = await res.json();
      state.availableProviders = data.providers;
      updateModelDropdown();
    }
  } catch {
    // Fallback if backend not ready yet
  }
}

/**
 * Send chat message to backend
 */
async function handleSendMessage() {
  const prompt = DOM.userPromptInput.value.trim();
  if (!prompt || state.isGenerating) return;

  // Clear input
  DOM.userPromptInput.value = '';
  DOM.userPromptInput.style.height = 'auto';

  // Ensure message container is visible
  DOM.welcomeContainer.classList.add('hidden');
  DOM.chatMessagesContainer.classList.remove('hidden');

  // 1. Append User Message to UI
  const userMsgId = 'msg-' + Date.now();
  const userMsg = {
    id: userMsgId,
    role: 'user',
    content: prompt,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  state.messages.push(userMsg);
  renderMessage(userMsg);
  scrollToBottom();

  // 2. Prepare Payload for Backend
  const historyPayload = state.messages
    .slice(0, -1) // exclude current turn
    .map(m => ({ role: m.role, content: m.content }));

  const activeKey = state.provider === 'gemini' 
    ? state.apiKeys.gemini 
    : (state.provider === 'openai' ? state.apiKeys.openai : null);

  const requestPayload = {
    prompt,
    history: historyPayload,
    provider: state.provider,
    model: state.model,
    systemPrompt: state.systemPrompt,
    conversationId: state.currentConversationId || undefined,
    apiKey: activeKey || undefined
  };

  // 3. Update Architectural Inspector (Outgoing Request)
  const reqTimestamp = new Date().toLocaleTimeString();
  DOM.inspectorReqTime.textContent = reqTimestamp;
  DOM.inspectorReqJson.textContent = JSON.stringify(requestPayload, null, 2);

  // 4. Show Typing Indicator
  state.isGenerating = true;
  DOM.btnSendMessage.disabled = true;
  DOM.typingIndicator.classList.remove('hidden');
  DOM.indicatorLabel.textContent = `Backend orchestrating ${formatProviderName(state.provider)}...`;
  scrollToBottom();

  const clientStartTime = Date.now();

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(activeKey ? { 'x-api-key': activeKey } : {})
      },
      body: JSON.stringify(requestPayload)
    });

    const clientRoundtripMs = Date.now() - clientStartTime;
    const responseData = await response.json();

    // 5. Update Architectural Inspector (Incoming Response)
    DOM.inspectorResTime.textContent = `${clientRoundtripMs}ms`;
    DOM.inspectorResJson.textContent = JSON.stringify(responseData, null, 2);
    DOM.metricProvider.textContent = responseData.meta?.provider || state.provider;
    DOM.metricModel.textContent = responseData.meta?.model || state.model;
    DOM.metricLlmLatency.textContent = responseData.meta?.llmLatencyMs ? `${responseData.meta.llmLatencyMs}ms` : '--';
    DOM.metricTotalTime.textContent = `${clientRoundtripMs}ms`;

    state.lastInspectorData = {
      request: requestPayload,
      response: responseData,
      roundtripMs: clientRoundtripMs,
      timestamp: new Date().toISOString()
    };

    if (responseData.meta?.conversationId) {
      state.currentConversationId = responseData.meta.conversationId;
    }

    if (!response.ok || !responseData.success) {
      throw new Error(responseData.error || `Server returned error (${response.status})`);
    }

    // 6. Append Assistant Message to UI
    const assistantMsg = {
      id: 'msg-' + Date.now(),
      role: 'assistant',
      content: responseData.reply,
      meta: responseData.meta,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.messages.push(assistantMsg);
    renderMessage(assistantMsg);

  } catch (err) {
    const errorMsg = {
      id: 'msg-err-' + Date.now(),
      role: 'assistant',
      content: `⚠️ **Backend Error**: ${err.message}\n\n*Check the Architecture / Inspector tab or ensure your API key / Backend server is running properly.*`,
      isError: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.messages.push(errorMsg);
    renderMessage(errorMsg);
    showToast(err.message, 'error');

  } finally {
    state.isGenerating = false;
    DOM.btnSendMessage.disabled = false;
    DOM.typingIndicator.classList.add('hidden');
    scrollToBottom();
    DOM.userPromptInput.focus();
  }
}

// ==============================================================
// UI RENDERING & MARKDOWN PARSER
// ==============================================================

function renderMessage(msg) {
  const row = document.createElement('div');
  row.className = `message-row ${msg.role}`;
  row.id = msg.id;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = msg.role === 'user' ? '👤' : (msg.isError ? '⚠️' : '✦');

  const wrapper = document.createElement('div');
  wrapper.className = 'message-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = parseMarkdown(msg.content);

  const metaBar = document.createElement('div');
  metaBar.className = 'message-meta-bar';

  const timeSpan = document.createElement('span');
  timeSpan.textContent = msg.timestamp;
  metaBar.appendChild(timeSpan);

  if (msg.meta) {
    const modelTag = document.createElement('span');
    modelTag.className = 'meta-model-tag';
    modelTag.textContent = msg.meta.model || state.model;
    metaBar.appendChild(modelTag);

    if (msg.meta.llmLatencyMs) {
      const latTag = document.createElement('span');
      latTag.className = 'meta-latency-tag';
      latTag.textContent = `${msg.meta.llmLatencyMs}ms`;
      metaBar.appendChild(latTag);
    }

    if (msg.meta.supabaseSaved) {
      const dbTag = document.createElement('span');
      dbTag.className = 'meta-latency-tag';
      dbTag.textContent = '⚡ Saved in Supabase';
      dbTag.title = 'Persisted to Supabase PostgreSQL database';
      metaBar.appendChild(dbTag);
    }
  }

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-msg-action';
  copyBtn.title = 'Copy message text';
  copyBtn.innerHTML = `<span>📋 Copy</span>`;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(msg.content);
    showToast('Copied to clipboard!', 'success');
  });
  metaBar.appendChild(copyBtn);

  wrapper.appendChild(bubble);
  wrapper.appendChild(metaBar);

  row.appendChild(avatar);
  row.appendChild(wrapper);

  DOM.chatMessagesContainer.appendChild(row);

  bubble.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code');
      navigator.clipboard.writeText(decodeURIComponent(code));
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
}

function parseMarkdown(text) {
  if (!text) return '';

  let html = text;

  // 1. Code blocks
  html = html.replace(/```([a-zA-Z0-9_\-+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const cleanLang = lang.trim() || 'code';
    const escapedCode = escapeHtml(code.trim());
    const encodedForCopy = encodeURIComponent(code.trim());
    return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-lang-label">${cleanLang}</span>
          <button class="btn-copy-code" data-code="${encodedForCopy}">Copy</button>
        </div>
        <pre><code class="language-${cleanLang}">${escapedCode}</code></pre>
      </div>
    `;
  });

  // 2. Inline code
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  });

  // 3. Tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const lines = match.trim().split(/\r?\n/);
    if (lines.length < 2) return match;

    let tableHtml = '<div class="markdown-table-wrapper"><table>';
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^\|[-:\s|]+\|$/.test(line)) {
        isHeader = false;
        continue;
      }
      const cells = line.split('|').slice(1, -1);
      const tag = isHeader ? 'th' : 'td';
      tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
      if (isHeader) isHeader = false;
    }
    tableHtml += '</table></div>';
    return tableHtml;
  });

  // 4. Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 5. Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 6. Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 7. Unordered Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // 8. Paragraphs
  const paragraphs = html.split(/\n{2,}/).map(para => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<div') || para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<blockquote') || para.startsWith('<table')) {
      return para;
    }
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  });

  return paragraphs.join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  const viewport = document.querySelector('.chat-viewport');
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  }
}

// ==============================================================
// SETTINGS & STATE MANAGEMENT
// ==============================================================

function initFormValues() {
  DOM.providerSelect.value = state.provider;
  updateModelDropdown();
  updateHeaderPill();
}

function updateModelDropdown() {
  DOM.modelSelect.innerHTML = '';
  
  const modelsMap = {
    mock: [
      { id: 'mock-llm-v1', name: 'Mock Simulator v1' }
    ],
    gemini: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' }
    ],
    openai: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  };

  const list = modelsMap[state.provider] || modelsMap.mock;
  list.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === state.model) opt.selected = true;
    DOM.modelSelect.appendChild(opt);
  });

  if (!list.some(m => m.id === state.model)) {
    state.model = list[0].id;
    localStorage.setItem('nexus_model', state.model);
  }

  updateHeaderPill();
}

function updateHeaderPill() {
  const iconMap = {
    mock: '🤖',
    gemini: '✨',
    openai: '⚡'
  };
  DOM.headerProviderIcon.textContent = iconMap[state.provider] || '🤖';
  DOM.headerModelName.textContent = state.model;
}

function syncSettingsFields() {
  DOM.settingsProvider.value = state.provider;
  DOM.settingsGeminiKey.value = state.apiKeys.gemini;
  DOM.settingsOpenaiKey.value = state.apiKeys.openai;
  DOM.settingsSupabaseUrl.value = state.supabase.url;
  DOM.settingsSupabaseAnonKey.value = state.supabase.anonKey;
  DOM.settingsSystemPrompt.value = state.systemPrompt;
}

function saveSettings() {
  state.provider = DOM.settingsProvider.value;
  state.apiKeys.gemini = DOM.settingsGeminiKey.value.trim();
  state.apiKeys.openai = DOM.settingsOpenaiKey.value.trim();
  state.supabase.url = DOM.settingsSupabaseUrl.value.trim();
  state.supabase.anonKey = DOM.settingsSupabaseAnonKey.value.trim();
  state.systemPrompt = DOM.settingsSystemPrompt.value.trim();

  localStorage.setItem('nexus_provider', state.provider);
  localStorage.setItem('nexus_key_gemini', state.apiKeys.gemini);
  localStorage.setItem('nexus_key_openai', state.apiKeys.openai);
  localStorage.setItem('nexus_supabase_url', state.supabase.url);
  localStorage.setItem('nexus_supabase_anon_key', state.supabase.anonKey);
  localStorage.setItem('nexus_sysprompt', state.systemPrompt);

  DOM.providerSelect.value = state.provider;
  updateModelDropdown();
  initSupabaseClient();
  closeModal(DOM.modalSettings);
  showToast('Settings & Supabase configuration saved!', 'success');
}

function resetSettings() {
  if (confirm('Reset settings to default configuration?')) {
    state.provider = 'mock';
    state.model = 'mock-llm-v1';
    state.apiKeys.gemini = '';
    state.apiKeys.openai = '';
    state.supabase.url = '';
    state.supabase.anonKey = '';
    state.systemPrompt = 'You are a helpful, knowledgeable AI assistant.';
    
    localStorage.removeItem('nexus_provider');
    localStorage.removeItem('nexus_model');
    localStorage.removeItem('nexus_key_gemini');
    localStorage.removeItem('nexus_key_openai');
    localStorage.removeItem('nexus_supabase_url');
    localStorage.removeItem('nexus_supabase_anon_key');
    localStorage.removeItem('nexus_sysprompt');

    syncSettingsFields();
    initFormValues();
    initSupabaseClient();
    closeModal(DOM.modalSettings);
    showToast('Reset to defaults.', 'success');
  }
}

// ==============================================================
// MODAL & DRAWER HELPERS
// ==============================================================
function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ==============================================================
// THEME & TOAST UTILITIES
// ==============================================================
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  DOM.themeIcon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  DOM.themeIcon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('nexus_theme', state.theme);
  showToast(`Switched to ${state.theme} mode`, 'success');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function formatProviderName(provider) {
  const names = {
    gemini: 'Google Gemini AI',
    openai: 'OpenAI Cloud',
    mock: 'Local Simulation Engine'
  };
  return names[provider] || provider;
}

function exportChatAsMarkdown() {
  if (state.messages.length === 0) {
    showToast('No messages to export.', 'error');
    return;
  }
  let md = `# NexusLLM Conversation Export\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
  state.messages.forEach(msg => {
    const roleTitle = msg.role === 'user' ? '### 👤 User' : `### ✦ Assistant (${msg.meta?.model || state.model})`;
    md += `${roleTitle} - *${msg.timestamp}*\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chat exported as Markdown!', 'success');
}
