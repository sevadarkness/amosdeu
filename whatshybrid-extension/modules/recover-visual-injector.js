/**
 * Recover Visual Injector - Injetor Visual de Indicadores de Mensagens Recover
 *
 * Injeta visualmente badges/indicadores nas mensagens do WhatsApp para mostrar:
 * - 🗑️ Mensagem DELETADA (deleted locally)
 * - 🔴 Mensagem REVOGADA (revoked by sender)
 * - ✏️ Mensagem EDITADA (edited)
 *
 * Persiste após reload da página usando messageVersions do RecoverAdvanced
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  console.log('[RecoverVisualInjector] 🎨 Inicializando...');

  // Configurações
  const CONFIG = {
    CHECK_INTERVAL: 2000, // Verificar a cada 2 segundos
    BADGE_CLASS: 'whl-recover-badge',
    INJECTED_ATTR: 'data-whl-recover-injected'
  };

  // Tipos de estados e seus estilos
  const MESSAGE_STATES = {
    DELETED_LOCAL: {
      id: 'deleted_local',
      emoji: '🗑️',
      text: 'Mensagem apagada',
      color: '#ef4444',
      bgColor: '#fee2e2'
    },
    REVOKED_GLOBAL: {
      id: 'revoked_global',
      emoji: '🔴',
      text: 'Mensagem revogada',
      color: '#dc2626',
      bgColor: '#fef2f2'
    },
    EDITED: {
      id: 'edited',
      emoji: '✏️',
      text: 'Mensagem editada',
      color: '#3b82f6',
      bgColor: '#dbeafe'
    }
  };

  // Estado
  let observer = null;
  let initialized = false;

  /**
   * Inicializa o injetor visual
   */
  function init() {
    if (initialized) return;

    console.log('[RecoverVisualInjector] 🎨 Registrando...');

    // Injetar CSS
    injectCSS();

    // Iniciar observador
    startObserver();

    // Processar mensagens existentes
    processExistingMessages();

    // Verificar periodicamente
    setInterval(processExistingMessages, CONFIG.CHECK_INTERVAL);

    initialized = true;
    console.log('[RecoverVisualInjector] ✅ Inicializado');
  }

  /**
   * Injeta CSS para os badges
   */
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'whl-recover-visual-styles';
    style.textContent = `
      .${CONFIG.BADGE_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        margin-top: 6px;
        margin-bottom: 2px;
        border: 1px solid currentColor;
        opacity: 0.9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .${CONFIG.BADGE_CLASS}-deleted {
        color: #ef4444;
        background-color: #fee2e2;
        border-color: #fca5a5;
      }

      .${CONFIG.BADGE_CLASS}-revoked {
        color: #dc2626;
        background-color: #fef2f2;
        border-color: #fca5a5;
      }

      .${CONFIG.BADGE_CLASS}-edited {
        color: #3b82f6;
        background-color: #dbeafe;
        border-color: #93c5fd;
      }

      .${CONFIG.BADGE_CLASS}:hover {
        opacity: 1;
      }
    `;

    if (!document.getElementById('whl-recover-visual-styles')) {
      document.head.appendChild(style);
      console.log('[RecoverVisualInjector] 🎨 CSS injetado');
    }
  }

  /**
   * Inicia MutationObserver para detectar novas mensagens
   */
  function startObserver() {
    // Observar mudanças no container de mensagens
    const chatContainer = document.querySelector('#main') || document.body;

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Processar novas mensagens
          setTimeout(processExistingMessages, 100);
          break;
        }
      }
    });

    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });

    console.log('[RecoverVisualInjector] 👁️ MutationObserver ativo');
  }

  /**
   * Processa todas as mensagens existentes no chat
   */
  function processExistingMessages() {
    // Seletores para mensagens do WhatsApp
    const messageSelectors = [
      '[data-testid="msg-container"]',
      '[data-id]',
      '.message-in, .message-out'
    ];

    for (const selector of messageSelectors) {
      const messages = document.querySelectorAll(selector);

      if (messages.length > 0) {
        console.log(`[RecoverVisualInjector] 🔍 Processando ${messages.length} mensagens (${selector})`);

        for (const msgEl of messages) {
          processMessage(msgEl);
        }

        break; // Usar apenas o primeiro seletor que encontrar mensagens
      }
    }
  }

  /**
   * Processa uma mensagem individual
   * @param {HTMLElement} msgEl - Elemento da mensagem
   */
  function processMessage(msgEl) {
    // Verificar se já foi processado
    if (msgEl.getAttribute(CONFIG.INJECTED_ATTR)) {
      return;
    }

    // Tentar extrair ID da mensagem
    const msgId = extractMessageId(msgEl);
    if (!msgId) {
      return;
    }

    // Verificar no RecoverAdvanced se há histórico dessa mensagem
    if (!window.RecoverAdvanced?.messageVersions) {
      return;
    }

    const messageHistory = window.RecoverAdvanced.messageVersions.get(msgId);
    if (!messageHistory || !messageHistory.history || messageHistory.history.length === 0) {
      return;
    }

    // Pegar o último evento (estado mais recente)
    const lastEvent = messageHistory.history[messageHistory.history.length - 1];
    const state = lastEvent.state;

    // Determinar qual badge mostrar
    let badgeConfig = null;
    if (state === 'deleted_local') {
      badgeConfig = MESSAGE_STATES.DELETED_LOCAL;
    } else if (state === 'revoked_global') {
      badgeConfig = MESSAGE_STATES.REVOKED_GLOBAL;
    } else if (state === 'edited') {
      badgeConfig = MESSAGE_STATES.EDITED;
    }

    if (!badgeConfig) {
      return;
    }

    // Injetar badge
    injectBadge(msgEl, badgeConfig, lastEvent);

    // Marcar como processado
    msgEl.setAttribute(CONFIG.INJECTED_ATTR, 'true');
  }

  /**
   * Extrai o ID da mensagem do elemento DOM
   * @param {HTMLElement} msgEl - Elemento da mensagem
   * @returns {string|null} ID da mensagem
   */
  function extractMessageId(msgEl) {
    // Método 1: data-id
    const dataId = msgEl.getAttribute('data-id');
    if (dataId) {
      // Extrair apenas o ID sem prefixos
      const match = dataId.match(/[A-F0-9]{16,}/);
      return match ? match[0] : dataId;
    }

    // Método 2: data-testid contém ID
    const testId = msgEl.getAttribute('data-testid');
    if (testId && testId.includes('msg-')) {
      return testId.replace('msg-', '');
    }

    // Método 3: Procurar em atributos do elemento pai
    const parent = msgEl.closest('[data-id]');
    if (parent) {
      const parentId = parent.getAttribute('data-id');
      const match = parentId.match(/[A-F0-9]{16,}/);
      return match ? match[0] : null;
    }

    return null;
  }

  /**
   * Injeta badge visual na mensagem
   * @param {HTMLElement} msgEl - Elemento da mensagem
   * @param {Object} config - Configuração do badge
   * @param {Object} event - Evento do histórico
   */
  function injectBadge(msgEl, config, event) {
    // Procurar container de texto da mensagem
    const textContainers = [
      msgEl.querySelector('[data-testid="msg-text"]'),
      msgEl.querySelector('.copyable-text'),
      msgEl.querySelector('.selectable-text'),
      msgEl.querySelector('[class*="message-text"]')
    ];

    let textContainer = null;
    for (const container of textContainers) {
      if (container) {
        textContainer = container;
        break;
      }
    }

    if (!textContainer) {
      // Se não encontrou container de texto, usar o próprio msgEl
      textContainer = msgEl;
    }

    // Criar badge
    const badge = document.createElement('div');
    badge.className = `${CONFIG.BADGE_CLASS} ${CONFIG.BADGE_CLASS}-${config.id.replace('_', '-')}`;
    badge.innerHTML = `
      <span>${config.emoji}</span>
      <span>${config.text}</span>
    `;

    // Adicionar informações extras no hover
    const previousBody = event.previousBody;
    if (previousBody && config.id === 'edited') {
      badge.title = `Conteúdo anterior: ${previousBody.substring(0, 100)}${previousBody.length > 100 ? '...' : ''}`;
    } else {
      badge.title = `${config.text} em ${new Date(event.timestamp).toLocaleString('pt-BR')}`;
    }

    // Inserir badge no início do container de texto
    if (textContainer.firstChild) {
      textContainer.insertBefore(badge, textContainer.firstChild);
    } else {
      textContainer.appendChild(badge);
    }

    console.log(`[RecoverVisualInjector] ✅ Badge injetado: ${config.emoji} ${config.text}`);
  }

  /**
   * API pública
   */
  window.RecoverVisualInjector = {
    init,
    processExistingMessages,
    MESSAGE_STATES
  };

  // Auto-inicializar quando RecoverAdvanced estiver pronto
  function tryInit() {
    if (window.RecoverAdvanced?.messageVersions) {
      init();
    } else {
      console.log('[RecoverVisualInjector] ⏳ Aguardando RecoverAdvanced...');
      setTimeout(tryInit, 1000);
    }
  }

  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    setTimeout(tryInit, 1000);
  }

})();

console.log('[RecoverVisualInjector] 📦 Módulo carregado');
