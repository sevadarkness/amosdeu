/**
 * 💡 Suggestion Injector - Exibe sugestões de IA na interface do WhatsApp
 * 
 * Mostra sugestões inline quando mensagens são recebidas
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // CONTAINER DE SUGESTÕES PREMIUM v7.5.0
  // 2.1 - Tamanho proporcional ao painel
  // 2.2 - Estilo premium
  // 2.3 - Integração visual
  // 2.4 - Design clean
  // ============================================
  function createSuggestionsContainer() {
    // Remover container existente
    document.getElementById('whl-suggestions-container')?.remove();
    
    const container = document.createElement('div');
    container.id = 'whl-suggestions-container';
    container.className = 'wh-suggestions-container';
    container.innerHTML = `
      <div class="wh-suggestions-header">
        <span>💡 Sugestões de Resposta</span>
        <button id="whl-suggestions-close" style="background:none;border:none;color:#8696a0;cursor:pointer;font-size:18px">×</button>
      </div>
      <div id="whl-suggestions-list" class="wh-suggestions-list"></div>
    `;
    
    // Estilos inline para garantir
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 320px;
      max-height: 400px;
      background: #1f2c33;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      overflow: hidden;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    document.body.appendChild(container);
    
    // Fechar ao clicar no X
    document.getElementById('whl-suggestions-close')?.addEventListener('click', () => {
      container.style.display = 'none';
    });
    
    return container;
  }

  function showSuggestions(suggestions) {
    let container = document.getElementById('whl-suggestions-container');
    if (!container) container = createSuggestionsContainer();
    
    const list = document.getElementById('whl-suggestions-list');
    if (!list) return;
    
    list.innerHTML = suggestions.map((sug, i) => `
      <div class="wh-suggestion-item" data-index="${i}" style="
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #e9edef;
        font-size: 14px;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(0,168,132,0.15)'" onmouseout="this.style.background='transparent'">
        ${sug.text || sug}
      </div>
    `).join('');
    
    container.style.display = 'block';
    
    // Click handler para inserir sugestão
    list.querySelectorAll('.wh-suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const text = item.textContent.trim();
        await insertSuggestionWithTyping(text);
        container.style.display = 'none';
      });
    });
  }

  async function insertSuggestionWithTyping(text) {
    const input = document.querySelector('footer div[contenteditable="true"]') ||
                  document.querySelector('[data-testid="conversation-compose-box-input"]');
    if (!input) return;
    
    input.focus();
    input.innerHTML = '';
    
    // Usar HumanTyping se disponível
    if (window.HumanTyping?.type) {
      window.HumanTyping.type(input, text, { minDelay: 20, maxDelay: 50 }).catch(console.error);
    } else {
      // Fallback
      for (const char of text) {
        document.execCommand('insertText', false, char);
        await new Promise(r => setTimeout(r, Math.random() * 30 + 15));
      }
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }


  'use strict';

  const CONFIG = {
    PANEL_ID: 'whl-suggestions-panel',
    MAX_SUGGESTIONS: 5,
    AUTO_HIDE_DELAY: 0, // 0 = NUNCA fecha automaticamente - usuário fecha manualmente
    ANIMATION_DURATION: 300
  };

  const state = {
    isVisible: false,
    currentSuggestions: [],
    currentChatId: null,
    hideTimeout: null,
    initialized: false
  };

  // ============================================================
  // ESTILOS
  // ============================================================

  function injectStyles() {
    if (document.getElementById('whl-suggestion-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'whl-suggestion-styles';
    styles.textContent = `
      #${CONFIG.PANEL_ID} {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 360px;
        max-height: 420px;
        background: rgba(26, 26, 46, 0.98);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(139, 92, 246, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 99998;
        overflow: hidden;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(20px);
      }

      #${CONFIG.PANEL_ID}.visible {
        transform: translateX(0);
        opacity: 1;
      }

      #${CONFIG.PANEL_ID} * {
        box-sizing: border-box;
      }

      .whl-sug-header {
        background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .whl-sug-title {
        color: white;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .whl-sug-badge {
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
      }

      .whl-sug-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .whl-sug-close:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
      }

      .whl-sug-body {
        padding: 12px;
        max-height: 320px;
        overflow-y: auto;
      }

      .whl-sug-item {
        background: rgba(40, 40, 70, 0.9);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid rgba(255,255,255,0.1);
      }

      .whl-sug-item:hover {
        background: rgba(102,126,234,0.15);
        border-color: rgba(102,126,234,0.3);
        transform: translateX(-4px);
      }

      .whl-sug-item:last-child {
        margin-bottom: 0;
      }

      .whl-sug-text {
        color: rgba(255,255,255,0.9);
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 8px;
      }

      .whl-sug-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .whl-sug-confidence {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
      }

      .whl-sug-confidence-bar {
        width: 40px;
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .whl-sug-confidence-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 2px;
        transition: width 0.3s;
      }

      .whl-sug-actions {
        display: flex;
        gap: 6px;
      }

      .whl-sug-btn {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }

      .whl-sug-btn-use {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      .whl-sug-btn-use:hover {
        transform: scale(1.05);
      }

      .whl-sug-btn-edit {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.8);
      }

      .whl-sug-btn-edit:hover {
        background: rgba(255,255,255,0.2);
      }

      .whl-sug-empty {
        text-align: center;
        padding: 20px;
        color: rgba(255,255,255,0.5);
        font-size: 13px;
      }

      .whl-sug-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        color: rgba(255,255,255,0.7);
      }

      .whl-sug-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #667eea;
        border-radius: 50%;
        animation: whl-spin 0.8s linear infinite;
      }

      @keyframes whl-spin {
        to { transform: rotate(360deg); }
      }

      /* Toast de confirmação */
      .whl-sug-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 99999;
        opacity: 0;
        transition: all 0.3s;
      }

      .whl-sug-toast.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }

      /* Botão flutuante minimizado - 🤖 Robot Button */
      .whl-sug-fab {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
        border-radius: 50%;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5);
        z-index: 99997;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
      }

      .whl-sug-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(139, 92, 246, 0.7);
      }

      .whl-sug-fab.visible {
        display: flex;
      }

      .whl-sug-fab-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        font-size: 10px;
        font-weight: 700;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
    document.head.appendChild(styles);
  }

  // ============================================================
  // CRIAÇÃO DO PAINEL
  // ============================================================

  function createPanel() {
    if (document.getElementById(CONFIG.PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = CONFIG.PANEL_ID;
    panel.innerHTML = `
      <div class="whl-sug-header">
        <div class="whl-sug-title">
          <span>💡</span>
          <span>Sugestões de IA</span>
          <span class="whl-sug-badge" id="whl-sug-count">0</span>
        </div>
        <button class="whl-sug-close" id="whl-sug-close" title="Fechar">×</button>
      </div>
      <div class="whl-sug-body" id="whl-sug-body">
        <div class="whl-sug-empty">
          As sugestões aparecerão aqui quando você receber mensagens.
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Botão flutuante
    const fab = document.createElement('button');
    fab.className = 'whl-sug-fab';
    fab.id = 'whl-sug-fab';
    fab.innerHTML = '🤖<span class="whl-sug-fab-badge" id="whl-sug-fab-badge" style="display:none">0</span>';
    fab.title = 'Abrir/Fechar Sugestões de IA';
    document.body.appendChild(fab);

    // Event listeners
    document.getElementById('whl-sug-close').addEventListener('click', hidePanel);
    fab.addEventListener('click', togglePanel);

    console.log('[SuggestionInjector] 💡 Painel criado');
  }

  // ============================================================
  // EXIBIÇÃO DE SUGESTÕES
  // ============================================================

  function showSuggestions(suggestions, chatId = null) {
    if (!suggestions || suggestions.length === 0) return;

    state.currentSuggestions = suggestions;
    state.currentChatId = chatId;

    const body = document.getElementById('whl-sug-body');
    const count = document.getElementById('whl-sug-count');
    const fabBadge = document.getElementById('whl-sug-fab-badge');

    if (!body) return;

    // Atualiza contador
    if (count) count.textContent = suggestions.length;
    if (fabBadge) {
      fabBadge.textContent = suggestions.length;
      fabBadge.style.display = suggestions.length > 0 ? 'flex' : 'none';
    }

    // Renderiza sugestões
    body.innerHTML = suggestions.slice(0, CONFIG.MAX_SUGGESTIONS).map((sug, i) => {
      const text = typeof sug === 'string' ? sug : (sug.text || sug.content || sug.message || '');
      const confidence = sug.confidence || sug.score || 0.8;
      const confidencePercent = Math.round(confidence * 100);

      return `
        <div class="whl-sug-item" data-index="${i}">
          <div class="whl-sug-text">${escapeHtml(text)}</div>
          <div class="whl-sug-meta">
            <div class="whl-sug-confidence">
              <div class="whl-sug-confidence-bar">
                <div class="whl-sug-confidence-fill" style="width: ${confidencePercent}%"></div>
              </div>
              <span>${confidencePercent}%</span>
            </div>
            <div class="whl-sug-actions">
              <button class="whl-sug-btn whl-sug-btn-edit" data-action="edit" data-index="${i}">✏️</button>
              <button class="whl-sug-btn whl-sug-btn-use" data-action="use" data-index="${i}">Usar</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners para botões
    body.querySelectorAll('.whl-sug-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        handleAction(action, index);
      });
    });

    // Clique no item inteiro para usar
    body.querySelectorAll('.whl-sug-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        handleAction('use', index);
      });
    });

    // Mostra o painel
    showPanel();

    // Auto-hide após delay
    resetAutoHide();

    console.log('[SuggestionInjector] 💡', suggestions.length, 'sugestões exibidas');
  }

  function handleAction(action, index) {
    const suggestion = state.currentSuggestions[index];
    if (!suggestion) return;

    const text = typeof suggestion === 'string' ? suggestion : (suggestion.text || suggestion.content || suggestion.message || '');

    if (action === 'use') {
      insertIntoChat(text);
      showToast('✅ Sugestão inserida!');
      hidePanel();
    } else if (action === 'edit') {
      insertIntoChat(text, true);
      showToast('✏️ Edite a mensagem');
      hidePanel();
    }
  }

  async function insertIntoChat(text, focusOnly = false) {
    // Encontra o campo de texto
    const selectors = [
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][data-tab="10"]',
      'footer div[contenteditable="true"]',
      '#main footer div[contenteditable="true"]'
    ];

    let inputField = null;
    for (const sel of selectors) {
      inputField = document.querySelector(sel);
      if (inputField) break;
    }

    if (!inputField) {
      console.error('[SuggestionInjector] Campo de texto não encontrado');
      showToast('❌ Campo de texto não encontrado', 'error');
      return;
    }

    // Foca no campo
    inputField.focus();

    if (!focusOnly) {
      // Insere o texto
      inputField.innerHTML = '';
      
      // Método 1: execCommand (funciona na maioria dos casos)
      document.execCommand('insertText', false, text);

      // Se não funcionou, tenta método alternativo
      if (!inputField.textContent || inputField.textContent.length === 0) {
        // v7.5.0: Usar digitação humana
    if (window.HumanTyping && typeof window.HumanTyping.type === 'function') {
      inputField.innerHTML = '';
      // Usar promise sem await (função não é async)
      window.HumanTyping.type(inputField, text, { minDelay: 20, maxDelay: 50 })
        .catch(e => console.error('[SuggestionInjector] Erro ao digitar:', e));
    } else {
      inputField.textContent = text;
    }
        inputField.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }

      // Move cursor para o final
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputField);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Dispara evento de input para WhatsApp detectar
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ============================================================
  // CONTROLE DO PAINEL
  // ============================================================

  function showPanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    
    if (panel) {
      panel.classList.add('visible');
      state.isVisible = true;
    }
    // Keep FAB visible - don't hide it
  }

  function hidePanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    
    if (panel) {
      panel.classList.remove('visible');
      state.isVisible = false;
    }
    // Keep FAB visible always
  }

  function togglePanel() {
    if (state.isVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function resetAutoHide() {
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
    }
    // Se AUTO_HIDE_DELAY = 0, não esconde automaticamente
    if (CONFIG.AUTO_HIDE_DELAY > 0) {
      state.hideTimeout = setTimeout(() => {
        hidePanel();
      }, CONFIG.AUTO_HIDE_DELAY);
    }
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'success') {
    // Remove toast existente
    const existing = document.querySelector('.whl-sug-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'whl-sug-toast';
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    document.body.appendChild(toast);

    // Anima entrada
    setTimeout(() => toast.classList.add('visible'), 10);

    // Remove após 3 segundos
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showLoading() {
    const body = document.getElementById('whl-sug-body');
    if (body) {
      body.innerHTML = `
        <div class="whl-sug-loading">
          <div class="whl-sug-spinner"></div>
          <span>Gerando sugestões...</span>
        </div>
      `;
    }
    showPanel();
  }

  // ============================================================
  // INTEGRAÇÃO COM EVENTOS
  // ============================================================

  function setupEventListeners() {
    // Escuta eventos de sugestões do CopilotEngine
    if (window.EventBus) {
      window.EventBus.on('copilot:suggestions', (data) => {
        console.log('[SuggestionInjector] 📩 Sugestões recebidas via EventBus');
        showSuggestions(data.suggestions, data.chatId);
      });

      window.EventBus.on('copilot:loading', () => {
        showLoading();
      });

      window.EventBus.on('chat:changed', () => {
        // Limpa sugestões ao trocar de chat
        state.currentSuggestions = [];
        hidePanel();
      });
    }

    // Escuta eventos customizados
    window.addEventListener('whl:suggestions', (e) => {
      console.log('[SuggestionInjector] 📩 Sugestões recebidas via CustomEvent');
      showSuggestions(e.detail.suggestions, e.detail.chatId);
    });

    // Atalho de teclado (Ctrl+Shift+S)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        togglePanel();
      }
    });
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  function init() {
    if (state.initialized) return;

    console.log('[SuggestionInjector] 💡 Inicializando...');

    injectStyles();
    createPanel();
    setupEventListeners();

    state.initialized = true;
    console.log('[SuggestionInjector] ✅ Inicializado');
  }

  // Aguarda DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

  // ============================================================
  // EXPORTAÇÃO GLOBAL
  // ============================================================

  window.SuggestionInjector = {
    show: showSuggestions,
    hide: hidePanel,
    toggle: togglePanel,
    showPanel: showPanel,
    showLoading,
    isVisible: () => state.isVisible,
    getSuggestions: () => state.currentSuggestions
  };

})();
