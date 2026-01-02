/**
 * 🤖 SmartBot Auto-Pilot - Processamento Automático de Mensagens
 * 
 * Funcionalidades:
 * - Monitora lista de chats por mensagens não lidas
 * - Abre automaticamente cada chat
 * - Aguarda carregar mensagens
 * - Gera e envia resposta IA
 * - Vai para o próximo chat da fila
 * - Controles de pausar/continuar
 * - Proteção anti-ban
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURAÇÕES
  // ============================================================

  const CONFIG = {
    // Delays (em ms) - Anti-ban
    DELAY_BETWEEN_CHATS: 3000,        // Delay entre processar chats
    DELAY_BEFORE_SEND: 1500,          // Delay antes de enviar mensagem
    DELAY_AFTER_SEND: 2000,           // Delay após enviar mensagem
    DELAY_CHAT_LOAD: 2000,            // Tempo para chat carregar
    DELAY_TYPING_SIMULATION: 1000,    // Simular digitação
    
    // Limites - Proteção
    MAX_RESPONSES_PER_HOUR: 30,       // Máximo de respostas por hora
    MAX_RESPONSES_PER_CHAT: 5,        // Máximo por chat antes de pausar
    MAX_CONSECUTIVE_ERRORS: 3,        // Erros consecutivos antes de pausar
    
    // Horário de funcionamento
    WORKING_HOURS: {
      enabled: false,
      start: 8,   // 8:00
      end: 22     // 22:00
    },
    
    // Filtros
    SKIP_GROUPS: true,                // Pular grupos
    SKIP_ARCHIVED: true,              // Pular arquivados
    ONLY_CONTACTS: false,             // Apenas contatos salvos
    
    // UI
    DEBUG: true,
    PANEL_POSITION: 'bottom-right'
  };

  // ============================================================
  // ESTADO
  // ============================================================

  const state = {
    isRunning: false,
    isPaused: false,
    isProcessing: false,
    
    // Estatísticas
    stats: {
      totalProcessed: 0,
      totalSent: 0,
      totalSkipped: 0,
      totalErrors: 0,
      startTime: null,
      lastActivityTime: null,
      responsesThisHour: 0,
      hourStartTime: null
    },
    
    // Filas
    pendingChats: [],
    processedChats: new Set(),
    skippedChats: new Set(),
    chatResponseCounts: new Map(),
    
    // Controle de erros
    consecutiveErrors: 0,
    
    // Configurações do usuário
    config: { ...CONFIG },
    
    // Blacklist/Whitelist
    blacklist: new Set(),
    whitelist: new Set(),
    useWhitelist: false,
    
    // Observer
    chatListObserver: null,
    
    // Intervalo de verificação
    checkInterval: null,
    
    // Chat atual
    currentChatId: null
  };

  // ============================================================
  // SELETORES DOM - WhatsApp Web
  // ============================================================

  const SELECTORS = {
    // Lista de chats
    CHAT_LIST: '#pane-side',
    CHAT_ITEM: '[data-testid="cell-frame-container"]',
    CHAT_ITEM_ALT: '[data-testid="list-item-container"]',
    
    // Indicadores de não lido
    UNREAD_BADGE: '[data-testid="icon-unread-count"]',
    UNREAD_INDICATOR: 'span[aria-label*="não lida"], span[aria-label*="unread"]',
    UNREAD_COUNT: 'span._ahlk, span[data-testid="icon-unread-count"]',
    
    // Chat aberto
    CONVERSATION_PANEL: '#main',
    CHAT_HEADER: '[data-testid="conversation-header"]',
    CHAT_TITLE: '[data-testid="conversation-info-header-chat-title"]',
    CHAT_TITLE_ALT: 'header span[title]',
    
    // Área de mensagens
    MESSAGE_LIST: '[data-testid="conversation-panel-messages"]',
    MESSAGE_IN: '[data-testid="msg-container"]:not([data-testid*="out"])',
    MESSAGE_OUT: '[data-testid="msg-container"][data-testid*="out"]',
    
    // Campo de texto
    TEXT_INPUT: '[data-testid="conversation-compose-box-input"]',
    TEXT_INPUT_ALT: 'div[contenteditable="true"][data-tab="10"]',
    SEND_BUTTON: '[data-testid="send"]',
    SEND_BUTTON_ALT: 'button[aria-label="Enviar"], button[aria-label="Send"]',
    
    // Indicadores de grupo
    GROUP_ICON: '[data-testid="default-group"]',
    GROUP_INDICATOR: '[data-icon="default-group"]',
    
    // Status de conexão
    LOADING_SCREEN: '[data-testid="startup"]',
    QR_CODE: 'canvas[aria-label*="QR"]'
  };

  // ============================================================
  // UTILIDADES
  // ============================================================

  function log(...args) {
    if (state.config.DEBUG) {
      console.log('[AutoPilot 🤖]', new Date().toLocaleTimeString(), ...args);
    }
  }

  function logError(...args) {
    console.error('[AutoPilot ❌]', new Date().toLocaleTimeString(), ...args);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelay(base, variance = 0.3) {
    const min = base * (1 - variance);
    const max = base * (1 + variance);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function isWithinWorkingHours() {
    if (!state.config.WORKING_HOURS.enabled) return true;
    const hour = new Date().getHours();
    return hour >= state.config.WORKING_HOURS.start && hour < state.config.WORKING_HOURS.end;
  }

  function resetHourlyCounter() {
    const now = Date.now();
    if (!state.stats.hourStartTime || (now - state.stats.hourStartTime) > 3600000) {
      state.stats.responsesThisHour = 0;
      state.stats.hourStartTime = now;
    }
  }

  function canSendMoreResponses() {
    resetHourlyCounter();
    return state.stats.responsesThisHour < state.config.MAX_RESPONSES_PER_HOUR;
  }

  function extractChatId(element) {
    try {
      // Tenta extrair de data attributes
      const dataId = element.getAttribute('data-id');
      if (dataId) return dataId;
      
      // Tenta do título
      const titleEl = element.querySelector('[title]');
      if (titleEl) {
        const title = titleEl.getAttribute('title');
        // Extrai número de telefone do título
        const phoneMatch = title.match(/\+?[\d\s-]{10,}/);
        if (phoneMatch) return phoneMatch[0].replace(/[\s-]/g, '');
        return title;
      }
      
      // Fallback: usa posição na lista
      const chatList = document.querySelectorAll(SELECTORS.CHAT_ITEM);
      const index = Array.from(chatList).indexOf(element);
      return `chat_${index}_${Date.now()}`;
    } catch (e) {
      return `unknown_${Date.now()}`;
    }
  }

  function isGroupChat(element) {
    try {
      // Verifica ícone de grupo
      if (element.querySelector(SELECTORS.GROUP_ICON)) return true;
      if (element.querySelector(SELECTORS.GROUP_INDICATOR)) return true;
      
      // Verifica título (grupos geralmente têm mais de um nome)
      const title = element.querySelector('[title]')?.getAttribute('title') || '';
      if (title.includes(',') && !title.includes('@')) return true;
      
      return false;
    } catch (e) {
      return false;
    }
  }

  function hasUnreadMessages(element) {
    try {
      // Verifica badge de não lido
      if (element.querySelector(SELECTORS.UNREAD_BADGE)) return true;
      if (element.querySelector(SELECTORS.UNREAD_INDICATOR)) return true;
      if (element.querySelector(SELECTORS.UNREAD_COUNT)) return true;
      
      // Verifica aria-label indicando não lido
      const ariaLabel = element.getAttribute('aria-label') || '';
      if (ariaLabel.toLowerCase().includes('não lida') || 
          ariaLabel.toLowerCase().includes('unread')) {
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  function getUnreadCount(element) {
    try {
      const badge = element.querySelector(SELECTORS.UNREAD_COUNT);
      if (badge) {
        const count = parseInt(badge.textContent);
        return isNaN(count) ? 1 : count;
      }
      return hasUnreadMessages(element) ? 1 : 0;
    } catch (e) {
      return 0;
    }
  }

  // ============================================================
  // DETECÇÃO DE CHATS NÃO LIDOS
  // ============================================================

  function scanUnreadChats() {
    const unreadChats = [];
    
    try {
      const chatList = document.querySelector(SELECTORS.CHAT_LIST);
      if (!chatList) {
        log('Lista de chats não encontrada');
        return unreadChats;
      }
      
      const chatItems = chatList.querySelectorAll(SELECTORS.CHAT_ITEM);
      if (chatItems.length === 0) {
        // Tenta seletor alternativo
        const altItems = chatList.querySelectorAll(SELECTORS.CHAT_ITEM_ALT);
        if (altItems.length > 0) {
          altItems.forEach(item => processUnreadItem(item, unreadChats));
        }
      } else {
        chatItems.forEach(item => processUnreadItem(item, unreadChats));
      }
      
    } catch (e) {
      logError('Erro ao escanear chats:', e);
    }
    
    return unreadChats;
  }

  function processUnreadItem(item, unreadChats) {
    try {
      if (!hasUnreadMessages(item)) return;
      
      const chatId = extractChatId(item);
      
      // Verificações de filtro
      if (state.processedChats.has(chatId)) return;
      if (state.skippedChats.has(chatId)) return;
      if (state.blacklist.has(chatId)) return;
      if (state.useWhitelist && !state.whitelist.has(chatId)) return;
      
      // Pula grupos se configurado
      if (state.config.SKIP_GROUPS && isGroupChat(item)) {
        log('Pulando grupo:', chatId);
        state.skippedChats.add(chatId);
        return;
      }
      
      // Verifica limite por chat
      const chatCount = state.chatResponseCounts.get(chatId) || 0;
      if (chatCount >= state.config.MAX_RESPONSES_PER_CHAT) {
        log('Limite de respostas atingido para:', chatId);
        return;
      }
      
      unreadChats.push({
        element: item,
        chatId: chatId,
        unreadCount: getUnreadCount(item),
        isGroup: isGroupChat(item),
        timestamp: Date.now()
      });
      
    } catch (e) {
      logError('Erro ao processar item:', e);
    }
  }

  // ============================================================
  // NAVEGAÇÃO E INTERAÇÃO COM CHAT
  // ============================================================

  async function openChat(chatInfo) {
    log('Abrindo chat:', chatInfo.chatId);
    
    try {
      // Clica no chat
      const clickTarget = chatInfo.element.querySelector('[role="listitem"]') || 
                          chatInfo.element.querySelector('[role="row"]') ||
                          chatInfo.element;
      
      clickTarget.click();
      
      // Aguarda o chat carregar
      await sleep(state.config.DELAY_CHAT_LOAD);
      
      // Verifica se o chat abriu
      const conversationPanel = document.querySelector(SELECTORS.CONVERSATION_PANEL);
      if (!conversationPanel) {
        throw new Error('Painel de conversa não encontrado');
      }
      
      // Aguarda mensagens carregarem
      await waitForMessages();
      
      state.currentChatId = chatInfo.chatId;
      log('Chat aberto com sucesso:', chatInfo.chatId);
      return true;
      
    } catch (e) {
      logError('Erro ao abrir chat:', e);
      return false;
    }
  }

  async function waitForMessages(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const messageList = document.querySelector(SELECTORS.MESSAGE_LIST);
      if (messageList && messageList.children.length > 0) {
        return true;
      }
      await sleep(200);
    }
    
    return false;
  }

  function getLastIncomingMessage() {
    try {
      const messages = document.querySelectorAll('[data-testid="msg-container"]');
      
      // Percorre de trás para frente para encontrar última mensagem recebida
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        
        // Verifica se é mensagem recebida (não enviada por mim)
        const isOutgoing = msg.closest('[data-testid*="out"]') || 
                           msg.querySelector('[data-testid="msg-dblcheck"]') ||
                           msg.querySelector('[data-testid="msg-check"]');
        
        if (!isOutgoing) {
          // Extrai texto da mensagem - SELETORES CORRETOS
          const textEl = msg.querySelector('.selectable-text[data-testid]') ||
                         msg.querySelector('.selectable-text') ||
                         msg.querySelector('span.selectable-text') ||
                         msg.querySelector('.copyable-text span') ||
                         msg.querySelector('span[dir="ltr"]');
          
          if (textEl) {
            const text = textEl.textContent || textEl.innerText || '';
            if (text.trim()) {
              log('📨 Mensagem encontrada:', text.substring(0, 50) + '...');
              return {
                text: text.trim(),
                element: msg,
                timestamp: Date.now()
              };
            }
          }
        }
      }
      
      // Fallback: pega qualquer última mensagem visível
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        const textEl = lastMsg.querySelector('.selectable-text, span[dir="ltr"], .copyable-text span');
        if (textEl) {
          const text = textEl.textContent || textEl.innerText || '';
          if (text.trim()) {
            return {
              text: text.trim(),
              element: lastMsg,
              timestamp: Date.now()
            };
          }
        }
      }
      
      return null;
    } catch (e) {
      logError('Erro ao obter última mensagem:', e);
      return null;
    }
  }

  function getAllMessages() {
    const messages = [];
    
    try {
      const msgContainers = document.querySelectorAll('[data-testid="msg-container"]');
      
      msgContainers.forEach(container => {
        const textEl = container.querySelector('.selectable-text, span[dir="ltr"]');
        if (!textEl) return;
        
        const isOutgoing = container.closest('[data-testid*="out"]') ||
                           container.querySelector('[data-testid="msg-dblcheck"]');
        
        messages.push({
          text: textEl.textContent || textEl.innerText,
          fromMe: !!isOutgoing,
          timestamp: Date.now()
        });
      });
      
    } catch (e) {
      logError('Erro ao obter mensagens:', e);
    }
    
    return messages;
  }

  // ============================================================
  // GERAÇÃO DE RESPOSTA COM IA
  // ============================================================

  async function generateAIResponse(chatId, lastMessage, allMessages) {
    log('🧠 Gerando resposta IA para:', chatId);
    log('📨 Mensagem:', lastMessage.text?.substring(0, 50) + '...');
    
    try {
      // IMPORTANTE: Analisar sentimento antes de gerar resposta
      let sentimentContext = null;
      
      if (window.CopilotEngine && window.CopilotEngine.analyzeSentiment) {
        const sentiment = window.CopilotEngine.analyzeSentiment(lastMessage.text);
        sentimentContext = sentiment;
        
        if (sentiment.isHostile || sentiment.label === 'hostile') {
          log('⚠️ Mensagem hostil detectada! Ajustando resposta...');
          lastMessage.hostile = true;
          lastMessage.sentimentAdvice = 'Responda de forma profissional e calma, sem reagir aos insultos.';
        }
      }
      
      // PRIORIDADE 1: BackendClient (usa GROQ configurado no .env)
      if (window.BackendClient && window.BackendClient.isConnected && window.BackendClient.isConnected()) {
        log('🔗 Tentando BackendClient (GROQ)...');
        const suggestion = await tryBackendClient(chatId, lastMessage, allMessages);
        if (suggestion) {
          suggestion.sentiment = sentimentContext;
          log('✅ BackendClient retornou resposta');
          return suggestion;
        }
      }
      
      // PRIORIDADE 2: AIService (providers locais)
      if (window.AIService) {
        log('🤖 Tentando AIService...');
        const suggestion = await tryAIService(chatId, lastMessage, allMessages);
        if (suggestion) {
          suggestion.sentiment = sentimentContext;
          log('✅ AIService retornou resposta');
          return suggestion;
        }
      }
      
      // PRIORIDADE 3: CopilotEngine
      if (window.CopilotEngine && window.CopilotEngine.generateResponse) {
        try {
          log('🎯 Tentando CopilotEngine...');
          const analysis = await window.CopilotEngine.analyzeMessage(lastMessage.text, chatId);
          const result = await window.CopilotEngine.generateResponse(chatId, analysis);
          if (result && result.content) {
            log('✅ CopilotEngine retornou resposta');
            return { text: result.content, source: 'CopilotEngine', confidence: result.confidence || 0.9, sentiment: sentimentContext };
          }
        } catch (e) {
          log('CopilotEngine falhou:', e.message);
        }
      }
      
      // PRIORIDADE 4: SmartBot
      if (window.smartBot) {
        log('🤖 Tentando SmartBot...');
        const suggestion = await trySmartBot(chatId, lastMessage, allMessages);
        if (suggestion) {
          suggestion.sentiment = sentimentContext;
          log('✅ SmartBot retornou resposta');
          return suggestion;
        }
      }
      
      // PRIORIDADE 5: SmartReplies
      if (window.SmartRepliesModule) {
        log('💬 Tentando SmartReplies...');
        const suggestion = await trySmartReplies(chatId, lastMessage, allMessages);
        if (suggestion) {
          suggestion.sentiment = sentimentContext;
          log('✅ SmartReplies retornou resposta');
          return suggestion;
        }
      }
      
      // PRIORIDADE 6: SmartBotAIPlus (cache)
      if (window.smartBotAIPlus) {
        log('📦 Tentando SmartBotAIPlus (cache)...');
        const suggestion = await trySmartBotAIPlus(chatId, lastMessage, allMessages);
        if (suggestion) {
          log('✅ SmartBotAIPlus retornou resposta');
          return suggestion;
        }
      }
      
      logError('❌ Nenhum serviço de IA disponível ou todos falharam');
      return null;
      
    } catch (e) {
      logError('Erro ao gerar resposta:', e);
      return null;
    }
  }

  async function trySmartReplies(chatId, lastMessage, allMessages) {
    try {
      const module = window.SmartRepliesModule;
      
      // Verifica se está configurado
      if (!module.isConfigured || !module.isConfigured()) {
        log('SmartReplies não configurado');
        return null;
      }
      
      // Gera sugestão
      if (module.generateSuggestion) {
        const result = await module.generateSuggestion(lastMessage.text, allMessages);
        if (result && result.text) {
          return { text: result.text, source: 'SmartReplies', confidence: result.confidence || 0.8 };
        }
      }
      
      // Tenta método alternativo
      if (module.getSuggestions) {
        const suggestions = await module.getSuggestions(lastMessage.text);
        if (suggestions && suggestions.length > 0) {
          return { text: suggestions[0].text || suggestions[0], source: 'SmartReplies', confidence: 0.7 };
        }
      }
      
      return null;
    } catch (e) {
      log('Erro no SmartReplies:', e.message);
      return null;
    }
  }

  async function trySmartBot(chatId, lastMessage, allMessages) {
    try {
      const bot = window.smartBot;
      
      if (bot.generateResponse) {
        const result = await bot.generateResponse(chatId, lastMessage.text, allMessages);
        if (result && result.text) {
          return { text: result.text, source: 'SmartBot', confidence: result.confidence || 0.8 };
        }
      }
      
      if (bot.analyzeAndSuggest) {
        const result = await bot.analyzeAndSuggest(chatId, lastMessage.text, allMessages);
        if (result && result.suggestions && result.suggestions.length > 0) {
          return { text: result.suggestions[0].text, source: 'SmartBot', confidence: result.suggestions[0].confidence || 0.7 };
        }
      }
      
      return null;
    } catch (e) {
      log('Erro no SmartBot:', e.message);
      return null;
    }
  }

  async function trySmartBotAIPlus(chatId, lastMessage, allMessages) {
    try {
      const aiPlus = window.smartBotAIPlus;
      
      // Verifica cache primeiro
      if (aiPlus.responseCache) {
        const cached = aiPlus.responseCache.get(lastMessage.text);
        if (cached) {
          return { text: cached.response, source: 'SmartBotAIPlus (cache)', confidence: 0.9 };
        }
      }
      
      // Processa mensagem
      if (aiPlus.processMessage) {
        const result = await aiPlus.processMessage(chatId, { text: lastMessage.text }, { messages: allMessages });
        
        if (result.cachedResponse) {
          return { text: result.cachedResponse.response, source: 'SmartBotAIPlus', confidence: 0.85 };
        }
      }
      
      return null;
    } catch (e) {
      log('Erro no SmartBotAIPlus:', e.message);
      return null;
    }
  }

  async function tryAIService(chatId, lastMessage, allMessages) {
    try {
      const service = window.AIService;
      
      if (!service) {
        log('AIService não disponível');
        return null;
      }
      
      // Verifica se há provider configurado
      const providers = service.getConfiguredProviders ? service.getConfiguredProviders() : [];
      const isConnected = window.BackendClient && window.BackendClient.isConnected();
      
      if (providers.length === 0 && !isConnected) {
        log('Nenhum provider de IA configurado e backend não conectado');
        return null;
      }
      
      // Prepara mensagens no formato correto
      const messages = [
        {
          role: 'system',
          content: `Você é um assistente profissional de atendimento ao cliente.
REGRAS OBRIGATÓRIAS:
- Responda SEMPRE de forma direta e útil
- NUNCA diga "não entendi" ou peça mais detalhes
- Mantenha resposta CURTA: máximo 2-3 frases
- Responda em português brasileiro
- Seja proativo e ofereça soluções`
        }
      ];
      
      // Adiciona histórico (últimas 5 mensagens)
      const recentMessages = allMessages.slice(-5);
      for (const m of recentMessages) {
        messages.push({
          role: m.fromMe ? 'assistant' : 'user',
          content: m.text || m.body || ''
        });
      }
      
      // Garante que a última mensagem está incluída
      if (!recentMessages.find(m => m.text === lastMessage.text)) {
        messages.push({
          role: 'user',
          content: lastMessage.text
        });
      }
      
      log('Chamando AIService.complete com', messages.length, 'mensagens');
      
      const result = await service.complete(messages, {
        temperature: 0.7,
        maxTokens: 300
      });
      
      if (result && (result.content || result.text)) {
        const responseText = result.content || result.text;
        log('✅ AIService retornou:', responseText.substring(0, 50) + '...');
        return { text: responseText, source: 'AIService/' + (result.provider || 'unknown'), confidence: 0.85 };
      }
      
      return null;
    } catch (e) {
      log('Erro no AIService:', e.message);
      return null;
    }
  }

  async function tryBackendClient(chatId, lastMessage, allMessages) {
    try {
      const client = window.BackendClient;
      
      if (!client || !client.isConnected || !client.isConnected()) {
        log('BackendClient não conectado');
        return null;
      }
      
      // Prepara mensagens
      const messages = [
        {
          role: 'system',
          content: `Você é um assistente profissional de atendimento ao cliente.
REGRAS: Responda diretamente, máximo 2-3 frases, português brasileiro.`
        }
      ];
      
      // Adiciona histórico
      for (const m of allMessages.slice(-5)) {
        messages.push({
          role: m.fromMe ? 'assistant' : 'user',
          content: m.text || m.body || ''
        });
      }
      
      // Adiciona mensagem atual se não estiver no histórico
      if (!allMessages.slice(-5).find(m => m.text === lastMessage.text)) {
        messages.push({
          role: 'user',
          content: lastMessage.text
        });
      }
      
      log('Chamando BackendClient.ai.complete...');
      
      // Usa o método ai.complete do BackendClient
      if (client.ai && client.ai.complete) {
        const result = await client.ai.complete(messages, {
          temperature: 0.7,
          maxTokens: 300
        });
        
        if (result && (result.content || result.text || result.response)) {
          const responseText = result.content || result.text || result.response;
          log('✅ Backend retornou:', responseText.substring(0, 50) + '...');
          return { text: responseText, source: 'Backend/GROQ', confidence: 0.9 };
        }
      }
      
      return null;
    } catch (e) {
      log('Erro no BackendClient:', e.message);
      return null;
    }
  }

  // ============================================================
  // ENVIO DE MENSAGEM
  // ============================================================

  async function sendMessage(text) {
    log('Enviando mensagem:', text.substring(0, 50) + '...');
    
    try {
      // Encontra campo de texto
      let inputField = document.querySelector(SELECTORS.TEXT_INPUT);
      if (!inputField) {
        inputField = document.querySelector(SELECTORS.TEXT_INPUT_ALT);
      }
      
      if (!inputField) {
        throw new Error('Campo de texto não encontrado');
      }
      
      // Foca no campo
      inputField.focus();
      await sleep(100);
      
      // Limpa conteúdo anterior
      inputField.innerHTML = '';
      
      // Simula digitação
      await simulateTyping(inputField, text);
      
      // Aguarda um pouco antes de enviar
      await sleep(state.config.DELAY_BEFORE_SEND);
      
      // Encontra botão de enviar
      let sendButton = document.querySelector(SELECTORS.SEND_BUTTON);
      if (!sendButton) {
        sendButton = document.querySelector(SELECTORS.SEND_BUTTON_ALT);
      }
      
      if (sendButton) {
        sendButton.click();
      } else {
        // Fallback: pressiona Enter
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }
      
      // Aguarda após enviar
      await sleep(state.config.DELAY_AFTER_SEND);
      
      log('Mensagem enviada com sucesso');
      return true;
      
    } catch (e) {
      logError('Erro ao enviar mensagem:', e);
      return false;
    }
  }

  async function simulateTyping(inputField, text) {
    // v7.5.0: Usar módulo HumanTyping se disponível
    if (window.HumanTyping && typeof window.HumanTyping.type === 'function') {
      try {
        console.log('[Autopilot] Usando HumanTyping para digitação natural');
        await window.HumanTyping.type(inputField, text, { minDelay: 25, maxDelay: 65 });
        return;
      } catch (e) {
        console.warn('[Autopilot] HumanTyping falhou, usando fallback:', e.message);
      }
    }
    
    // Fallback original
    // Método 1: Inserção direta com eventos
    try {
      inputField.innerHTML = '';
      inputField.focus();
      
      // Dispara evento de input para atualizar estado do WhatsApp
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      inputField.dispatchEvent(pasteEvent);
      
      // Se não funcionou, tenta inserção direta
      if (!inputField.textContent || inputField.textContent.length === 0) {
        inputField.textContent = text;
        inputField.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      
      await sleep(state.config.DELAY_TYPING_SIMULATION);
      
    } catch (e) {
      // Fallback: inserção simples
      inputField.textContent = text;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ============================================================
  // LOOP PRINCIPAL DO AUTO-PILOT
  // ============================================================

  async function processNextChat() {
    if (!state.isRunning || state.isPaused || state.isProcessing) {
      return;
    }
    
    // Verificações de segurança
    if (!isWithinWorkingHours()) {
      log('Fora do horário de funcionamento');
      return;
    }
    
    if (!canSendMoreResponses()) {
      log('Limite de respostas por hora atingido');
      pause();
      emitEvent('limitReached', { type: 'hourly', limit: state.config.MAX_RESPONSES_PER_HOUR });
      return;
    }
    
    if (state.consecutiveErrors >= state.config.MAX_CONSECUTIVE_ERRORS) {
      log('Muitos erros consecutivos, pausando...');
      pause();
      emitEvent('errorLimit', { errors: state.consecutiveErrors });
      return;
    }
    
    state.isProcessing = true;
    
    try {
      // Escaneia chats não lidos
      const unreadChats = scanUnreadChats();
      
      if (unreadChats.length === 0) {
        log('Nenhum chat não lido encontrado');
        state.isProcessing = false;
        return;
      }
      
      log(`Encontrados ${unreadChats.length} chats não lidos`);
      
      // Processa o primeiro chat da fila
      const chatInfo = unreadChats[0];
      
      // Abre o chat
      const opened = await openChat(chatInfo);
      if (!opened) {
        throw new Error('Falha ao abrir chat');
      }
      
      // Obtém última mensagem
      const lastMessage = getLastIncomingMessage();
      if (!lastMessage) {
        log('Nenhuma mensagem encontrada no chat');
        state.skippedChats.add(chatInfo.chatId);
        state.stats.totalSkipped++;
        state.isProcessing = false;
        return;
      }
      
      // Obtém todas as mensagens para contexto
      const allMessages = getAllMessages();
      
      // Gera resposta com IA
      const response = await generateAIResponse(chatInfo.chatId, lastMessage, allMessages);
      
      if (!response || !response.text) {
        log('Não foi possível gerar resposta');
        state.skippedChats.add(chatInfo.chatId);
        state.stats.totalSkipped++;
        state.isProcessing = false;
        return;
      }
      
      log('Resposta gerada:', response.text.substring(0, 50) + '...', '- Fonte:', response.source);
      
      // Envia a resposta
      const sent = await sendMessage(response.text);
      
      if (sent) {
        // Atualiza estatísticas
        state.stats.totalProcessed++;
        state.stats.totalSent++;
        state.stats.responsesThisHour++;
        state.stats.lastActivityTime = Date.now();
        state.consecutiveErrors = 0;
        
        // Marca como processado
        state.processedChats.add(chatInfo.chatId);
        
        // Incrementa contador do chat
        const chatCount = state.chatResponseCounts.get(chatInfo.chatId) || 0;
        state.chatResponseCounts.set(chatInfo.chatId, chatCount + 1);
        
        // Emite evento
        emitEvent('messageSent', {
          chatId: chatInfo.chatId,
          message: response.text,
          source: response.source
        });
        
        // Atualiza UI
        updateUI();
        
        log('✅ Chat processado com sucesso:', chatInfo.chatId);
        
      } else {
        throw new Error('Falha ao enviar mensagem');
      }
      
      // Delay entre chats
      await sleep(randomDelay(state.config.DELAY_BETWEEN_CHATS));
      
    } catch (e) {
      logError('Erro no processamento:', e);
      state.stats.totalErrors++;
      state.consecutiveErrors++;
      emitEvent('error', { error: e.message });
    }
    
    state.isProcessing = false;
  }

  // ============================================================
  // CONTROLES: START, PAUSE, RESUME, STOP
  // ============================================================

  function start(options = {}) {
    if (state.isRunning) {
      log('Auto-Pilot já está rodando');
      return false;
    }
    
    log('🚀 Iniciando Auto-Pilot...');
    
    // Aplica opções
    if (options.config) {
      state.config = { ...state.config, ...options.config };
    }
    
    // Reseta estado
    state.isRunning = true;
    state.isPaused = false;
    state.stats.startTime = Date.now();
    state.consecutiveErrors = 0;
    
    // Limpa chats processados (opcional)
    if (options.clearProcessed) {
      state.processedChats.clear();
      state.skippedChats.clear();
    }
    
    // Inicia loop de verificação
    state.checkInterval = setInterval(() => {
      if (state.isRunning && !state.isPaused) {
        processNextChat();
      }
    }, state.config.DELAY_BETWEEN_CHATS + 1000);
    
    // Processa imediatamente
    processNextChat();
    
    // Inicia observer da lista de chats
    startChatListObserver();
    
    // Atualiza UI
    updateUI();
    
    emitEvent('started', { config: state.config });
    
    log('✅ Auto-Pilot iniciado');
    return true;
  }

  function pause() {
    if (!state.isRunning) {
      log('Auto-Pilot não está rodando');
      return false;
    }
    
    log('⏸️ Pausando Auto-Pilot...');
    state.isPaused = true;
    
    updateUI();
    emitEvent('paused', { stats: getStats() });
    
    return true;
  }

  function resume() {
    if (!state.isRunning) {
      log('Auto-Pilot não está rodando');
      return false;
    }
    
    if (!state.isPaused) {
      log('Auto-Pilot não está pausado');
      return false;
    }
    
    log('▶️ Retomando Auto-Pilot...');
    state.isPaused = false;
    state.consecutiveErrors = 0;
    
    // Processa imediatamente
    processNextChat();
    
    updateUI();
    emitEvent('resumed', { stats: getStats() });
    
    return true;
  }

  function stop() {
    if (!state.isRunning) {
      log('Auto-Pilot não está rodando');
      return false;
    }
    
    log('🛑 Parando Auto-Pilot...');
    
    state.isRunning = false;
    state.isPaused = false;
    state.isProcessing = false;
    
    // Para intervalo de verificação
    if (state.checkInterval) {
      clearInterval(state.checkInterval);
      state.checkInterval = null;
    }
    
    // Para observer
    stopChatListObserver();
    
    updateUI();
    emitEvent('stopped', { stats: getStats() });
    
    log('✅ Auto-Pilot parado');
    return true;
  }

  function toggle() {
    if (!state.isRunning) {
      return start();
    } else if (state.isPaused) {
      return resume();
    } else {
      return pause();
    }
  }

  // ============================================================
  // OBSERVER DA LISTA DE CHATS
  // ============================================================

  function startChatListObserver() {
    stopChatListObserver();
    
    const chatList = document.querySelector(SELECTORS.CHAT_LIST);
    if (!chatList) {
      log('Lista de chats não encontrada para observer');
      return;
    }
    
    state.chatListObserver = new MutationObserver((mutations) => {
      // Detecta novos chats não lidos
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // Agenda verificação (debounced)
          clearTimeout(state.scanTimeout);
          state.scanTimeout = setTimeout(() => {
            if (state.isRunning && !state.isPaused && !state.isProcessing) {
              log('Detectada mudança na lista de chats');
              // O processamento será feito pelo intervalo principal
            }
          }, 1000);
        }
      }
    });
    
    state.chatListObserver.observe(chatList, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'data-testid']
    });
    
    log('Observer da lista de chats iniciado');
  }

  function stopChatListObserver() {
    if (state.chatListObserver) {
      state.chatListObserver.disconnect();
      state.chatListObserver = null;
    }
  }

  // ============================================================
  // UI DO PAINEL DE CONTROLE
  // ============================================================

  function createControlPanel() {
    // DISABLED per v7.6.0 requirements - Autopilot functionality moved to dedicated tab only
    // Floating autopilot block has been removed as per problem statement:
    // "All autopilot functionality should be exclusively in the Autopilot tab"
    console.log('[SmartBot Autopilot] Control panel creation disabled - use dedicated Autopilot tab');
    return null;
    
    /* DISABLED CODE - Floating autopilot panel
    // Remove painel existente
    const existing = document.getElementById('autopilot-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'autopilot-panel';
    panel.innerHTML = `
      <style>
        #autopilot-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 340px;
          background: linear-gradient(135deg, #1a1a2e 0%, #1a1a2e 100%);
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(102,126,234,0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 99999;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.3s ease;
        }
        
        #autopilot-panel.ap-hidden {
          transform: translateX(400px);
          opacity: 0;
          pointer-events: none;
        }
        
        #autopilot-panel * {
          box-sizing: border-box;
        }
        
        .ap-header {
          background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: move;
        }
        
        .ap-title {
          color: white;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .ap-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .ap-status {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .ap-status.running {
          background: #10b981;
          color: white;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .ap-status.paused {
          background: #f59e0b;
          color: white;
        }
        
        .ap-status.stopped {
          background: #6b7280;
          color: white;
        }
        
        .ap-body {
          padding: 16px;
        }
        
        .ap-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .ap-stat {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
          padding: 10px 6px;
          text-align: center;
          transition: all 0.2s;
        }
        
        .ap-stat:hover {
          background: rgba(255,255,255,0.1);
        }
        
        .ap-stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #8B5CF6;
        }
        
        .ap-stat-label {
          font-size: 9px;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }
        
        .ap-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .ap-btn {
          flex: 1;
          padding: 12px 8px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        
        .ap-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .ap-btn:active {
          transform: translateY(0);
        }
        
        .ap-btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .ap-btn-warning {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }
        
        .ap-btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        
        .ap-btn-secondary {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        
        .ap-btn-secondary:hover {
          background: rgba(255,255,255,0.15);
        }
        
        .ap-info {
          padding: 10px 12px;
          background: rgba(102, 126, 234, 0.15);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.8);
          border-left: 3px solid #8B5CF6;
        }
        
        .ap-header-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          font-size: 12px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .ap-header-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .ap-minimized .ap-body {
          display: none;
        }
        
        .ap-progress {
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          margin-bottom: 14px;
          overflow: hidden;
        }
        
        .ap-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #8B5CF6, #3B82F6, #8B5CF6);
          background-size: 200% 100%;
          border-radius: 3px;
          transition: width 0.3s;
          animation: shimmer 2s infinite linear;
        }
        
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .ap-toggle-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(102,126,234,0.4);
          z-index: 99998;
          display: none;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }
        
        .ap-toggle-btn:hover {
          transform: scale(1.1);
        }
        
        .ap-toggle-btn.visible {
          display: flex;
        }
        
        .ap-config-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        .ap-config-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .ap-config-label {
          font-size: 11px;
          color: rgba(255,255,255,0.7);
        }
        
        .ap-config-toggle {
          position: relative;
          width: 40px;
          height: 22px;
          background: rgba(255,255,255,0.2);
          border-radius: 11px;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .ap-config-toggle.active {
          background: #10b981;
        }
        
        .ap-config-toggle::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s;
        }
        
        .ap-config-toggle.active::after {
          left: 21px;
        }
      </style>
      
      <div class="ap-header">
        <div class="ap-title">
          <span>🤖</span>
          <span>Auto-Pilot</span>
        </div>
        <div class="ap-header-actions">
          <span class="ap-status stopped" id="ap-status">PARADO</span>
          <button class="ap-header-btn" id="ap-minimize" title="Minimizar">➖</button>
          <button class="ap-header-btn" id="ap-close" title="Fechar">✕</button>
        </div>
      </div>
      
      <div class="ap-body">
        <div class="ap-progress">
          <div class="ap-progress-bar" id="ap-progress" style="width: 0%"></div>
        </div>
        
        <div class="ap-stats">
          <div class="ap-stat">
            <div class="ap-stat-value" id="ap-sent">0</div>
            <div class="ap-stat-label">Enviadas</div>
          </div>
          <div class="ap-stat">
            <div class="ap-stat-value" id="ap-pending">0</div>
            <div class="ap-stat-label">Pendentes</div>
          </div>
          <div class="ap-stat">
            <div class="ap-stat-value" id="ap-skipped">0</div>
            <div class="ap-stat-label">Puladas</div>
          </div>
          <div class="ap-stat">
            <div class="ap-stat-value" id="ap-errors">0</div>
            <div class="ap-stat-label">Erros</div>
          </div>
        </div>
        
        <div class="ap-controls">
          <button class="ap-btn ap-btn-success" id="ap-start">
            ▶️ Iniciar
          </button>
          <button class="ap-btn ap-btn-warning" id="ap-pause" style="display: none;">
            ⏸️ Pausar
          </button>
          <button class="ap-btn ap-btn-success" id="ap-resume" style="display: none;">
            ▶️ Continuar
          </button>
          <button class="ap-btn ap-btn-danger" id="ap-stop" style="display: none;">
            ⏹️ Parar
          </button>
        </div>
        
        <div class="ap-info" id="ap-info">
          💡 Pronto para iniciar. O Auto-Pilot responderá automaticamente às mensagens não lidas.
        </div>
        
        <div class="ap-config-section">
          <div class="ap-config-row">
            <span class="ap-config-label">Pular grupos</span>
            <div class="ap-config-toggle active" id="ap-toggle-groups" title="Ativado"></div>
          </div>
          <div class="ap-config-row">
            <span class="ap-config-label">Limite: 30/hora</span>
            <div class="ap-config-toggle active" id="ap-toggle-limit" title="Ativado"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // Botão flutuante para reabrir
    let toggleBtn = document.getElementById('ap-toggle-btn');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'ap-toggle-btn';
      toggleBtn.className = 'ap-toggle-btn';
      toggleBtn.innerHTML = '🤖';
      toggleBtn.title = 'Abrir Auto-Pilot';
      document.body.appendChild(toggleBtn);
      
      toggleBtn.addEventListener('click', () => {
        panel.classList.remove('ap-hidden');
        toggleBtn.classList.remove('visible');
      });
    }
    
    // Event listeners - Botões principais
    document.getElementById('ap-start').addEventListener('click', () => {
      start();
    });
    
    document.getElementById('ap-pause').addEventListener('click', () => {
      pause();
    });
    
    document.getElementById('ap-resume').addEventListener('click', () => {
      resume();
    });
    
    document.getElementById('ap-stop').addEventListener('click', () => {
      stop();
    });
    
    // Minimizar
    document.getElementById('ap-minimize').addEventListener('click', () => {
      panel.classList.toggle('ap-minimized');
    });
    
    // Fechar (esconde o painel)
    document.getElementById('ap-close').addEventListener('click', () => {
      panel.classList.add('ap-hidden');
      toggleBtn.classList.add('visible');
    });
    
    // Toggle de configurações
    document.getElementById('ap-toggle-groups').addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      state.config.SKIP_GROUPS = e.target.classList.contains('active');
      log('Pular grupos:', state.config.SKIP_GROUPS);
    });
    
    document.getElementById('ap-toggle-limit').addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      if (e.target.classList.contains('active')) {
        state.config.MAX_RESPONSES_PER_HOUR = 30;
      } else {
        state.config.MAX_RESPONSES_PER_HOUR = 999;
      }
      log('Limite por hora:', state.config.MAX_RESPONSES_PER_HOUR);
    });
    
    log('Painel de controle criado');
  }

  function updateUI() {
    const statusEl = document.getElementById('ap-status');
    const startBtn = document.getElementById('ap-start');
    const pauseBtn = document.getElementById('ap-pause');
    const resumeBtn = document.getElementById('ap-resume');
    const stopBtn = document.getElementById('ap-stop');
    const infoEl = document.getElementById('ap-info');
    const progressEl = document.getElementById('ap-progress');
    
    if (!statusEl) return;
    
    // Atualiza status e botões baseado no estado
    if (!state.isRunning) {
      // PARADO
      statusEl.textContent = 'PARADO';
      statusEl.className = 'ap-status stopped';
      startBtn.style.display = '';
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      infoEl.innerHTML = '💡 Pronto para iniciar. O Auto-Pilot responderá automaticamente às mensagens não lidas.';
      if (progressEl) progressEl.style.width = '0%';
      
    } else if (state.isPaused) {
      // PAUSADO
      statusEl.textContent = 'PAUSADO';
      statusEl.className = 'ap-status paused';
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = '';
      stopBtn.style.display = '';
      infoEl.innerHTML = '⏸️ Pausado. Clique em <strong>Continuar</strong> para retomar ou <strong>Parar</strong> para encerrar.';
      
    } else {
      // ATIVO
      statusEl.textContent = 'ATIVO';
      statusEl.className = 'ap-status running';
      startBtn.style.display = 'none';
      pauseBtn.style.display = '';
      resumeBtn.style.display = 'none';
      stopBtn.style.display = '';
      
      const hourlyProgress = (state.stats.responsesThisHour / state.config.MAX_RESPONSES_PER_HOUR) * 100;
      if (progressEl) progressEl.style.width = `${Math.min(hourlyProgress, 100)}%`;
      
      const pending = scanUnreadChats().length;
      if (pending > 0) {
        infoEl.innerHTML = `🔄 Processando... <strong>${pending}</strong> chat(s) na fila. (${state.stats.responsesThisHour}/${state.config.MAX_RESPONSES_PER_HOUR} esta hora)`;
      } else {
        infoEl.innerHTML = `✅ Aguardando novas mensagens... (${state.stats.responsesThisHour}/${state.config.MAX_RESPONSES_PER_HOUR} esta hora)`;
      }
    }
    
    // Atualiza estatísticas
    const sentEl = document.getElementById('ap-sent');
    const pendingEl = document.getElementById('ap-pending');
    const skippedEl = document.getElementById('ap-skipped');
    const errorsEl = document.getElementById('ap-errors');
    
    if (sentEl) sentEl.textContent = state.stats.totalSent;
    if (pendingEl) pendingEl.textContent = scanUnreadChats().length;
    if (skippedEl) skippedEl.textContent = state.stats.totalSkipped;
    if (errorsEl) errorsEl.textContent = state.stats.totalErrors;
  }

  // ============================================================
  // EVENTOS
  // ============================================================

  function emitEvent(eventName, data = {}) {
    const event = new CustomEvent(`autopilot:${eventName}`, {
      detail: { ...data, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
    
    // Também emite no EventBus se disponível
    if (window.EventBus && window.EventBus.emit) {
      window.EventBus.emit(`autopilot:${eventName}`, { ...data, timestamp: Date.now() });
    }
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================

  function getStats() {
    const runtime = state.stats.startTime ? 
      Math.floor((Date.now() - state.stats.startTime) / 1000) : 0;
    
    return {
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      isProcessing: state.isProcessing,
      runtime,
      runtimeFormatted: formatRuntime(runtime),
      ...state.stats,
      processedChats: state.processedChats.size,
      skippedChats: state.skippedChats.size,
      pendingChats: scanUnreadChats().length,
      config: state.config
    };
  }

  function formatRuntime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  function setConfig(newConfig) {
    state.config = { ...state.config, ...newConfig };
    log('Configuração atualizada:', newConfig);
    return state.config;
  }

  function addToBlacklist(chatId) {
    state.blacklist.add(chatId);
    log('Adicionado à blacklist:', chatId);
  }

  function removeFromBlacklist(chatId) {
    state.blacklist.delete(chatId);
    log('Removido da blacklist:', chatId);
  }

  function addToWhitelist(chatId) {
    state.whitelist.add(chatId);
    log('Adicionado à whitelist:', chatId);
  }

  function removeFromWhitelist(chatId) {
    state.whitelist.delete(chatId);
    log('Removido da whitelist:', chatId);
  }

  function setWhitelistMode(enabled) {
    state.useWhitelist = enabled;
    log('Modo whitelist:', enabled ? 'ativado' : 'desativado');
  }

  function resetStats() {
    state.stats = {
      totalProcessed: 0,
      totalSent: 0,
      totalSkipped: 0,
      totalErrors: 0,
      startTime: null,
      lastActivityTime: null,
      responsesThisHour: 0,
      hourStartTime: null
    };
    state.processedChats.clear();
    state.skippedChats.clear();
    state.chatResponseCounts.clear();
    state.consecutiveErrors = 0;
    log('Estatísticas resetadas');
    updateUI();
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  function init() {
    log('Inicializando Auto-Pilot...');
    
    // Aguarda WhatsApp carregar
    const checkWhatsApp = setInterval(() => {
      const chatList = document.querySelector(SELECTORS.CHAT_LIST);
      if (chatList) {
        clearInterval(checkWhatsApp);
        
        // Cria painel de controle
        createControlPanel();
        
        // Carrega configurações salvas
        loadSavedConfig();
        
        log('✅ Auto-Pilot inicializado');
        emitEvent('initialized');
      }
    }, 1000);
    
    // Timeout de segurança
    setTimeout(() => {
      clearInterval(checkWhatsApp);
    }, 30000);
  }

  function loadSavedConfig() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['autopilot_config'], (result) => {
          if (result.autopilot_config) {
            state.config = { ...CONFIG, ...result.autopilot_config };
            log('Configuração carregada:', state.config);
          }
        });
      }
    } catch (e) {
      log('Erro ao carregar configuração:', e);
    }
  }

  function saveConfig() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ autopilot_config: state.config });
        log('Configuração salva');
      }
    } catch (e) {
      log('Erro ao salvar configuração:', e);
    }
  }

  // ============================================================
  // EXPORTAÇÃO GLOBAL
  // ============================================================

  const AutoPilot = {
    // Controles principais
    start,
    stop,
    pause,
    resume,
    toggle,
    
    // Getters
    getStats,
    getConfig: () => state.config,
    isRunning: () => state.isRunning,
    isPaused: () => state.isPaused,
    
    // Configuração
    setConfig,
    saveConfig,
    
    // Listas
    addToBlacklist,
    removeFromBlacklist,
    addToWhitelist,
    removeFromWhitelist,
    setWhitelistMode,
    getBlacklist: () => Array.from(state.blacklist),
    getWhitelist: () => Array.from(state.whitelist),
    
    // Utilidades
    resetStats,
    scanUnreadChats,
    
    // UI
    showPanel: createControlPanel,
    updateUI,
    
    // Debug
    _state: state,
    _config: CONFIG
  };

  // Exporta globalmente
  window.AutoPilot = AutoPilot;
  window.autoPilot = AutoPilot;

  // Auto-inicializa quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }

  log('Módulo Auto-Pilot carregado');

})();
