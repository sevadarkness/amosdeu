/**
 * 🧠 SmartBot IA Service - Backend
 * 
 * Serviço de inteligência avançada para WhatsHybrid Backend
 * - Análise de contexto avançada
 * - Priorização inteligente de mensagens
 * - Sistema de aprendizado contínuo
 * - Métricas com detecção de anomalias
 * 
 * @version 1.0.0
 */

const EventEmitter = require('events');

// ============================================================
// ADVANCED CONTEXT ANALYZER
// ============================================================
class AdvancedContextAnalyzer {
  constructor(storage = null) {
    this.storage = storage;
    this.customerProfiles = new Map();
    this.conversationFlows = new Map();
    this.commonFlowPatterns = [
      { pattern: ['greeting', 'question'], name: 'inquiry' },
      { pattern: ['greeting', 'complaint'], name: 'support_issue' },
      { pattern: ['complaint', 'apology', 'solution'], name: 'resolution' },
      { pattern: ['question', 'answer', 'thanks'], name: 'successful_help' },
      { pattern: ['greeting', 'product_inquiry', 'price_inquiry'], name: 'sales_lead' }
    ];
  }

  async loadProfiles() {
    if (this.storage) {
      try {
        const profiles = await this.storage.get('smartbot_profiles');
        if (profiles) {
          Object.entries(profiles).forEach(([key, value]) => {
            this.customerProfiles.set(key, value);
          });
        }
      } catch (error) {
        console.warn('[SmartBot] Error loading profiles:', error);
      }
    }
  }

  async saveProfiles() {
    if (this.storage) {
      try {
        const profiles = Object.fromEntries(this.customerProfiles);
        await this.storage.set('smartbot_profiles', profiles);
      } catch (error) {
        console.warn('[SmartBot] Error saving profiles:', error);
      }
    }
  }

  analyzeContext(chatId, messages, currentMessage) {
    const customerProfile = this.getOrCreateProfile(chatId);
    const flowAnalysis = this.analyzeConversationFlow(chatId, messages);
    const sentimentTrend = this.analyzeSentimentTrend(messages);
    const urgencyLevel = this.detectUrgency(currentMessage, messages);
    const topicClusters = this.identifyTopicClusters(messages);

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

  updateCustomerProfile(chatId, message, sentimentTrend) {
    const profile = this.getOrCreateProfile(chatId);
    
    profile.lastContact = new Date().toISOString();
    profile.messageCount++;
    
    if (sentimentTrend.average > 0.6) {
      profile.preferredTone = 'friendly';
    } else if (sentimentTrend.average < 0.4) {
      profile.preferredTone = 'formal';
    }
    
    profile.satisfactionScore = profile.satisfactionScore * 0.8 + sentimentTrend.average * 0.2;
    
    this.saveProfiles();
    return profile;
  }

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

  classifyMessageStage(message) {
    const text = (message.body || message.text || message.content || '').toLowerCase();
    
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

  predictNextStage(stages, flowPattern) {
    const flow = this.commonFlowPatterns.find(f => f.name === flowPattern);
    if (!flow) return 'unknown';
    
    const currentIndex = stages.length % flow.pattern.length;
    return flow.pattern[currentIndex] || 'resolution';
  }

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

  analyzeSentimentTrend(messages) {
    if (messages.length === 0) {
      return { values: [], average: 0.5, trend: 'neutral', volatility: 0, hasHostile: false };
    }

    const sentiments = messages.map(msg => 
      this.analyzeSentiment(msg.body || msg.text || msg.content || '')
    );
    
    // Extrair scores e verificar hostilidade
    const values = sentiments.map(s => typeof s === 'object' ? s.score : s);
    const hasHostile = sentiments.some(s => s && s.isHostile);
    
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

    return { values, average, trend, volatility, hasHostile };
  }

  analyzeSentiment(text) {
    if (!text) return { score: 0.5, isHostile: false };
    
    const lowerText = text.toLowerCase();
    
    const positiveWords = [
      'ótimo', 'excelente', 'perfeito', 'maravilhoso', 'obrigado', 'obrigada',
      'adorei', 'amei', 'incrível', 'parabéns', 'satisfeito', 'feliz', 'bom',
      'legal', 'top', 'show', 'massa', 'demais'
    ];
    
    const negativeWords = [
      'péssimo', 'horrível', 'terrível', 'problema', 'erro', 'falha', 'ruim',
      'insatisfeito', 'decepcionado', 'frustrado', 'raiva', 'absurdo', 'nunca',
      'cancelar', 'reclamação', 'descaso'
    ];
    
    // IMPORTANTE: Palavras hostis/insultos
    const hostileWords = [
      'merda', 'bosta', 'porra', 'caralho', 'cacete', 'droga', 'inferno',
      'idiota', 'burro', 'imbecil', 'estúpido', 'otário', 'babaca', 'cretino', 'retardado',
      'fdp', 'pqp', 'vsf', 'vtnc', 'tnc', 'puta', 'vagabundo', 'safado', 'pilantra',
      'filho da puta', 'vai tomar', 'vai se foder', 'foda-se', 'tomar no cu',
      'desgraça', 'maldito', 'some daqui', 'cala boca', 'lixo humano', 'nojento'
    ];
    
    let score = 0.5;
    let isHostile = false;
    
    // Verificar hostilidade primeiro (maior peso)
    hostileWords.forEach(word => {
      if (lowerText.includes(word)) {
        score -= 0.3;
        isHostile = true;
      }
    });
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });
    
    // CAPS LOCK indica intensidade
    if (text === text.toUpperCase() && text.length > 5) {
      score = score < 0.5 ? score - 0.15 : score + 0.05;
    }
    
    score = Math.max(0, Math.min(1, score));
    
    // Retornar objeto com mais informações
    return {
      score,
      isHostile,
      label: isHostile ? 'hostile' : score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral',
      advice: isHostile ? 'Responda de forma profissional e calma, sem reagir aos insultos.' : null
    };
  }

