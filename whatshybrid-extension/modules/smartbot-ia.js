/**
 * 🧠 SmartBot IA - Sistema de Inteligência Avançada para WhatsHybrid
 * 
 * Integra funcionalidades avançadas de chatbot:
 * - AdvancedContextAnalyzer: Análise de perfil do cliente e fluxo de conversa
 * - IntelligentPriorityQueue: Priorização inteligente de mensagens
 * - ContinuousLearningSystem: Aprendizado contínuo com feedback
 * - SmartMetricsSystem: Métricas e detecção de anomalias
 * 
 * @version 1.0.0
 * @author WhatsHybrid Team
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    CUSTOMER_PROFILES: 'whl_smartbot_profiles',
    LEARNING_DATA: 'whl_smartbot_learning',
    METRICS: 'whl_smartbot_metrics',
    QUEUE_STATE: 'whl_smartbot_queue'
  };

  // ============================================================
  // 🔍 ADVANCED CONTEXT ANALYZER
  // Analisa perfil do cliente e detecta fluxo de conversa
  // ============================================================
  class AdvancedContextAnalyzer {
    constructor() {
      this.customerProfiles = new Map();
      this.conversationFlows = new Map();
      this.commonFlowPatterns = [
        { pattern: ['greeting', 'question'], name: 'inquiry' },
        { pattern: ['greeting', 'complaint'], name: 'support_issue' },
        { pattern: ['complaint', 'apology', 'solution'], name: 'resolution' },
        { pattern: ['question', 'answer', 'thanks'], name: 'successful_help' },
        { pattern: ['greeting', 'product_inquiry', 'price_inquiry'], name: 'sales_lead' }
      ];
      this.loadProfiles();
    }

    /**
     * Carrega perfis do storage
     */
    async loadProfiles() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.CUSTOMER_PROFILES);
        if (data[STORAGE_KEYS.CUSTOMER_PROFILES]) {
          const profiles = JSON.parse(data[STORAGE_KEYS.CUSTOMER_PROFILES]);
          Object.entries(profiles).forEach(([key, value]) => {
            this.customerProfiles.set(key, value);
          });
        }
      } catch (error) {
        console.warn('[SmartBot] Erro ao carregar perfis:', error);
      }
    }

    /**
     * Salva perfis no storage
     */
    async saveProfiles() {
      try {
        const profiles = Object.fromEntries(this.customerProfiles);
        await chrome.storage.local.set({
          [STORAGE_KEYS.CUSTOMER_PROFILES]: JSON.stringify(profiles)
        });
      } catch (error) {
        console.warn('[SmartBot] Erro ao salvar perfis:', error);
      }
    }

    /**
     * Analisa contexto completo de uma conversa
     * @param {string} chatId - ID do chat
     * @param {Array} messages - Histórico de mensagens
     * @param {Object} currentMessage - Mensagem atual
     * @returns {Object} Análise de contexto
     */
    analyzeContext(chatId, messages, currentMessage) {
      const customerProfile = this.getOrCreateProfile(chatId);
      const flowAnalysis = this.analyzeConversationFlow(chatId, messages);
      const sentimentTrend = this.analyzeSentimentTrend(messages);
      const urgencyLevel = this.detectUrgency(currentMessage, messages);
      const topicClusters = this.identifyTopicClusters(messages);

      // Atualiza perfil do cliente
      this.updateCustomerProfile(chatId, currentMessage, sentimentTrend);

      return {
        customerProfile,
        flowAnalysis,
        sentimentTrend,
        urgencyLevel,
        topicClusters,
        recommendedTone: this.recommendTone(customerProfile, sentimentTrend),
        suggestedApproach: this.suggestApproach(flowAnalysis, urgencyLevel),
        contextSummary: this.generateContextSummary(customerProfile, flowAnalysis, sentimentTrend)
      };
    }

    /**
     * Obtém ou cria perfil do cliente
     */
    getOrCreateProfile(chatId) {
      if (!this.customerProfiles.has(chatId)) {
        this.customerProfiles.set(chatId, {
          chatId,
          firstContact: new Date().toISOString(),
          lastContact: new Date().toISOString(),
          messageCount: 0,
          avgResponseTime: 0,
          preferredTone: 'neutral',
          commonTopics: [],
          satisfactionScore: 0.5,
          escalationHistory: [],
          tags: []
        });
      }
      return this.customerProfiles.get(chatId);
    }

    /**
     * Atualiza perfil do cliente
     */
    updateCustomerProfile(chatId, message, sentimentTrend) {
      const profile = this.getOrCreateProfile(chatId);
      
      profile.lastContact = new Date().toISOString();
      profile.messageCount++;
      
      // Atualiza tom preferido baseado no histórico
      if (sentimentTrend.average > 0.6) {
        profile.preferredTone = 'friendly';
      } else if (sentimentTrend.average < 0.4) {
        profile.preferredTone = 'formal';
      }
      
      // Atualiza score de satisfação
      profile.satisfactionScore = profile.satisfactionScore * 0.8 + sentimentTrend.average * 0.2;
      
      this.saveProfiles();
      return profile;
    }

    /**
     * Analisa fluxo de conversa
     */
    analyzeConversationFlow(chatId, messages) {
      const stages = messages.map(msg => this.classifyMessageStage(msg));
      const currentStage = stages[stages.length - 1] || 'unknown';
      const flowPattern = this.detectFlowPattern(stages);
      
      return {
        stages,
        currentStage,
        flowPattern,
        predictedNextStage: this.predictNextStage(stages, flowPattern),
        flowHealth: this.assessFlowHealth(stages)
      };
    }

    /**
     * Classifica estágio da mensagem
     */
    classifyMessageStage(message) {
      const text = (message.body || message.text || '').toLowerCase();
      
      if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello)/i.test(text)) {
        return 'greeting';
      }
      if (/(\?|como|qual|quando|onde|por que|quanto)/i.test(text)) {
        return 'question';
      }
      if (/(problema|erro|não funciona|reclamação|insatisfeito|péssimo)/i.test(text)) {
        return 'complaint';
      }
      if (/(obrigado|obrigada|valeu|agradeço|thanks)/i.test(text)) {
        return 'thanks';
      }
      if (/(desculpa|desculpe|perdão|sentimos)/i.test(text)) {
        return 'apology';
      }
      if (/(preço|valor|quanto custa|promoção|desconto)/i.test(text)) {
        return 'price_inquiry';
      }
      if (/(produto|serviço|funcionalidade|recurso)/i.test(text)) {
        return 'product_inquiry';
      }
      if (/(resolvido|funcionou|consegui|deu certo)/i.test(text)) {
        return 'resolution';
      }
      
      return 'general';
    }

    /**
     * Detecta padrão de fluxo
     */
    detectFlowPattern(stages) {
      const recentStages = stages.slice(-5);
      
      for (const flow of this.commonFlowPatterns) {
        let matchIndex = 0;
        for (const stage of recentStages) {
          if (stage === flow.pattern[matchIndex]) {
            matchIndex++;
            if (matchIndex === flow.pattern.length) {
              return flow.name;
            }
          }
        }
      }
      
      return 'custom';
    }

    /**
     * Prediz próximo estágio
     */
    predictNextStage(stages, flowPattern) {
      const flow = this.commonFlowPatterns.find(f => f.name === flowPattern);
      if (!flow) return 'unknown';
      
      const currentIndex = stages.length % flow.pattern.length;
      return flow.pattern[currentIndex] || 'resolution';
    }

    /**
     * Avalia saúde do fluxo
     */
    assessFlowHealth(stages) {
      const hasGreeting = stages.includes('greeting');
      const hasComplaint = stages.includes('complaint');
      const hasResolution = stages.includes('resolution');
      const hasThanks = stages.includes('thanks');
      
      let health = 0.5;
      if (hasGreeting) health += 0.1;
      if (hasComplaint && !hasResolution) health -= 0.2;
      if (hasResolution) health += 0.2;
      if (hasThanks) health += 0.2;
      
      return Math.max(0, Math.min(1, health));
    }

    /**
     * Analisa tendência de sentimento
     */
    analyzeSentimentTrend(messages) {
      if (messages.length === 0) {
        return { values: [], average: 0.5, trend: 'neutral', volatility: 0 };
      }

      const values = messages.map(msg => this.analyzeSentiment(msg.body || msg.text || ''));
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      
      let trend = 'stable';
      if (values.length >= 3) {
        const recent = values.slice(-3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = values.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 3);
        
        if (recentAvg > olderAvg + 0.1) trend = 'improving';
        else if (recentAvg < olderAvg - 0.1) trend = 'declining';
      }

      const volatility = this.calculateVolatility(values);

      return { values, average, trend, volatility };
    }

    /**
     * Analisa sentimento de texto
     */
    analyzeSentiment(text) {
      if (!text) return 0.5;
      
      const lowerText = text.toLowerCase();
      
      const positiveWords = [
        'ótimo', 'excelente', 'perfeito', 'maravilhoso', 'obrigado', 'obrigada',
        'adorei', 'amei', 'incrível', 'parabéns', 'satisfeito', 'feliz', 'bom',
        'legal', 'top', 'show', 'massa', 'demais', '😀', '😊', '👍', '❤️', '🎉'
      ];
      
      const negativeWords = [
        'péssimo', 'horrível', 'terrível', 'problema', 'erro', 'falha', 'ruim',
        'insatisfeito', 'decepcionado', 'frustrado', 'raiva', 'absurdo', 'nunca',
        'cancelar', 'reclamação', 'descaso', '😡', '😤', '👎', '😢', '😞'
      ];
      
      let score = 0.5;
      
      positiveWords.forEach(word => {
        if (lowerText.includes(word)) score += 0.1;
      });
      
      negativeWords.forEach(word => {
        if (lowerText.includes(word)) score -= 0.1;
      });
      
      // Caps lock aumenta intensidade
      if (text === text.toUpperCase() && text.length > 5) {
        score = score < 0.5 ? score - 0.1 : score + 0.05;
      }
      
      return Math.max(0, Math.min(1, score));
    }

    /**
     * Calcula volatilidade
     */
    calculateVolatility(values) {
      if (values.length < 2) return 0;
      
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
      
      return Math.sqrt(variance);
    }

    /**
     * Detecta nível de urgência
     */
    detectUrgency(currentMessage, messages) {
      const text = (currentMessage?.body || currentMessage?.text || '').toLowerCase();
      
      const urgentKeywords = [
        'urgente', 'urgência', 'emergência', 'imediato', 'agora', 'já',
        'não pode esperar', 'crítico', 'importante', 'prazo', 'deadline',
        'socorro', 'help', 'asap'
      ];
      
      let urgency = 0;
      
      // Palavras urgentes
      urgentKeywords.forEach(keyword => {
        if (text.includes(keyword)) urgency += 0.2;
      });
      
      // Caps lock
      if (text === text.toUpperCase() && text.length > 10) urgency += 0.15;
      
      // Múltiplas exclamações/interrogações
      const exclamations = (text.match(/!/g) || []).length;
      const questions = (text.match(/\?/g) || []).length;
      if (exclamations > 2) urgency += 0.1;
      if (questions > 2) urgency += 0.1;
      
      // Histórico de reclamações
      const complaints = messages.filter(m => 
        this.classifyMessageStage(m) === 'complaint'
      ).length;
      if (complaints > 2) urgency += 0.15;
      
      return Math.min(1, urgency);
    }

    /**
     * Identifica clusters de tópicos
     */
    identifyTopicClusters(messages) {
      const topics = new Map();
      
      const topicKeywords = {
        'pagamento': ['pagar', 'pagamento', 'boleto', 'cartão', 'pix', 'fatura'],
        'entrega': ['entrega', 'envio', 'rastreio', 'correios', 'chegou', 'prazo'],
        'produto': ['produto', 'item', 'mercadoria', 'compra', 'pedido'],
        'suporte': ['problema', 'erro', 'bug', 'não funciona', 'ajuda', 'suporte'],
        'vendas': ['preço', 'valor', 'desconto', 'promoção', 'comprar', 'orçamento'],
        'cadastro': ['cadastro', 'senha', 'login', 'conta', 'email', 'acesso']
      };
      
      messages.forEach(msg => {
        const text = (msg.body || msg.text || '').toLowerCase();
        
        Object.entries(topicKeywords).forEach(([topic, keywords]) => {
          keywords.forEach(keyword => {
            if (text.includes(keyword)) {
              topics.set(topic, (topics.get(topic) || 0) + 1);
            }
          });
        });
      });
      
      return Array.from(topics.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count, percentage: count / messages.length }));
    }

    /**
     * Recomenda tom para resposta
     */
    recommendTone(profile, sentimentTrend) {
      if (sentimentTrend.average < 0.3 || sentimentTrend.trend === 'declining') {
        return 'empathetic_formal';
      }
      if (profile.preferredTone === 'friendly' && sentimentTrend.average > 0.5) {
        return 'friendly_casual';
      }
      if (profile.messageCount > 10) {
        return 'familiar_professional';
      }
      return 'professional_neutral';
    }

    /**
     * Sugere abordagem
     */
    suggestApproach(flowAnalysis, urgencyLevel) {
      if (urgencyLevel > 0.7) {
        return {
          approach: 'immediate_action',
          priority: 'high',
          actions: ['Responder imediatamente', 'Oferecer solução rápida', 'Considerar escalação']
        };
      }
      
      if (flowAnalysis.currentStage === 'complaint') {
        return {
          approach: 'empathetic_resolution',
          priority: 'high',
          actions: ['Demonstrar empatia', 'Reconhecer o problema', 'Apresentar solução']
        };
      }
      
      if (flowAnalysis.flowPattern === 'sales_lead') {
        return {
          approach: 'consultative_selling',
          priority: 'medium',
          actions: ['Identificar necessidades', 'Apresentar benefícios', 'Criar senso de oportunidade']
        };
      }
      
      return {
        approach: 'standard_support',
        priority: 'normal',
        actions: ['Responder objetivamente', 'Oferecer ajuda adicional']
      };
    }

    /**
     * Gera resumo do contexto
     */
    generateContextSummary(profile, flowAnalysis, sentimentTrend) {
      const isReturning = profile.messageCount > 1;
      const satisfaction = profile.satisfactionScore > 0.6 ? 'satisfeito' : 
                          profile.satisfactionScore < 0.4 ? 'insatisfeito' : 'neutro';
      
      return {
        customerType: isReturning ? 'returning' : 'new',
        interactionCount: profile.messageCount,
        currentMood: sentimentTrend.average > 0.6 ? 'positive' : 
                     sentimentTrend.average < 0.4 ? 'negative' : 'neutral',
        conversationStage: flowAnalysis.currentStage,
        satisfaction,
        recommendation: this.recommendTone(profile, sentimentTrend)
      };
    }

    /**
     * Obtém perfil de cliente
     */
    getCustomerProfile(chatId) {
      return this.customerProfiles.get(chatId) || null;
    }

    /**
     * Lista todos os perfis
     */
    getAllProfiles() {
      return Array.from(this.customerProfiles.values());
    }
  }

  // ============================================================
  // 📊 INTELLIGENT PRIORITY QUEUE
  // Sistema de fila com priorização inteligente
  // ============================================================
  class IntelligentPriorityQueue {
    constructor(options = {}) {
      this.queue = [];
      this.processing = false;
      this.maxRetries = options.maxRetries || 3;
      this.processDelay = options.processDelay || 1000;
      this.onProcess = options.onProcess || (() => {});
      this.onError = options.onError || console.error;
    }

    /**
     * Adiciona item à fila com prioridade calculada
     * @param {Object} item - Item a ser processado
     * @param {Object} context - Contexto para cálculo de prioridade
     */
    enqueue(item, context = {}) {
      const priority = this.calculatePriority(item, context);
      
      const queueItem = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        item,
        priority,
        retries: 0,
        addedAt: new Date().toISOString(),
        context
      };

      // Insere na posição correta (maior prioridade primeiro)
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      console.log(`[SmartBot Queue] Item adicionado com prioridade ${priority.toFixed(2)}`);
      
      // Inicia processamento se não estiver rodando
      if (!this.processing) {
        this.startProcessing();
      }

      return queueItem.id;
    }

    /**
     * Calcula prioridade do item (0-100)
     */
    calculatePriority(item, context) {
      let priority = 50; // Base

      // Fator: Sentimento (negativo = maior prioridade)
      if (context.sentiment !== undefined) {
        if (context.sentiment < 0.3) priority += 30; // Muito negativo
        else if (context.sentiment < 0.5) priority += 15; // Negativo
      }

      // Fator: Intenção
      const intent = context.intent || item.intent;
      if (intent === 'complaint') priority += 25;
      else if (intent === 'urgent') priority += 35;
      else if (intent === 'question') priority += 10;

      // Fator: Urgência detectada
      if (context.urgency !== undefined) {
        priority += context.urgency * 30;
      }

      // Fator: Palavras urgentes no texto
      const text = (item.body || item.text || '').toLowerCase();
      const urgentWords = ['urgente', 'emergência', 'imediato', 'agora', 'crítico'];
      urgentWords.forEach(word => {
        if (text.includes(word)) priority += 10;
      });

      // Fator: Cliente VIP ou com histórico
      if (context.isVIP) priority += 20;
      if (context.messageCount > 20) priority += 5;

      // Fator: Tempo de espera (aumenta prioridade com o tempo)
      if (item.waitTime > 60000) priority += 10; // > 1 min
      if (item.waitTime > 300000) priority += 15; // > 5 min

      // Normaliza para 0-100
      return Math.min(100, Math.max(0, priority));
    }

    /**
     * Inicia processamento da fila
     */
    async startProcessing() {
      if (this.processing) return;
      this.processing = true;

      while (this.queue.length > 0) {
        const item = this.queue.shift();
        
        try {
          await this.onProcess(item);
          console.log(`[SmartBot Queue] Item ${item.id} processado com sucesso`);
        } catch (error) {
          item.retries++;
          
          if (item.retries < this.maxRetries) {
            // Reinsere com prioridade reduzida
            item.priority = Math.max(0, item.priority - 10);
            this.queue.push(item);
            console.warn(`[SmartBot Queue] Retry ${item.retries}/${this.maxRetries} para item ${item.id}`);
          } else {
            this.onError(error, item);
            console.error(`[SmartBot Queue] Item ${item.id} falhou após ${this.maxRetries} tentativas`);
          }
        }

        // Delay entre processamentos
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.processDelay));
        }
      }

      this.processing = false;
    }

    /**
     * Obtém status da fila
     */
    getStatus() {
      return {
        queueLength: this.queue.length,
        processing: this.processing,
        items: this.queue.map(q => ({
          id: q.id,
          priority: q.priority,
          retries: q.retries,
          addedAt: q.addedAt
        }))
      };
    }

    /**
     * Limpa a fila
     */
    clear() {
      this.queue = [];
      this.processing = false;
    }

    /**
     * Remove item específico
     */
    remove(id) {
      const index = this.queue.findIndex(q => q.id === id);
      if (index !== -1) {
        this.queue.splice(index, 1);
        return true;
      }
      return false;
    }
  }

  // ============================================================
  // 🎓 CONTINUOUS LEARNING SYSTEM
  // Sistema de aprendizado contínuo com feedback
  // ============================================================
  class ContinuousLearningSystem {
    constructor() {
      this.feedbackBuffer = [];
      this.knowledgeBase = new Map();
      this.patternStats = new Map();
      this.batchSize = 10;
      this.minConfidence = 0.3;
      this.learnedPatterns = [];
      this.MAX_PATTERNS = 200;
      this.PRUNE_TO = 150;
      this.loadData();
    }

    /**
     * Carrega dados do storage
     */
    async loadData() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.LEARNING_DATA);
        if (data[STORAGE_KEYS.LEARNING_DATA]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.LEARNING_DATA]);
          
          if (parsed.knowledgeBase) {
            Object.entries(parsed.knowledgeBase).forEach(([key, value]) => {
              this.knowledgeBase.set(key, value);
            });
          }
          
          if (parsed.patternStats) {
            Object.entries(parsed.patternStats).forEach(([key, value]) => {
              this.patternStats.set(key, value);
            });
          }
        }
      } catch (error) {
        console.warn('[SmartBot Learning] Erro ao carregar dados:', error);
      }
      
      // Carrega padrões aprendidos
      await this.loadLearnedPatterns();
    }

    /**
     * Salva dados no storage
     */
    async saveData() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.LEARNING_DATA]: JSON.stringify({
            knowledgeBase: Object.fromEntries(this.knowledgeBase),
            patternStats: Object.fromEntries(this.patternStats)
          })
        });
      } catch (error) {
        console.warn('[SmartBot Learning] Erro ao salvar dados:', error);
      }
    }

    /**
     * Registra feedback sobre uma resposta
     * @param {Object} feedback - {input, response, rating, context}
     */
    recordFeedback(feedback) {
      this.feedbackBuffer.push({
        ...feedback,
        timestamp: new Date().toISOString()
      });

      // Processa batch quando atinge o limite
      if (this.feedbackBuffer.length >= this.batchSize) {
        this.processFeedbackBatch();
      }

      return true;
    }

    /**
     * Processa batch de feedback
     */
    async processFeedbackBatch() {
      if (this.feedbackBuffer.length === 0) return;

      const batch = [...this.feedbackBuffer];
      this.feedbackBuffer = [];

      console.log(`[SmartBot Learning] Processando batch de ${batch.length} feedbacks`);

      for (const feedback of batch) {
        await this.learnFromFeedback(feedback);
      }

      this.optimizeKnowledgeBase();
      await this.saveData();
    }

    /**
     * Aprende com um feedback individual
     */
    async learnFromFeedback(feedback) {
      const { input, response, rating, context } = feedback;
      
      // Extrai padrões do input
      const patterns = this.extractPatterns(input);
      
      patterns.forEach(pattern => {
        const key = pattern.toLowerCase();
        
        if (!this.patternStats.has(key)) {
          this.patternStats.set(key, {
            pattern: key,
            positive: 0,
            negative: 0,
            responses: [],
            avgRating: 0,
            lastUpdated: new Date().toISOString()
          });
        }
        
        const stats = this.patternStats.get(key);
        
        if (rating >= 4) {
          stats.positive++;
          // Adiciona resposta positiva ao conhecimento
          if (!stats.responses.some(r => this.similarity(r, response) > 0.8)) {
            stats.responses.push({
              text: response,
              rating,
              context: context?.intent || 'general'
            });
          }
        } else if (rating <= 2) {
          stats.negative++;
        }
        
        // Atualiza média
        const total = stats.positive + stats.negative;
        stats.avgRating = (stats.avgRating * (total - 1) + rating) / total;
        stats.lastUpdated = new Date().toISOString();
      });
    }

    /**
     * Extrai padrões de texto (n-grams)
     */
    extractPatterns(text) {
      if (!text) return [];
      
      const words = text.toLowerCase()
        .replace(/[^\w\sáéíóúãõâêôç]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      const patterns = [];
      
      // Unigrams
      patterns.push(...words);
      
      // Bigrams
      for (let i = 0; i < words.length - 1; i++) {
        patterns.push(`${words[i]} ${words[i + 1]}`);
      }
      
      // Trigrams
      for (let i = 0; i < words.length - 2; i++) {
        patterns.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
      
      return patterns;
    }

    /**
     * Calcula similaridade entre textos (Jaccard)
     */
    similarity(text1, text2) {
      const set1 = new Set(text1.toLowerCase().split(/\s+/));
      const set2 = new Set(text2.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      return intersection.size / union.size;
    }

    /**
     * Otimiza base de conhecimento
     */
    optimizeKnowledgeBase() {
      // Remove padrões com baixa confiança
      for (const [key, stats] of this.patternStats.entries()) {
        const total = stats.positive + stats.negative;
        const confidence = total > 0 ? stats.positive / total : 0;
        
        if (confidence < this.minConfidence && total > 5) {
          this.patternStats.delete(key);
          continue;
        }
        
        // Remove respostas duplicadas
        if (stats.responses.length > 1) {
          const uniqueResponses = [];
          for (const response of stats.responses) {
            if (!uniqueResponses.some(r => this.similarity(r.text, response.text) > 0.7)) {
              uniqueResponses.push(response);
            }
          }
          stats.responses = uniqueResponses;
        }
      }
    }

    /**
     * Busca respostas aprendidas para um input
     * @param {string} input - Texto de entrada
     * @param {Object} context - Contexto adicional
     * @returns {Array} Respostas sugeridas
     */
    getSuggestedResponses(input, context = {}) {
      const patterns = this.extractPatterns(input);
      const suggestions = [];
      
      patterns.forEach(pattern => {
        const stats = this.patternStats.get(pattern.toLowerCase());
        
        if (stats && stats.responses.length > 0) {
          const confidence = stats.positive / (stats.positive + stats.negative + 1);
          
          stats.responses.forEach(response => {
            if (!suggestions.some(s => this.similarity(s.text, response.text) > 0.7)) {
              suggestions.push({
                text: response.text,
                confidence,
                pattern,
                rating: response.rating,
                source: 'learned'
              });
            }
          });
        }
      });
      
      // Ordena por confiança
      return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    }

    /**
     * Obtém estatísticas do sistema de aprendizado
     */
    getStats() {
      const patterns = Array.from(this.patternStats.values());
      
      return {
        totalPatterns: patterns.length,
        totalFeedback: patterns.reduce((sum, p) => sum + p.positive + p.negative, 0),
        avgRating: patterns.length > 0 
          ? patterns.reduce((sum, p) => sum + p.avgRating, 0) / patterns.length 
          : 0,
        topPatterns: patterns
          .sort((a, b) => (b.positive - b.negative) - (a.positive - a.negative))
          .slice(0, 10)
          .map(p => ({ pattern: p.pattern, score: p.positive - p.negative })),
        bufferSize: this.feedbackBuffer.length
      };
    }

    /**
     * Aprende com uma interação
     * Baseado em CERTO-WHATSAPPLITE-main-21/05chromeextensionwhatsapp/content/content.js learnFromInteraction()
     * @param {Object} interaction - { messageText, response, confidence, intent }
     */
    learnFromInteraction(interaction) {
      if (!interaction?.messageText || !interaction?.response) return;
      
      const text = interaction.messageText.toLowerCase();
      
      // Verifica se já existe padrão similar
      const existingPattern = this.learnedPatterns.find(p => 
        p.triggers.some(t => text.includes(t.toLowerCase()))
      );
      
      if (existingPattern) {
        // Atualiza padrão existente
        existingPattern.occurrences = (existingPattern.occurrences || 0) + 1;
        existingPattern.confidence = Math.min(95, (existingPattern.confidence || 70) + 2);
        existingPattern.lastUsed = Date.now();
        
        console.log('[Learning] 📈 Padrão atualizado:', existingPattern.triggers[0], 'conf:', existingPattern.confidence);
      } else if (interaction.confidence >= 80) {
        // Cria novo padrão apenas se confiança alta
        const words = text
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 5);
        
        if (words.length >= 2) {
          this.learnedPatterns.push({
            triggers: words,
            response: interaction.response,
            intent: interaction.intent || 'general',
            confidence: 70,
            occurrences: 1,
            createdAt: Date.now(),
            lastUsed: Date.now()
          });
          
          console.log('[Learning] 📚 Novo padrão aprendido:', words);
        }
      }
      
      // Prune se exceder limite
      if (this.learnedPatterns.length > this.MAX_PATTERNS) {
        this.prunePatterns();
      }
      
      // Salva
      this.saveLearnedPatterns();
    }

    /**
     * Remove padrões menos usados/confiantes
     */
    prunePatterns() {
      // Ordena por score (occurrences * confidence)
      this.learnedPatterns.sort((a, b) => {
        const scoreA = (a.occurrences || 0) * (a.confidence || 0);
        const scoreB = (b.occurrences || 0) * (b.confidence || 0);
        return scoreB - scoreA;
      });
      
      // Mantém apenas os melhores
      const removed = this.learnedPatterns.length - this.PRUNE_TO;
      this.learnedPatterns = this.learnedPatterns.slice(0, this.PRUNE_TO);
      
      console.log(`[Learning] 🧹 Pruned ${removed} padrões. Total: ${this.learnedPatterns.length}`);
    }

    /**
     * Busca padrão aprendido que faz match
     * @param {string} text - Texto a buscar
     * @returns {Object|null} - { pattern, confidence, response }
     */
    findLearnedPattern(text) {
      if (!text) return null;
      
      const lowerText = text.toLowerCase();
      
      for (const pattern of this.learnedPatterns) {
        if (pattern.triggers.some(t => lowerText.includes(t.toLowerCase()))) {
          return {
            pattern,
            confidence: pattern.confidence || 85,
            response: pattern.response
          };
        }
      }
      
      return null;
    }

    /**
     * Salva padrões aprendidos
     */
    async saveLearnedPatterns() {
      try {
        await chrome.storage.local.set({
          'whl_learned_patterns': this.learnedPatterns
        });
      } catch (e) {
        console.error('[Learning] Erro ao salvar padrões:', e);
      }
    }

    /**
     * Carrega padrões aprendidos
     */
    async loadLearnedPatterns() {
      try {
        const data = await chrome.storage.local.get('whl_learned_patterns');
        this.learnedPatterns = data.whl_learned_patterns || [];
        console.log('[Learning] Carregados', this.learnedPatterns.length, 'padrões');
      } catch (e) {
        console.error('[Learning] Erro ao carregar padrões:', e);
      }
    }

    /**
     * Força processamento do buffer
     */
    flush() {
      return this.processFeedbackBatch();
    }

    /**
     * Limpa todos os dados aprendidos
     */
    async reset() {
      this.feedbackBuffer = [];
      this.knowledgeBase.clear();
      this.patternStats.clear();
      await chrome.storage.local.remove(STORAGE_KEYS.LEARNING_DATA);
    }
  }

  // ============================================================
  // 📈 SMART METRICS SYSTEM
  // Sistema de métricas com detecção de anomalias
  // ============================================================
  class SmartMetricsSystem {
    constructor() {
      this.metrics = {
        messages: { total: 0, today: 0, byHour: new Array(24).fill(0) },
        responses: { total: 0, aiGenerated: 0, manual: 0 },
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        responseTime: { total: 0, count: 0, avg: 0 },
        escalations: { total: 0, rate: 0 },
        satisfaction: { total: 0, count: 0, avg: 0 }
      };
      this.history = [];
      this.anomalyThresholds = {
        escalationRate: 0.3,
        negativeRate: 0.4,
        avgResponseTime: 60000 // 1 minuto
      };
      this.loadMetrics();
    }

    /**
     * Carrega métricas do storage
     */
    async loadMetrics() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.METRICS);
        if (data[STORAGE_KEYS.METRICS]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.METRICS]);
          this.metrics = { ...this.metrics, ...parsed.metrics };
          this.history = parsed.history || [];
        }
      } catch (error) {
        console.warn('[SmartBot Metrics] Erro ao carregar métricas:', error);
      }
    }

    /**
     * Salva métricas no storage
     */
    async saveMetrics() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.METRICS]: JSON.stringify({
            metrics: this.metrics,
            history: this.history.slice(-1000) // Mantém últimos 1000 registros
          })
        });
      } catch (error) {
        console.warn('[SmartBot Metrics] Erro ao salvar métricas:', error);
      }
    }

    /**
     * Registra evento de mensagem
     */
    recordMessage(message, context = {}) {
      this.metrics.messages.total++;
      this.metrics.messages.today++;
      
      const hour = new Date().getHours();
      this.metrics.messages.byHour[hour]++;
      
      // Registra sentimento
      if (context.sentiment !== undefined) {
        if (context.sentiment > 0.6) this.metrics.sentiment.positive++;
        else if (context.sentiment < 0.4) this.metrics.sentiment.negative++;
        else this.metrics.sentiment.neutral++;
      }
      
      this.history.push({
        type: 'message',
        timestamp: new Date().toISOString(),
        context
      });
      
      this.checkAnomalies();
      this.saveMetrics();
    }

    /**
     * Registra resposta
     */
    recordResponse(responseTime, isAI = false) {
      this.metrics.responses.total++;
      
      if (isAI) {
        this.metrics.responses.aiGenerated++;
      } else {
        this.metrics.responses.manual++;
      }
      
      this.metrics.responseTime.total += responseTime;
      this.metrics.responseTime.count++;
      this.metrics.responseTime.avg = 
        this.metrics.responseTime.total / this.metrics.responseTime.count;
      
      this.saveMetrics();
    }

    /**
     * Registra escalação
     */
    recordEscalation() {
      this.metrics.escalations.total++;
      this.metrics.escalations.rate = 
        this.metrics.escalations.total / this.metrics.messages.total;
      
      this.checkAnomalies();
      this.saveMetrics();
    }

    /**
     * Registra satisfação
     */
    recordSatisfaction(score) {
      this.metrics.satisfaction.total += score;
      this.metrics.satisfaction.count++;
      this.metrics.satisfaction.avg = 
        this.metrics.satisfaction.total / this.metrics.satisfaction.count;
      
      this.saveMetrics();
    }

    /**
     * Verifica anomalias
     */
    checkAnomalies() {
      const anomalies = [];
      
      // Taxa de escalação alta
      if (this.metrics.escalations.rate > this.anomalyThresholds.escalationRate) {
        anomalies.push({
          type: 'high_escalation_rate',
          value: this.metrics.escalations.rate,
          threshold: this.anomalyThresholds.escalationRate,
          message: `Taxa de escalação alta: ${(this.metrics.escalations.rate * 100).toFixed(1)}%`
        });
      }
      
      // Muitos sentimentos negativos
      const totalSentiment = this.metrics.sentiment.positive + 
                            this.metrics.sentiment.neutral + 
                            this.metrics.sentiment.negative;
      if (totalSentiment > 10) {
        const negativeRate = this.metrics.sentiment.negative / totalSentiment;
        if (negativeRate > this.anomalyThresholds.negativeRate) {
          anomalies.push({
            type: 'high_negative_sentiment',
            value: negativeRate,
            threshold: this.anomalyThresholds.negativeRate,
            message: `Alto índice de sentimentos negativos: ${(negativeRate * 100).toFixed(1)}%`
          });
        }
      }
      
      // Tempo de resposta alto
      if (this.metrics.responseTime.avg > this.anomalyThresholds.avgResponseTime) {
        anomalies.push({
          type: 'high_response_time',
          value: this.metrics.responseTime.avg,
          threshold: this.anomalyThresholds.avgResponseTime,
          message: `Tempo médio de resposta alto: ${(this.metrics.responseTime.avg / 1000).toFixed(1)}s`
        });
      }
      
      if (anomalies.length > 0) {
        console.warn('[SmartBot Metrics] Anomalias detectadas:', anomalies);
        this.onAnomaliesDetected(anomalies);
      }
      
      return anomalies;
    }

    /**
     * Callback para anomalias (pode ser sobrescrito)
     */
    onAnomaliesDetected(anomalies) {
      // Dispara evento para o sistema de notificações
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('smartbot:anomalies', {
          detail: { anomalies }
        }));
      }
    }

    /**
     * Obtém métricas completas
     */
    getMetrics() {
      const totalSentiment = this.metrics.sentiment.positive + 
                            this.metrics.sentiment.neutral + 
                            this.metrics.sentiment.negative;
      
      return {
        ...this.metrics,
        computed: {
          aiResponseRate: this.metrics.responses.total > 0 
            ? this.metrics.responses.aiGenerated / this.metrics.responses.total 
            : 0,
          positiveRate: totalSentiment > 0 
            ? this.metrics.sentiment.positive / totalSentiment 
            : 0,
          negativeRate: totalSentiment > 0 
            ? this.metrics.sentiment.negative / totalSentiment 
            : 0,
          avgResponseTimeSeconds: this.metrics.responseTime.avg / 1000
        },
        anomalies: this.checkAnomalies()
      };
    }

    /**
     * Obtém métricas do período
     */
    getMetricsByPeriod(hours = 24) {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      return this.history.filter(h => new Date(h.timestamp) > cutoff);
    }

    /**
     * Reseta métricas diárias
     */
    resetDaily() {
      this.metrics.messages.today = 0;
      this.metrics.messages.byHour = new Array(24).fill(0);
      this.saveMetrics();
    }

    /**
     * Reseta todas as métricas
     */
    async reset() {
      this.metrics = {
        messages: { total: 0, today: 0, byHour: new Array(24).fill(0) },
        responses: { total: 0, aiGenerated: 0, manual: 0 },
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        responseTime: { total: 0, count: 0, avg: 0 },
        escalations: { total: 0, rate: 0 },
        satisfaction: { total: 0, count: 0, avg: 0 }
      };
      this.history = [];
      await chrome.storage.local.remove(STORAGE_KEYS.METRICS);
    }
  }

  // ============================================================
  // 🎯 SMARTBOT IA MAIN CLASS
  // Classe principal que integra todos os sistemas
  // ============================================================
  class SmartBotIA {
    constructor() {
      this.contextAnalyzer = new AdvancedContextAnalyzer();
      this.priorityQueue = new IntelligentPriorityQueue({
        onProcess: this.processQueueItem.bind(this),
        onError: this.handleQueueError.bind(this)
      });
      this.learningSystem = new ContinuousLearningSystem();
      this.metricsSystem = new SmartMetricsSystem();
      
      this.initialized = false;
      this.callbacks = {
        onSuggestion: null,
        onAnalysis: null,
        onMetricsUpdate: null
      };

      console.log('[SmartBot IA] Sistema inicializado');
    }

    /**
     * Inicializa o sistema
     */
    async init() {
      if (this.initialized) return;
      
      await this.contextAnalyzer.loadProfiles();
      await this.learningSystem.loadData();
      await this.metricsSystem.loadMetrics();
      
      this.initialized = true;
      console.log('[SmartBot IA] Dados carregados com sucesso');
    }

    /**
     * Analisa mensagem recebida
     * @param {string} chatId - ID do chat
     * @param {Object} message - Mensagem recebida
     * @param {Array} history - Histórico de mensagens
     * @returns {Object} Análise completa
     */
    async analyzeMessage(chatId, message, history = []) {
      // Análise de contexto
      const contextAnalysis = this.contextAnalyzer.analyzeContext(chatId, history, message);
      
      // Busca sugestões aprendidas
      const learnedSuggestions = this.learningSystem.getSuggestedResponses(
        message.body || message.text, 
        { intent: contextAnalysis.flowAnalysis.currentStage }
      );
      
      // Registra métricas
      this.metricsSystem.recordMessage(message, {
        sentiment: contextAnalysis.sentimentTrend.average,
        intent: contextAnalysis.flowAnalysis.currentStage
      });
      
      // Adiciona à fila se urgente
      if (contextAnalysis.urgencyLevel > 0.5) {
        this.priorityQueue.enqueue(message, {
          sentiment: contextAnalysis.sentimentTrend.average,
          urgency: contextAnalysis.urgencyLevel,
          intent: contextAnalysis.flowAnalysis.currentStage
        });
      }

      const result = {
        context: contextAnalysis,
        suggestions: learnedSuggestions,
        metrics: this.metricsSystem.getMetrics(),
        queueStatus: this.priorityQueue.getStatus()
      };

      // Callback
      if (this.callbacks.onAnalysis) {
        this.callbacks.onAnalysis(result);
      }

      return result;
    }

    /**
     * Registra feedback de resposta
     */
    recordResponseFeedback(input, response, rating, context = {}) {
      this.learningSystem.recordFeedback({
        input,
        response,
        rating,
        context
      });
      
      this.metricsSystem.recordSatisfaction(rating);
      
      return true;
    }

    /**
     * Registra tempo de resposta
     */
    recordResponseTime(responseTime, isAI = false) {
      this.metricsSystem.recordResponse(responseTime, isAI);
    }

    /**
     * Processa item da fila
     */
    async processQueueItem(queueItem) {
      console.log('[SmartBot IA] Processando item da fila:', queueItem.id);
      
      // Aqui você pode integrar com o sistema de notificações
      // ou processar automaticamente mensagens urgentes
      
      if (this.callbacks.onSuggestion) {
        this.callbacks.onSuggestion({
          type: 'urgent_message',
          item: queueItem.item,
          priority: queueItem.priority,
          context: queueItem.context
        });
      }
    }

    /**
     * Trata erro da fila
     */
    handleQueueError(error, item) {
      console.error('[SmartBot IA] Erro ao processar item:', error);
    }

    /**
     * Define callbacks
     */
    setCallbacks(callbacks) {
      this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Obtém perfil de cliente
     */
    getCustomerProfile(chatId) {
      return this.contextAnalyzer.getCustomerProfile(chatId);
    }

    /**
     * Obtém estatísticas de aprendizado
     */
    getLearningStats() {
      return this.learningSystem.getStats();
    }

    /**
     * Obtém métricas
     */
    getMetrics() {
      return this.metricsSystem.getMetrics();
    }

    /**
     * Obtém status da fila
     */
    getQueueStatus() {
      return this.priorityQueue.getStatus();
    }

    /**
     * Força processamento do buffer de aprendizado
     */
    async flushLearning() {
      await this.learningSystem.flush();
    }

    /**
     * Reseta todos os dados
     */
    async resetAll() {
      await this.learningSystem.reset();
      await this.metricsSystem.reset();
      this.priorityQueue.clear();
      console.log('[SmartBot IA] Todos os dados foram resetados');
    }

    /**
     * Exporta dados para backup
     */
    async exportData() {
      const data = {
        profiles: this.contextAnalyzer.getAllProfiles(),
        learning: this.learningSystem.getStats(),
        metrics: this.metricsSystem.getMetrics(),
        exportedAt: new Date().toISOString()
      };
      
      return JSON.stringify(data, null, 2);
    }

    /**
     * Gera uma resposta para a mensagem usando IA
     * @param {string} chatId - ID do chat
     * @param {string} message - Mensagem recebida
     * @param {Array} history - Histórico de mensagens
     * @returns {Promise<Object>} { text, confidence, source }
     */
    async generateResponse(chatId, message, history = []) {
      try {
        // Analisar contexto
        const analysis = await this.analyzeMessage(chatId, message, history);
        
        // Buscar sugestões aprendidas
        const suggestions = this.learningSystem.getSuggestedResponses(message, {
          intent: analysis.contextAnalysis?.flowAnalysis?.currentStage
        });
        
        // Se tem sugestão com alta confiança, usar
        if (suggestions.length > 0 && suggestions[0].confidence > 0.7) {
          return {
            text: suggestions[0].text,
            confidence: suggestions[0].confidence,
            source: 'learned'
          };
        }
        
        // Tentar usar CopilotEngine
        if (window.CopilotEngine && window.CopilotEngine.generateResponse) {
          try {
            const result = await window.CopilotEngine.generateResponse(chatId, analysis);
            if (result && result.content) {
              return {
                text: result.content,
                confidence: result.confidence || 0.8,
                source: 'copilot'
              };
            }
          } catch (e) {
            console.warn('[SmartBot IA] CopilotEngine falhou:', e.message);
          }
        }
        
        // Tentar usar AIService
        if (window.AIService && window.AIService.generateResponse) {
          try {
            const context = history.map(m => ({
              role: m.fromMe ? 'assistant' : 'user',
              content: m.text || m.body || m.content
            }));
            
            const response = await window.AIService.generateResponse(message, context, {
              temperature: 0.7,
              maxTokens: 300
            });
            
            if (response) {
              return {
                text: response,
                confidence: 0.75,
                source: 'ai_service'
              };
            }
          } catch (e) {
            console.warn('[SmartBot IA] AIService falhou:', e.message);
          }
        }
        
        // Fallback: usar sugestão de menor confiança ou template
        if (suggestions.length > 0) {
          return {
            text: suggestions[0].text,
            confidence: suggestions[0].confidence,
            source: 'learned_fallback'
          };
        }
        
        // Último fallback: mensagem genérica
        return {
          text: 'Entendi sua mensagem. Como posso ajudar?',
          confidence: 0.3,
          source: 'fallback'
        };
        
      } catch (error) {
        console.error('[SmartBot IA] Erro em generateResponse:', error);
        return null;
      }
    }

    /**
     * Analisa mensagem e sugere respostas
     * @param {string} chatId - ID do chat
     * @param {string} message - Mensagem recebida
     * @param {Array} history - Histórico de mensagens
     * @returns {Promise<Object>} { analysis, suggestions }
     */
    async analyzeAndSuggest(chatId, message, history = []) {
      try {
        // Analisar mensagem
        const analysis = await this.analyzeMessage(chatId, message, history);
        
        // Obter sugestões
        const suggestions = [];
        
        // Sugestões do sistema de aprendizado
        const learnedSuggestions = this.learningSystem.getSuggestedResponses(message, {
          intent: analysis.contextAnalysis?.flowAnalysis?.currentStage
        });
        
        learnedSuggestions.forEach(s => {
          suggestions.push({
            text: s.text,
            confidence: s.confidence,
            source: 'learned',
            type: 'smart'
          });
        });
        
        // Se não tem sugestões suficientes, gerar com IA
        if (suggestions.length < 3 && window.AIService && window.AIService.isProviderConfigured?.()) {
          try {
            const response = await this.generateResponse(chatId, message, history);
            if (response && response.text) {
              suggestions.push({
                text: response.text,
                confidence: response.confidence,
                source: response.source,
                type: 'ai'
              });
            }
          } catch (e) {
            console.warn('[SmartBot IA] Falha ao gerar sugestão IA:', e.message);
          }
        }
        
        // Ordenar por confiança
        suggestions.sort((a, b) => b.confidence - a.confidence);
        
        return {
          analysis,
          suggestions: suggestions.slice(0, 5),
          sentiment: analysis.contextAnalysis?.sentimentTrend,
          urgency: analysis.urgencyLevel,
          recommendedTone: analysis.contextAnalysis?.recommendedTone
        };
        
      } catch (error) {
        console.error('[SmartBot IA] Erro em analyzeAndSuggest:', error);
        return {
          analysis: null,
          suggestions: [],
          error: error.message
        };
      }
    }
  }

  // ============================================================
  // INICIALIZAÇÃO GLOBAL
  // ============================================================
  
  // Cria instância global
  if (typeof window !== 'undefined') {
    window.SmartBotIA = SmartBotIA;
    window.smartBot = new SmartBotIA();
    
    // Inicializa automaticamente
    window.smartBot.init().then(() => {
      console.log('[SmartBot IA] ✅ Sistema pronto para uso');
    });
  }

})();
