/**
 * 🎨 AI & Backend View Handlers
 * Controla a interface visual dos módulos AI e Backend
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // AI VIEW HANDLERS
  // ============================================

  function initAIView() {
    // Tab switching
    document.querySelectorAll('[data-ai-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.aiTab;
        
        // Update tab styles
        document.querySelectorAll('[data-ai-tab]').forEach(t => {
          t.style.borderBottom = 'none';
          t.style.color = 'var(--mod-text-muted)';
        });
        tab.style.borderBottom = '2px solid var(--mod-primary)';
        tab.style.color = 'var(--mod-text)';
        
        // Show/hide content
        document.querySelectorAll('.ai-tab-content').forEach(c => c.style.display = 'none');
        const content = document.getElementById(`aiTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (content) content.style.display = 'block';
      });
    });

    // Persona selection
    document.querySelectorAll('.persona-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.persona-card').forEach(c => {
          c.classList.remove('active');
          c.style.borderColor = '';
          c.style.background = '';
        });
        card.classList.add('active');
        card.style.borderColor = 'var(--mod-primary)';
        card.style.background = 'rgba(139,92,246,0.1)';
        
        const persona = card.dataset.persona;
        if (window.CopilotEngine) {
          window.CopilotEngine.setActivePersona(persona);
        }
      });
    });

    // Copilot mode change
    const modeSelect = document.getElementById('copilot_mode');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        if (window.CopilotEngine) {
          window.CopilotEngine.setMode(modeSelect.value);
          showToast(`Modo alterado para: ${modeSelect.options[modeSelect.selectedIndex].text}`);
        }
      });
    }

    // Analyze button
    const analyzeBtn = document.getElementById('copilot_analyze_btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        const input = document.getElementById('copilot_test_input');
        if (!input?.value.trim()) {
          showToast('Digite uma mensagem para analisar', 'warning');
          return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Analisando...';
        
        // Armazenar para feedback do aprendizado
        window._lastAnalyzedMessage = input.value;

        try {
          if (window.CopilotEngine) {
            const analysis = await window.CopilotEngine.analyzeMessage(input.value, 'test-chat');
            displayAnalysisResult(analysis);
          } else {
            // Fallback local analysis
            const analysis = localAnalysis(input.value);
            displayAnalysisResult(analysis);
          }
        } catch (error) {
          showToast('Erro na análise: ' + error.message, 'error');
        }

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '🔍 Analisar Mensagem';
      });
    }

    // Provider toggles
    document.querySelectorAll('.provider-card').forEach(card => {
      const provider = card.dataset.provider;
      const checkbox = card.querySelector(`#provider_${provider}_enabled`);
      const config = card.querySelector('.provider-config');
      
      if (checkbox && config) {
        checkbox.addEventListener('change', () => {
          config.style.display = checkbox.checked ? 'block' : 'none';
        });
      }
    });

    // Save providers button
    const saveProvidersBtn = document.getElementById('ai_save_providers');
    if (saveProvidersBtn) {
      saveProvidersBtn.addEventListener('click', saveAIProviders);
    }

    // Test provider button
    const testProviderBtn = document.getElementById('ai_test_provider');
    if (testProviderBtn) {
      testProviderBtn.addEventListener('click', testAIProvider);
    }

    // Knowledge base add button
    const kbAddBtn = document.getElementById('kb_add_btn');
    if (kbAddBtn) {
      kbAddBtn.addEventListener('click', addKnowledgeItem);
    }

    // Botão para mostrar sugestões na tela do WhatsApp
    const showSuggestionsBtn = document.getElementById('btn_show_suggestions_panel');
    if (showSuggestionsBtn) {
      showSuggestionsBtn.addEventListener('click', () => {
        // Envia mensagem para content script mostrar o painel
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'showSuggestionsPanel'
            }, (response) => {
              if (response?.success) {
                showToast('💡 Painel de sugestões exibido!', 'success');
              } else {
                showToast('⚠️ Abra uma conversa no WhatsApp primeiro', 'warning');
              }
            });
          }
        });
      });
    }

    // Load initial state
    loadAIState();
    updateAIMetrics();
  }

  function localAnalysis(message) {
    const lowerMsg = message.toLowerCase();
    
    // Palavras hostis/insultos
    const hostilePatterns = [
      'tomar no cu', 'vai se foder', 'foda-se', 'vai tomar', 'vai pro inferno',
      'idiota', 'imbecil', 'burro', 'otário', 'babaca', 'cretino', 'retardado',
      'merda', 'bosta', 'porra', 'caralho', 'fdp', 'pqp', 'vsf', 'vtnc', 'tnc',
      'filho da puta', 'desgraça', 'maldito', 'some daqui', 'cala boca',
      'vagabundo', 'safado', 'pilantra', 'lixo humano', 'nojento'
    ];
    
    // Verificar hostilidade primeiro (maior prioridade)
    const isHostile = hostilePatterns.some(p => lowerMsg.includes(p));
    
    // Simple intent detection
    let intent = { id: 'info', name: 'Informação' };
    if (isHostile) {
      intent = { id: 'hostile', name: 'Hostilidade' };
    } else if (/olá|oi|bom dia|boa tarde|boa noite/i.test(message)) {
      intent = { id: 'greeting', name: 'Saudação' };
    } else if (/\?|como|quando|onde|qual|quanto/i.test(message)) {
      intent = { id: 'question', name: 'Pergunta' };
    } else if (/problema|ruim|péssimo|reclamar|insatisfeito/i.test(message)) {
      intent = { id: 'complaint', name: 'Reclamação' };
    } else if (/preço|valor|comprar|pagar/i.test(message)) {
      intent = { id: 'purchase', name: 'Compra' };
    }

    // Sentiment analysis
    let sentiment = { label: 'neutral', emoji: '😐', score: 0, isHostile: false };
    
    if (isHostile) {
      sentiment = { label: 'hostile', emoji: '😡', score: -1, isHostile: true, advice: 'Responda de forma profissional e calma' };
    } else if (/obrigado|ótimo|excelente|adorei|top|maravilhoso|perfeito|amei/i.test(message)) {
      sentiment = { label: 'positive', emoji: '😊', score: 0.7, isHostile: false };
    } else if (/problema|ruim|péssimo|raiva|absurdo|horrível|cancelar|devolver|decepcionado/i.test(message)) {
      sentiment = { label: 'negative', emoji: '😟', score: -0.7, isHostile: false };
    }

    // Extract entities
    const entities = {
      phones: message.match(/(?:\d{2})?\s?\d{4,5}[-\s]?\d{4}/g) || [],
      emails: message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || [],
      money: message.match(/R\$\s?[\d.,]+/g) || []
    };

    return {
      intent,
      sentiment,
      entities,
      confidence: isHostile ? 0.95 : 0.75
    };
  }

  function displayAnalysisResult(analysis) {
    const resultDiv = document.getElementById('copilot_analysis_result');
    if (!resultDiv) return;

    resultDiv.style.display = 'block';

    document.getElementById('analysis_intent').textContent = 
      `${analysis.intent?.name || analysis.intent?.id || '-'}`;
    
    document.getElementById('analysis_sentiment').textContent = 
      `${analysis.sentiment?.emoji || ''} ${analysis.sentiment?.label || '-'}`;
    
    document.getElementById('analysis_confidence').textContent = 
      `${Math.round((analysis.confidence || 0) * 100)}%`;

    // Entities
    const entitiesEl = document.getElementById('analysis_entities');
    const entities = analysis.entities || {};
    const entityParts = [];
    
    if (entities.phones?.length) entityParts.push(`📱 ${entities.phones.join(', ')}`);
    if (entities.emails?.length) entityParts.push(`📧 ${entities.emails.join(', ')}`);
    if (entities.money?.length) entityParts.push(`💰 ${entities.money.join(', ')}`);
    
    entitiesEl.textContent = entityParts.length ? entityParts.join(' | ') : 'Nenhuma entidade detectada';
  }

  function saveAIProviders() {
    const providers = ['openai', 'anthropic', 'groq', 'venice'];
    let savedCount = 0;
    
    providers.forEach(provider => {
      const enabled = document.getElementById(`provider_${provider}_enabled`)?.checked;
      const keyInput = document.getElementById(`provider_${provider}_key`);
      const model = document.getElementById(`provider_${provider}_model`)?.value;
      
      if (!enabled) return;
      
      let key = keyInput?.value;
      
      // Verificar se a key é a mascarada (••••••••)
      // Se for, manter a key existente
      if (key && key.startsWith('••••')) {
        const existingConfig = window.AIService?.getProviderConfig(provider);
        if (existingConfig?.apiKey) {
          key = existingConfig.apiKey; // Manter a key real
        } else {
          showToast(`Digite a API Key para ${provider}`, 'warning');
          return;
        }
      }
      
      if (window.AIService && key) {
        window.AIService.configureProvider(provider, {
          apiKey: key,
          model: model,
          enabled: true
        });
        savedCount++;
      }
    });

    if (savedCount > 0) {
      showToast(`✅ ${savedCount} provider(s) configurado(s)!`, 'success');
    } else {
      showToast('Nenhum provider habilitado com API key válida', 'warning');
    }
  }

  async function testAIProvider() {
    const btn = document.getElementById('ai_test_provider');
    btn.disabled = true;
    btn.textContent = '⏳ Testando...';

    try {
      if (!window.AIService) {
        throw new Error('AIService não disponível');
      }

      const providers = window.AIService.getConfiguredProviders();
      if (providers.length === 0) {
        throw new Error('Nenhum provider configurado');
      }

      const result = await window.AIService.complete([
        { role: 'user', content: 'Diga apenas "OK" se você estiver funcionando.' }
      ], { maxTokens: 10 });

      showToast(`✅ Provider ${result.provider} funcionando! "${result.content}"`, 'success');
    } catch (error) {
      showToast('❌ Erro: ' + error.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '🧪 Testar Provider Ativo';
  }

  function addKnowledgeItem() {
    const question = document.getElementById('kb_question')?.value.trim();
    const answer = document.getElementById('kb_answer')?.value.trim();

    if (!question || !answer) {
      showToast('Preencha pergunta e resposta', 'warning');
      return;
    }

    if (window.CopilotEngine) {
      window.CopilotEngine.addToKnowledgeBase('faqs', { q: question, a: answer });
    }

    // Clear inputs
    document.getElementById('kb_question').value = '';
    document.getElementById('kb_answer').value = '';

    // Refresh list
    renderKnowledgeList();
    showToast('FAQ adicionada!', 'success');
  }

  function renderKnowledgeList() {
    const container = document.getElementById('kb_list');
    if (!container) return;

    // Get knowledge from CopilotEngine or storage
    let items = [];
    if (window.CopilotEngine) {
      const results = window.CopilotEngine.searchKnowledgeBase('');
      items = results.map(r => r.content);
    }

    if (items.length === 0) {
      container.innerHTML = '<div class="sp-muted">Nenhuma FAQ cadastrada.</div>';
      return;
    }

    container.innerHTML = items.map((item, i) => `
      <div class="mod-card" style="padding: 8px; margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 12px;">${escapeHtml(item.q || item.question)}</div>
        <div style="font-size: 11px; color: var(--mod-text-muted); margin-top: 4px;">${escapeHtml(item.a || item.answer)}</div>
      </div>
    `).join('');
  }

  function loadAIState() {
    // Load Copilot state
    if (window.CopilotEngine) {
      const mode = window.CopilotEngine.getMode();
      const modeSelect = document.getElementById('copilot_mode');
      if (modeSelect) modeSelect.value = mode;

      const persona = window.CopilotEngine.getActivePersona();
      document.querySelectorAll('.persona-card').forEach(card => {
        if (card.dataset.persona === persona?.id) {
          card.classList.add('active');
          card.style.borderColor = 'var(--mod-primary)';
          card.style.background = 'rgba(139,92,246,0.1)';
        }
      });
    }

    // Load AI providers state
    if (window.AIService) {
      const providers = ['openai', 'anthropic', 'groq', 'venice'];
      providers.forEach(provider => {
        const config = window.AIService.getProviderConfig(provider);
        if (config) {
          const checkbox = document.getElementById(`provider_${provider}_enabled`);
          const keyInput = document.getElementById(`provider_${provider}_key`);
          const modelSelect = document.getElementById(`provider_${provider}_model`);
          const configDiv = document.querySelector(`.provider-card[data-provider="${provider}"] .provider-config`);
          
          if (checkbox) checkbox.checked = config.enabled;
          if (keyInput && config.apiKey) keyInput.value = '••••••••' + config.apiKey.slice(-4);
          if (modelSelect && config.model) modelSelect.value = config.model;
          if (configDiv && config.enabled) configDiv.style.display = 'block';
        }
      });
    }

    renderKnowledgeList();
  }

  function updateAIMetrics() {
    // Copilot metrics
    if (window.CopilotEngine) {
      const metrics = window.CopilotEngine.getMetrics();
      setElementText('metric_total_responses', metrics.totalResponses || 0);
      setElementText('metric_auto_responses', metrics.autoResponses || 0);
      setElementText('metric_avg_confidence', Math.round((metrics.avgConfidence || 0) * 100) + '%');
      setElementText('metric_feedback_score', metrics.feedbackScore ? metrics.feedbackScore.toFixed(1) : '-');
    }

    // AI Service stats
    if (window.AIService) {
      const stats = window.AIService.getStats();
      setElementText('ai_stat_requests', stats.totalRequests || 0);
      setElementText('ai_stat_tokens', formatNumber(stats.totalTokens || 0));
      const successRate = stats.totalRequests > 0 
        ? Math.round((stats.successfulRequests / stats.totalRequests) * 100) 
        : 0;
      setElementText('ai_stat_success', successRate + '%');
      setElementText('ai_stat_cost', '$' + (stats.totalCost || 0).toFixed(4));
    }
  }

  // ============================================
  // BACKEND VIEW HANDLERS
  // ============================================

  function initBackendView() {
    // Auth tab switching
    document.querySelectorAll('.backend-auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        document.querySelectorAll('.backend-auth-tab').forEach(t => {
          t.style.background = 'transparent';
          t.style.color = 'var(--mod-text-muted)';
        });
        tab.style.background = 'rgba(139,92,246,0.2)';
        tab.style.color = 'var(--mod-text)';
        
        document.getElementById('backend_login_form').style.display = tabName === 'login' ? 'block' : 'none';
        document.getElementById('backend_register_form').style.display = tabName === 'register' ? 'block' : 'none';
      });
    });

    // Login button
    const loginBtn = document.getElementById('backend_login_btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', handleBackendLogin);
    }

    // Register button
    const registerBtn = document.getElementById('backend_register_btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', handleBackendRegister);
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('backend_disconnect_btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', handleBackendDisconnect);
    }

    // Sync buttons
    document.getElementById('backend_sync_contacts')?.addEventListener('click', () => syncData('contacts'));
    document.getElementById('backend_sync_deals')?.addEventListener('click', () => syncData('deals'));
    document.getElementById('backend_sync_tasks')?.addEventListener('click', () => syncData('tasks'));
    document.getElementById('backend_sync_all')?.addEventListener('click', syncAllData);

    // Check initial connection status
    checkBackendConnection();
  }

  async function handleBackendLogin() {
    const btn = document.getElementById('backend_login_btn');
    const email = document.getElementById('backend_login_email')?.value;
    const password = document.getElementById('backend_login_password')?.value;
    const url = document.getElementById('backend_url')?.value;

    if (!email || !password) {
      showAuthError('Preencha email e senha');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Entrando...';
    hideAuthError();

    try {
      if (window.BackendClient) {
        if (url) window.BackendClient.setBaseUrl(url);
        await window.BackendClient.login(email, password);
        showToast('Login realizado com sucesso!', 'success');
        updateBackendUI(true);
      } else {
        throw new Error('BackendClient não disponível');
      }
    } catch (error) {
      showAuthError(error.message);
    }

    btn.disabled = false;
    btn.textContent = '🔑 Entrar';
  }

  async function handleBackendRegister() {
    const btn = document.getElementById('backend_register_btn');
    const name = document.getElementById('backend_register_name')?.value;
    const email = document.getElementById('backend_register_email')?.value;
    const password = document.getElementById('backend_register_password')?.value;
    const url = document.getElementById('backend_url')?.value;

    if (!name || !email || !password) {
      showAuthError('Preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      showAuthError('Senha deve ter no mínimo 8 caracteres');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Criando conta...';
    hideAuthError();

    try {
      if (window.BackendClient) {
        if (url) window.BackendClient.setBaseUrl(url);
        await window.BackendClient.register(email, password, name);
        showToast('Conta criada com sucesso!', 'success');
        updateBackendUI(true);
      } else {
        throw new Error('BackendClient não disponível');
      }
    } catch (error) {
      showAuthError(error.message);
    }

    btn.disabled = false;
    btn.textContent = '📝 Criar Conta';
  }

  async function handleBackendDisconnect() {
    try {
      if (window.BackendClient) {
        await window.BackendClient.logout();
        showToast('Desconectado com sucesso', 'success');
        updateBackendUI(false);
      }
    } catch (error) {
      showToast('Erro ao desconectar: ' + error.message, 'error');
    }
  }

  function checkBackendConnection() {
    if (window.BackendClient && window.BackendClient.isConnected()) {
      updateBackendUI(true);
    } else {
      updateBackendUI(false);
    }
  }

  function updateBackendUI(connected) {
    const authForm = document.getElementById('backend_auth_form');
    const connectedPanel = document.getElementById('backend_connected_panel');
    const disconnectBtn = document.getElementById('backend_disconnect_btn');
    const statusIcon = document.getElementById('backend_status_icon');
    const statusText = document.getElementById('backend_status_text');
    const statusDetail = document.getElementById('backend_status_detail');

    // Check if elements exist (sidepanel might not be open)
    if (!authForm || !connectedPanel || !statusIcon) {
      console.log('[AIBackendHandlers] Backend UI elements not found - sidepanel may not be open');
      return;
    }

    if (connected && window.BackendClient) {
      authForm.style.display = 'none';
      connectedPanel.style.display = 'block';
      if (disconnectBtn) disconnectBtn.style.display = 'block';
      if (statusIcon) statusIcon.textContent = '🟢';
      if (statusText) statusText.textContent = 'Conectado';
      if (statusDetail) statusDetail.textContent = window.BackendClient.getBaseUrl();

      // Update user info
      const user = window.BackendClient.getUser();
      const workspace = window.BackendClient.getWorkspace();
      
      if (user) {
        setElementText('backend_user_name', user.name || '-');
        setElementText('backend_user_email', user.email || '-');
      }
      
      if (workspace) {
        setElementText('backend_workspace_plan', workspace.plan?.toUpperCase() || 'FREE');
        setElementText('backend_workspace_credits', workspace.credits || 0);
      }

      // Check WebSocket
      const debug = window.BackendClient.debug ? window.BackendClient.debug() : {};
      if (debug.socketConnected) {
        const wsStatus = document.getElementById('backend_ws_status');
        const wsText = document.getElementById('backend_ws_text');
        if (wsStatus) wsStatus.textContent = '🟢';
        if (wsText) wsText.textContent = 'Conectado';
      }
    } else {
      if (authForm) authForm.style.display = 'block';
      if (connectedPanel) connectedPanel.style.display = 'none';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      if (statusIcon) statusIcon.textContent = '🔴';
      if (statusText) statusText.textContent = 'Desconectado';
      if (statusDetail) statusDetail.textContent = 'Configure a conexão abaixo';
    }
  }

  async function syncData(type) {
    const statusEl = document.getElementById('backend_sync_status');
    if (statusEl) statusEl.textContent = `Sincronizando ${type}...`;

    try {
      if (!window.BackendClient || !window.BackendClient.isConnected()) {
        throw new Error('Não conectado ao backend');
      }

      let result;
      switch (type) {
        case 'contacts':
          result = await window.BackendClient.contacts.list({ limit: 1000 });
          setElementText('backend_count_contacts', result.contacts?.length || 0);
          break;
        case 'deals':
          result = await window.BackendClient.crm.deals.list();
          setElementText('backend_count_deals', result.deals?.length || 0);
          break;
        case 'tasks':
          result = await window.BackendClient.tasks.list();
          setElementText('backend_count_tasks', result.tasks?.length || 0);
          break;
      }

      if (statusEl) {
        statusEl.textContent = `✅ ${type} sincronizado!`;
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      }
    } catch (error) {
      if (statusEl) statusEl.textContent = `❌ Erro: ${error.message}`;
    }
  }

  async function syncAllData() {
    const statusEl = document.getElementById('backend_sync_status');
    if (statusEl) statusEl.textContent = 'Sincronizando tudo...';

    try {
      if (!window.BackendClient || !window.BackendClient.isConnected()) {
        throw new Error('Não conectado ao backend');
      }

      const result = await window.BackendClient.syncAll();
      
      setElementText('backend_count_contacts', result.contacts?.contacts?.length || 0);
      setElementText('backend_count_deals', result.deals?.deals?.length || 0);
      setElementText('backend_count_tasks', result.tasks?.tasks?.length || 0);
      setElementText('backend_count_templates', result.templates?.templates?.length || 0);

      if (statusEl) {
        statusEl.textContent = '✅ Sincronização completa!';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      }
      showToast('Dados sincronizados com sucesso!', 'success');
    } catch (error) {
      if (statusEl) statusEl.textContent = `❌ Erro: ${error.message}`;
      showToast('Erro na sincronização: ' + error.message, 'error');
    }
  }

  function showAuthError(message) {
    const el = document.getElementById('backend_auth_error');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function hideAuthError() {
    const el = document.getElementById('backend_auth_error');
    if (el) el.style.display = 'none';
  }

  // ============================================
  // UTILS
  // ============================================

  function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message, type = 'info') {
    if (window.NotificationsModule) {
      window.NotificationsModule.toast(message, type, 3000);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // ============================================
  // FUNÇÕES DE SUGESTÕES E ANÁLISE
  // ============================================
  
  function renderSuggestions(suggestions) {
    const container = document.getElementById('copilot_suggestions');
    if (!container) return;
    
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '<div class="sp-muted">As sugestões aparecerão aqui quando você receber mensagens.</div>';
      return;
    }
    
    container.innerHTML = suggestions.map((sug, i) => `
      <div class="suggestion-item mod-card" style="padding: 10px; margin-bottom: 8px; transition: all 0.2s;" data-suggestion-index="${i}">
        <div style="font-size: 13px; cursor: pointer;" onclick="useSuggestion(\`${escapeHtml(sug.content.replace(/\`/g, '\\\`'))}\`)">${escapeHtml(sug.content)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 10px; color: var(--mod-text-muted);">
          <span>${sug.source === 'ai' ? '🤖 IA' : sug.source === 'knowledge' ? '📚 KB' : sug.source === 'learned' ? '🧠 Aprendido' : '📝 Template'}</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span>${Math.round(sug.confidence * 100)}%</span>
            <button onclick="rateSuggestion(${i}, 5, \`${escapeHtml(sug.content.replace(/\`/g, '\\\`'))}\`)" 
                    style="background: rgba(16,185,129,0.2); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: #10b981; font-size: 12px;"
                    title="Boa sugestão">👍</button>
            <button onclick="rateSuggestion(${i}, 1, \`${escapeHtml(sug.content.replace(/\`/g, '\\\`'))}\`)" 
                    style="background: rgba(239,68,68,0.2); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: #ef4444; font-size: 12px;"
                    title="Sugestão ruim">👎</button>
          </div>
        </div>
      </div>
    `).join('');
    
    window._currentSuggestions = suggestions;
    showToast(`💡 ${suggestions.length} sugestões geradas!`, 'success');
  }
  
  // Função para dar rating nas sugestões - HABILITA APRENDIZADO CONTÍNUO
  window.rateSuggestion = function(index, rating, suggestionText) {
    const suggestions = window._currentSuggestions || [];
    const suggestion = suggestions[index];
    if (!suggestion) return;
    
    const lastInput = window._lastAnalyzedMessage || '';
    
    if (window.EventBus) {
      window.EventBus.emit('copilot:feedback', {
        input: lastInput,
        response: suggestionText,
        rating: rating,
        context: { intent: suggestion.intent || 'unknown', source: suggestion.source, confidence: suggestion.confidence }
      });
    }
    
    const item = document.querySelector(`[data-suggestion-index="${index}"]`);
    if (item) {
      if (rating >= 4) {
        item.style.borderColor = '#10b981';
        item.style.background = 'rgba(16,185,129,0.1)';
        showToast('✅ Obrigado! Aprendizado registrado.', 'success');
      } else {
        item.style.borderColor = '#ef4444';
        item.style.background = 'rgba(239,68,68,0.1)';
        showToast('📝 Feedback registrado. Vamos melhorar!', 'info');
      }
      item.querySelectorAll('button').forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });
    }
    
    if (window.smartBot && window.smartBot.learningSystem) {
      window.smartBot.learningSystem.recordFeedback({ input: lastInput, response: suggestionText, rating: rating, context: { source: suggestion.source } });
    }
  };

  function updateAnalysisUI(analysis) {
    if (!analysis) return;
    
    setElementText('analysis_intent', analysis.intent?.name || '-');
    setElementText('analysis_sentiment', getSentimentEmoji(analysis.sentiment?.label) + ' ' + (analysis.sentiment?.label || '-'));
    setElementText('analysis_confidence', Math.round((analysis.confidence || 0) * 100) + '%');
    
    const entitiesEl = document.getElementById('analysis_entities');
    if (entitiesEl && analysis.entities) {
      const entityList = Object.entries(analysis.entities)
        .filter(([k, v]) => v && v.length > 0)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
        .join(' | ');
      entitiesEl.textContent = entityList || 'Nenhuma entidade detectada';
    }
  }
  
  function getSentimentEmoji(sentiment) {
    const emojis = { positive: '😊', neutral: '😐', negative: '😔', hostile: '😡' };
    return emojis[sentiment] || '❓';
  }

  function updateModeIndicator(mode) {
    // Atualiza indicador visual do modo atual
    const modeIndicator = document.getElementById('copilot_mode_indicator');
    if (modeIndicator) {
      const modeColors = {
        'off': { bg: 'rgba(107,114,128,0.2)', color: '#9ca3af', icon: '🔴' },
        'passive': { bg: 'rgba(147,51,234,0.2)', color: '#9333ea', icon: '👁️' },
        'suggest': { bg: 'rgba(16,185,129,0.2)', color: '#10b981', icon: '💡' },
        'assist': { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6', icon: '🤝' },
        'auto_draft': { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b', icon: '📝' },
        'semi_auto': { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6', icon: '⚡' },
        'full_auto': { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', icon: '🤖' }
      };
      const config = modeColors[mode] || modeColors['suggest'];
      modeIndicator.style.background = config.bg;
      modeIndicator.style.color = config.color;
      modeIndicator.innerHTML = `${config.icon} ${getModeLabel(mode)}`;
    }
  }

  function getModeLabel(mode) {
    const labels = {
      'off': 'Desativado',
      'passive': 'Observador',
      'suggest': 'Sugestões',
      'assist': 'Assistente',
      'auto_draft': 'Auto-rascunho',
      'semi_auto': 'Semi-auto',
      'full_auto': 'Automático'
    };
    return labels[mode] || mode;
  }
  
  // Função global para usar sugestão
  window.useSuggestion = function(text) {
    // Registrar uso como feedback positivo implícito (rating 4 = bom)
    const lastInput = window._lastAnalyzedMessage || '';
    if (lastInput && window.EventBus) {
      window.EventBus.emit('copilot:feedback', {
        input: lastInput,
        response: text,
        rating: 4, // Usar = aprovar implicitamente
        context: { source: 'suggestion_used', implicit: true }
      });
    }
    
    // Enviar mensagem para o content script inserir o texto
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'insertSuggestion',
          text: text
        }, (response) => {
          if (response?.success) {
            showToast('✅ Sugestão inserida!', 'success');
          } else {
            showToast('⚠️ Não foi possível inserir. Copie manualmente.', 'warning');
            // Copiar para clipboard como fallback
            navigator.clipboard.writeText(text).then(() => {
              showToast('📋 Texto copiado para área de transferência!', 'info');
            });
          }
        });
      }
    });
  };

  // ============================================
  // INIT
  // ============================================

  function init() {
    console.log('[AIBackendHandlers] 🚀 Iniciando...');
    
    // Wait for DOM
    if (document.readyState === 'loading') {
      console.log('[AIBackendHandlers] Aguardando DOM...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[AIBackendHandlers] DOM carregado, inicializando views...');
        initAIView();
        initBackendView();
      });
    } else {
      console.log('[AIBackendHandlers] DOM já carregado, inicializando views...');
      initAIView();
      initBackendView();
    }

    // Also init after a delay to catch any late-loaded elements
    setTimeout(() => {
      console.log('[AIBackendHandlers] Re-inicializando após 1s...');
      initAIView();
      initBackendView();
    }, 1000);

    // Listen for view changes
    if (window.EventBus) {
      window.EventBus.on('view:changed', (data) => {
        console.log('[AIBackendHandlers] View changed:', data.view);
        if (data.view === 'ai') {
          updateAIMetrics();
          loadAIState();
        } else if (data.view === 'backend') {
          checkBackendConnection();
        }
      });
      
      // Listener para sugestões do CopilotEngine
      window.EventBus.on('copilot:suggestions', (data) => {
        console.log('[AIBackendHandlers] 💡 Novas sugestões recebidas:', data.suggestions?.length);
        renderSuggestions(data.suggestions);
      });
      
      // Listener para análise do CopilotEngine
      window.EventBus.on('copilot:analysis', (data) => {
        console.log('[AIBackendHandlers] 🔍 Análise recebida:', data.analysis?.intent?.id);
        // Armazenar mensagem para feedback/aprendizado
        if (data.message) {
          window._lastAnalyzedMessage = data.message;
        }
        updateAnalysisUI(data.analysis);
      });

      // Listener para sincronizar UI quando modo muda
      window.EventBus.on('copilot:mode:changed', (data) => {
        console.log('[AIBackendHandlers] 🔄 Modo alterado para:', data.mode);
        const modeSelect = document.getElementById('copilot_mode');
        if (modeSelect && modeSelect.value !== data.mode) {
          modeSelect.value = data.mode;
        }
        // Atualiza indicador visual
        updateModeIndicator(data.mode);
      });

      // Listener para sincronizar UI quando persona muda
      window.EventBus.on('copilot:persona:changed', (data) => {
        console.log('[AIBackendHandlers] 👤 Persona alterada para:', data.personaId);
        document.querySelectorAll('.persona-card').forEach(card => {
          if (card.dataset.persona === data.personaId) {
            card.classList.add('active');
            card.style.borderColor = 'var(--mod-primary)';
            card.style.background = 'rgba(139,92,246,0.1)';
          } else {
            card.classList.remove('active');
            card.style.borderColor = '';
            card.style.background = '';
          }
        });
      });
    }

    // Also listen for storage changes (when user clicks tabs in top panel)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.whl_active_view) {
        const view = changes.whl_active_view.newValue;
        console.log('[AIBackendHandlers] Storage view changed:', view);
        if (view === 'ai') {
          setTimeout(() => {
            initAIView();
            updateAIMetrics();
          }, 100);
        } else if (view === 'backend') {
          setTimeout(() => {
            initBackendView();
            checkBackendConnection();
          }, 100);
        }
      }
    });

    // Periodic updates
    setInterval(() => {
      const aiView = document.getElementById('whlViewAi');
      if (aiView && !aiView.classList.contains('hidden')) {
        updateAIMetrics();
      }
    }, 10000);

    console.log('[AIBackendHandlers] ✅ Handlers inicializados');
  }

  init();

  // Export
  window.AIBackendHandlers = {
    initAIView,
    initBackendView,
    updateAIMetrics,
    checkBackendConnection
  };

})();