  calculateVolatility(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  detectUrgency(currentMessage, messages) {
    const text = (currentMessage?.body || currentMessage?.text || currentMessage?.content || '').toLowerCase();
    
    const urgentKeywords = [
      'urgente', 'urgência', 'emergência', 'imediato', 'agora', 'já',
      'não pode esperar', 'crítico', 'importante', 'prazo', 'deadline',
      'socorro', 'help', 'asap'
    ];
    
    let urgency = 0;
    
    urgentKeywords.forEach(keyword => {
      if (text.includes(keyword)) urgency += 0.2;
    });
    
    if (text === text.toUpperCase() && text.length > 10) urgency += 0.15;
    
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    if (exclamations > 2) urgency += 0.1;
    if (questions > 2) urgency += 0.1;
    
    const complaints = messages.filter(m => 
      this.classifyMessageStage(m) === 'complaint'
    ).length;
    if (complaints > 2) urgency += 0.15;
    
    return Math.min(1, urgency);
  }

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
      const text = (msg.body || msg.text || msg.content || '').toLowerCase();
      
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
      .map(([topic, count]) => ({ topic, count, percentage: count / Math.max(1, messages.length) }));
  }

  recommendTone(profile, sentimentTrend) {
    // PRIORIDADE: Hostilidade detectada
    if (sentimentTrend.hasHostile) {
      return {
        tone: 'calm_professional',
        advice: 'O cliente está usando linguagem hostil. Responda de forma calma e profissional, sem reagir às provocações.',
        suggestions: [
          'Manter a calma e não levar para o lado pessoal',
          'Focar na solução do problema',
          'Usar frases empáticas como "Entendo sua frustração..."',
          'Evitar respostas passivo-agressivas'
        ]
      };
    }
    
    if (sentimentTrend.average < 0.3 || sentimentTrend.trend === 'declining') {
      return {
        tone: 'empathetic_formal',
        advice: 'Cliente insatisfeito. Use tom empático e formal.',
        suggestions: ['Demonstrar compreensão', 'Oferecer solução concreta']
      };
    }
    if (profile.preferredTone === 'friendly' && sentimentTrend.average > 0.5) {
      return {
        tone: 'friendly_casual',
        advice: 'Cliente satisfeito e receptivo.',
        suggestions: ['Manter tom amigável', 'Pode usar emojis com moderação']
      };
    }
    if (profile.messageCount > 10) {
      return {
        tone: 'familiar_professional',
        advice: 'Cliente recorrente.',
        suggestions: ['Mostrar familiaridade', 'Referenciar interações anteriores']
      };
    }
    return {
      tone: 'professional_neutral',
      advice: 'Manter tom profissional padrão.',
      suggestions: ['Ser claro e objetivo']
    };
  }

