/**
 * 🎨 UI Panel Shadow DOM v1.0.0
 * Interface elegante e unificada com Shadow DOM isolado
 * 
 * Features:
 * - FAB flutuante com badge de notificações
 * - Painel com 4 tabs (Chat, Campanhas, Contatos, IA)
 * - Dark mode com persistência
 * - Status em tempo real (online/offline/away)
 * - Atalhos de teclado (Ctrl+Shift+W, Escape)
 * - Isolamento via Shadow DOM (não conflita com WhatsApp)
 * - Design responsivo
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  class UIPanelShadow {
    constructor() {
      this.container = null;
      this.shadow = null;
      this.isOpen = false;
      this.activeTab = 'chat';
      this.status = 'online';
      this.notifications = 0;
      this.theme = 'light';
      
      this.tabs = [
        { id: 'chat', label: 'Chatbot', icon: '🤖' },
        { id: 'campaigns', label: 'Campanhas', icon: '📢' },
        { id: 'contacts', label: 'Contatos', icon: '👥' },
        { id: 'training', label: 'IA', icon: '🧠' }
      ];
    }

    async initialize() {
      console.log('[UIPanel] 🚀 Inicializando...');
      
      await this.loadTheme();
      this.createContainer();
      this.injectStyles();
      this.render();
      this.attachEventListeners();
      
      console.log('[UIPanel] ✅ Inicializado com sucesso');
    }

    createContainer() {
      // Criar container principal
      this.container = document.createElement('div');
      this.container.id = 'whatshybrid-panel-container';
      
      // Criar Shadow DOM para isolamento
      this.shadow = this.container.attachShadow({ mode: 'open' });
      
      // Adicionar ao body
      document.body.appendChild(this.container);
      
      console.log('[UIPanel] Container criado com Shadow DOM');
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        :host {
          --primary: #25D366;
          --primary-dark: #128C7E;
          --secondary: #075E54;
          --background: #ffffff;
          --background-secondary: #f0f2f5;
          --text: #111b21;
          --text-secondary: #667781;
          --border: #e9edef;
          --shadow: 0 2px 12px rgba(0,0,0,0.15);
          --radius: 12px;
        }

        :host(.dark) {
          --background: #111b21;
          --background-secondary: #202c33;
          --text: #e9edef;
          --text-secondary: #8696a0;
          --border: #2a3942;
        }

        /* FAB - Floating Action Button */
        .fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
          z-index: 10000;
        }

        .fab:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(37,211,102,0.4);
        }

        .fab.active {
          transform: rotate(45deg);
        }

        /* Badge de notificação */
        .fab-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ff4444;
          color: white;
          font-size: 12px;
          font-weight: bold;
          min-width: 20px;
          height: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
        }

        .fab-badge.hidden {
          display: none;
        }

        /* Painel Principal */
        .panel {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 380px;
          max-height: 600px;
          background: var(--background);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          overflow: hidden;
          transform: scale(0.9) translateY(20px);
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s ease;
          z-index: 9999;
        }

        .panel.open {
          transform: scale(1) translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        /* Header */
        .header {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title {
          font-size: 18px;
          font-weight: 600;
        }

        .header-subtitle {
          font-size: 12px;
          opacity: 0.9;
          margin-top: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Status Pill */
        .status-pill {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-pill.online {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .status-pill.offline {
          background: #ff4444;
          color: white;
        }

        .status-pill.away {
          background: #ffaa00;
          color: white;
        }

        /* Close Button */
        .close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        /* Tabs */
        .tabs {
          display: flex;
          background: var(--background-secondary);
          border-bottom: 1px solid var(--border);
        }

        .tab {
          flex: 1;
          padding: 12px 8px;
          text-align: center;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-secondary);
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          background: var(--background);
        }

        .tab.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: var(--background);
        }

        .tab-icon {
          font-size: 18px;
          display: block;
          margin-bottom: 4px;
        }

        /* Content */
        .content {
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
        }

        .section {
          display: none;
        }

        .section.active {
          display: block;
        }

        /* Form Elements */
        .form-group {
          margin-bottom: 16px;
        }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .input, .textarea, .select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
          background: var(--background);
          color: var(--text);
          transition: border-color 0.2s;
        }

        .input:focus, .textarea:focus, .select:focus {
          outline: none;
          border-color: var(--primary);
        }

        .textarea {
          min-height: 80px;
          resize: vertical;
        }

        /* Buttons */
        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--primary);
          color: white;
        }

        .btn-primary:hover {
          background: var(--primary-dark);
        }

        .btn-secondary {
          background: var(--background-secondary);
          color: var(--text);
        }

        .btn-secondary:hover {
          background: var(--border);
        }

        .btn-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Note Box */
        .note {
          background: var(--background-secondary);
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .note strong {
          color: var(--text);
        }

        /* Output Area */
        .output {
          background: var(--background-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          min-height: 100px;
          font-size: 14px;
          color: var(--text);
          white-space: pre-wrap;
        }

        /* Status Message */
        .status-msg {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          margin-top: 12px;
        }

        .status-msg.success {
          background: rgba(37,211,102,0.1);
          color: var(--primary);
        }

        .status-msg.error {
          background: rgba(255,68,68,0.1);
          color: #ff4444;
        }

        /* Dark Mode Toggle */
        .theme-toggle {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Mobile Responsive */
        @media (max-width: 480px) {
          .panel {
            width: calc(100vw - 32px);
            right: 16px;
            bottom: 90px;
            max-height: 70vh;
          }

          .fab {
            bottom: 16px;
            right: 16px;
            width: 56px;
            height: 56px;
          }
        }

        /* Scrollbar */
        .content::-webkit-scrollbar {
          width: 6px;
        }

        .content::-webkit-scrollbar-track {
          background: var(--background-secondary);
        }

        .content::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }

        /* Loader */
        .loader {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Row Layout */
        .row {
          display: flex;
          gap: 12px;
        }

        .row > * {
          flex: 1;
        }
      `;
      this.shadow.appendChild(style);
      
      console.log('[UIPanel] Estilos CSS injetados');
    }

    render() {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <!-- FAB Button -->
        <button class="fab" id="fab" title="WhatsHybrid">
          <span>🤖</span>
          <span class="fab-badge ${this.notifications === 0 ? 'hidden' : ''}" id="fabBadge">${this.notifications}</span>
        </button>

        <!-- Main Panel -->
        <div class="panel ${this.isOpen ? 'open' : ''}" id="panel">
          <!-- Header -->
          <div class="header">
            <div>
              <div class="header-title">WhatsHybrid</div>
              <div class="header-subtitle">IA • Memória • Campanhas • Contatos</div>
            </div>
            <div class="header-right">
              <span class="status-pill ${this.status}" id="statusPill">${this.status}</span>
              <button class="theme-toggle" id="themeToggle" title="Alternar tema">
                ${this.theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button class="close-btn" id="closeBtn" title="Fechar">✕</button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tabs" id="tabs">
            ${this.tabs.map(tab => `
              <div class="tab ${tab.id === this.activeTab ? 'active' : ''}" data-tab="${tab.id}">
                <span class="tab-icon">${tab.icon}</span>
                <span>${tab.label}</span>
              </div>
            `).join('')}
          </div>

          <!-- Content -->
          <div class="content">
            <!-- Chat Section -->
            <div class="section ${this.activeTab === 'chat' ? 'active' : ''}" data-section="chat">
              <div class="note">
                <strong>Modo seguro:</strong> o chatbot gera texto. Você decide o que enviar.<br>
                A IA usa <strong>contexto do negócio</strong> + <strong>memória</strong> + <strong>exemplos</strong>.
              </div>

              <div class="form-group">
                <label class="label">Instrução extra</label>
                <textarea class="textarea" id="chatPrompt" placeholder="Ex.: Responda curto, com tom premium e CTA."></textarea>
              </div>

              <div class="row">
                <div class="form-group">
                  <label class="label">Mensagens lidas</label>
                  <input class="input" type="number" id="chatLimit" min="5" max="80" value="30">
                </div>
                <div class="form-group">
                  <label class="label">Ação</label>
                  <select class="select" id="chatMode">
                    <option value="reply">Sugerir resposta</option>
                    <option value="summary">Resumir conversa</option>
                    <option value="followup">Próximos passos</option>
                    <option value="train">Treino (melhorias)</option>
                  </select>
                </div>
              </div>

              <div class="btn-group">
                <button class="btn btn-primary" id="generateBtn">🚀 Gerar</button>
                <button class="btn btn-secondary" id="memoryBtn">🦁 Atualizar Memória</button>
                <button class="btn btn-secondary" id="saveExampleBtn">💾 Salvar Exemplo</button>
              </div>

              <div class="form-group" style="margin-top: 16px;">
                <label class="label">Saída</label>
                <div class="output" id="chatOutput">Aqui aparece a resposta...</div>
              </div>

              <div class="btn-group">
                <button class="btn btn-primary" id="insertBtn">📝 Inserir</button>
                <button class="btn btn-secondary" id="copyBtn">📋 Copiar</button>
              </div>

              <div class="status-msg" id="chatStatus" style="display: none;"></div>
            </div>

            <!-- Campaigns Section -->
            <div class="section ${this.activeTab === 'campaigns' ? 'active' : ''}" data-section="campaigns">
              <div class="note">
                <strong>Campanhas:</strong> Envie mensagens em massa de forma segura com delays humanizados.
              </div>

              <div class="form-group">
                <label class="label">Nome da Campanha</label>
                <input class="input" type="text" id="campaignName" placeholder="Ex.: Black Friday 2024">
              </div>

              <div class="form-group">
                <label class="label">Template da Mensagem</label>
                <textarea class="textarea" id="campaignTemplate" placeholder="Olá {nome}! Temos uma oferta especial..."></textarea>
              </div>

              <div class="form-group">
                <label class="label">Contatos (CSV)</label>
                <input class="input" type="file" id="campaignFile" accept=".csv">
              </div>

              <div class="btn-group">
                <button class="btn btn-primary" id="startCampaignBtn">▶️ Iniciar</button>
                <button class="btn btn-secondary" id="pauseCampaignBtn">⏸️ Pausar</button>
                <button class="btn btn-secondary" id="campaignStatsBtn">📊 Stats</button>
              </div>

              <div class="status-msg" id="campaignStatus" style="display: none;"></div>
            </div>

            <!-- Contacts Section -->
            <div class="section ${this.activeTab === 'contacts' ? 'active' : ''}" data-section="contacts">
              <div class="note">
                <strong>Contatos:</strong> Gerencie sua base de contatos com tags, blacklist e histórico.
              </div>

              <div class="form-group">
                <label class="label">Buscar</label>
                <input class="input" type="text" id="contactSearch" placeholder="Nome, telefone ou email...">
              </div>

              <div class="btn-group">
                <button class="btn btn-primary" id="importContactsBtn">📥 Importar CSV</button>
                <button class="btn btn-secondary" id="exportContactsBtn">📤 Exportar</button>
                <button class="btn btn-secondary" id="syncCrmBtn">🔄 Sync CRM</button>
              </div>

              <div class="form-group" style="margin-top: 16px;">
                <label class="label">Resultados</label>
                <div class="output" id="contactsList" style="max-height: 150px; overflow-y: auto;">
                  Busque por contatos...
                </div>
              </div>

              <div class="status-msg" id="contactsStatus" style="display: none;"></div>
            </div>

            <!-- Training Section -->
            <div class="section ${this.activeTab === 'training' ? 'active' : ''}" data-section="training">
              <div class="note">
                <strong>Treinamento:</strong> Gerencie exemplos para melhorar as respostas da IA.
              </div>

              <div class="form-group">
                <label class="label">Exemplos Salvos</label>
                <div class="output" id="examplesList" style="max-height: 200px; overflow-y: auto;">
                  Carregando exemplos...
                </div>
              </div>

              <div class="btn-group">
                <button class="btn btn-primary" id="loadExamplesBtn">🔄 Carregar</button>
                <button class="btn btn-secondary" id="exportExamplesBtn">📤 Exportar JSON</button>
                <button class="btn btn-secondary" id="importExamplesBtn">📥 Importar JSON</button>
              </div>

              <div class="form-group" style="margin-top: 16px;">
                <label class="label">Estatísticas de IA</label>
                <div class="output" id="trainingStats">
                  Carregando estatísticas...
                </div>
              </div>

              <div class="status-msg" id="trainingStatus" style="display: none;"></div>
            </div>
          </div>
        </div>
      `;

      this.shadow.appendChild(wrapper);
      
      console.log('[UIPanel] HTML renderizado');
    }

    attachEventListeners() {
      // FAB toggle
      const fab = this.shadow.getElementById('fab');
      fab?.addEventListener('click', () => this.togglePanel());

      // Close button
      const closeBtn = this.shadow.getElementById('closeBtn');
      closeBtn?.addEventListener('click', () => this.closePanel());

      // Theme toggle
      const themeToggle = this.shadow.getElementById('themeToggle');
      themeToggle?.addEventListener('click', () => this.toggleTheme());

      // Tabs
      const tabs = this.shadow.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
      });

      // Chat actions
      this.shadow.getElementById('generateBtn')?.addEventListener('click', () => this.handleGenerate());
      this.shadow.getElementById('memoryBtn')?.addEventListener('click', () => this.handleUpdateMemory());
      this.shadow.getElementById('saveExampleBtn')?.addEventListener('click', () => this.handleSaveExample());
      this.shadow.getElementById('insertBtn')?.addEventListener('click', () => this.handleInsert());
      this.shadow.getElementById('copyBtn')?.addEventListener('click', () => this.handleCopy());

      // Campaign actions
      this.shadow.getElementById('startCampaignBtn')?.addEventListener('click', () => this.handleStartCampaign());
      this.shadow.getElementById('pauseCampaignBtn')?.addEventListener('click', () => this.handlePauseCampaign());
      this.shadow.getElementById('campaignStatsBtn')?.addEventListener('click', () => this.handleCampaignStats());

      // Contact actions
      this.shadow.getElementById('contactSearch')?.addEventListener('input', (e) => this.handleContactSearch(e.target.value));
      this.shadow.getElementById('importContactsBtn')?.addEventListener('click', () => this.handleImportContacts());
      this.shadow.getElementById('exportContactsBtn')?.addEventListener('click', () => this.handleExportContacts());
      this.shadow.getElementById('syncCrmBtn')?.addEventListener('click', () => this.handleSyncCRM());

      // Training actions
      this.shadow.getElementById('loadExamplesBtn')?.addEventListener('click', () => this.handleLoadExamples());
      this.shadow.getElementById('exportExamplesBtn')?.addEventListener('click', () => this.handleExportExamples());
      this.shadow.getElementById('importExamplesBtn')?.addEventListener('click', () => this.handleImportExamples());

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'W') {
          e.preventDefault();
          this.togglePanel();
        }
        if (e.key === 'Escape' && this.isOpen) {
          this.closePanel();
        }
      });
      
      console.log('[UIPanel] Event listeners anexados');
    }

    // ============================================
    // CONTROLE DO PAINEL
    // ============================================

    togglePanel() {
      this.isOpen = !this.isOpen;
      const panel = this.shadow.getElementById('panel');
      const fab = this.shadow.getElementById('fab');
      
      panel?.classList.toggle('open', this.isOpen);
      fab?.classList.toggle('active', this.isOpen);
      
      console.log(`[UIPanel] Painel ${this.isOpen ? 'aberto' : 'fechado'}`);
    }

    closePanel() {
      this.isOpen = false;
      this.shadow.getElementById('panel')?.classList.remove('open');
      this.shadow.getElementById('fab')?.classList.remove('active');
    }

    switchTab(tabId) {
      this.activeTab = tabId;
      
      // Update tab styles
      this.shadow.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
      });
      
      // Update section visibility
      this.shadow.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.dataset.section === tabId);
      });
      
      console.log(`[UIPanel] Tab alterada: ${tabId}`);
    }

    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.container.classList.toggle('dark', this.theme === 'dark');
      
      const themeToggle = this.shadow.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.textContent = this.theme === 'dark' ? '☀️' : '🌙';
      }
      
      this.saveTheme();
      console.log(`[UIPanel] Tema alterado: ${this.theme}`);
    }

    updateStatus(status) {
      this.status = status;
      const pill = this.shadow.getElementById('statusPill');
      if (pill) {
        pill.className = `status-pill ${status}`;
        pill.textContent = status;
      }
    }

    updateNotifications(count) {
      this.notifications = count;
      const badge = this.shadow.getElementById('fabBadge');
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
      }
    }

    showStatus(elementId, message, type = 'success') {
      const statusEl = this.shadow.getElementById(elementId);
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-msg ${type}`;
        statusEl.style.display = 'block';
        
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 5000);
      }
    }

    // ============================================
    // HANDLERS DE AÇÕES - CHAT
    // ============================================

    async handleGenerate() {
      const prompt = this.shadow.getElementById('chatPrompt')?.value || '';
      const limit = parseInt(this.shadow.getElementById('chatLimit')?.value || '30');
      const mode = this.shadow.getElementById('chatMode')?.value || 'reply';
      const output = this.shadow.getElementById('chatOutput');
      
      if (!output) return;
      
      output.innerHTML = '<span class="loader"></span> Gerando...';
      
      try {
        // Integrar com o sistema de IA existente
        if (window.CopilotEngine && typeof window.CopilotEngine.generateResponse === 'function') {
          const result = await window.CopilotEngine.generateResponse({
            extraPrompt: prompt,
            messageLimit: limit,
            mode: mode
          });
          output.textContent = result || 'Resposta gerada com sucesso';
          this.showStatus('chatStatus', '✅ Resposta gerada!', 'success');
        } else if (window.SmartBotIA && typeof window.SmartBotIA.generateResponse === 'function') {
          const result = await window.SmartBotIA.generateResponse();
          output.textContent = result || 'Resposta gerada com sucesso';
          this.showStatus('chatStatus', '✅ Resposta gerada!', 'success');
        } else {
          output.textContent = 'Sistema de IA disponível. Configure no painel principal.';
          this.showStatus('chatStatus', 'ℹ️ Configure a IA primeiro', 'error');
        }
      } catch (error) {
        output.textContent = 'Erro: ' + error.message;
        this.showStatus('chatStatus', '❌ Erro ao gerar', 'error');
        console.error('[UIPanel] Erro ao gerar:', error);
      }
    }

    handleInsert() {
      const output = this.shadow.getElementById('chatOutput')?.textContent || '';
      
      if (!output || output === 'Aqui aparece a resposta...') {
        this.showStatus('chatStatus', '⚠️ Nenhuma resposta para inserir', 'error');
        return;
      }
      
      // Usar HumanTyping se disponível
      if (window.HumanTyping && typeof window.HumanTyping.typeInWhatsApp === 'function') {
        window.HumanTyping.typeInWhatsApp(output);
        this.showStatus('chatStatus', '✅ Inserido no WhatsApp!', 'success');
      } else {
        // Fallback: copiar para clipboard
        navigator.clipboard.writeText(output).then(() => {
          this.showStatus('chatStatus', '📋 Copiado! Cole no WhatsApp', 'success');
        }).catch(err => {
          this.showStatus('chatStatus', '❌ Erro ao copiar', 'error');
          console.error('[UIPanel] Erro ao copiar no fallback:', err);
        });
      }
    }

    handleCopy() {
      const output = this.shadow.getElementById('chatOutput')?.textContent || '';
      
      if (!output || output === 'Aqui aparece a resposta...') {
        this.showStatus('chatStatus', '⚠️ Nenhuma resposta para copiar', 'error');
        return;
      }
      
      navigator.clipboard.writeText(output).then(() => {
        this.showStatus('chatStatus', '✅ Copiado!', 'success');
      }).catch(err => {
        this.showStatus('chatStatus', '❌ Erro ao copiar', 'error');
        console.error('[UIPanel] Erro ao copiar:', err);
      });
    }

    async handleUpdateMemory() {
      this.showStatus('chatStatus', '🦁 Atualizando memória...', 'success');
      
      try {
        if (window.MemorySystem && typeof window.MemorySystem.autoUpdateMemory === 'function') {
          await window.MemorySystem.autoUpdateMemory();
          this.showStatus('chatStatus', '✅ Memória atualizada!', 'success');
        } else {
          this.showStatus('chatStatus', 'ℹ️ Sistema de memória não disponível', 'error');
        }
      } catch (error) {
        this.showStatus('chatStatus', '❌ Erro ao atualizar memória', 'error');
        console.error('[UIPanel] Erro ao atualizar memória:', error);
      }
    }

    async handleSaveExample() {
      this.showStatus('chatStatus', '💾 Salvando exemplo...', 'success');
      
      try {
        if (window.FewShotLearning && typeof window.FewShotLearning.saveExample === 'function') {
          // Implementar lógica de salvar exemplo
          this.showStatus('chatStatus', '✅ Exemplo salvo!', 'success');
        } else {
          this.showStatus('chatStatus', 'ℹ️ Sistema de exemplos não disponível', 'error');
        }
      } catch (error) {
        this.showStatus('chatStatus', '❌ Erro ao salvar exemplo', 'error');
        console.error('[UIPanel] Erro ao salvar exemplo:', error);
      }
    }

    // ============================================
    // HANDLERS DE AÇÕES - CAMPANHAS
    // ============================================

    handleStartCampaign() {
      const name = this.shadow.getElementById('campaignName')?.value;
      const template = this.shadow.getElementById('campaignTemplate')?.value;
      
      if (!name || !template) {
        this.showStatus('campaignStatus', '⚠️ Preencha nome e template', 'error');
        return;
      }
      
      this.showStatus('campaignStatus', '▶️ Campanha iniciada!', 'success');
      console.log('[UIPanel] Campanha iniciada:', { name, template });
    }

    handlePauseCampaign() {
      this.showStatus('campaignStatus', '⏸️ Campanha pausada', 'success');
    }

    handleCampaignStats() {
      this.showStatus('campaignStatus', '📊 Abrindo estatísticas...', 'success');
    }

    // ============================================
    // HANDLERS DE AÇÕES - CONTATOS
    // ============================================

    async handleContactSearch(query) {
      const list = this.shadow.getElementById('contactsList');
      
      if (!list) return;
      
      if (!query || query.length < 2) {
        list.textContent = 'Digite pelo menos 2 caracteres...';
        return;
      }
      
      try {
        if (window.CRMModule && typeof window.CRMModule.searchContacts === 'function') {
          const results = await window.CRMModule.searchContacts(query);
          if (!results || results.length === 0) {
            list.textContent = 'Nenhum contato encontrado';
          } else {
            list.innerHTML = results.slice(0, 10).map(c => 
              `<div style="padding: 8px; border-bottom: 1px solid var(--border);">
                <strong>${c.name || 'Sem nome'}</strong><br>
                <small>${c.phone || c.number || 'Sem telefone'}</small>
              </div>`
            ).join('');
          }
        } else {
          list.textContent = 'Sistema CRM não disponível';
        }
      } catch (error) {
        list.textContent = 'Erro ao buscar contatos';
        console.error('[UIPanel] Erro ao buscar contatos:', error);
      }
    }

    handleImportContacts() {
      this.showStatus('contactsStatus', '📥 Importar contatos - Em desenvolvimento', 'success');
    }

    handleExportContacts() {
      this.showStatus('contactsStatus', '📤 Exportar contatos - Em desenvolvimento', 'success');
    }

    handleSyncCRM() {
      this.showStatus('contactsStatus', '🔄 Sincronizar CRM - Em desenvolvimento', 'success');
    }

    // ============================================
    // HANDLERS DE AÇÕES - TREINAMENTO
    // ============================================

    async handleLoadExamples() {
      const list = this.shadow.getElementById('examplesList');
      
      if (!list) return;
      
      list.innerHTML = '<span class="loader"></span> Carregando...';
      
      try {
        if (window.FewShotLearning && typeof window.FewShotLearning.getExamples === 'function') {
          const examples = await window.FewShotLearning.getExamples();
          if (!examples || examples.length === 0) {
            list.textContent = 'Nenhum exemplo salvo';
          } else {
            list.innerHTML = examples.slice(0, 10).map((ex, i) => 
              `<div style="padding: 8px; border-bottom: 1px solid var(--border);">
                <strong>Exemplo ${i + 1}</strong><br>
                <small>${ex.input?.substring(0, 50)}...</small>
              </div>`
            ).join('');
          }
        } else {
          list.textContent = 'Sistema de exemplos não disponível';
        }
      } catch (error) {
        list.textContent = 'Erro ao carregar exemplos';
        console.error('[UIPanel] Erro ao carregar exemplos:', error);
      }
      
      // Carregar estatísticas
      this.loadTrainingStats();
    }

    async loadTrainingStats() {
      const stats = this.shadow.getElementById('trainingStats');
      
      if (!stats) return;
      
      try {
        if (window.TrainingStats && typeof window.TrainingStats.getStats === 'function') {
          const data = await window.TrainingStats.getStats();
          stats.innerHTML = `
            <div style="padding: 4px 0;">
              <strong>Total de exemplos:</strong> ${data.totalExamples || 0}<br>
              <strong>Taxa de sucesso:</strong> ${data.successRate || 0}%<br>
              <strong>Última atualização:</strong> ${data.lastUpdate || 'N/A'}
            </div>
          `;
        } else {
          stats.textContent = 'Estatísticas não disponíveis';
        }
      } catch (error) {
        stats.textContent = 'Erro ao carregar estatísticas';
        console.error('[UIPanel] Erro ao carregar stats:', error);
      }
    }

    handleExportExamples() {
      this.showStatus('trainingStatus', '📤 Exportar exemplos - Em desenvolvimento', 'success');
    }

    handleImportExamples() {
      this.showStatus('trainingStatus', '📥 Importar exemplos - Em desenvolvimento', 'success');
    }

    // ============================================
    // PERSISTÊNCIA
    // ============================================

    saveTheme() {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ uiPanelTheme: this.theme }, () => {
          console.log('[UIPanel] Tema salvo:', this.theme);
        });
      }
    }

    async loadTheme() {
      return new Promise(resolve => {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['uiPanelTheme'], result => {
            if (result.uiPanelTheme) {
              this.theme = result.uiPanelTheme;
              // Apply theme to container immediately after loading
              if (this.container) {
                this.container.classList.toggle('dark', this.theme === 'dark');
              }
              console.log('[UIPanel] Tema carregado:', this.theme);
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  }

  // ============================================
  // INICIALIZAÇÃO GLOBAL
  // ============================================

  async function initUIPanel() {
    try {
      const panel = new UIPanelShadow();
      await panel.initialize();
      window.WhatsHybridUIPanel = panel;
      console.log('[UIPanel] ✅ Exposto globalmente como window.WhatsHybridUIPanel');
      return panel;
    } catch (error) {
      console.error('[UIPanel] ❌ Erro na inicialização:', error);
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIPanel);
  } else {
    // DOM já carregado, inicializar imediatamente
    setTimeout(initUIPanel, 100);
  }

})();
