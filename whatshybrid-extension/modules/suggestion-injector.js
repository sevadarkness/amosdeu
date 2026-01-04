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
      <div class="wh-suggestion-wrapper" data-index="${i}" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div class="wh-suggestion-item" style="
          padding: 12px 16px 8px 16px;
          cursor: pointer;
          color: #e9edef;
          font-size: 14px;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(0,168,132,0.15)'" onmouseout="this.style.background='transparent'">
          ${sug.text || sug}
        </div>
        <div class="wh-suggestion-feedback" style="
          display: flex;
          gap: 8px;
          padding: 4px 16px 8px 16px;
          justify-content: flex-end;
        ">
          <button class="wh-feedback-btn wh-feedback-good" data-index="${i}" style="
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            padding: 4px 8px;
            opacity: 0.6;
            transition: opacity 0.2s;
          " title="Boa sugestão">👍</button>
          <button class="wh-feedback-btn wh-feedback-bad" data-index="${i}" style="
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            padding: 4px 8px;
            opacity: 0.6;
            transition: opacity 0.2s;
          " title="Sugestão ruim">👎</button>
          <button class="wh-feedback-btn wh-feedback-edit" data-index="${i}" style="
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            padding: 4px 8px;
            opacity: 0.6;
            transition: opacity 0.2s;
          " title="Corrigir sugestão">✏️</button>
        </div>
      </div>
    `).join('');
    
    container.style.display = 'block';
    
    // Click handler para inserir sugestão
    list.querySelectorAll('.wh-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', async () => {
        const wrapper = item.closest('.wh-suggestion-wrapper');
        const text = item.textContent.trim();
        await insertSuggestionWithTyping(text);
        container.style.display = 'none';
        
        // Registra uso de sugestão
        if (window.confidenceSystem) {
          window.confidenceSystem.recordSuggestionUsage(false, { text, index });
        }
        if (window.trainingStats) {
          window.trainingStats.incrementSuggestionsUsed();
        }
      });
    });
    
    // Feedback buttons handlers
    list.querySelectorAll('.wh-feedback-good').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const suggestion = suggestions[index];
        
        console.log('[SuggestionInjector] Feedback positivo:', suggestion);
        
        // Registra feedback positivo
        if (window.confidenceSystem) {
          await window.confidenceSystem.sendConfidenceFeedback('good', { suggestion, index });
        }
        if (window.trainingStats) {
          await window.trainingStats.incrementGood();
        }
        
        // Feedback visual
        btn.style.opacity = '1';
        btn.style.color = '#00a884';
        setTimeout(() => {
          btn.style.opacity = '0.6';
          btn.style.color = '';
        }, 2000);
      });
    });
    
    list.querySelectorAll('.wh-feedback-bad').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const suggestion = suggestions[index];
        
        console.log('[SuggestionInjector] Feedback negativo:', suggestion);
        
        // Registra feedback negativo
        if (window.confidenceSystem) {
          await window.confidenceSystem.sendConfidenceFeedback('bad', { suggestion, index });
        }
        if (window.trainingStats) {
          await window.trainingStats.incrementBad();
        }
        
        // Feedback visual
        btn.style.opacity = '1';
        btn.style.color = '#f44336';
        setTimeout(() => {
          btn.style.opacity = '0.6';
          btn.style.color = '';
        }, 2000);
      });
    });
    
    list.querySelectorAll('.wh-feedback-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const suggestion = suggestions[index];
        const sugText = typeof suggestion === 'string' ? suggestion : suggestion.text;
        
        // Insere sugestão no campo para edição
        await insertSuggestionWithTyping(sugText);
        
        // Registra como editada
        if (window.confidenceSystem) {
          await window.confidenceSystem.recordSuggestionUsage(true, { suggestion, index });
        }
        
        // Feedback visual
        btn.style.opacity = '1';
        btn.style.color = '#ffa726';
        
        // Prompt para corrigir
        const corrected = prompt('Corrija a sugestão:', sugText);
        if (corrected && corrected !== sugText) {
          // Salva como exemplo de correção
          if (window.fewShotLearning) {
            await window.fewShotLearning.addExample({
              input: 'Contexto da correção',
              output: corrected,
              context: `Original: ${sugText}`,
              category: 'Correções'
            });
          }
          
          if (window.confidenceSystem) {
            await window.confidenceSystem.sendConfidenceFeedback('correction', { 
              original: sugText, 
              corrected, 
              index 
            });
          }
          if (window.trainingStats) {
            await window.trainingStats.incrementCorrected();
          }
          
          // Atualiza campo com versão corrigida
          await insertSuggestionWithTyping(corrected);
        }
        
        container.style.display = 'none';
      });
    });
  }

  async function insertSuggestionWithTyping(text) {
    const input = document.querySelector('footer div[contenteditable="true"]') ||
                  document.querySelector('[data-testid="conversation-compose-box-input"]');
    if (!input) return;
    
    // CORREÇÃO CRÍTICA: Limpar campo COMPLETAMENTE antes de inserir
    input.textContent = '';
    input.innerHTML = '';
    input.focus();
    
    // Aguardar um momento para garantir que o campo foi limpo
    await new Promise(r => setTimeout(r, 50));
    
    // Inserir texto UMA ÚNICA VEZ usando apenas execCommand
    document.execCommand('insertText', false, text);
    
    // Dispara evento de input UMA ÚNICA VEZ
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }


  const CONFIG = {
    PANEL_ID: 'whl-suggestions-panel',
    MAX_SUGGESTIONS: 1, // Show only ONE best suggestion
    MAX_CONTEXT_MESSAGES: 10, // Maximum number of messages to extract from DOM for context
    FOCUS_DELAY_MS: 100, // Delay to ensure input field focus is established
    DOM_CLEANUP_DELAY_MS: 100, // Delay to allow browser to complete DOM reflow after clearing
    // v7.5.0: AUTO_HIDE_DELAY removed - no auto-hide behavior
    ANIMATION_DURATION: 300,
    // FAB positioning - positioned above WhatsApp input field to avoid overlapping send button
    // WhatsApp's input field is approximately 50px height, send button is ~60px from right edge
    FAB_BOTTOM: '60px',  // 10px clearance above input field
    FAB_RIGHT: '80px'    // 20px clearance from send button
  };

  const state = {
    isVisible: false,
    currentSuggestions: [],
    currentChatId: null,
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

      /* Botão flutuante - 🤖 Robot Button v7.5.0 */
      #whl-suggestion-fab {
        position: absolute;
        bottom: ${CONFIG.FAB_BOTTOM};  /* Above input field */
        right: ${CONFIG.FAB_RIGHT};    /* Left of send button */
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8B5CF6, #3B82F6);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        z-index: 1000;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      /* Fallback for when button is on body instead of footer */
      body > #whl-suggestion-fab {
        position: fixed;
      }

      #whl-suggestion-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(139, 92, 246, 0.5);
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

    // Botão flutuante 🤖 v7.5.0 - Positioned above input field
    const fab = document.createElement('button');
    fab.id = 'whl-suggestion-fab';
    fab.innerHTML = '🤖';
    fab.title = 'Abrir/Fechar Sugestões de IA (Toggle)';
    
    // Find the footer to attach the button relative to it
    const footer = document.querySelector('#main footer') || document.querySelector('footer');
    if (footer) {
      // Only set position if it's currently static (defensive approach)
      const currentPosition = window.getComputedStyle(footer).position;
      if (currentPosition === 'static') {
        footer.style.position = 'relative';
      }
      footer.appendChild(fab);
    } else {
      // Fallback: append to body with fixed positioning
      document.body.appendChild(fab);
    }

    // Event listeners - v7.5.0: Toggle behavior, no auto-close
    document.getElementById('whl-sug-close').addEventListener('click', hidePanel);
    fab.addEventListener('click', togglePanel);

    console.log('[SuggestionInjector] 💡 Painel criado com botão 🤖');
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

    if (!body) return;

    // Atualiza contador
    if (count) count.textContent = suggestions.length;

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

    // v7.5.0: NO auto-hide - user closes manually via X or toggle button
    // resetAutoHide(); // REMOVED

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
      '#main footer div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]'
    ];

    let inputField = null;
    for (const sel of selectors) {
      inputField = document.querySelector(sel);
      if (inputField) {
        console.log('[SuggestionInjector] Campo encontrado:', sel);
        break;
      }
    }

    if (!inputField) {
      console.error('[SuggestionInjector] Campo de texto não encontrado');
      showToast('❌ Campo de texto não encontrado', 'error');
      return false;
    }

    // Foca no campo
    inputField.focus();
    // Wait for focus to be established
    await new Promise(r => setTimeout(r, CONFIG.FOCUS_DELAY_MS));

    if (!focusOnly && text) {
      // CORREÇÃO: Limpar campo COMPLETAMENTE
      inputField.textContent = '';
      inputField.innerHTML = '';
      
      // Aguardar limpeza do DOM
      await new Promise(r => setTimeout(r, CONFIG.DOM_CLEANUP_DELAY_MS));
      
      // Focar novamente após limpeza
      inputField.focus();
      
      // MÉTODO 1: execCommand (deprecated but widely supported, with fallback)
      // Note: execCommand is deprecated but still widely supported. Direct insertion is fallback.
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, text);
        console.log('[SuggestionInjector] execCommand result:', inserted);
      } catch (e) {
        console.warn('[SuggestionInjector] execCommand falhou:', e);
      }
      
      // MÉTODO 2: Fallback - inserção direta (only if execCommand failed completely)
      if (!inserted || !inputField.textContent || inputField.textContent.trim() === '') {
        console.log('[SuggestionInjector] Usando fallback de inserção direta');
        inputField.textContent = text;
      }
      
      // Dispara eventos para WhatsApp detectar
      inputField.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: true,
        inputType: 'insertText',
        data: text 
      }));
      
      // Evento adicional para garantir
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor para o final
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputField);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        console.warn('[SuggestionInjector] Erro ao mover cursor:', e);
      }
      
      console.log('[SuggestionInjector] Texto inserido:', text.length, 'caracteres');
      return true;
    }
    
    return true;
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
    // v7.5.0: FAB always visible, doesn't hide
  }

  function hidePanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    
    if (panel) {
      panel.classList.remove('visible');
      state.isVisible = false;
    }
    // v7.5.0: FAB always visible
  }

  function togglePanel() {
    if (state.isVisible) {
      hidePanel();
    } else {
      showPanel();
      // Generate suggestion immediately when opening
      requestSuggestionGeneration();
    }
  }

  // Extract messages from WhatsApp Web DOM
  function extractMessagesFromDOM() {
    const messages = [];
    try {
      // Seletores para mensagens do WhatsApp Web
      const messageSelectors = [
        '[data-testid="msg-container"]',
        '.message-in, .message-out',
        '[data-id][class*="message"]'
      ];
      
      let msgElements = null;
      for (const sel of messageSelectors) {
        msgElements = document.querySelectorAll(sel);
        if (msgElements && msgElements.length > 0) break;
      }
      
      if (!msgElements || msgElements.length === 0) {
        console.warn('[SuggestionInjector] Nenhuma mensagem encontrada no DOM');
        return messages;
      }
      
      // Pegar as últimas N mensagens configuradas
      const lastMessages = Array.from(msgElements).slice(-CONFIG.MAX_CONTEXT_MESSAGES);
      
      for (const el of lastMessages) {
        // Detectar se é mensagem recebida ou enviada
        const isOutgoing = el.classList.contains('message-out') || 
                           el.closest('[data-testid="msg-container"]')?.querySelector('[data-icon="tail-out"]') ||
                           el.getAttribute('data-id')?.includes('true');
        
        // Extrair texto
        const textEl = el.querySelector('[data-testid="msg-text"], .copyable-text span, .selectable-text span');
        const text = textEl?.textContent?.trim() || '';
        
        if (text) {
          messages.push({
            role: isOutgoing ? 'assistant' : 'user',
            content: text
          });
        }
      }
      
      console.log('[SuggestionInjector] Extraídas', messages.length, 'mensagens do DOM');
    } catch (e) {
      console.error('[SuggestionInjector] Erro ao extrair mensagens:', e);
    }
    
    return messages;
  }

  // Request suggestion generation from AI
  async function requestSuggestionGeneration() {
    const chatId = state.currentChatId || getCurrentChatId();
    
    // Mostrar loading
    const body = document.getElementById('whl-sug-body');
    if (body) {
      body.innerHTML = `
        <div class="whl-sug-loading">
          <div class="whl-sug-spinner"></div>
          <span>Analisando conversa...</span>
        </div>
      `;
    }
    
    try {
      // CRÍTICO: Extrair mensagens REAIS do chat
      const domMessages = extractMessagesFromDOM();
      console.log('[SuggestionInjector] Mensagens extraídas:', domMessages.length);
      
      // MÉTODO 1: SmartRepliesModule com contexto real
      if (window.SmartRepliesModule?.isConfigured?.()) {
        console.log('[SuggestionInjector] Gerando via SmartRepliesModule...');
        
        // Passar as mensagens extraídas do DOM
        const contextMessages = domMessages.length > 0 ? domMessages : [];
        const suggestions = await window.SmartRepliesModule.generateSuggestions(chatId, contextMessages);
        
        if (suggestions?.length > 0) {
          showSuggestions(suggestions, chatId);
          return;
        }
      }
      
      // MÉTODO 2: AIService direto com contexto do DOM
      if (window.AIService?.isProviderConfigured?.()) {
        console.log('[SuggestionInjector] Gerando via AIService...');
        
        // Formatar contexto
        const contextText = domMessages.length > 0 
          ? domMessages.map(m => `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`).join('\n')
          : 'Nova conversa - cliente acabou de enviar primeira mensagem.';
        
        // Find last user message more efficiently
        let lastUserMessage = 'Mensagem não detectada';
        for (let i = domMessages.length - 1; i >= 0; i--) {
          if (domMessages[i].role === 'user') {
            lastUserMessage = domMessages[i].content;
            break;
          }
        }
        
        const prompt = `Baseado na conversa abaixo, gere UMA sugestão de resposta profissional e contextualizada.