  suggestApproach(flowAnalysis, urgencyLevel) {
    if (urgencyLevel > 0.7) {
      return {
        approach: 'immediate_action',
        priority: 'high',
        actions: ['Respond immediately', 'Offer quick solution', 'Consider escalation']
      };
    }
    
    if (flowAnalysis.currentStage === 'complaint') {
      return {
        approach: 'empathetic_resolution',
        priority: 'high',
        actions: ['Show empathy', 'Acknowledge problem', 'Present solution']
      };
    }
    
    if (flowAnalysis.flowPattern === 'sales_lead') {
      return {
        approach: 'consultative_selling',
        priority: 'medium',
        actions: ['Identify needs', 'Present benefits', 'Create opportunity sense']
      };
    }
    
    return {
      approach: 'standard_support',
      priority: 'normal',
      actions: ['Respond objectively', 'Offer additional help']
    };
  }

  generateContextSummary(profile, flowAnalysis, sentimentTrend) {
    const isReturning = profile.messageCount > 1;
    const satisfaction = profile.satisfactionScore > 0.6 ? 'satisfied' : 
                        profile.satisfactionScore < 0.4 ? 'unsatisfied' : 'neutral';
    
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

  getCustomerProfile(chatId) {
    return this.customerProfiles.get(chatId) || null;
  }

  getAllProfiles() {
    return Array.from(this.customerProfiles.values());
  }
}

// ============================================================
// INTELLIGENT PRIORITY QUEUE
// ============================================================
class IntelligentPriorityQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.queue = [];
    this.processing = false;
    this.maxRetries = options.maxRetries || 3;
    this.processDelay = options.processDelay || 1000;
  }

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

    const insertIndex = this.queue.findIndex(q => q.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.emit('enqueue', queueItem);
    
    if (!this.processing) {
      this.startProcessing();
    }

    return queueItem.id;
  }

  calculatePriority(item, context) {
    let priority = 50;

    if (context.sentiment !== undefined) {
      if (context.sentiment < 0.3) priority += 30;
      else if (context.sentiment < 0.5) priority += 15;
    }

    const intent = context.intent || item.intent;
    if (intent === 'complaint') priority += 25;
    else if (intent === 'urgent') priority += 35;
    else if (intent === 'question') priority += 10;

    if (context.urgency !== undefined) {
      priority += context.urgency * 30;
    }

    const text = (item.body || item.text || item.content || '').toLowerCase();
    const urgentWords = ['urgente', 'emergência', 'imediato', 'agora', 'crítico'];
    urgentWords.forEach(word => {
      if (text.includes(word)) priority += 10;
    });

    if (context.isVIP) priority += 20;
    if (context.messageCount > 20) priority += 5;

    if (item.waitTime > 60000) priority += 10;
    if (item.waitTime > 300000) priority += 15;

    return Math.min(100, Math.max(0, priority));
  }

  async startProcessing() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        this.emit('process', item);
        await this.processItem(item);
        this.emit('processed', item);
      } catch (error) {
        item.retries++;
        
        if (item.retries < this.maxRetries) {
          item.priority = Math.max(0, item.priority - 10);
          this.queue.push(item);
          this.emit('retry', item);
        } else {
          this.emit('failed', { item, error });
        }
      }

      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.processDelay));
      }
    }

    this.processing = false;
  }

  async processItem(item) {
    // Override in subclass or set handler
    return item;
  }

  setHandler(handler) {
    this.processItem = handler;
  }

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

  clear() {
    this.queue = [];
    this.processing = false;
  }

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
// CONTINUOUS LEARNING SYSTEM
// ============================================================
class ContinuousLearningSystem {
  constructor(storage = null) {
    this.storage = storage;
    this.feedbackBuffer = [];
    this.knowledgeBase = new Map();
    this.patternStats = new Map();
    this.batchSize = 10;
    this.minConfidence = 0.3;
  }

  async loadData() {
    if (this.storage) {
      try {
        const data = await this.storage.get('smartbot_learning');
        if (data) {
          if (data.knowledgeBase) {
            Object.entries(data.knowledgeBase).forEach(([key, value]) => {
              this.knowledgeBase.set(key, value);
            });
          }
          if (data.patternStats) {
            Object.entries(data.patternStats).forEach(([key, value]) => {
              this.patternStats.set(key, value);
            });
          }
        }
      } catch (error) {
        console.warn('[SmartBot Learning] Error loading data:', error);
      }
    }
  }

