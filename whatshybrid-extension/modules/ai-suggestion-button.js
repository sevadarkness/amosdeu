/**
 * 🤖 AI Suggestion Button - Botão Azul de Sugestões de IA
 *
 * Botão posicionado ACIMA do botão enviar do WhatsApp (sem atrapalhar)
 * Ao clicar: gera sugestão baseada em TODA a conversa
 * Ao clicar novamente: minimiza o painel
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  if (window.__AI_SUGGESTION_BUTTON_LOADED__) return;
  window.__AI_SUGGESTION_BUTTON_LOADED__ = true;

  const CONFIG = {
    BUTTON_ID: 'whl-ai-suggestion-btn',
    PANEL_ID: 'whl-ai-suggestion-panel',
    CHECK_INTERVAL: 2000,
    BUTTON_SIZE: 44,
    BUTTON_MARGIN: 8
  };

  let state = {
    buttonInjected: false,
    panelVisible: false,
    currentSuggestion: null,
    isGenerating: false
  };

  // ============================================
  // ESTILOS
  // ============================================

  function injectStyles() {
    if (document.getElementById('whl-ai-suggestion-styles')) return;

    const style = document.createElement('style');
    style.id = 'whl-ai-suggestion-styles';
    style.textContent = `
      /* Botão Azul de IA */
      #${CONFIG.BUTTON_ID} {
        position: absolute;
        bottom: ${CONFIG.BUTTON_SIZE + CONFIG.BUTTON_MARGIN}px;
        right: 10px;
        width: ${CONFIG.BUTTON_SIZE}px;
        height: ${CONFIG.BUTTON_SIZE}px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        transition: all 0.3s ease;
        z-index: 100;
        font-size: 22px;
      }

      #${CONFIG.BUTTON_ID}:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
      }

      #${CONFIG.BUTTON_ID}:active {
        transform: scale(0.95);
      }

      #${CONFIG.BUTTON_ID}.generating {
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      /* Painel de Sugestão */
      #${CONFIG.PANEL_ID} {
        position: absolute;
        bottom: ${CONFIG.BUTTON_SIZE + CONFIG.BUTTON_MARGIN * 2 + 10}px;
        right: 10px;
        width: 360px;
        max-height: 200px;
        background: rgba(26, 26, 46, 0.98);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(20px);
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 99;
        overflow: hidden;
      }

      #${CONFIG.PANEL_ID}.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .whl-ai-sug-header {
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .whl-ai-sug-title {
        color: white;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .whl-ai-sug-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .whl-ai-sug-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .whl-ai-sug-body {
        padding: 12px;
        color: #e5e7eb;
        font-size: 13px;
        line-height: 1.5;
        max-height: 120px;
        overflow-y: auto;
      }

      .whl-ai-sug-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: #9ca3af;
        gap: 10px;
      }

      .whl-ai-sug-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .whl-ai-sug-text {
        cursor: pointer;
        padding: 10px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(59, 130, 246, 0.3);
        transition: all 0.2s;
      }

      .whl-ai-sug-text:hover {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.5);
      }

      .whl-ai-sug-error {
        color: #f87171;
        text-align: center;
        padding: 20px;
        font-size: 12px;
      }

      .whl-ai-sug-config {
        text-align: center;
        padding: 20px;
        color: #fbbf24;
        font-size: 12px;
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================
  // CRIAR BOTÃO
  // ============================================

  function createButton() {
    const button = document.createElement('button');
    button.id = CONFIG.BUTTON_ID;
    button.innerHTML = '🤖';
    button.title = 'Gerar Sugestão de IA';

    button.addEventListener('click', handleButtonClick);

    return button;
  }

  // ============================================
  // CRIAR PAINEL
  // ============================================

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = CONFIG.PANEL_ID;
    panel.innerHTML = `
      <div class="whl-ai-sug-header">
        <div class="whl-ai-sug-title">
          <span>🤖</span>
          <span>Sugestão de IA</span>
        </div>
        <button class="whl-ai-sug-close" id="whl-ai-sug-close-btn">✕</button>
      </div>
      <div class="whl-ai-sug-body" id="whl-ai-sug-body">
        <div class="whl-ai-sug-loading">
          <div class="whl-ai-sug-spinner"></div>
          <span>Aguardando...</span>
        </div>
      </div>
    `;

    // Close button
    panel.querySelector('#whl-ai-sug-close-btn').addEventListener('click', hidePanel);

    return panel;
  }

  // ============================================
  // INJETAR NO WHATSAPP
  // ============================================

  function injectButton() {
    // Remover botão/painel existentes
    const existingBtn = document.getElementById(CONFIG.BUTTON_ID);
    const existingPanel = document.getElementById(CONFIG.PANEL_ID);
    if (existingBtn) existingBtn.remove();
    if (existingPanel) existingPanel.remove();

    // Encontrar o footer (área de composição de mensagem)
    const footerSelectors = [
      'footer[data-testid="conversation-compose-box-input"]',
      'footer._akay',
      'footer.copyable-area',
      'div[data-testid="conversation-compose-box-input"]',
      'footer'
    ];

    let footer = null;
    for (const selector of footerSelectors) {
      footer = document.querySelector(selector);
      if (footer) break;
    }

    if (!footer) {
      console.log('[AISuggestionBtn] Footer não encontrado');
      return false;
    }

    // Garantir que footer tem position relative
    const footerStyle = window.getComputedStyle(footer);
    if (footerStyle.position === 'static') {
      footer.style.position = 'relative';
    }

    // Criar e injetar botão
    const button = createButton();
    footer.appendChild(button);

    // Criar e injetar painel
    const panel = createPanel();
    footer.appendChild(panel);

    state.buttonInjected = true;
    console.log('[AISuggestionBtn] ✅ Botão azul injetado');
    return true;
  }

  // ============================================
  // HANDLERS
  // ============================================

  async function handleButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // Se painel está visível, minimiza
    if (state.panelVisible) {
      hidePanel();
      return;
    }

    // Se não está visível, gera sugestão
    await generateSuggestion();
  }

  async function generateSuggestion() {
    if (state.isGenerating) return;

    state.isGenerating = true;
    showPanel();
    showLoading();

    const button = document.getElementById(CONFIG.BUTTON_ID);
    if (button) button.classList.add('generating');

    try {
      // Extrair mensagens do DOM
      const messages = extractMessages();

      if (messages.length === 0) {
        showError('Nenhuma mensagem encontrada nesta conversa');
        return;
      }

      // MÉTODO 1: Tentar SmartRepliesModule
      if (window.SmartRepliesModule?.isConfigured?.()) {
        const chatId = getCurrentChatId();
        const result = await window.SmartRepliesModule.generateReply(chatId, messages);

        if (result) {
          showSuggestion(result);
          return;
        }
      }

      // MÉTODO 2: Tentar AIService
      if (window.AIService?.getConfiguredProviders?.().length > 0) {
        const context = messages.map(m =>
          `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`
        ).join('\n');

        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';

        const prompt = `Baseado na conversa completa abaixo, gere UMA sugestão de resposta profissional e contextualizada para a última mensagem do cliente.

CONVERSA COMPLETA:
${context}

ÚLTIMA MENSAGEM DO CLIENTE: ${lastUserMsg}

INSTRUÇÕES:
- Analise TODA a conversa para entender o contexto
- Responda de forma profissional e útil
- Seja conciso (máximo 2-3 frases)
- Responda em português brasileiro
- NÃO inclua saudações se a conversa já começou

Responda APENAS com o texto da sugestão, sem formatação adicional.`;

        const result = await window.AIService.generateText(prompt, {
          temperature: 0.7,
          maxTokens: 200
        });

        if (result?.content) {
          showSuggestion(result.content);
          return;
        }
      }

      // MÉTODO 3: CopilotEngine
      if (window.CopilotEngine?.generateResponse) {
        const chatId = getCurrentChatId();
        const result = await window.CopilotEngine.generateResponse(chatId);

        if (result?.content) {
          showSuggestion(result.content);
          return;
        }
      }

      // Nenhum método disponível
      showConfig();

    } catch (error) {
      console.error('[AISuggestionBtn] Erro:', error);
      showError(error.message || 'Erro ao gerar sugestão');
    } finally {
      state.isGenerating = false;
      const button = document.getElementById(CONFIG.BUTTON_ID);
      if (button) button.classList.remove('generating');
    }
  }

  // ============================================
  // EXTRAIR MENSAGENS
  // ============================================

  function extractMessages() {
    const messages = [];

    try {
      // Encontrar container de mensagens
      const msgContainerSelectors = [
        '[data-testid="conversation-panel-messages"]',
        'div[data-testid="msg-container"]',
        '.message-list',
        '#main .copyable-area'
      ];

      let container = null;
      for (const selector of msgContainerSelectors) {
        container = document.querySelector(selector);
        if (container) break;
      }

      if (!container) return messages;

      // Buscar mensagens
      const messageElements = container.querySelectorAll('[data-testid="msg-container"]');

      for (const el of messageElements) {
        // Detectar se é mensagem enviada ou recebida
        const isOutgoing = el.querySelector('[data-testid="msg-dblcheck"]') ||
                          el.querySelector('[data-icon="msg-dblcheck"]') ||
                          el.querySelector('[data-icon="msg-check"]') ||
                          el.closest('[data-testid="msg-container"]')?.querySelector('[data-icon="tail-out"]');

        // Extrair texto
        const textEl = el.querySelector('[data-testid="msg-text"], .copyable-text span, .selectable-text span');
        const text = textEl?.textContent?.trim();

        if (text) {
          messages.push({
            role: isOutgoing ? 'assistant' : 'user',
            content: text
          });
        }
      }

      console.log(`[AISuggestionBtn] Extraídas ${messages.length} mensagens`);
    } catch (e) {
      console.error('[AISuggestionBtn] Erro ao extrair mensagens:', e);
    }

    return messages;
  }

  function getCurrentChatId() {
    try {
      if (window.Store?.Chat?.getActive) {
        return window.Store.Chat.getActive()?.id?._serialized;
      }
    } catch (e) {}
    return null;
  }

  // ============================================
  // UI DO PAINEL
  // ============================================

  function showPanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    if (panel) {
      panel.classList.add('visible');
      state.panelVisible = true;
    }
  }

  function hidePanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    if (panel) {
      panel.classList.remove('visible');
      state.panelVisible = false;
    }
  }

  function showLoading() {
    const body = document.getElementById('whl-ai-sug-body');
    if (!body) return;

    body.innerHTML = `
      <div class="whl-ai-sug-loading">
        <div class="whl-ai-sug-spinner"></div>
        <span>Analisando conversa...</span>
      </div>
    `;
  }

  function showSuggestion(text) {
    const body = document.getElementById('whl-ai-sug-body');
    if (!body) return;

    state.currentSuggestion = text;

    body.innerHTML = `
      <div class="whl-ai-sug-text" id="whl-ai-sug-text">
        ${escapeHtml(text)}
      </div>
    `;

    // Ao clicar na sugestão, insere no campo
    body.querySelector('#whl-ai-sug-text').addEventListener('click', useSuggestion);
  }

  function showError(message) {
    const body = document.getElementById('whl-ai-sug-body');
    if (!body) return;

    body.innerHTML = `
      <div class="whl-ai-sug-error">
        <div style="font-size: 20px; margin-bottom: 8px;">❌</div>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function showConfig() {
    const body = document.getElementById('whl-ai-sug-body');
    if (!body) return;

    body.innerHTML = `
      <div class="whl-ai-sug-config">
        <div style="font-size: 20px; margin-bottom: 8px;">⚙️</div>
        <div>Configure a IA</div>
        <div style="font-size: 11px; margin-top: 4px; color: rgba(251, 191, 36, 0.7);">
          Abra o painel lateral e configure o provider de IA
        </div>
      </div>
    `;
  }

  function useSuggestion() {
    if (!state.currentSuggestion) return;

    // Encontrar campo de input
    const inputSelectors = [
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][data-tab="10"]',
      'footer div[contenteditable="true"]'
    ];

    let input = null;
    for (const selector of inputSelectors) {
      input = document.querySelector(selector);
      if (input) break;
    }

    if (!input) {
      console.error('[AISuggestionBtn] Input não encontrado');
      return;
    }

    // Limpar e focar
    input.focus();

    // Usar execCommand para inserir texto
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, state.currentSuggestion);

    // Trigger eventos
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Fechar painel
    hidePanel();

    console.log('[AISuggestionBtn] ✅ Sugestão inserida no campo');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // MONITORAMENTO
  // ============================================

  function startMonitoring() {
    // Verificar periodicamente se botão ainda está injetado
    setInterval(() => {
      if (!document.getElementById(CONFIG.BUTTON_ID)) {
        state.buttonInjected = false;
        injectButton();
      }
    }, CONFIG.CHECK_INTERVAL);
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  function init() {
    console.log('[AISuggestionBtn] 🚀 Inicializando...');

    injectStyles();

    // Aguardar WhatsApp carregar
    const waitForWhatsApp = setInterval(() => {
      const footer = document.querySelector('footer');
      if (footer) {
        clearInterval(waitForWhatsApp);
        injectButton();
        startMonitoring();
        console.log('[AISuggestionBtn] ✅ Inicializado');
      }
    }, 1000);
  }

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 2000));
  } else {
    setTimeout(init, 2000);
  }

  // Export
  window.AISuggestionButton = {
    show: showPanel,
    hide: hidePanel,
    generate: generateSuggestion
  };

})();