CONVERSA:
${contextText}

ÚLTIMA MENSAGEM DO CLIENTE: ${lastUserMessage}

INSTRUÇÕES:
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
          showSuggestions([{ text: result.content, type: 'ai' }], chatId);
          return;
        }
      }
      
      // Nenhum método disponível
      showConfigurationNeeded();
      
    } catch (error) {
      console.error('[SuggestionInjector] Erro:', error);
      showErrorSuggestion(error.message);
    }
  }

  // Nova função auxiliar para obter contexto
  async function getConversationContext(chatId) {
    try {
      // PRIORIDADE 1: Extrair mensagens DIRETAMENTE do DOM (mais confiável)
      const domMessages = extractMessagesFromDOM();
      if (domMessages.length > 0) {
        console.log('[SuggestionInjector] Usando contexto do DOM');
        return domMessages.slice(-5).map(m => `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`).join('\n');
      }
      
      // PRIORIDADE 2: Tentar Store do WhatsApp
      if (window.Store?.Msg?.getModelsArray) {
        const msgs = window.Store.Msg.getModelsArray().slice(-CONFIG.MAX_CONTEXT_MESSAGES);
        if (msgs.length > 0) {
          return msgs.map(m => `${m.fromMe ? 'Você' : 'Cliente'}: ${m.body || ''}`).join('\n');
        }
      }
      
      // PRIORIDADE 3: CopilotEngine
      if (window.CopilotEngine?.getContext) {
        const ctx = window.CopilotEngine.getContext(chatId);
        if (ctx?.messages?.length > 0) {
          return ctx.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
        }
      }
      
      // PRIORIDADE 4: SmartRepliesModule history
      if (window.SmartRepliesModule?.getHistory) {
        const history = window.SmartRepliesModule.getHistory(chatId);
        if (history?.length > 0) {
          return history.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
        }
      }
      
      return 'Sem contexto disponível. Gere uma saudação profissional.';
    } catch (e) {
      console.error('[SuggestionInjector] Erro ao obter contexto:', e);
      return 'Sem contexto disponível. Gere uma saudação profissional.';
    }
  }

  // Nova função para mostrar que precisa configurar
  function showConfigurationNeeded() {
    const body = document.getElementById('whl-sug-body');
    if (!body) return;
    
    body.innerHTML = `
      <div style="padding: 16px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">⚙️</div>
        <div style="color: #fbbf24; font-weight: 500; margin-bottom: 8px;">Configure a IA</div>
        <div style="color: rgba(255,255,255,0.6); font-size: 12px; margin-bottom: 12px;">
          Abra o painel lateral e configure o provider de IA nas Configurações.
        </div>
      </div>
    `;
  }

  // Nova função para mostrar erro
  function showErrorSuggestion(errorMessage) {
    const body = document.getElementById('whl-sug-body');
    if (!body) return;
    
    body.innerHTML = `
      <div style="padding: 16px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
        <div style="color: #ef4444; font-weight: 500; margin-bottom: 4px;">Erro ao gerar</div>
        <div style="color: rgba(255,255,255,0.5); font-size: 11px;">${errorMessage || 'Tente novamente'}</div>
      </div>
    `;
  }

  function getCurrentChatId() {
    // Try to get current chat ID from WhatsApp
    try {
      if (window.Store?.Chat?.getActive) {
        return window.Store.Chat.getActive()?.id?._serialized;
      }
    } catch (e) {}
    return null;
  }

  function showEmptySuggestion() {
    const body = document.getElementById('whl-sug-body');
    if (body) {
      body.innerHTML = '<div class="whl-sug-empty">Configure a IA no painel de configurações para ver sugestões.</div>';
    }
  }

  // v7.5.0: resetAutoHide() removed - no auto-hide behavior

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
