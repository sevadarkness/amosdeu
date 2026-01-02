/**
 * WhatsHybrid Autopilot v7.5.0
 * Correção completa do sistema de resposta automática
 */
(function() {
  'use strict';

  const CONFIG = {
    enabled: false,
    delay: { min: 2000, max: 5000 },
    typingDelay: { min: 25, max: 65 },
    maxQueue: 50,
    processedKey: 'whl_autopilot_processed'
  };

  const state = {
    running: false,
    queue: [],
    processed: new Set(),
    currentChat: null,
    stats: { received: 0, replied: 0, failed: 0 }
  };

  // ============================================
  // 7.1 - Reutilizar openChatByPhone do disparo
  // ============================================
  async function openChatByPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Método 1: Via Store.Cmd (mais confiável)
    if (window.Store?.Cmd?.openChatAt) {
      try {
        await window.Store.Cmd.openChatAt(cleanPhone + '@c.us');
        console.log('[Autopilot] ✅ Chat aberto via Store.Cmd');
        return true;
      } catch (e) {}
    }
    
    // Método 2: Via Store.Chat
    if (window.Store?.Chat?.find) {
      try {
        const chat = await window.Store.Chat.find(cleanPhone + '@c.us');
        if (chat) {
          chat.open?.();
          console.log('[Autopilot] ✅ Chat aberto via Store.Chat');
          return true;
        }
      } catch (e) {}
    }
    
    // Método 3: Via URL (fallback)
    try {
      const link = document.createElement('a');
      link.href = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
      link.click();
      await sleep(2000);
      return true;
    } catch (e) {}
    
    return false;
  }

  // ============================================
  // 7.2 - Reutilizar sendMessageViaInput do disparo
  // ============================================
  async function sendMessageViaInput(text) {
    const inputSelectors = [
      'footer div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][role="textbox"]',
      '[data-testid="conversation-compose-box-input"]'
    ];
    
    let input = null;
    for (const sel of inputSelectors) {
      input = document.querySelector(sel);
      if (input) break;
    }
    
    if (!input) {
      console.error('[Autopilot] ❌ Campo de input não encontrado');
      return false;
    }
    
    // 7.3/7.11 - Usar digitação humana
    await simulateTyping(input, text);
    
    // 7.12 - Clicar no botão send
    await sleep(300);
    const sendBtn = document.querySelector('[data-testid="send"]') ||
                    document.querySelector('button[aria-label*="Enviar"]') ||
                    document.querySelector('span[data-icon="send"]')?.parentElement;
    
    if (sendBtn) {
      sendBtn.click();
      console.log('[Autopilot] ✅ Mensagem enviada');
      return true;
    }
    
    // Fallback: Enter
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }

  // ============================================
  // 7.3/7.11 - Integrar humanTyping
  // ============================================
  async function simulateTyping(input, text) {
    // Usar módulo HumanTyping se disponível
    if (window.HumanTyping?.type) {
      await window.HumanTyping.type(input, text, {
        minDelay: CONFIG.typingDelay.min,
        maxDelay: CONFIG.typingDelay.max
      });
      return;
    }
    
    // Fallback: digitação manual
    input.focus();
    await sleep(100);
    
    for (const char of text) {
      document.execCommand('insertText', false, char);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(Math.random() * 40 + 20);
    }
  }

  // ============================================
  // 7.4/7.13 - Loop automático
  // ============================================
  async function processQueue() {
    if (!state.running || state.queue.length === 0) return;
    
    const item = state.queue.shift();
    if (!item || state.processed.has(item.id)) {
      processQueue();
      return;
    }
    
    console.log('[Autopilot] 🔄 Processando:', item.phone);
    
    try {
      // 7.9 - Abrir chat automaticamente
      const opened = await openChatByPhone(item.phone);
      if (!opened) throw new Error('Falha ao abrir chat');
      
      await sleep(1500);
      
      // 7.10 - Preencher resposta
      const response = await generateResponse(item);
      if (!response) throw new Error('Falha ao gerar resposta');
      
      // 7.11/7.12 - Digitar e enviar
      const sent = await sendMessageViaInput(response);
      if (!sent) throw new Error('Falha ao enviar');
      
      state.processed.add(item.id);
      state.stats.replied++;
      saveProcessed();
      
      updateUI();
      
    } catch (error) {
      console.error('[Autopilot] ❌ Erro:', error);
      state.stats.failed++;
    }
    
    // 7.13 - Repetir para próximas mensagens
    const delay = Math.random() * (CONFIG.delay.max - CONFIG.delay.min) + CONFIG.delay.min;
    setTimeout(processQueue, delay);
  }

  // ============================================
  // 7.7 - Detectar nova mensagem via onMessage hook
  // ============================================
  function setupMessageListener() {
    // Via EventBus
    if (window.EventBus) {
      window.EventBus.on('message:received', handleNewMessage);
    }
    
    // Via window.postMessage
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'WHL_NEW_MESSAGE') {
        handleNewMessage(e.data.payload);
      }
    });
    
    // Via Store
    if (window.Store?.Msg?.on) {
      window.Store.Msg.on('add', handleNewMessage);
    }
  }

  // 7.8 - Identificar chat
  function handleNewMessage(msg) {
    if (!CONFIG.enabled || !state.running) return;
    if (!msg || msg.fromMe) return;
    
    const chatId = msg.chatId || msg.from || msg.id?.remote;
    const phone = chatId?.replace(/@[cs]\.us$/i, '').replace(/\D/g, '');
    
    if (!phone) return;
    
    // Verificar se já processou
    const msgId = msg.id?._serialized || msg.id || Date.now().toString();
    if (state.processed.has(msgId)) return;
    
    state.stats.received++;
    
    // Adicionar à fila
    state.queue.push({
      id: msgId,
      phone,
      message: msg.body || '',
      type: msg.type || 'chat',
      timestamp: msg.t || Date.now()
    });
    
    console.log('[Autopilot] 📩 Nova mensagem na fila:', phone);
    updateUI();
  }

  // ============================================
  // 7.10 - Gerar resposta via AI ou template
  // ============================================
  async function generateResponse(item) {
    // Tentar via AI
    if (window.AIService?.generate) {
      try {
        const response = await window.AIService.generate(item.message);
        if (response) return response;
      } catch (e) {}
    }
    
    // Tentar via backend
    if (window.BackendClient?.generateResponse) {
      try {
        const response = await window.BackendClient.generateResponse(item.message);
        if (response) return response;
      } catch (e) {}
    }
    
    // Fallback: template padrão
    const templates = [
      'Olá! Recebi sua mensagem e retornarei em breve.',
      'Obrigado pelo contato! Em instantes te respondo.',
      'Oi! Vi sua mensagem, já já te respondo!'
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ============================================
  // 7.5/7.6 - UI apenas no painel lateral
  // ============================================
  function updateUI() {
    const statusEl = document.getElementById('autopilot_status');
    const queueEl = document.getElementById('autopilot_queue');
    const statsEl = document.getElementById('autopilot_stats');
    
    if (statusEl) {
      statusEl.innerHTML = state.running 
        ? '<span class="wh-badge wh-badge-success">🤖 Ativo</span>'
        : '<span class="wh-badge wh-badge-warning">⏸️ Pausado</span>';
    }
    
    if (queueEl) {
      queueEl.textContent = state.queue.length;
    }
    
    if (statsEl) {
      statsEl.innerHTML = `📩 ${state.stats.received} | ✅ ${state.stats.replied} | ❌ ${state.stats.failed}`;
    }
  }

  // ============================================
  // Persistência
  // ============================================
  function saveProcessed() {
    try {
      const data = [...state.processed].slice(-500);
      localStorage.setItem(CONFIG.processedKey, JSON.stringify(data));
    } catch (e) {}
  }

  function loadProcessed() {
    try {
      const data = localStorage.getItem(CONFIG.processedKey);
      if (data) state.processed = new Set(JSON.parse(data));
    } catch (e) {}
  }

  // ============================================
  // Utilitários
  // ============================================
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ============================================
  // API Pública
  // ============================================
  window.AutopilotV2 = {
    start: () => {
      CONFIG.enabled = true;
      state.running = true;
      console.log('[Autopilot] ▶️ Iniciado');
      updateUI();
      processQueue();
    },
    stop: () => {
      state.running = false;
      console.log('[Autopilot] ⏹️ Parado');
      updateUI();
    },
    pause: () => {
      state.running = false;
      console.log('[Autopilot] ⏸️ Pausado');
      updateUI();
    },
    resume: () => {
      state.running = true;
      console.log('[Autopilot] ▶️ Retomado');
      processQueue();
      updateUI();
    },
    getStats: () => ({ ...state.stats }),
    getQueue: () => [...state.queue],
    clearQueue: () => { state.queue = []; updateUI(); },
    isRunning: () => state.running,
    setConfig: (key, value) => { if (key in CONFIG) CONFIG[key] = value; }
  };

  // Aliases
  window.Autopilot = window.AutopilotV2;

  // Inicializar
  loadProcessed();
  setupMessageListener();
  console.log('[Autopilot v7.5.0] ✅ Módulo carregado');

})();
