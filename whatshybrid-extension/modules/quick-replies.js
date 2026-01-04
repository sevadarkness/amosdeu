/**
 * Quick Replies System v1.0.0
 * Respostas rápidas com atalhos /trigger
 */

class QuickRepliesSystem {
  constructor() {
    this.STORAGE_KEY = 'whl_quick_replies';
    this.replies = [];
    this.suggestionBox = null;
    this.init();
  }

  async init() {
    await this.loadReplies();
    this.setupComposerWatcher();
    console.log('[QuickReplies] ✅ Inicializado com', this.replies.length, 'respostas');
  }

  // CRUD de respostas
  async loadReplies() {
    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    this.replies = data[this.STORAGE_KEY] || [];
  }

  async saveReplies() {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: this.replies });
  }

  async addReply(trigger, response) {
    const cleanTrigger = trigger.toLowerCase().replace(/^\//, '');
    
    // Verifica duplicata
    if (this.replies.some(r => r.trigger === cleanTrigger)) {
      throw new Error('Gatilho já existe');
    }
    
    this.replies.push({
      id: `qr_${Date.now()}`,
      trigger: cleanTrigger,
      response: response,
      usageCount: 0,
      createdAt: new Date().toISOString()
    });
    
    await this.saveReplies();
    return this.replies[this.replies.length - 1];
  }

  async removeReply(id) {
    this.replies = this.replies.filter(r => r.id !== id);
    await this.saveReplies();
  }

  async updateReply(id, updates) {
    const reply = this.replies.find(r => r.id === id);
    if (reply) {
      Object.assign(reply, updates);
      await this.saveReplies();
    }
    return reply;
  }

  // Busca por trigger
  findByTrigger(trigger) {
    const clean = trigger.toLowerCase().replace(/^\//, '');
    return this.replies.find(r => r.trigger === clean);
  }

  // Busca parcial (autocomplete)
  searchTriggers(partial) {
    const clean = partial.toLowerCase().replace(/^\//, '');
    return this.replies.filter(r => r.trigger.startsWith(clean));
  }

  // Observa o composer para detectar /trigger
  setupComposerWatcher() {
    const observer = new MutationObserver(() => {
      this.checkForTrigger();
    });

    // Observar mudanças no body para detectar quando o composer aparece
    observer.observe(document.body, { childList: true, subtree: true });

    // Também verificar periodicamente
    setInterval(() => this.attachToComposer(), 2000);
  }

  attachToComposer() {
    const selectors = [
      'footer div[contenteditable="true"][role="textbox"]',
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][role="textbox"]'
    ];

    for (const sel of selectors) {
      const composer = document.querySelector(sel);
      if (composer && !composer.dataset.whlQuickReplies) {
        composer.dataset.whlQuickReplies = 'true';
        
        composer.addEventListener('input', () => this.checkForTrigger());
        composer.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        console.log('[QuickReplies] Composer anexado');
        break;
      }
    }
  }

  checkForTrigger() {
    const composer = this.getComposer();
    if (!composer) return;

    const text = composer.textContent || '';
    
    // Verifica se começa com /
    if (text.startsWith('/') && text.length > 1) {
      const partial = text.slice(1).split(' ')[0]; // Pega só a primeira palavra
      const matches = this.searchTriggers(partial);
      
      if (matches.length > 0) {
        this.showSuggestions(composer, matches);
      } else {
        this.hideSuggestions();
      }
    } else {
      this.hideSuggestions();
    }
  }

  handleKeydown(e) {
    // Tab ou Enter para aceitar sugestão
    if ((e.key === 'Tab' || e.key === 'Enter') && this.suggestionBox?.style.display !== 'none') {
      const firstSuggestion = this.suggestionBox.querySelector('.qr-suggestion-item');
      if (firstSuggestion) {
        e.preventDefault();
        firstSuggestion.click();
      }
    }
    
    // Escape para fechar
    if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  showSuggestions(composer, matches) {
    if (!this.suggestionBox) {
      this.createSuggestionBox();
    }

    const rect = composer.getBoundingClientRect();
    
    this.suggestionBox.innerHTML = matches.slice(0, 5).map(r => `
      <div class="qr-suggestion-item" data-id="${r.id}" data-response="${this.escapeHtml(r.response)}">
        <span class="qr-trigger">/${r.trigger}</span>
        <span class="qr-preview">${this.escapeHtml(r.response.slice(0, 50))}${r.response.length > 50 ? '...' : ''}</span>
      </div>
    `).join('');

    // Posicionar acima do composer
    this.suggestionBox.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    this.suggestionBox.style.left = rect.left + 'px';
    this.suggestionBox.style.width = rect.width + 'px';
    this.suggestionBox.style.display = 'block';

    // Event listeners
    this.suggestionBox.querySelectorAll('.qr-suggestion-item').forEach(item => {
      item.addEventListener('click', () => this.insertReply(item.dataset.id));
    });
  }

  hideSuggestions() {
    if (this.suggestionBox) {
      this.suggestionBox.style.display = 'none';
    }
  }

  createSuggestionBox() {
    this.suggestionBox = document.createElement('div');
    this.suggestionBox.id = 'whl-quick-replies-suggestions';
    this.suggestionBox.innerHTML = '';
    
    // Estilos inline para garantir funcionamento
    Object.assign(this.suggestionBox.style, {
      position: 'fixed',
      zIndex: '99999',
      background: '#1f2c34',
      border: '1px solid #3b4a54',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      maxHeight: '200px',
      overflowY: 'auto',
      display: 'none',
      fontFamily: 'Segoe UI, sans-serif'
    });

    // CSS para itens
    const style = document.createElement('style');
    style.textContent = `
      .qr-suggestion-item {
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-bottom: 1px solid #3b4a54;
        transition: background 0.2s;
      }
      .qr-suggestion-item:hover {
        background: #2a3942;
      }
      .qr-suggestion-item:last-child {
        border-bottom: none;
      }
      .qr-trigger {
        color: #00a884;
        font-weight: 600;
        font-size: 13px;
      }
      .qr-preview {
        color: #8696a0;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.suggestionBox);
  }

  async insertReply(id) {
    const reply = this.replies.find(r => r.id === id);
    if (!reply) return;

    const composer = this.getComposer();
    if (!composer) return;

    // Limpar composer
    composer.textContent = '';
    composer.focus();

    // Inserir resposta
    if (window.HumanTyping?.typeInWhatsApp) {
      await window.HumanTyping.typeInWhatsApp(reply.response);
    } else {
      document.execCommand('insertText', false, reply.response);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Incrementar contador de uso
    reply.usageCount = (reply.usageCount || 0) + 1;
    await this.saveReplies();

    this.hideSuggestions();
    console.log('[QuickReplies] ✅ Resposta inserida:', reply.trigger);
  }

  getComposer() {
    const selectors = [
      'footer div[contenteditable="true"][role="textbox"]',
      '[data-testid="conversation-compose-box-input"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // API pública
  getAll() { return [...this.replies]; }
  getStats() {
    return {
      total: this.replies.length,
      totalUsage: this.replies.reduce((sum, r) => sum + (r.usageCount || 0), 0),
      mostUsed: [...this.replies].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5)
    };
  }
}

// Exportar
window.QuickRepliesSystem = QuickRepliesSystem;
window.quickReplies = new QuickRepliesSystem();

console.log('[QuickReplies] ✅ Módulo carregado');
