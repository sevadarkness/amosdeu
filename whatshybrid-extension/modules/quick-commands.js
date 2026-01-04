/**
 * ⚡ Quick Commands - Sistema de Comandos Rápidos com /gatilho
 *
 * Permite usar respostas rápidas digitando / seguido do gatilho no chat.
 *
 * Exemplos:
 * /oi → "Olá! Como posso ajudar você hoje?"
 * /aguarde → "Um momento, por favor. Estou verificando..."
 * /pix → "Chave PIX: [SUA CHAVE]. Após o pagamento, envie o comprovante."
 *
 * Features:
 * - Autocompletar ao digitar /
 * - Dropdown de sugestões
 * - Integração com SmartRepliesModule
 * - Comandos customizáveis
 * - Categorias de comandos
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_quick_commands_v1';

  // Comandos padrão (integrados com SmartReplies)
  const DEFAULT_COMMANDS = [
    { trigger: 'oi', text: 'Olá! Como posso ajudar você hoje?', category: 'Saudações', emoji: '👋' },
    { trigger: 'obrigado', text: 'Obrigado pelo contato! Estou à disposição.', category: 'Saudações', emoji: '🙏' },
    { trigger: 'aguarde', text: 'Um momento, por favor. Estou verificando...', category: 'Aguardo', emoji: '⏳' },
    { trigger: 'verificando', text: 'Vou verificar essa informação e já retorno.', category: 'Aguardo', emoji: '🔍' },
    { trigger: 'confirmar', text: 'Perfeito! Confirmado. Mais alguma dúvida?', category: 'Confirmação', emoji: '✅' },
    { trigger: 'preco', text: 'O valor é R$ [VALOR]. Posso ajudar com mais alguma informação?', category: 'Vendas', emoji: '💰' },
    { trigger: 'pix', text: 'Chave PIX: [SUA CHAVE]. Após o pagamento, envie o comprovante.', category: 'Vendas', emoji: '💳' },
    { trigger: 'tchau', text: 'Foi um prazer atendê-lo! Tenha um ótimo dia! 😊', category: 'Encerramento', emoji: '👋' },
    { trigger: 'ausente', text: 'No momento não estou disponível. Retornarei assim que possível.', category: 'Ausência', emoji: '🔕' },
    { trigger: 'horario', text: 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.', category: 'Informações', emoji: '🕐' },
    { trigger: 'entrega', text: 'O prazo de entrega é de 5 a 7 dias úteis após a confirmação do pagamento.', category: 'Informações', emoji: '📦' }
  ];

  let state = {
    commands: [...DEFAULT_COMMANDS],
    isActive: false,
    currentMatches: [],
    selectedIndex: 0,
    initialized: false
  };

  let dropdown = null;
  let inputField = null;

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  async function init() {
    if (state.initialized) return;

    console.log('[QuickCommands] ⚡ Inicializando...');

    await loadCommands();
    setupInputMonitoring();

    state.initialized = true;
    console.log('[QuickCommands] ✅ Inicializado com', state.commands.length, 'comandos');
  }

  // ============================================================
  // PERSISTÊNCIA
  // ============================================================

  async function loadCommands() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        state.commands = result[STORAGE_KEY];
      }

      // Sincronizar com SmartRepliesModule se disponível
      if (window.SmartRepliesModule?.getQuickReplies) {
        const quickReplies = window.SmartRepliesModule.getQuickReplies();
        // Adicionar quick replies que não existem ainda
        quickReplies.forEach(qr => {
          const trigger = qr.text.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const exists = state.commands.some(cmd => cmd.trigger === trigger);
          if (!exists && trigger.length > 2) {
            state.commands.push({
              trigger,
              text: qr.text,
              category: qr.category || 'Geral',
              emoji: qr.emoji || '📝'
            });
          }
        });
      }
    } catch (e) {
      console.error('[QuickCommands] Erro ao carregar comandos:', e);
    }
  }

  async function saveCommands() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: state.commands });
    } catch (e) {
      console.error('[QuickCommands] Erro ao salvar comandos:', e);
    }
  }

  // ============================================================
  // MONITORAMENTO DO INPUT
  // ============================================================

  function setupInputMonitoring() {
    // Procurar o campo de input do WhatsApp
    const findInput = setInterval(() => {
      inputField = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                   document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                   document.querySelector('footer div[contenteditable="true"]');

      if (inputField) {
        console.log('[QuickCommands] Campo de input encontrado');
        clearInterval(findInput);
        attachInputListeners();
      }
    }, 1000);

    // Parar depois de 30 segundos
    setTimeout(() => clearInterval(findInput), 30000);
  }

  function attachInputListeners() {
    if (!inputField) return;

    // Monitorar digitação
    inputField.addEventListener('input', handleInput);
    inputField.addEventListener('keydown', handleKeyDown);

    // Observar mudanças no DOM (troca de chat)
    const observer = new MutationObserver(() => {
      const newInput = document.querySelector('[data-testid="conversation-compose-box-input"]');
      if (newInput && newInput !== inputField) {
        inputField.removeEventListener('input', handleInput);
        inputField.removeEventListener('keydown', handleKeyDown);
        inputField = newInput;
        attachInputListeners();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function handleInput(e) {
    const text = inputField.textContent || '';

    // Detectar se começou com /
    if (text.startsWith('/')) {
      const query = text.slice(1).toLowerCase();
      showSuggestions(query);
    } else if (state.isActive) {
      hideSuggestions();
    }
  }

  function handleKeyDown(e) {
    if (!state.isActive) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectPrevious();
        break;

      case 'Enter':
        if (state.currentMatches.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          insertCommand(state.currentMatches[state.selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        hideSuggestions();
        break;

      case 'Tab':
        if (state.currentMatches.length > 0) {
          e.preventDefault();
          insertCommand(state.currentMatches[state.selectedIndex]);
        }
        break;
    }
  }

  // ============================================================
  // DROPDOWN DE SUGESTÕES
  // ============================================================

  function showSuggestions(query) {
    // Buscar comandos que correspondem
    state.currentMatches = state.commands.filter(cmd =>
      cmd.trigger.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);

    if (state.currentMatches.length === 0) {
      hideSuggestions();
      return;
    }

    state.isActive = true;
    state.selectedIndex = 0;

    renderDropdown();
  }

  function renderDropdown() {
    // Remover dropdown existente
    if (dropdown) {
      dropdown.remove();
    }

    // Criar dropdown
    dropdown = document.createElement('div');
    dropdown.id = 'whl-quick-commands-dropdown';
    dropdown.className = 'whl-qc-dropdown';

    dropdown.innerHTML = state.currentMatches.map((cmd, index) => `
      <div class="whl-qc-item ${index === state.selectedIndex ? 'selected' : ''}" data-index="${index}">
        <span class="whl-qc-emoji">${cmd.emoji}</span>
        <div class="whl-qc-content">
          <div class="whl-qc-trigger">/${cmd.trigger}</div>
          <div class="whl-qc-preview">${cmd.text.slice(0, 60)}${cmd.text.length > 60 ? '...' : ''}</div>
        </div>
        <span class="whl-qc-category">${cmd.category}</span>
      </div>
    `).join('');

    // Event listeners
    dropdown.querySelectorAll('.whl-qc-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        insertCommand(state.currentMatches[index]);
      });

      item.addEventListener('mouseenter', () => {
        state.selectedIndex = index;
        updateSelection();
      });
    });

    // Posicionar acima do input
    const inputRect = inputField.getBoundingClientRect();
    dropdown.style.cssText = `
      position: fixed;
      bottom: ${window.innerHeight - inputRect.top + 10}px;
      left: ${inputRect.left}px;
      width: ${Math.min(500, inputRect.width)}px;
      max-height: 400px;
      z-index: 99999;
    `;

    // Adicionar estilos se não existirem
    if (!document.getElementById('whl-qc-styles')) {
      const styles = document.createElement('style');
      styles.id = 'whl-qc-styles';
      styles.textContent = `
        .whl-qc-dropdown {
          background: rgba(26, 26, 46, 0.98);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          overflow-y: auto;
          backdrop-filter: blur(20px);
        }

        .whl-qc-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: all 0.2s;
        }

        .whl-qc-item:last-child {
          border-bottom: none;
        }

        .whl-qc-item:hover,
        .whl-qc-item.selected {
          background: rgba(139, 92, 246, 0.2);
        }

        .whl-qc-emoji {
          font-size: 24px;
        }

        .whl-qc-content {
          flex: 1;
        }

        .whl-qc-trigger {
          color: #8b5cf6;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .whl-qc-preview {
          color: rgba(255,255,255,0.7);
          font-size: 12px;
        }

        .whl-qc-category {
          color: rgba(255,255,255,0.5);
          font-size: 11px;
          background: rgba(255,255,255,0.1);
          padding: 4px 8px;
          border-radius: 4px;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(dropdown);
  }

  function updateSelection() {
    if (!dropdown) return;

    dropdown.querySelectorAll('.whl-qc-item').forEach((item, index) => {
      if (index === state.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function selectNext() {
    if (state.selectedIndex < state.currentMatches.length - 1) {
      state.selectedIndex++;
      updateSelection();
    }
  }

  function selectPrevious() {
    if (state.selectedIndex > 0) {
      state.selectedIndex--;
      updateSelection();
    }
  }

  function hideSuggestions() {
    state.isActive = false;
    state.currentMatches = [];
    state.selectedIndex = 0;

    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }
  }

  // ============================================================
  // INSERÇÃO DE COMANDO
  // ============================================================

  async function insertCommand(command) {
    if (!inputField || !command) return;

    console.log('[QuickCommands] Inserindo comando:', command.trigger);

    // Limpar campo
    inputField.textContent = '';
    inputField.innerHTML = '';

    // Aguardar um momento
    await new Promise(r => setTimeout(r, 50));

    // Inserir texto
    inputField.focus();
    document.execCommand('insertText', false, command.text);

    // Disparar evento
    inputField.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Fechar dropdown
    hideSuggestions();

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('quick_command:used', {
        trigger: command.trigger,
        category: command.category
      });
    }

    // Adicionar ponto no Trust System se disponível
    if (window.TrustSystem) {
      window.TrustSystem.addPoints('USE_SUGGESTION');
    }

    // Notificar
    if (window.NotificationsModule) {
      window.NotificationsModule.toast(
        `⚡ Comando /${command.trigger} inserido`,
        'success',
        1500
      );
    }
  }

  // ============================================================
  // GERENCIAMENTO DE COMANDOS
  // ============================================================

  function addCommand(trigger, text, category = 'Geral', emoji = '📝') {
    const exists = state.commands.some(cmd => cmd.trigger === trigger);
    if (exists) {
      console.warn('[QuickCommands] Comando já existe:', trigger);
      return false;
    }

    state.commands.push({
      trigger: trigger.toLowerCase().replace(/[^a-z0-9]/g, ''),
      text,
      category,
      emoji
    });

    saveCommands();
    console.log('[QuickCommands] Comando adicionado:', trigger);
    return true;
  }

  function removeCommand(trigger) {
    const index = state.commands.findIndex(cmd => cmd.trigger === trigger);
    if (index === -1) return false;

    state.commands.splice(index, 1);
    saveCommands();
    console.log('[QuickCommands] Comando removido:', trigger);
    return true;
  }

  function updateCommand(trigger, updates) {
    const cmd = state.commands.find(c => c.trigger === trigger);
    if (!cmd) return false;

    Object.assign(cmd, updates);
    saveCommands();
    console.log('[QuickCommands] Comando atualizado:', trigger);
    return true;
  }

  function getCommands() {
    return [...state.commands];
  }

  function getCommandsByCategory(category) {
    return state.commands.filter(cmd => cmd.category === category);
  }

  // ============================================================
  // UI - GERENCIAMENTO
  // ============================================================

  function renderCommandsManager(container) {
    const categories = [...new Set(state.commands.map(cmd => cmd.category))];

    container.innerHTML = `
      <div class="qc-manager">
        <div class="qc-header">
          <h3>⚡ Comandos Rápidos</h3>
          <button id="qc-add-btn" class="mod-btn mod-btn-primary">➕ Novo Comando</button>
        </div>

        <div class="qc-info">
          Digite <strong>/</strong> seguido do gatilho no chat para usar.
        </div>

        <div class="qc-filters">
          <button class="qc-filter-btn active" data-category="all">Todos (${state.commands.length})</button>
          ${categories.map(cat => `
            <button class="qc-filter-btn" data-category="${cat}">
              ${cat} (${getCommandsByCategory(cat).length})
            </button>
          `).join('')}
        </div>

        <div class="qc-list" id="qc-commands-list">
          ${renderCommandsList('all')}
        </div>
      </div>
    `;

    // Event listeners
    container.querySelectorAll('.qc-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.qc-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const list = container.querySelector('#qc-commands-list');
        list.innerHTML = renderCommandsList(btn.dataset.category);
      });
    });

    container.querySelector('#qc-add-btn')?.addEventListener('click', () => {
      showAddCommandDialog(container);
    });
  }

  function renderCommandsList(category) {
    const commands = category === 'all'
      ? state.commands
      : getCommandsByCategory(category);

    if (commands.length === 0) {
      return '<div class="qc-empty">Nenhum comando nesta categoria.</div>';
    }

    return commands.map(cmd => `
      <div class="qc-command-item">
        <span class="qc-command-emoji">${cmd.emoji}</span>
        <div class="qc-command-info">
          <div class="qc-command-trigger">/${cmd.trigger}</div>
          <div class="qc-command-text">${cmd.text}</div>
          <span class="qc-command-category">${cmd.category}</span>
        </div>
        <div class="qc-command-actions">
          <button class="qc-action-btn" data-action="copy" data-trigger="${cmd.trigger}">📋</button>
          <button class="qc-action-btn" data-action="delete" data-trigger="${cmd.trigger}">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function showAddCommandDialog(container) {
    // Implementar dialog para adicionar comando
    const dialog = document.createElement('div');
    dialog.className = 'qc-dialog-overlay';
    dialog.innerHTML = `
      <div class="qc-dialog">
        <h3>Novo Comando Rápido</h3>
        <input type="text" id="qc-new-trigger" placeholder="Gatilho (ex: oi, pix)" class="mod-input">
        <textarea id="qc-new-text" placeholder="Texto do comando..." class="mod-input" rows="3"></textarea>
        <input type="text" id="qc-new-category" placeholder="Categoria" class="mod-input">
        <input type="text" id="qc-new-emoji" placeholder="Emoji" class="mod-input" maxlength="2">
        <div class="qc-dialog-actions">
          <button id="qc-cancel-btn" class="mod-btn">Cancelar</button>
          <button id="qc-save-btn" class="mod-btn mod-btn-primary">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#qc-cancel-btn').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#qc-save-btn').addEventListener('click', () => {
      const trigger = dialog.querySelector('#qc-new-trigger').value.trim();
      const text = dialog.querySelector('#qc-new-text').value.trim();
      const category = dialog.querySelector('#qc-new-category').value.trim() || 'Geral';
      const emoji = dialog.querySelector('#qc-new-emoji').value.trim() || '📝';

      if (trigger && text) {
        if (addCommand(trigger, text, category, emoji)) {
          renderCommandsManager(container);
          if (window.NotificationsModule) {
            window.NotificationsModule.success('Comando adicionado!');
          }
        }
      }
      dialog.remove();
    });
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================

  window.QuickCommands = {
    init,
    addCommand,
    removeCommand,
    updateCommand,
    getCommands,
    getCommandsByCategory,
    renderCommandsManager,
    DEFAULT_COMMANDS
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

})();
