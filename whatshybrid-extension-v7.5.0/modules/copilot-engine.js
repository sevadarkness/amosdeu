/**
 * 🤖 CopilotEngine v1.0 - Motor de Copilot Enterprise
 * Sistema inteligente de assistência conversacional
 * 
 * Features:
 * - Context-aware responses
 * - Multi-turn conversations
 * - Intent detection & routing
 * - Sentiment analysis
 * - Entity extraction
 * - Conversation summarization
 * - Auto-suggestions
 * - Learning from feedback
 * - Templates & macros
 * - Response scoring
 * - A/B testing support
 * - Personality profiles
 * - Knowledge base integration
 * - RAG (Retrieval Augmented Generation)
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // v7.5.0 - INTEGRAÇÃO COM HUMAN TYPING
  // ============================================
  async function insertTextWithHumanTyping(element, text) {
    if (window.HumanTyping && typeof window.HumanTyping.type === 'function') {
      try {
        console.log('[CopilotEngine] Usando HumanTyping para digitação natural');
        await window.HumanTyping.type(element, text, { minDelay: 25, maxDelay: 60 });
        return true;
      } catch (e) {
        console.warn('[CopilotEngine] HumanTyping falhou, usando fallback:', e.message);
      }
    }
    
    // Fallback: execCommand
    element.focus();
    await insertTextWithHumanTyping(inputField, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }


  'use strict';

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  const CONFIG = {
    STORAGE_KEY: 'whl_copilot_engine',
    MAX_CONTEXT_MESSAGES: 20,
    MAX_CONTEXT_TOKENS: 8000,
    SUGGESTION_COUNT: 3,
    MIN_CONFIDENCE_SCORE: 0.6,
    AUTO_RESPONSE_DELAY: 2000,
    TYPING_SIMULATION_SPEED: 30, // ms per character
    FEEDBACK_LEARNING_THRESHOLD: 10,
    KNOWLEDGE_BASE_MAX_RESULTS: 5
  };

  // ============================================
  // MODOS DE OPERAÇÃO
  // ============================================
  const MODES = {
    OFF: { id: 'off', name: '🔴 Desativado', description: 'Copilot desativado' },
    PASSIVE: { id: 'passive', name: '👁️ Observador', description: 'Analisa mas não sugere' },
    SUGGEST: { id: 'suggest', name: '💡 Sugestões', description: 'Mostra sugestões de resposta' },
    ASSIST: { id: 'assist', name: '🤝 Assistente', description: 'Ajuda a compor respostas' },
    AUTO_DRAFT: { id: 'auto_draft', name: '📝 Auto-rascunho', description: 'Gera rascunhos automáticos' },
    SEMI_AUTO: { id: 'semi_auto', name: '⚡ Semi-automático', description: 'Envia após aprovação' },
    FULL_AUTO: { id: 'full_auto', name: '🤖 Automático', description: 'Responde automaticamente' }
  };

  // ============================================
  // INTENTS (Intenções detectadas)
  // ============================================
  const INTENTS = {
    GREETING: { id: 'greeting', name: 'Saudação', priority: 1, patterns: ['olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'eae'] },
    FAREWELL: { id: 'farewell', name: 'Despedida', priority: 1, patterns: ['tchau', 'até mais', 'até logo', 'adeus', 'flw', 'falou'] },
    QUESTION: { id: 'question', name: 'Pergunta', priority: 2, patterns: ['?', 'como', 'quando', 'onde', 'qual', 'quanto', 'quem', 'por que'] },
    COMPLAINT: { id: 'complaint', name: 'Reclamação', priority: 3, patterns: ['problema', 'reclamar', 'insatisfeito', 'péssimo', 'horrível', 'não funciona'] },
    HOSTILE: { id: 'hostile', name: 'Hostilidade', priority: 4, patterns: [
      'tomar no cu', 'vai se foder', 'foda-se', 'vai tomar', 'vai pro inferno', 
      'idiota', 'imbecil', 'burro', 'otário', 'babaca', 'cretino',
      'merda', 'bosta', 'porra', 'caralho', 'fdp', 'pqp', 'vsf', 'vtnc',
      'filho da puta', 'desgraça', 'maldito', 'some daqui', 'cala boca'
    ]},
    PURCHASE: { id: 'purchase', name: 'Compra', priority: 2, patterns: ['comprar', 'preço', 'valor', 'quanto custa', 'pagar', 'pix', 'cartão'] },
    SUPPORT: { id: 'support', name: 'Suporte', priority: 2, patterns: ['ajuda', 'suporte', 'problema', 'erro', 'não consigo', 'bug'] },
    INFO: { id: 'info', name: 'Informação', priority: 2, patterns: ['informação', 'saber', 'detalhes', 'sobre', 'mais'] },
    CONFIRMATION: { id: 'confirmation', name: 'Confirmação', priority: 1, patterns: ['ok', 'certo', 'entendi', 'sim', 'pode ser', 'fechado'] },
    NEGATION: { id: 'negation', name: 'Negação', priority: 1, patterns: ['não', 'nao', 'nunca', 'nem', 'negativo'] },
    URGENCY: { id: 'urgency', name: 'Urgência', priority: 3, patterns: ['urgente', 'urgência', 'agora', 'imediato', 'rápido', 'emergência'] },
    SCHEDULE: { id: 'schedule', name: 'Agendamento', priority: 2, patterns: ['agendar', 'marcar', 'horário', 'disponível', 'agenda'] },
    FEEDBACK: { id: 'feedback', name: 'Feedback', priority: 2, patterns: ['obrigado', 'gostei', 'excelente', 'ótimo', 'parabéns', 'top'] }
  };

  // ============================================
  // PERSONAS (Perfis de personalidade)
  // ============================================
  const DEFAULT_PERSONAS = {
    professional: {
      id: 'professional',
      name: '👔 Profissional',
      description: 'Formal, objetivo e educado',
      temperature: 0.5,
      maxTokens: 300,
      systemPrompt: `Você é um assistente profissional de atendimento ao cliente.
Diretrizes:
- Mantenha um tom formal e educado
- Seja objetivo e direto nas respostas
- Use linguagem clara e acessível
- Sempre ofereça ajuda adicional
- Evite gírias e expressões informais
- Responda em português brasileiro`
    },
    friendly: {
      id: 'friendly',
      name: '😊 Amigável',
      description: 'Descontraído e acolhedor',
      temperature: 0.7,
      maxTokens: 350,
      systemPrompt: `Você é um assistente amigável e acolhedor.
Diretrizes:
- Use um tom descontraído mas respeitoso
- Pode usar emojis ocasionalmente (com moderação)
- Seja empático e demonstre compreensão
- Crie conexão com o cliente
- Mantenha a conversa leve mas profissional`
    },
    sales: {
      id: 'sales',
      name: '💼 Vendas',
      description: 'Persuasivo e focado em conversão',
      temperature: 0.7,
      maxTokens: 400,
      systemPrompt: `Você é um vendedor experiente e consultivo.
Diretrizes:
- Destaque benefícios e valor do produto/serviço
- Use técnicas de persuasão éticas
- Identifique necessidades do cliente
- Crie senso de oportunidade (sem pressão excessiva)
- Responda objeções de forma positiva
- Sempre busque fechar a venda ou próximo passo`
    },
    support: {
      id: 'support',
      name: '🛠️ Suporte Técnico',
      description: 'Técnico e solucionador',
      temperature: 0.4,
      maxTokens: 500,
      systemPrompt: `Você é um especialista em suporte técnico.
Diretrizes:
- Forneça soluções claras e passo a passo
- Use linguagem técnica quando necessário, mas explique termos
- Seja paciente e detalhado
- Confirme o entendimento do problema antes de responder
- Sempre verifique se o problema foi resolvido
- Documente casos recorrentes`
    },
    concierge: {
      id: 'concierge',
      name: '🎩 Concierge',
      description: 'Luxo e exclusividade',
      temperature: 0.6,
      maxTokens: 350,
      systemPrompt: `Você é um concierge de alto padrão.
Diretrizes:
- Trate cada cliente como VIP
- Use linguagem sofisticada e elegante
- Antecipe necessidades
- Ofereça soluções personalizadas
- Demonstre conhecimento exclusivo
- Mantenha discrição e profissionalismo`
    },
    coach: {
      id: 'coach',
      name: '🏆 Coach',
      description: 'Motivador e orientador',
      temperature: 0.7,
      maxTokens: 400,
      systemPrompt: `Você é um coach motivacional e orientador.
Diretrizes:
- Inspire e motive o cliente
- Faça perguntas poderosas
- Ajude a identificar objetivos
- Celebre conquistas
- Ofereça perspectivas diferentes
- Encoraje ação e comprometimento`
    }
  };

  // ============================================
  // KNOWLEDGE BASE (Base de conhecimento)
  // ============================================
  const DEFAULT_KNOWLEDGE_BASE = {
    faqs: [
      { q: 'Qual o horário de atendimento?', a: 'Nosso atendimento funciona de segunda a sexta, das 9h às 18h.', tags: ['horário', 'atendimento'] },
      { q: 'Como faço para cancelar?', a: 'Para cancelar, acesse sua conta ou entre em contato conosco.', tags: ['cancelar', 'cancelamento'] },
      { q: 'Quais formas de pagamento?', a: 'Aceitamos PIX, cartão de crédito (até 12x) e boleto.', tags: ['pagamento', 'pix', 'cartão'] },
      { q: 'Qual o prazo de entrega?', a: 'O prazo de entrega varia de 3 a 10 dias úteis dependendo da região.', tags: ['prazo', 'entrega'] }
    ],
    products: [],
    policies: [],
    custom: []
  };

  // ============================================
  // TEMPLATES DE RESPOSTA
  // ============================================
  const RESPONSE_TEMPLATES = {
    greeting: [
      'Olá! Como posso ajudar você hoje?',
      'Oi! Tudo bem? Em que posso ajudar?',
      'Olá! Seja bem-vindo(a)! Como posso ajudar?'
    ],
    farewell: [
      'Foi um prazer atendê-lo(a)! Tenha um ótimo dia! 😊',
      'Obrigado pelo contato! Estamos à disposição.',
      'Até mais! Se precisar, é só chamar!'
    ],
    wait: [
      'Um momento, por favor. Estou verificando...',
      'Deixa eu conferir isso para você...',
      'Aguarde um instante enquanto busco essa informação...'
    ],
    notUnderstood: [
      'Desculpe, não entendi bem. Pode reformular?',
      'Pode me dar mais detalhes sobre isso?',
      'Não tenho certeza se entendi. Poderia explicar melhor?'
    ],
    transfer: [
      'Vou transferir você para um especialista que pode ajudar melhor.',
      'Um momento, vou conectar você com nosso time especializado.',
      'Entendo. Deixa eu direcionar para quem pode resolver isso.'
    ],
    hostile: [
      'Entendo que você está frustrado(a). Vamos resolver isso juntos. Como posso ajudar?',
      'Percebo sua insatisfação e peço desculpas por qualquer inconveniente. O que aconteceu?',
      'Lamento que você esteja passando por isso. Estou aqui para ajudar a resolver.',
      'Compreendo sua frustração. Vamos focar em encontrar uma solução. O que precisa?',
      'Sinto muito por essa situação. Me conte o que aconteceu para eu poder ajudar.'
    ],
    complaint: [
      'Lamento muito pelo ocorrido. Vamos resolver isso para você.',
      'Peço desculpas pelo transtorno. Me conte mais para eu poder ajudar.',
      'Sinto muito por essa experiência negativa. O que aconteceu exatamente?'
    ]
  };

  // ============================================
  // ESTADO
  // ============================================
  let state = {
    mode: MODES.SUGGEST.id,
    activePersona: 'professional',
    customPersonas: {},
    conversations: {}, // { chatId: { messages: [], context: {}, lastActivity: timestamp } }
    knowledgeBase: { ...DEFAULT_KNOWLEDGE_BASE },
    templates: { ...RESPONSE_TEMPLATES },
    feedback: [], // { responseId, rating, correctedResponse, timestamp }
    suggestions: [], // Current suggestions
    metrics: {
      totalResponses: 0,
      autoResponses: 0,
      manualResponses: 0,
      avgResponseTime: 0,
      avgConfidence: 0,
      feedbackScore: 0,
      byIntent: {},
      byPersona: {}
    },
    settings: {
      autoGreeting: true,
      autoSuggestions: true,
      showConfidence: true,
      learnFromFeedback: true,
      useKnowledgeBase: true,
      contextWindow: CONFIG.MAX_CONTEXT_MESSAGES,
      minConfidence: CONFIG.MIN_CONFIDENCE_SCORE
    }
  };

  let initialized = false;
  let suggestionPanel = null;

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  async function init() {
    if (initialized) return;

    try {
      await loadState();
      setupEventListeners();
      initialized = true;
      console.log('[CopilotEngine] ✅ Inicializado');

      if (window.EventBus) {
        window.EventBus.emit('copilot:ready', { mode: state.mode, persona: state.activePersona });
      }
    } catch (error) {
      console.error('[CopilotEngine] ❌ Erro na inicialização:', error);
    }
  }

  async function loadState() {
    try {
      const stored = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
      if (stored[CONFIG.STORAGE_KEY]) {
        const loaded = JSON.parse(stored[CONFIG.STORAGE_KEY]);
        state = { ...state, ...loaded };
      }
    } catch (e) {
      console.warn('[CopilotEngine] Falha ao carregar estado:', e);
    }
  }

  async function saveState() {
    try {
      // Não salvar conversas completas (muito grande)
      const toSave = { ...state };
      toSave.conversations = {}; // Limpar conversas do storage
      
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEY]: JSON.stringify(toSave)
      });
    } catch (e) {
      console.error('[CopilotEngine] Falha ao salvar estado:', e);
    }
  }

  function setupEventListeners() {
    if (!window.EventBus) return;

    // Escutar mensagens recebidas
    window.EventBus.on('message:received', async (data) => {
      if (state.mode === MODES.OFF.id) return;
      await handleIncomingMessage(data);
    });

    // Escutar mudanças de chat
    window.EventBus.on('chat:changed', (data) => {
      loadConversationContext(data.chatId);
    });

    // Escutar feedback
    window.EventBus.on('copilot:feedback', (data) => {
      recordFeedback(data);
    });
    
    // Configurar observer para detectar mudança de chat
    setupChatChangeObserver();
  }

  /**
   * Configura MutationObserver para detectar quando o usuário troca de chat
   */
  function setupChatChangeObserver() {
    let lastChatId = null;
    let observerStarted = false;
    
    function detectCurrentChat() {
      try {
        // Tentar múltiplos seletores para obter o chat atual
        const headerSpan = document.querySelector('header span[title]');
        const headerDiv = document.querySelector('[data-testid="conversation-info-header"] span');
        const mainPanel = document.querySelector('#main header');
        
        let chatId = null;
        let chatName = null;
        
        if (headerSpan) {
          chatName = headerSpan.getAttribute('title') || headerSpan.textContent;
        } else if (headerDiv) {
          chatName = headerDiv.textContent;
        } else if (mainPanel) {
          const nameEl = mainPanel.querySelector('span[dir="auto"]');
          chatName = nameEl?.textContent;
        }
        
        if (chatName) {
          // Usar nome como ID (não ideal, mas funciona)
          chatId = chatName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        }
        
        return { chatId, chatName };
      } catch (e) {
        console.warn('[CopilotEngine] Erro ao detectar chat:', e);
        return { chatId: null, chatName: null };
      }
    }
    
    function checkForChatChange() {
      const { chatId, chatName } = detectCurrentChat();
      
      if (chatId && chatId !== lastChatId) {
        console.log(`[CopilotEngine] 📱 Chat alterado: ${chatName}`);
        lastChatId = chatId;
        
        // Carregar histórico do DOM
        loadConversationContext(chatId);
        
        // Emitir evento para outros módulos
        if (window.EventBus) {
          window.EventBus.emit('chat:changed', { chatId, chatName });
        }
      }
    }
    
    function startObserver() {
      if (observerStarted) return;
      
      // Verificar a cada 1 segundo por mudança de chat
      setInterval(checkForChatChange, 1000);
      
      // Também usar MutationObserver no main panel
      const mainPanel = document.querySelector('#main');
      if (mainPanel) {
        const observer = new MutationObserver(() => {
          setTimeout(checkForChatChange, 100);
        });
        
        observer.observe(mainPanel, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['title', 'data-testid']
        });
      }
      
      observerStarted = true;
      console.log('[CopilotEngine] 👁️ Observer de chat iniciado');
      
      // Verificar imediatamente
      checkForChatChange();
    }
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(startObserver, 2000));
    } else {
      setTimeout(startObserver, 2000);
    }
  }

  // ============================================
  // PROCESSAMENTO DE MENSAGENS
  // ============================================
  async function handleIncomingMessage(data) {
    const { chatId, message, sender, timestamp } = data;

    // Adicionar ao contexto
    addToContext(chatId, { role: 'user', content: message, timestamp, sender });

    // Analisar mensagem
    const analysis = await analyzeMessage(message, chatId);

    // Emitir análise COM a mensagem original para aprendizado
    if (window.EventBus) {
      window.EventBus.emit('copilot:analysis', { chatId, analysis, message });
    }

    // Agir baseado no modo
    switch (state.mode) {
      case MODES.SUGGEST.id:
        await generateSuggestions(chatId, analysis);
        break;
      case MODES.AUTO_DRAFT.id:
        await generateDraft(chatId, analysis);
        break;
      case MODES.SEMI_AUTO.id:
        await generateAndQueue(chatId, analysis);
        break;
      case MODES.FULL_AUTO.id:
        await generateAndSend(chatId, analysis);
        break;
    }
  }

  async function analyzeMessage(message, chatId) {
    const startTime = Date.now();

    // Detectar intenção
    const intent = detectIntent(message);

    // Analisar sentimento
    const sentiment = analyzeSentiment(message);

    // Extrair entidades
    const entities = extractEntities(message);

    // Buscar na knowledge base
    const knowledgeMatches = searchKnowledgeBase(message);

    // Obter contexto da conversa
    const context = getConversationContext(chatId);

    // Calcular urgência
    const urgency = calculateUrgency(intent, sentiment, message);

    // Usar IA para análise profunda (se configurada)
    let aiAnalysis = null;
    const configuredProviders = window.AIService?.getConfiguredProviders() || [];
    if (window.AIService && configuredProviders.length > 0) {
      try {
        aiAnalysis = await deepAnalysis(message, context);
      } catch (e) {
        console.warn('[CopilotEngine] AI analysis failed:', e);
      }
    }

    return {
      intent,
      sentiment,
      entities,
      knowledgeMatches,
      context,
      urgency,
      aiAnalysis,
      originalMessage: message, // Guardar mensagem original para uso no prompt
      confidence: calculateConfidence(intent, sentiment, knowledgeMatches, aiAnalysis),
      processingTime: Date.now() - startTime
    };
  }

  // ============================================
  // DETECÇÃO DE INTENÇÃO
  // ============================================
  function detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, intent] of Object.entries(INTENTS)) {
      let score = 0;
      for (const pattern of intent.patterns) {
        if (lowerMessage.includes(pattern.toLowerCase())) {
          score += pattern.length; // Padrões mais longos = mais relevantes
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { ...intent, score };
      }
    }

    // Se não encontrou match claro, usar "INFO" como fallback
    if (!bestMatch || bestScore < 2) {
      bestMatch = { ...INTENTS.INFO, score: 0 };
    }

    return bestMatch;
  }

  // ============================================
  // ANÁLISE DE SENTIMENTO
  // ============================================
  function analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();

    const SENTIMENT_WORDS = {
      positive: {
        words: ['obrigado', 'ótimo', 'excelente', 'perfeito', 'adorei', 'maravilhoso', 'top', 'parabéns', 'amei', 'incrível', 'show', 'demais', 'legal', 'bom', 'muito bom', 'gostei', 'satisfeito', 'feliz', 'agradeço', 'nota 10'],
        weight: 1
      },
      negative: {
        words: [
          // Reclamações gerais
          'problema', 'ruim', 'péssimo', 'horrível', 'reclamar', 'insatisfeito', 'cancelar', 'devolver', 'raiva', 'absurdo', 'lixo', 'decepcionado', 'frustrado', 'irritado', 'bravo',
          // Palavrões e insultos (censurados parcialmente para evitar problemas)
          'merda', 'bosta', 'porra', 'caralho', 'cacete', 'desgraça', 'maldito', 'droga', 'inferno',
          'idiota', 'burro', 'imbecil', 'estúpido', 'otário', 'babaca', 'cretino', 'retardado', 'palhaço',
          'fdp', 'pqp', 'vsf', 'vtnc', 'tnc', 'puta', 'vagabundo', 'safado', 'pilantra',
          'filho da', 'vai tomar', 'vai se', 'vai pro', 'cala boca', 'some daqui',
          // Expressões negativas
          'não presta', 'uma porcaria', 'que lixo', 'que droga', 'não aguento', 'detesto', 'odeio'
        ],
        weight: -1
      },
      hostile: {
        words: [
          'tomar no cu', 'foder', 'foda-se', 'fudido', 'cu', 'pau no cu', 'enfia no cu',
          'viado', 'viadinho', 'bicha', 'gay', 'sapatão', // insultos homofóbicos
          'preto', 'negro', 'macaco', 'crioulo', // insultos racistas - detectar para responder adequadamente
          'gordo', 'baleia', 'feia', 'nojento',
          'matar', 'morrer', 'sumir', 'desaparecer'
        ],
        weight: -2
      },
      neutral: {
        words: ['ok', 'certo', 'entendi', 'tá', 'beleza', 'pode ser', 'tanto faz'],
        weight: 0
      }
    };

    let score = 0;
    let matches = [];
    let isHostile = false;

    for (const [sentiment, config] of Object.entries(SENTIMENT_WORDS)) {
      for (const word of config.words) {
        if (lowerMessage.includes(word)) {
          score += config.weight;
          matches.push({ word, sentiment });
          if (sentiment === 'hostile') {
            isHostile = true;
          }
        }
      }
    }

    // Normalizar score entre -1 e 1
    const normalizedScore = Math.max(-1, Math.min(1, score / 3));

    let label = 'neutral';
    if (isHostile || normalizedScore < -0.5) label = 'hostile';
    else if (normalizedScore > 0.3) label = 'positive';
    else if (normalizedScore < -0.3) label = 'negative';

    return {
      score: normalizedScore,
      label,
      matches,
      isHostile,
      emoji: label === 'positive' ? '😊' : label === 'negative' ? '😟' : label === 'hostile' ? '😡' : '😐',
      advice: isHostile ? 'Responda de forma profissional e calma, não reaja aos insultos' : null
    };
  }

  // ============================================
  // EXTRAÇÃO DE ENTIDADES
  // ============================================
  function extractEntities(message) {
    const entities = {
      phones: [],
      emails: [],
      urls: [],
      dates: [],
      times: [],
      money: [],
      numbers: [],
      names: []
    };

    // Telefones brasileiros
    const phoneRegex = /(?:\+?55\s?)?(?:\(?[1-9]{2}\)?\s?)?(?:9\s?)?[0-9]{4}[-\s]?[0-9]{4}/g;
    entities.phones = message.match(phoneRegex) || [];

    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    entities.emails = message.match(emailRegex) || [];

    // URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    entities.urls = message.match(urlRegex) || [];

    // Datas (formatos brasileiros)
    const dateRegex = /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g;
    entities.dates = message.match(dateRegex) || [];

    // Horários
    const timeRegex = /\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?/gi;
    entities.times = message.match(timeRegex) || [];

    // Valores monetários
    const moneyRegex = /R\$\s?[\d.,]+|\d+(?:[.,]\d+)?\s?(?:reais|real)/gi;
    entities.money = message.match(moneyRegex) || [];

    // Números
    const numberRegex = /\b\d+(?:[.,]\d+)?\b/g;
    entities.numbers = message.match(numberRegex) || [];

    return entities;
  }

  // ============================================
  // KNOWLEDGE BASE
  // ============================================
  function searchKnowledgeBase(query) {
    if (!state.settings.useKnowledgeBase) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];

    // Buscar em FAQs
    for (const faq of state.knowledgeBase.faqs) {
      const score = calculateTextSimilarity(lowerQuery, faq.q.toLowerCase());
      if (score > 0.3) {
        results.push({ type: 'faq', content: faq, score });
      }
    }

    // Buscar em produtos
    for (const product of state.knowledgeBase.products) {
      const score = calculateTextSimilarity(lowerQuery, `${product.name} ${product.description}`.toLowerCase());
      if (score > 0.3) {
        results.push({ type: 'product', content: product, score });
      }
    }

    // Buscar em custom
    for (const item of state.knowledgeBase.custom) {
      const score = calculateTextSimilarity(lowerQuery, item.content.toLowerCase());
      if (score > 0.3) {
        results.push({ type: 'custom', content: item, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, CONFIG.KNOWLEDGE_BASE_MAX_RESULTS);
  }

  function calculateTextSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    let matches = 0;
    for (const word of words1) {
      if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }

  function addToKnowledgeBase(type, content) {
    if (!state.knowledgeBase[type]) {
      state.knowledgeBase[type] = [];
    }
    state.knowledgeBase[type].push({ ...content, id: Date.now().toString(), addedAt: new Date().toISOString() });
    saveState();
  }

  // ============================================
  // CONTEXTO DE CONVERSA
  // ============================================
  function addToContext(chatId, message) {
    if (!state.conversations[chatId]) {
      state.conversations[chatId] = {
        messages: [],
        context: {},
        lastActivity: Date.now()
      };
    }

    state.conversations[chatId].messages.push(message);
    state.conversations[chatId].lastActivity = Date.now();

    // Limitar tamanho do contexto
    if (state.conversations[chatId].messages.length > state.settings.contextWindow) {
      state.conversations[chatId].messages = state.conversations[chatId].messages.slice(-state.settings.contextWindow);
    }
  }

  function getConversationContext(chatId) {
    return state.conversations[chatId] || { messages: [], context: {}, lastActivity: null };
  }

  function loadConversationContext(chatId) {
    // IMPORTANTE: Carregar histórico do DOM do WhatsApp
    const existingContext = getConversationContext(chatId);
    
    // Se já tem mensagens carregadas recentemente, não recarrega
    if (existingContext.messages.length > 5 && 
        existingContext.lastActivity && 
        (Date.now() - existingContext.lastActivity) < 30000) {
      if (window.EventBus) {
        window.EventBus.emit('copilot:context:loaded', { chatId, context: existingContext });
      }
      return existingContext;
    }

    // Extrair mensagens do DOM
    const domMessages = extractMessagesFromDOM();
    
    if (domMessages.length > 0) {
      // Inicializar contexto se não existir
      if (!state.conversations[chatId]) {
        state.conversations[chatId] = {
          messages: [],
          context: {},
          lastActivity: Date.now()
        };
      }
      
      // Mesclar mensagens do DOM com as existentes (evitar duplicatas)
      const existingContents = new Set(state.conversations[chatId].messages.map(m => m.content));
      
      for (const msg of domMessages) {
        if (!existingContents.has(msg.content)) {
          state.conversations[chatId].messages.push(msg);
        }
      }
      
      // Limitar tamanho
      if (state.conversations[chatId].messages.length > state.settings.contextWindow) {
        state.conversations[chatId].messages = state.conversations[chatId].messages.slice(-state.settings.contextWindow);
      }
      
      state.conversations[chatId].lastActivity = Date.now();
      
      console.log(`[CopilotEngine] ✅ Carregadas ${domMessages.length} mensagens do histórico para chat ${chatId}`);
    }
    
    const context = getConversationContext(chatId);
    if (window.EventBus) {
      window.EventBus.emit('copilot:context:loaded', { chatId, context });
    }
    
    return context;
  }

  /**
   * Extrai mensagens visíveis do DOM do WhatsApp
   * @returns {Array} Array de mensagens {role, content, timestamp}
   */
  function extractMessagesFromDOM() {
    const messages = [];
    
    try {
      // Seletores do WhatsApp Web
      const msgContainers = document.querySelectorAll('[data-testid="msg-container"]');
      
      if (msgContainers.length === 0) {
        // Fallback para seletores alternativos
        const altContainers = document.querySelectorAll('.message-in, .message-out');
        altContainers.forEach(container => {
          const textEl = container.querySelector('.selectable-text, span[dir="ltr"], .copyable-text');
          if (textEl && textEl.textContent?.trim()) {
            const isOutgoing = container.classList.contains('message-out');
            messages.push({
              role: isOutgoing ? 'assistant' : 'user',
              content: textEl.textContent.trim(),
              timestamp: Date.now(),
              fromDOM: true
            });
          }
        });
        return messages;
      }
      
      msgContainers.forEach((container, index) => {
        // Verificar se é mensagem enviada ou recebida
        const isOutgoing = container.closest('[data-testid*="out"]') || 
                           container.querySelector('[data-testid="msg-dblcheck"]') ||
                           container.querySelector('[data-testid="msg-check"]');
        
        // Extrair texto - tentar múltiplos seletores
        const textEl = container.querySelector('.selectable-text[data-testid]') ||
                       container.querySelector('.selectable-text') ||
                       container.querySelector('span.selectable-text') ||
                       container.querySelector('span[dir="ltr"]') ||
                       container.querySelector('.copyable-text span');
        
        if (textEl && textEl.textContent?.trim()) {
          const text = textEl.textContent.trim();
          
          // Ignorar mensagens muito curtas ou de sistema
          if (text.length < 2) return;
          if (text.includes('Mensagem apagada') || text.includes('Aguardando esta mensagem')) return;
          
          messages.push({
            role: isOutgoing ? 'assistant' : 'user',
            content: text,
            timestamp: Date.now() - ((msgContainers.length - index) * 1000), // Estimar timestamp
            fromDOM: true
          });
        }
      });
      
      console.log(`[CopilotEngine] 📜 Extraídas ${messages.length} mensagens do DOM`);
      
    } catch (error) {
      console.error('[CopilotEngine] Erro ao extrair mensagens do DOM:', error);
    }
    
    return messages;
  }

  function clearConversationContext(chatId) {
    if (state.conversations[chatId]) {
      state.conversations[chatId].messages = [];
      state.conversations[chatId].context = {};
    }
  }

  // ============================================
  // GERAÇÃO DE RESPOSTAS
  // ============================================
  async function generateResponse(chatId, analysis, options = {}) {
    const persona = getActivePersona();
    const context = getConversationContext(chatId);
    
    // Construir prompt
    const messages = buildPromptMessages(context, analysis, persona);

    // Gerar com IA
    if (!window.AIService) {
      throw new Error('AIService não disponível');
    }

    const result = await window.AIService.complete(messages, {
      temperature: options.temperature ?? persona.temperature,
      maxTokens: options.maxTokens ?? persona.maxTokens
    });

    // Pós-processar resposta
    const response = postProcessResponse(result.content, analysis, persona);

    // Calcular score de confiança
    const confidence = calculateResponseConfidence(response, analysis, result);

    // Registrar métricas
    updateMetrics('generated', analysis.intent, confidence);

    return {
      content: response,
      confidence,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      provider: result.provider,
      tokens: result.usage?.totalTokens,
      latency: result.latency
    };
  }

  function buildPromptMessages(context, analysis, persona) {
    const messages = [];

    // System prompt com persona e contexto
    let systemPrompt = persona.systemPrompt;
    
    // Adicionar instruções explícitas de resposta
    systemPrompt += `\n\n=== INSTRUÇÕES CRÍTICAS - SIGA SEMPRE ===
1. RESPONDA DIRETAMENTE à mensagem do cliente - NÃO peça detalhes
2. NUNCA diga "não entendi", "pode explicar melhor" ou similares
3. Interprete a mensagem da melhor forma possível e responda
4. Se a pergunta for vaga, dê uma resposta geral útil
5. Seja proativo - ofereça soluções, não faça perguntas
6. Mantenha resposta CURTA: máximo 2-3 frases
7. Responda em português brasileiro natural
8. Se for uma saudação, responda com saudação e ofereça ajuda
9. Se for uma pergunta, responda diretamente com a informação`;
    
    // Adicionar informações da knowledge base
    if (analysis.knowledgeMatches && analysis.knowledgeMatches.length > 0) {
      systemPrompt += '\n\n📚 Informações da base de conhecimento:\n';
      analysis.knowledgeMatches.forEach(match => {
        if (match.type === 'faq') {
          systemPrompt += `- P: ${match.content.q} R: ${match.content.a}\n`;
        }
      });
    }

    // Adicionar contexto de sentimento
    if (analysis.sentiment) {
      systemPrompt += `\n\n💭 Sentimento detectado: ${analysis.sentiment.label} (${analysis.sentiment.emoji || ''})`;
    }
    
    // Instruções especiais para hostilidade
    if (analysis.sentiment?.isHostile || analysis.sentiment?.label === 'hostile') {
      systemPrompt += `\n\n⚠️ ATENÇÃO: O cliente está usando linguagem hostil ou ofensiva.
DIRETRIZES OBRIGATÓRIAS:
1. NÃO reaja aos insultos ou palavrões
2. Mantenha a calma e profissionalismo absoluto
3. Responda com empatia e compreensão
4. Foque em resolver o problema, não na ofensa
5. Use frases como "Entendo sua frustração..." ou "Lamento por essa situação..."`;
    }
    
    if (analysis.urgency && analysis.urgency > 0.7) {
      systemPrompt += ' 🚨 Esta é uma situação URGENTE.';
    }

    // Adicionar contexto da conversa atual
    if (analysis.originalMessage) {
      systemPrompt += `\n\n📨 MENSAGEM ATUAL DO CLIENTE: "${analysis.originalMessage}"`;
    }

    messages.push({ role: 'system', content: systemPrompt });

    // Adicionar histórico de conversa (últimas 10 mensagens)
    if (context.messages && context.messages.length > 0) {
      for (const msg of context.messages.slice(-10)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Garantir que a mensagem atual está no final
    if (analysis.originalMessage && (!context.messages || context.messages.length === 0 || 
        context.messages[context.messages.length - 1]?.content !== analysis.originalMessage)) {
      messages.push({
        role: 'user',
        content: analysis.originalMessage
      });
    }

    return messages;
  }

  function postProcessResponse(response, analysis, persona) {
    let processed = response.trim();

    // Remover prefixos indesejados
    processed = processed.replace(/^(Resposta:|Assistente:|Bot:)/i, '').trim();

    // Limitar tamanho
    if (processed.length > 500) {
      processed = processed.substring(0, 497) + '...';
    }

    return processed;
  }

  // ============================================
  // SUGESTÕES
  // ============================================
  async function generateSuggestions(chatId, analysis) {
    try {
      const suggestions = [];

      // Template rápido baseado na intenção
      const templateSuggestions = getTemplateSuggestions(analysis.intent);
      suggestions.push(...templateSuggestions.map(t => ({
        type: 'template',
        content: t,
        confidence: 0.7,
        source: 'template'
      })));

      // Sugestão da knowledge base
      if (analysis.knowledgeMatches.length > 0) {
        const kbSuggestion = analysis.knowledgeMatches[0];
        if (kbSuggestion.type === 'faq') {
          suggestions.push({
            type: 'knowledge',
            content: kbSuggestion.content.a,
            confidence: kbSuggestion.score,
            source: 'knowledge_base'
          });
        }
      }

      // Sugestão gerada por IA (se disponível)
      if (window.AIService && window.AIService.getConfiguredProviders().length > 0) {
        try {
          const aiResponse = await generateResponse(chatId, analysis, { maxTokens: 150 });
          suggestions.push({
            type: 'ai',
            content: aiResponse.content,
            confidence: aiResponse.confidence,
            source: 'ai',
            metadata: { provider: aiResponse.provider, tokens: aiResponse.tokens }
          });
        } catch (e) {
          console.warn('[CopilotEngine] AI suggestion failed:', e);
        }
      }

      // Ordenar por confiança
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Limitar e salvar
      state.suggestions = suggestions.slice(0, CONFIG.SUGGESTION_COUNT);

      // Emitir evento
      if (window.EventBus) {
        window.EventBus.emit('copilot:suggestions', { chatId, suggestions: state.suggestions });
      }

      return state.suggestions;
    } catch (error) {
      console.error('[CopilotEngine] Erro ao gerar sugestões:', error);
      return [];
    }
  }

  function getTemplateSuggestions(intent) {
    const templates = state.templates[intent.id] || state.templates.notUnderstood;
    return templates.slice(0, 2);
  }

  function getSuggestions() {
    return [...state.suggestions];
  }

  // ============================================
  // AUTO-RESPOSTA
  // ============================================
  async function generateAndSend(chatId, analysis) {
    // Verificar confiança mínima
    if (analysis.confidence < state.settings.minConfidence) {
      console.log('[CopilotEngine] Confiança baixa, não enviando automaticamente');
      await generateSuggestions(chatId, analysis);
      return;
    }

    try {
      const response = await generateResponse(chatId, analysis);

      // Emitir evento para enviar
      if (window.EventBus) {
        window.EventBus.emit('copilot:auto_send', {
          chatId,
          content: response.content,
          confidence: response.confidence
        });
      }

      // Adicionar ao contexto
      addToContext(chatId, { role: 'assistant', content: response.content, timestamp: Date.now(), auto: true });

      // Atualizar métricas
      updateMetrics('auto_sent', analysis.intent, response.confidence);

    } catch (error) {
      console.error('[CopilotEngine] Erro no auto-send:', error);
    }
  }

  async function generateDraft(chatId, analysis) {
    try {
      const response = await generateResponse(chatId, analysis);

      if (window.EventBus) {
        window.EventBus.emit('copilot:draft', {
          chatId,
          content: response.content,
          confidence: response.confidence
        });
      }

      return response;
    } catch (error) {
      console.error('[CopilotEngine] Erro ao gerar draft:', error);
    }
  }

  async function generateAndQueue(chatId, analysis) {
    try {
      const response = await generateResponse(chatId, analysis);

      if (window.EventBus) {
        window.EventBus.emit('copilot:queued', {
          chatId,
          content: response.content,
          confidence: response.confidence,
          requiresApproval: true
        });
      }

      return response;
    } catch (error) {
      console.error('[CopilotEngine] Erro ao gerar/enfileirar:', error);
    }
  }

  // ============================================
  // ANÁLISE PROFUNDA COM IA
  // ============================================
  async function deepAnalysis(message, context) {
    const prompt = `Analise a seguinte mensagem de um cliente e retorne um JSON com:
- intent: intenção principal (greeting, question, complaint, purchase, support, info, etc)
- sentiment: sentimento (positive, negative, neutral)
- urgency: nível de urgência de 0 a 1
- topics: lista de tópicos mencionados
- suggestedAction: ação sugerida para o atendente

Histórico recente:
${context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

Mensagem atual: "${message}"

Responda APENAS com o JSON, sem markdown.`;

    try {
      const result = await window.AIService.generateText(prompt, { maxTokens: 300 });
      return JSON.parse(result.content.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // CÁLCULOS DE CONFIANÇA
  // ============================================
  function calculateConfidence(intent, sentiment, knowledgeMatches, aiAnalysis) {
    let score = 0.5; // Base

    // Intent score
    if (intent.score > 5) score += 0.2;
    else if (intent.score > 2) score += 0.1;

    // Knowledge base match
    if (knowledgeMatches.length > 0) {
      score += Math.min(0.2, knowledgeMatches[0].score);
    }

    // AI analysis match
    if (aiAnalysis && aiAnalysis.intent === intent.id) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  function calculateResponseConfidence(response, analysis, aiResult) {
    let score = analysis.confidence;

    // Ajustar baseado no tamanho da resposta
    if (response.length < 20) score -= 0.1;
    if (response.length > 300) score -= 0.05;

    // Ajustar baseado nos tokens usados
    if (aiResult.usage?.totalTokens > 500) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  function calculateUrgency(intent, sentiment, message) {
    let urgency = 0;

    // Intent de urgência
    if (intent.id === 'urgency') urgency += 0.5;
    if (intent.id === 'complaint') urgency += 0.3;
    if (intent.id === 'support') urgency += 0.2;

    // Sentimento negativo
    if (sentiment.label === 'negative') urgency += 0.3;

    // Palavras específicas
    const urgentWords = ['urgente', 'emergência', 'agora', 'imediato', 'rápido'];
    if (urgentWords.some(w => message.toLowerCase().includes(w))) {
      urgency += 0.3;
    }

    return Math.min(1, urgency);
  }

  // ============================================
  // FEEDBACK E APRENDIZADO
  // ============================================
  function recordFeedback(data) {
    state.feedback.push({
      ...data,
      timestamp: Date.now()
    });

    // Limitar tamanho
    if (state.feedback.length > 1000) {
      state.feedback = state.feedback.slice(-1000);
    }

    // Atualizar score médio
    updateFeedbackMetrics();

    // Salvar
    saveState();
    
    // IMPORTANTE: Encaminhar para SmartBot para aprendizado contínuo
    if (window.smartBot && window.smartBot.learningSystem) {
      window.smartBot.learningSystem.recordFeedback({
        input: data.input,
        response: data.response,
        rating: data.rating,
        context: data.context
      });
      console.log('[CopilotEngine] 🧠 Feedback encaminhado para aprendizado');
    }

    if (window.EventBus) {
      window.EventBus.emit('copilot:feedback:recorded', data);
    }
  }

  function updateFeedbackMetrics() {
    const recent = state.feedback.slice(-100);
    if (recent.length === 0) return;

    const avgRating = recent.reduce((sum, f) => sum + (f.rating || 0), 0) / recent.length;
    state.metrics.feedbackScore = avgRating;
  }

  // ============================================
  // MÉTRICAS
  // ============================================
  function updateMetrics(action, intent, confidence) {
    state.metrics.totalResponses++;

    if (action === 'auto_sent') {
      state.metrics.autoResponses++;
    } else {
      state.metrics.manualResponses++;
    }

    // Média de confiança
    state.metrics.avgConfidence = (state.metrics.avgConfidence * (state.metrics.totalResponses - 1) + confidence) / state.metrics.totalResponses;

    // Por intenção
    if (!state.metrics.byIntent[intent.id]) {
      state.metrics.byIntent[intent.id] = 0;
    }
    state.metrics.byIntent[intent.id]++;

    // Por persona
    if (!state.metrics.byPersona[state.activePersona]) {
      state.metrics.byPersona[state.activePersona] = 0;
    }
    state.metrics.byPersona[state.activePersona]++;
  }

  function getMetrics() {
    return { ...state.metrics };
  }

  function resetMetrics() {
    state.metrics = {
      totalResponses: 0,
      autoResponses: 0,
      manualResponses: 0,
      avgResponseTime: 0,
      avgConfidence: 0,
      feedbackScore: 0,
      byIntent: {},
      byPersona: {}
    };
    saveState();
  }

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  function setMode(mode) {
    if (!MODES[mode.toUpperCase()] && !Object.values(MODES).find(m => m.id === mode)) {
      throw new Error(`Modo inválido: ${mode}`);
    }
    state.mode = mode;
    saveState();

    if (window.EventBus) {
      window.EventBus.emit('copilot:mode:changed', { mode });
    }
  }

  function getMode() {
    return state.mode;
  }

  function setActivePersona(personaId) {
    const allPersonas = { ...DEFAULT_PERSONAS, ...state.customPersonas };
    if (!allPersonas[personaId]) {
      throw new Error(`Persona não encontrada: ${personaId}`);
    }
    state.activePersona = personaId;
    saveState();

    if (window.EventBus) {
      window.EventBus.emit('copilot:persona:changed', { personaId });
    }
  }

  function getActivePersona() {
    const allPersonas = { ...DEFAULT_PERSONAS, ...state.customPersonas };
    return allPersonas[state.activePersona] || DEFAULT_PERSONAS.professional;
  }

  function getAllPersonas() {
    return { ...DEFAULT_PERSONAS, ...state.customPersonas };
  }

  function createCustomPersona(persona) {
    const id = persona.id || `custom_${Date.now()}`;
    state.customPersonas[id] = {
      ...persona,
      id,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    saveState();
    return id;
  }

  function deleteCustomPersona(personaId) {
    if (state.customPersonas[personaId]) {
      delete state.customPersonas[personaId];
      if (state.activePersona === personaId) {
        state.activePersona = 'professional';
      }
      saveState();
      return true;
    }
    return false;
  }

  function updateSettings(settings) {
    state.settings = { ...state.settings, ...settings };
    saveState();
  }

  function getSettings() {
    return { ...state.settings };
  }

  // ============================================
  // DEBUG
  // ============================================
  function debug() {
    return {
      initialized,
      mode: state.mode,
      activePersona: state.activePersona,
      conversationsCount: Object.keys(state.conversations).length,
      suggestionsCount: state.suggestions.length,
      feedbackCount: state.feedback.length,
      metrics: state.metrics,
      settings: state.settings
    };
  }

  // ============================================
  // EXPORT
  // ============================================
  window.CopilotEngine = {
    // Lifecycle
    init,

    // Configuration
    setMode,
    getMode,
    setActivePersona,
    getActivePersona,
    getAllPersonas,
    createCustomPersona,
    deleteCustomPersona,
    updateSettings,
    getSettings,

    // Core
    handleIncomingMessage,
    analyzeMessage,
    generateResponse,
    generateSuggestions,
    getSuggestions,

    // Intent & Analysis
    detectIntent,
    analyzeSentiment,
    extractEntities,

    // Context
    addToContext,
    getConversationContext,
    clearConversationContext,

    // Knowledge Base
    searchKnowledgeBase,
    addToKnowledgeBase,

    // Feedback
    recordFeedback,

    // Metrics
    getMetrics,
    resetMetrics,

    // Debug
    debug,
    
    // Context Management (novas funções)
    loadConversationContext,
    extractMessagesFromDOM,

    // Constants
    MODES,
    INTENTS,
    DEFAULT_PERSONAS
  };

  console.log('[CopilotEngine] 🤖 Motor de Copilot v1.0 carregado');
  console.log('[CopilotEngine] 📋 Modos:', Object.values(MODES).map(m => m.name).join(', '));
})();