  async saveData() {
    if (this.storage) {
      try {
        await this.storage.set('smartbot_learning', {
          knowledgeBase: Object.fromEntries(this.knowledgeBase),
          patternStats: Object.fromEntries(this.patternStats)
        });
      } catch (error) {
        console.warn('[SmartBot Learning] Error saving data:', error);
      }
    }
  }

  recordFeedback(feedback) {
    this.feedbackBuffer.push({
      ...feedback,
      timestamp: new Date().toISOString()
    });

    if (this.feedbackBuffer.length >= this.batchSize) {
      this.processFeedbackBatch();
    }

    return true;
  }

  async processFeedbackBatch() {
    if (this.feedbackBuffer.length === 0) return;

    const batch = [...this.feedbackBuffer];
    this.feedbackBuffer = [];

    for (const feedback of batch) {
      await this.learnFromFeedback(feedback);
    }

    this.optimizeKnowledgeBase();
    await this.saveData();
  }

  async learnFromFeedback(feedback) {
    const { input, response, rating, context } = feedback;
    
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
      
      const total = stats.positive + stats.negative;
      stats.avgRating = (stats.avgRating * (total - 1) + rating) / total;
      stats.lastUpdated = new Date().toISOString();
    });
  }

  extractPatterns(text) {
    if (!text) return [];
    
    const words = text.toLowerCase()
      .replace(/[^\w\sáéíóúãõâêôç]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
    
    const patterns = [];
    
    patterns.push(...words);
    
    for (let i = 0; i < words.length - 1; i++) {
      patterns.push(`${words[i]} ${words[i + 1]}`);
    }
    
    for (let i = 0; i < words.length - 2; i++) {
      patterns.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    
    return patterns;
  }

  similarity(text1, text2) {
    if (typeof text1 === 'object') text1 = text1.text || '';
    if (typeof text2 === 'object') text2 = text2.text || '';
    
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  optimizeKnowledgeBase() {
    for (const [key, stats] of this.patternStats.entries()) {
      const total = stats.positive + stats.negative;
      const confidence = total > 0 ? stats.positive / total : 0;
      
      if (confidence < this.minConfidence && total > 5) {
        this.patternStats.delete(key);
        continue;
      }
      
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
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

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

  flush() {
    return this.processFeedbackBatch();
  }

  async reset() {
    this.feedbackBuffer = [];
    this.knowledgeBase.clear();
    this.patternStats.clear();
    if (this.storage) {
      await this.storage.delete('smartbot_learning');
    }
  }
}

// ============================================================
// SMART METRICS SYSTEM
// ============================================================
class SmartMetricsSystem extends EventEmitter {
  constructor(storage = null) {
    super();
    this.storage = storage;
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
      avgResponseTime: 60000
    };
  }

  async loadMetrics() {
    if (this.storage) {
      try {
        const data = await this.storage.get('smartbot_metrics');
        if (data) {
          this.metrics = { ...this.metrics, ...data.metrics };
          this.history = data.history || [];
        }
      } catch (error) {
        console.warn('[SmartBot Metrics] Error loading:', error);
      }
    }
  }

  async saveMetrics() {
    if (this.storage) {
      try {
        await this.storage.set('smartbot_metrics', {
          metrics: this.metrics,
          history: this.history.slice(-1000)
        });
      } catch (error) {
        console.warn('[SmartBot Metrics] Error saving:', error);
      }
    }
  }

  recordMessage(message, context = {}) {
    this.metrics.messages.total++;
    this.metrics.messages.today++;
    
    const hour = new Date().getHours();
    this.metrics.messages.byHour[hour]++;
    
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
    
    const anomalies = this.checkAnomalies();
    if (anomalies.length > 0) {
      this.emit('anomalies', anomalies);
    }
    
    this.saveMetrics();
  }

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

  recordEscalation() {
    this.metrics.escalations.total++;
    this.metrics.escalations.rate = 
      this.metrics.escalations.total / this.metrics.messages.total;
    
    const anomalies = this.checkAnomalies();
    if (anomalies.length > 0) {
      this.emit('anomalies', anomalies);
    }
    
    this.saveMetrics();
  }

  recordSatisfaction(score) {
    this.metrics.satisfaction.total += score;
    this.metrics.satisfaction.count++;
    this.metrics.satisfaction.avg = 
      this.metrics.satisfaction.total / this.metrics.satisfaction.count;
    
    this.saveMetrics();
  }

  checkAnomalies() {
    const anomalies = [];
    
    if (this.metrics.escalations.rate > this.anomalyThresholds.escalationRate) {
      anomalies.push({
        type: 'high_escalation_rate',
        value: this.metrics.escalations.rate,
        threshold: this.anomalyThresholds.escalationRate,
        message: `High escalation rate: ${(this.metrics.escalations.rate * 100).toFixed(1)}%`
      });
    }
    
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
          message: `High negative sentiment: ${(negativeRate * 100).toFixed(1)}%`
        });
      }
    }
    
    if (this.metrics.responseTime.avg > this.anomalyThresholds.avgResponseTime) {
      anomalies.push({
        type: 'high_response_time',
        value: this.metrics.responseTime.avg,
        threshold: this.anomalyThresholds.avgResponseTime,
        message: `High avg response time: ${(this.metrics.responseTime.avg / 1000).toFixed(1)}s`
      });
    }
    
    return anomalies;
  }

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

  getMetricsByPeriod(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.history.filter(h => new Date(h.timestamp) > cutoff);
  }

  resetDaily() {
    this.metrics.messages.today = 0;
    this.metrics.messages.byHour = new Array(24).fill(0);
    this.saveMetrics();
  }

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
    if (this.storage) {
      await this.storage.delete('smartbot_metrics');
    }
  }
}

// ============================================================
// SMARTBOT IA SERVICE - MAIN CLASS
// ============================================================
class SmartBotIAService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.storage = options.storage || null;
    this.contextAnalyzer = new AdvancedContextAnalyzer(this.storage);
    this.priorityQueue = new IntelligentPriorityQueue(options.queue);
    this.learningSystem = new ContinuousLearningSystem(this.storage);
    this.metricsSystem = new SmartMetricsSystem(this.storage);
    
    this.initialized = false;
    
    // Setup event forwarding
    this.priorityQueue.on('enqueue', (item) => this.emit('queue:enqueue', item));
    this.priorityQueue.on('process', (item) => this.emit('queue:process', item));
    this.priorityQueue.on('processed', (item) => this.emit('queue:processed', item));
    this.priorityQueue.on('failed', (data) => this.emit('queue:failed', data));
    this.metricsSystem.on('anomalies', (anomalies) => this.emit('anomalies', anomalies));
  }

  async init() {
    if (this.initialized) return;
    
    await this.contextAnalyzer.loadProfiles();
    await this.learningSystem.loadData();
    await this.metricsSystem.loadMetrics();
    
    this.initialized = true;
    this.emit('initialized');
    
    console.log('[SmartBot IA Service] Initialized');
  }

  async analyzeMessage(chatId, message, history = []) {
    const contextAnalysis = this.contextAnalyzer.analyzeContext(chatId, history, message);
    
    const learnedSuggestions = this.learningSystem.getSuggestedResponses(
      message.body || message.text || message.content, 
      { intent: contextAnalysis.flowAnalysis.currentStage }
    );
    
    this.metricsSystem.recordMessage(message, {
      sentiment: contextAnalysis.sentimentTrend.average,
      intent: contextAnalysis.flowAnalysis.currentStage
    });
    
    if (contextAnalysis.urgencyLevel > 0.5) {
      this.priorityQueue.enqueue(message, {
        chatId,
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

    this.emit('analysis', result);

    return result;
  }

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

  recordResponseTime(responseTime, isAI = false) {
    this.metricsSystem.recordResponse(responseTime, isAI);
  }

  setQueueHandler(handler) {
    this.priorityQueue.setHandler(handler);
  }

  getCustomerProfile(chatId) {
    return this.contextAnalyzer.getCustomerProfile(chatId);
  }

  getAllProfiles() {
    return this.contextAnalyzer.getAllProfiles();
  }

  getLearningStats() {
    return this.learningSystem.getStats();
  }

  getMetrics() {
    return this.metricsSystem.getMetrics();
  }

  getQueueStatus() {
    return this.priorityQueue.getStatus();
  }

  async flushLearning() {
    await this.learningSystem.flush();
  }

  async resetAll() {
    await this.learningSystem.reset();
    await this.metricsSystem.reset();
    this.priorityQueue.clear();
    this.emit('reset');
  }

  async exportData() {
    return {
      profiles: this.contextAnalyzer.getAllProfiles(),
      learning: this.learningSystem.getStats(),
      metrics: this.metricsSystem.getMetrics(),
      exportedAt: new Date().toISOString()
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  SmartBotIAService,
  AdvancedContextAnalyzer,
  IntelligentPriorityQueue,
  ContinuousLearningSystem,
  SmartMetricsSystem
};
