/**
 * 🧠 SmartBot Extended Service - Backend Node.js
 * 
 * 9 Sistemas Avançados:
 * - DialogManager: Máquina de estados para conversas
 * - EntityManager: Extração de entidades com fuzzy matching
 * - IntentManager: Classificação de intenções
 * - HumanAssistanceSystem: Escalação e gestão de agentes
 * - CacheManager: LRU eviction com TTL
 * - RateLimitManager: Token bucket algorithm
 * - ContextManager: Contexto aninhado com TTL
 * - SessionManager: Lifecycle de sessões
 * - FeedbackAnalyzer: Análise avançada de feedback
 * 
 * @version 1.0.0
 */

const EventEmitter = require('events');

// ============================================================
// 🎭 DIALOG MANAGER
// ============================================================
class DialogManager extends EventEmitter {
  constructor(storage = null) {
    super();
    this.storage = storage;
    this.dialogs = new Map();
    this.activeDialogs = new Map();
    this.transitions = new Map();
    this.hooks = {
      onEnter: new Map(),
      onExit: new Map(),
      onTransition: []
    };
  }

  registerDialog(dialogId, config) {
    const dialog = {
      id: dialogId,
      name: config.name || dialogId,
      initialState: config.initialState || 'start',
      states: config.states || {},
      transitions: config.transitions || [],
      timeout: config.timeout || 300000,
      metadata: config.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.dialogs.set(dialogId, dialog);
    
    dialog.transitions.forEach(t => {
      const key = `${dialogId}:${t.from}:${t.trigger}`;
      this.transitions.set(key, t);
    });

    return dialog;
  }

  startDialog(chatId, dialogId, initialData = {}) {
    const dialog = this.dialogs.get(dialogId);
    if (!dialog) throw new Error(`Dialog not found: ${dialogId}`);

    const session = {
      chatId,
      dialogId,
      currentState: dialog.initialState,
      data: initialData,
      history: [{ state: dialog.initialState, timestamp: Date.now(), action: 'start' }],
      startedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.activeDialogs.set(chatId, session);
    this._executeHook('onEnter', dialogId, dialog.initialState, session);
    this.emit('dialogStarted', { chatId, dialogId, session });
    
    return session;
  }

  processInput(chatId, input, context = {}) {
    const session = this.activeDialogs.get(chatId);
    if (!session) return { handled: false, reason: 'no_active_dialog' };

    const dialog = this.dialogs.get(session.dialogId);
    if (!dialog) return { handled: false, reason: 'dialog_not_found' };

    if (Date.now() - session.lastActivity > dialog.timeout) {
      this.endDialog(chatId, 'timeout');
      return { handled: false, reason: 'timeout' };
    }

    const currentState = dialog.states[session.currentState];
    let matchedTransition = null;

    for (const transition of dialog.transitions) {
      if (transition.from !== session.currentState && transition.from !== '*') continue;
      if (this._matchesTrigger(transition.trigger, input, context)) {
        if (!transition.condition || this._evaluateCondition(transition.condition, session, context)) {
          matchedTransition = transition;
          break;
        }
      }
    }

    if (!matchedTransition) {
      if (currentState?.fallback) {
        return { handled: true, response: currentState.fallback, state: session.currentState, transitioned: false };
      }
      return { handled: false, reason: 'no_matching_transition' };
    }

    const previousState = session.currentState;
    this._executeHook('onExit', session.dialogId, previousState, session);

    session.currentState = matchedTransition.to;
    session.lastActivity = Date.now();
    session.history.push({
      state: matchedTransition.to,
      from: previousState,
      trigger: matchedTransition.trigger,
      timestamp: Date.now()
    });

    if (matchedTransition.action) {
      this._executeAction(matchedTransition.action, session, context);
    }

    this._executeHook('onEnter', session.dialogId, matchedTransition.to, session);
    this.hooks.onTransition.forEach(hook => {
      try { hook(session, previousState, matchedTransition.to); } catch (e) {}
    });

    const newState = dialog.states[matchedTransition.to];
    if (newState?.final) {
      this.endDialog(chatId, 'completed');
    }

    this.emit('stateChanged', { chatId, from: previousState, to: matchedTransition.to });

    return {
      handled: true,
      response: newState?.response || matchedTransition.response,
      state: matchedTransition.to,
      transitioned: true,
      previousState,
      data: session.data
    };
  }

  _matchesTrigger(trigger, input, context) {
    if (typeof trigger === 'string') return input.toLowerCase().includes(trigger.toLowerCase());
    if (trigger instanceof RegExp) return trigger.test(input);
    if (typeof trigger === 'object') {
      if (trigger.type === 'intent' && context.intent) return context.intent === trigger.value;
      if (trigger.type === 'entity' && context.entities) return context.entities.some(e => e.type === trigger.value);
      if (trigger.type === 'keyword') {
        const keywords = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
        return keywords.some(k => input.toLowerCase().includes(k.toLowerCase()));
      }
      if (trigger.type === 'any') return true;
    }
    if (typeof trigger === 'function') return trigger(input, context);
    return false;
  }

  _evaluateCondition(condition, session, context) {
    if (typeof condition === 'function') return condition(session, context);
    if (typeof condition === 'object') {
      const { field, operator, value } = condition;
      const fieldValue = field.split('.').reduce((o, k) => o?.[k], session.data);
      return this._compare(fieldValue, value, operator);
    }
    return true;
  }

  _compare(a, b, operator = 'eq') {
    switch (operator) {
      case 'eq': return a === b;
      case 'neq': return a !== b;
      case 'gt': return a > b;
      case 'gte': return a >= b;
      case 'lt': return a < b;
      case 'lte': return a <= b;
      case 'contains': return String(a).includes(b);
      case 'exists': return a !== undefined && a !== null;
      default: return a === b;
    }
  }

  _executeAction(action, session, context) {
    if (typeof action === 'function') {
      action(session, context);
    } else if (typeof action === 'object') {
      if (action.set) {
        Object.entries(action.set).forEach(([key, value]) => {
          session.data[key] = typeof value === 'function' ? value(session, context) : value;
        });
      }
      if (action.increment) {
        Object.entries(action.increment).forEach(([key, value]) => {
          session.data[key] = (session.data[key] || 0) + value;
        });
      }
    }
  }

  _executeHook(hookType, dialogId, state, session) {
    const key = `${dialogId}:${state}`;
    const hooks = this.hooks[hookType].get(key) || [];
    hooks.forEach(hook => { try { hook(session); } catch (e) {} });
  }

  onEnterState(dialogId, state, callback) {
    const key = `${dialogId}:${state}`;
    if (!this.hooks.onEnter.has(key)) this.hooks.onEnter.set(key, []);
    this.hooks.onEnter.get(key).push(callback);
  }

  onExitState(dialogId, state, callback) {
    const key = `${dialogId}:${state}`;
    if (!this.hooks.onExit.has(key)) this.hooks.onExit.set(key, []);
    this.hooks.onExit.get(key).push(callback);
  }

  onTransition(callback) {
    this.hooks.onTransition.push(callback);
  }

  endDialog(chatId, reason = 'manual') {
    const session = this.activeDialogs.get(chatId);
    if (session) {
      session.endedAt = Date.now();
      session.endReason = reason;
      this.activeDialogs.delete(chatId);
      this.emit('dialogEnded', { chatId, reason, session });
      return session;
    }
    return null;
  }

  getCurrentState(chatId) {
    const session = this.activeDialogs.get(chatId);
    return session ? session.currentState : null;
  }

  getActiveSession(chatId) {
    return this.activeDialogs.get(chatId) || null;
  }

  getActiveDialogs() {
    return Array.from(this.activeDialogs.entries()).map(([chatId, session]) => ({
      chatId, dialogId: session.dialogId, currentState: session.currentState,
      startedAt: session.startedAt, lastActivity: session.lastActivity
    }));
  }

  forceState(chatId, newState) {
    const session = this.activeDialogs.get(chatId);
    if (!session) return false;
    const dialog = this.dialogs.get(session.dialogId);
    if (!dialog.states[newState]) return false;

    const previousState = session.currentState;
    this._executeHook('onExit', session.dialogId, previousState, session);
    session.currentState = newState;
    session.history.push({ state: newState, from: previousState, trigger: 'force', timestamp: Date.now() });
    this._executeHook('onEnter', session.dialogId, newState, session);
    return true;
  }

  updateSessionData(chatId, data) {
    const session = this.activeDialogs.get(chatId);
    if (session) {
      session.data = { ...session.data, ...data };
      return true;
    }
    return false;
  }
}

// ============================================================
// 🏷️ ENTITY MANAGER
// ============================================================
class EntityManager {
  constructor() {
    this.extractors = new Map();
    this.customEntities = new Map();
    this.synonyms = new Map();
    this._registerDefaultExtractors();
  }

  _registerDefaultExtractors() {
    this.registerExtractor('email', {
      type: 'regex',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      normalize: (match) => match.toLowerCase()
    });

    this.registerExtractor('phone', {
      type: 'regex',
      pattern: /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g,
      normalize: (match) => match.replace(/\D/g, '')
    });

    this.registerExtractor('cpf', {
      type: 'regex',
      pattern: /\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}/g,
      normalize: (match) => match.replace(/\D/g, ''),
      validate: (value) => this._validateCPF(value)
    });

    this.registerExtractor('cnpj', {
      type: 'regex',
      pattern: /\d{2}[\s.]?\d{3}[\s.]?\d{3}[\s/]?\d{4}[\s-]?\d{2}/g,
      normalize: (match) => match.replace(/\D/g, '')
    });

    this.registerExtractor('cep', {
      type: 'regex',
      pattern: /\d{5}[\s-]?\d{3}/g,
      normalize: (match) => match.replace(/\D/g, '')
    });

    this.registerExtractor('date', {
      type: 'regex',
      pattern: /\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}/g,
      normalize: (match) => {
        const parts = match.split(/[\s/.-]/);
        if (parts.length === 3) {
          const [d, m, y] = parts;
          const year = y.length === 2 ? '20' + y : y;
          return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return match;
      }
    });

    this.registerExtractor('money', {
      type: 'regex',
      pattern: /R\$\s*[\d.,]+|\d+(?:[.,]\d{3})*(?:[.,]\d{2})?(?:\s*(?:reais|real|R\$))/gi,
      normalize: (match) => parseFloat(match.replace(/[^\d,]/g, '').replace(',', '.'))
    });

    this.registerExtractor('url', {
      type: 'regex',
      pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
    });

    this.registerExtractor('order_number', {
      type: 'regex',
      pattern: /(?:pedido|protocolo|ordem|ticket|#)\s*(?:n[°º]?\s*)?(\d{4,})/gi,
      normalize: (match, groups) => groups?.[1] || match.replace(/\D/g, '')
    });
  }

  _validateCPF(cpf) {
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(cpf[10]);
  }

  registerExtractor(entityType, config) {
    this.extractors.set(entityType, {
      type: config.type || 'regex',
      pattern: config.pattern,
      extract: config.extract,
      normalize: config.normalize || ((v) => v),
      validate: config.validate || (() => true),
      priority: config.priority || 0
    });
  }

  registerEntityList(entityType, values, options = {}) {
    this.customEntities.set(entityType, {
      values: values.map(v => typeof v === 'string' ? { value: v, canonical: v } : v),
      caseSensitive: options.caseSensitive || false,
      fuzzyMatch: options.fuzzyMatch !== false,
      threshold: options.threshold || 0.8
    });
  }

  addSynonyms(entityType, canonical, synonyms) {
    if (!this.synonyms.has(entityType)) this.synonyms.set(entityType, new Map());
    const entitySynonyms = this.synonyms.get(entityType);
    synonyms.forEach(syn => entitySynonyms.set(syn.toLowerCase(), canonical));
  }

  extractAll(text, options = {}) {
    const entities = [];
    const types = options.types || Array.from(this.extractors.keys());

    types.forEach(type => {
      const extractor = this.extractors.get(type);
      if (extractor) {
        const extracted = this._extractWithExtractor(text, type, extractor);
        entities.push(...extracted);
      }
    });

    this.customEntities.forEach((config, type) => {
      if (!options.types || options.types.includes(type)) {
        const extracted = this._extractFromList(text, type, config);
        entities.push(...extracted);
      }
    });

    return this._deduplicateEntities(entities);
  }

  _extractWithExtractor(text, type, extractor) {
    const results = [];
    if (extractor.type === 'regex' && extractor.pattern) {
      const pattern = new RegExp(extractor.pattern.source, extractor.pattern.flags);
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const rawValue = match[0];
        const normalizedValue = extractor.normalize(rawValue, match.slice(1));
        if (extractor.validate(normalizedValue)) {
          results.push({
            type, value: normalizedValue, raw: rawValue,
            start: match.index, end: match.index + rawValue.length, confidence: 1.0
          });
        }
      }
    } else if (extractor.type === 'function' && extractor.extract) {
      const extracted = extractor.extract(text);
      extracted.forEach(e => {
        results.push({
          type, value: extractor.normalize(e.value), raw: e.raw || e.value,
          start: e.start, end: e.end, confidence: e.confidence || 0.9
        });
      });
    }
    return results;
  }

  _extractFromList(text, type, config) {
    const results = [];
    const lowerText = config.caseSensitive ? text : text.toLowerCase();

    config.values.forEach(item => {
      const searchValue = config.caseSensitive ? item.value : item.value.toLowerCase();
      let index = lowerText.indexOf(searchValue);
      while (index !== -1) {
        results.push({
          type, value: item.canonical || item.value,
          raw: text.substring(index, index + item.value.length),
          start: index, end: index + item.value.length, confidence: 1.0
        });
        index = lowerText.indexOf(searchValue, index + 1);
      }

      if (config.fuzzyMatch && results.length === 0) {
        const words = text.split(/\s+/);
        words.forEach((word) => {
          const similarity = this._calculateSimilarity(
            config.caseSensitive ? word : word.toLowerCase(), searchValue
          );
          if (similarity >= config.threshold) {
            const start = text.indexOf(word);
            results.push({
              type, value: item.canonical || item.value, raw: word,
              start, end: start + word.length, confidence: similarity, fuzzyMatch: true
            });
          }
        });
      }
    });

    return results;
  }

  _calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }

    const distance = matrix[b.length][a.length];
    return 1 - distance / Math.max(a.length, b.length);
  }

  _deduplicateEntities(entities) {
    entities.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.confidence - a.confidence;
    });

    const result = [];
    let lastEnd = -1;

    entities.forEach(entity => {
      if (entity.start >= lastEnd) {
        result.push(entity);
        lastEnd = entity.end;
      } else if (entity.confidence > result[result.length - 1]?.confidence) {
        result[result.length - 1] = entity;
        lastEnd = entity.end;
      }
    });

    return result;
  }

  extract(text, entityType) {
    return this.extractAll(text, { types: [entityType] });
  }

  resolveSynonym(entityType, value) {
    const synonymMap = this.synonyms.get(entityType);
    return synonymMap ? (synonymMap.get(value.toLowerCase()) || value) : value;
  }
}

// ============================================================
// 🎯 INTENT MANAGER
// ============================================================
class IntentManager {
  constructor() {
    this.intents = new Map();
    this.patterns = new Map();
    this.trainingData = [];
    this.confidenceThreshold = 0.6;
    this._registerDefaultIntents();
  }

  _registerDefaultIntents() {
    this.registerIntent('greeting', {
      patterns: [/^(oi|olá|ola|hey|hi|hello|bom dia|boa tarde|boa noite)/i],
      keywords: ['oi', 'olá', 'hello', 'bom dia', 'boa tarde', 'boa noite'],
      priority: 10
    });

    this.registerIntent('farewell', {
      patterns: [/^(tchau|até|bye|adeus|falou|flw|vlw)/i, /(obrigad[oa]|valeu|thanks)/i],
      keywords: ['tchau', 'até mais', 'adeus', 'bye'],
      priority: 10
    });

    this.registerIntent('question', {
      patterns: [/\?$/, /^(como|qual|quando|onde|por ?que|quem|quanto)/i],
      priority: 5
    });

    this.registerIntent('complaint', {
      patterns: [/(problema|erro|bug|não funciona|nao funciona)/i, /(péssimo|pessimo|horrível|horrivel|absurdo)/i],
      keywords: ['problema', 'erro', 'bug', 'reclamação', 'insatisfeito'],
      priority: 15,
      sentiment: 'negative'
    });

    this.registerIntent('urgent', {
      patterns: [/(urgente|urgência|emergência|imediato)/i, /(preciso agora|crítico|critico)/i],
      keywords: ['urgente', 'emergência', 'imediato', 'agora'],
      priority: 20
    });

    this.registerIntent('purchase_interest', {
      patterns: [/(quero|queria|gostaria|interesse|comprar)/i, /(preço|preco|valor|quanto custa)/i],
      keywords: ['comprar', 'preço', 'valor', 'disponível'],
      priority: 12
    });

    this.registerIntent('technical_support', {
      patterns: [/(ajuda|suporte|assistência)/i, /(como faço|não sei|não consigo)/i],
      keywords: ['ajuda', 'suporte', 'como faço'],
      priority: 10
    });

    this.registerIntent('cancellation', {
      patterns: [/(cancelar|cancelamento|desistir)/i, /(estornar|reembolso|devolver)/i],
      keywords: ['cancelar', 'desistir', 'reembolso'],
      priority: 15
    });

    this.registerIntent('thanks', {
      patterns: [/(obrigad[oa]|agradeço|valeu|thanks)/i],
      keywords: ['obrigado', 'obrigada', 'valeu'],
      priority: 8
    });

    this.registerIntent('confirmation', {
      patterns: [/^(sim|ok|certo|correto|isso|confirmo|confirmado)$/i],
      priority: 10
    });

    this.registerIntent('negation', {
      patterns: [/^(não|nao|nunca|negativo|no)$/i],
      priority: 10
    });
  }

  registerIntent(intentId, config) {
    this.intents.set(intentId, {
      id: intentId,
      patterns: config.patterns || [],
      keywords: config.keywords || [],
      priority: config.priority || 0,
      sentiment: config.sentiment || null,
      responses: config.responses || [],
      actions: config.actions || []
    });
  }

  classify(text, context = {}) {
    const scores = new Map();
    const normalizedText = text.toLowerCase().trim();

    this.intents.forEach((intent, intentId) => {
      let score = 0;
      let matchedPatterns = [];

      intent.patterns.forEach(pattern => {
        if (pattern.test(text)) {
          score += 0.4;
          matchedPatterns.push(pattern.toString());
        }
      });

      intent.keywords.forEach(keyword => {
        if (normalizedText.includes(keyword.toLowerCase())) score += 0.2;
      });

      score *= (1 + intent.priority / 100);

      if (context.previousIntent === intentId) score *= 0.8;
      if (context.sentiment && intent.sentiment === context.sentiment) score *= 1.2;

      if (score > 0) scores.set(intentId, { score: Math.min(score, 1), patterns: matchedPatterns });
    });

    this._adjustScoresFromTraining(normalizedText, scores);

    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);

    if (sorted.length === 0) return { intent: 'unknown', confidence: 0, alternatives: [] };

    const [topIntent, topData] = sorted[0];
    const alternatives = sorted.slice(1, 4).map(([intent, data]) => ({ intent, confidence: data.score }));

    return {
      intent: topData.score >= this.confidenceThreshold ? topIntent : 'unknown',
      confidence: topData.score,
      matchedPatterns: topData.patterns,
      alternatives,
      allScores: Object.fromEntries(scores)
    };
  }

  _adjustScoresFromTraining(text, scores) {
    const words = new Set(text.split(/\s+/));
    this.trainingData.forEach(example => {
      const exampleWords = new Set(example.text.toLowerCase().split(/\s+/));
      const intersection = new Set([...words].filter(x => exampleWords.has(x)));
      const similarity = intersection.size / Math.max(words.size, exampleWords.size);

      if (similarity > 0.5) {
        const currentScore = scores.get(example.intent)?.score || 0;
        scores.set(example.intent, {
          score: currentScore + similarity * 0.3 * (example.positive ? 1 : -0.5),
          patterns: scores.get(example.intent)?.patterns || []
        });
      }
    });
  }

  addTrainingExample(text, intent, positive = true) {
    this.trainingData.push({ text: text.toLowerCase(), intent, positive, addedAt: Date.now() });
  }

  getIntent(intentId) { return this.intents.get(intentId) || null; }
  listIntents() { return Array.from(this.intents.keys()); }
  setConfidenceThreshold(threshold) { this.confidenceThreshold = threshold; }
}

// ============================================================
// 👥 HUMAN ASSISTANCE SYSTEM
// ============================================================
class HumanAssistanceSystem extends EventEmitter {
  constructor() {
    super();
    this.escalationQueue = [];
    this.agents = new Map();
    this.activeChats = new Map();
    this.config = {
      maxChatsPerAgent: 5,
      escalationTimeout: 300000,
      autoAssign: true,
      priorityFactors: { sentiment: 0.3, waitTime: 0.3, urgency: 0.2, vip: 0.2 }
    };
    this.stats = { totalEscalations: 0, resolved: 0, avgWaitTime: 0, avgHandleTime: 0 };
  }

  registerAgent(agentId, info = {}) {
    this.agents.set(agentId, {
      id: agentId,
      name: info.name || agentId,
      status: 'offline',
      skills: info.skills || [],
      maxChats: info.maxChats || this.config.maxChatsPerAgent,
      activeChats: [],
      stats: { handled: 0, avgHandleTime: 0, satisfaction: 0 },
      lastActivity: Date.now()
    });
    return this.agents.get(agentId);
  }

  setAgentStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActivity = Date.now();
      if (status === 'online' && this.config.autoAssign) this._processQueue();
      this.emit('agentStatusChanged', { agentId, status });
      return true;
    }
    return false;
  }

  requestEscalation(chatId, context = {}) {
    if (this.activeChats.has(chatId)) {
      return { success: false, reason: 'already_assigned', agentId: this.activeChats.get(chatId) };
    }
    if (this.escalationQueue.some(e => e.chatId === chatId)) {
      return { success: false, reason: 'already_in_queue' };
    }

    const priority = this._calculatePriority(context);
    const escalation = {
      id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      chatId, priority,
      context: {
        reason: context.reason || 'user_request',
        sentiment: context.sentiment,
        intent: context.intent,
        urgency: context.urgency || 0,
        isVIP: context.isVIP || false,
        customerName: context.customerName,
        summary: context.summary
      },
      requestedAt: Date.now(),
      status: 'pending'
    };

    const insertIndex = this.escalationQueue.findIndex(e => e.priority < priority);
    if (insertIndex === -1) this.escalationQueue.push(escalation);
    else this.escalationQueue.splice(insertIndex, 0, escalation);

    this.stats.totalEscalations++;
    this.emit('escalationRequested', escalation);

    if (this.config.autoAssign) {
      const assigned = this._processQueue();
      if (assigned.includes(chatId)) {
        return { success: true, status: 'assigned', agentId: this.activeChats.get(chatId), position: 0 };
      }
    }

    return {
      success: true, status: 'queued',
      position: this.escalationQueue.findIndex(e => e.chatId === chatId) + 1,
      estimatedWait: this._estimateWaitTime(escalation)
    };
  }

  _calculatePriority(context) {
    let priority = 50;
    const factors = this.config.priorityFactors;
    if (context.sentiment !== undefined) priority += (1 - context.sentiment) * 100 * factors.sentiment;
    if (context.urgency) priority += context.urgency * 100 * factors.urgency;
    if (context.isVIP) priority += 100 * factors.vip;
    return Math.min(100, Math.max(0, priority));
  }

  _estimateWaitTime(escalation) {
    const position = this.escalationQueue.indexOf(escalation);
    const availableAgents = this._getAvailableAgents().length;
    if (availableAgents === 0) return -1;
    const avgHandleTime = this.stats.avgHandleTime || 300000;
    return Math.round((position / availableAgents) * avgHandleTime);
  }

  _getAvailableAgents() {
    return Array.from(this.agents.values()).filter(a => a.status === 'online' && a.activeChats.length < a.maxChats);
  }

  _processQueue() {
    const assignedChats = [];
    const availableAgents = this._getAvailableAgents();

    while (this.escalationQueue.length > 0 && availableAgents.length > 0) {
      const escalation = this.escalationQueue[0];
      const bestAgent = this._findBestAgent(escalation, availableAgents);
      if (!bestAgent) break;

      this._assignChat(escalation.chatId, bestAgent.id);
      this.escalationQueue.shift();
      escalation.status = 'assigned';
      escalation.assignedAt = Date.now();
      escalation.agentId = bestAgent.id;

      assignedChats.push(escalation.chatId);
      this.emit('chatAssigned', { chatId: escalation.chatId, agentId: bestAgent.id });

      if (bestAgent.activeChats.length >= bestAgent.maxChats) {
        const idx = availableAgents.indexOf(bestAgent);
        if (idx > -1) availableAgents.splice(idx, 1);
      }
    }

    return assignedChats;
  }

  _findBestAgent(escalation, availableAgents) {
    if (availableAgents.length === 0) return null;
    if (availableAgents.length === 1) return availableAgents[0];

    let bestAgent = null, bestScore = -1;
    availableAgents.forEach(agent => {
      let score = (1 - agent.activeChats.length / agent.maxChats) * 50;
      if (escalation.context.intent && agent.skills.includes(escalation.context.intent)) score += 30;
      score += (agent.stats.satisfaction || 0.5) * 20;
      if (score > bestScore) { bestScore = score; bestAgent = agent; }
    });
    return bestAgent;
  }

  _assignChat(chatId, agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.activeChats.push({ chatId, assignedAt: Date.now() });
      this.activeChats.set(chatId, agentId);
    }
  }

  endChat(chatId, resolution = {}) {
    const agentId = this.activeChats.get(chatId);
    if (!agentId) return false;

    const agent = this.agents.get(agentId);
    if (agent) {
      const chatInfo = agent.activeChats.find(c => c.chatId === chatId);
      if (chatInfo) {
        const handleTime = Date.now() - chatInfo.assignedAt;
        agent.stats.handled++;
        agent.stats.avgHandleTime = (agent.stats.avgHandleTime * (agent.stats.handled - 1) + handleTime) / agent.stats.handled;
        if (resolution.satisfaction !== undefined) {
          agent.stats.satisfaction = (agent.stats.satisfaction * (agent.stats.handled - 1) + resolution.satisfaction) / agent.stats.handled;
        }
        agent.activeChats = agent.activeChats.filter(c => c.chatId !== chatId);
      }
    }

    this.activeChats.delete(chatId);
    this.stats.resolved++;
    this.emit('chatEnded', { chatId, agentId, resolution });
    if (this.config.autoAssign) this._processQueue();
    return true;
  }

  transferChat(chatId, newAgentId) {
    const currentAgentId = this.activeChats.get(chatId);
    if (!currentAgentId) return { success: false, reason: 'chat_not_found' };
    const newAgent = this.agents.get(newAgentId);
    if (!newAgent) return { success: false, reason: 'agent_not_found' };
    if (newAgent.status !== 'online') return { success: false, reason: 'agent_not_available' };
    if (newAgent.activeChats.length >= newAgent.maxChats) return { success: false, reason: 'agent_full' };

    const currentAgent = this.agents.get(currentAgentId);
    if (currentAgent) currentAgent.activeChats = currentAgent.activeChats.filter(c => c.chatId !== chatId);
    this._assignChat(chatId, newAgentId);
    this.emit('chatTransferred', { chatId, from: currentAgentId, to: newAgentId });
    return { success: true, previousAgent: currentAgentId, newAgent: newAgentId };
  }

  getQueuePosition(chatId) {
    const index = this.escalationQueue.findIndex(e => e.chatId === chatId);
    if (index === -1) {
      if (this.activeChats.has(chatId)) return { position: 0, status: 'assigned', agentId: this.activeChats.get(chatId) };
      return { position: -1, status: 'not_found' };
    }
    const escalation = this.escalationQueue[index];
    return { position: index + 1, status: 'queued', estimatedWait: this._estimateWaitTime(escalation), priority: escalation.priority };
  }

  getQueueStatus() {
    return {
      queueLength: this.escalationQueue.length,
      activeChats: this.activeChats.size,
      availableAgents: this._getAvailableAgents().length,
      totalAgents: this.agents.size,
      onlineAgents: Array.from(this.agents.values()).filter(a => a.status === 'online').length,
      stats: this.stats
    };
  }

  getAgents() {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id, name: a.name, status: a.status, activeChats: a.activeChats.length, maxChats: a.maxChats, stats: a.stats
    }));
  }

  cancelEscalation(chatId) {
    const index = this.escalationQueue.findIndex(e => e.chatId === chatId);
    if (index > -1) { this.escalationQueue.splice(index, 1); return true; }
    return false;
  }
}

// ============================================================
// 💾 CACHE MANAGER
// ============================================================
class CacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000;
    this.cache = new Map();
    this.accessOrder = [];
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) { this.stats.misses++; return null; }
    if (entry.expiresAt && Date.now() > entry.expiresAt) { this.delete(key); this.stats.misses++; return null; }
    this._updateAccessOrder(key);
    this.stats.hits++;
    return entry.value;
  }

  set(key, value, ttl = null) {
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) this._evict();
    const entry = {
      value, createdAt: Date.now(),
      expiresAt: ttl !== null ? Date.now() + ttl : (this.defaultTTL ? Date.now() + this.defaultTTL : null),
      accessCount: 0
    };
    this.cache.set(key, entry);
    this._updateAccessOrder(key);
    return true;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) { this.delete(key); return false; }
    return true;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
    }
    return deleted;
  }

  clear() { this.cache.clear(); this.accessOrder = []; }

  async getOrSet(key, factory, ttl = null) {
    const existing = this.get(key);
    if (existing !== null) return existing;
    const value = typeof factory === 'function' ? await factory() : factory;
    this.set(key, value, ttl);
    return value;
  }

  touch(key, ttl = null) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiresAt = ttl !== null ? Date.now() + ttl : (this.defaultTTL ? Date.now() + this.defaultTTL : null);
      return true;
    }
    return false;
  }

  _updateAccessOrder(key) {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
    const entry = this.cache.get(key);
    if (entry) entry.accessCount++;
  }

  _evict() {
    if (this.accessOrder.length > 0) {
      const keyToRemove = this.accessOrder.shift();
      this.cache.delete(keyToRemove);
      this.stats.evictions++;
    }
  }

  _cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    this.cache.forEach((entry, key) => {
      if (entry.expiresAt && now > entry.expiresAt) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => this.delete(key));
  }

  getStats() {
    return { size: this.cache.size, maxSize: this.maxSize, hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0, ...this.stats };
  }

  keys() { return Array.from(this.cache.keys()); }
  size() { return this.cache.size; }
  destroy() { clearInterval(this.cleanupInterval); this.clear(); }
}

// ============================================================
// ⏱️ RATE LIMIT MANAGER
// ============================================================
class RateLimitManager {
  constructor() {
    this.limiters = new Map();
    this.blocked = new Map();
    this.stats = { allowed: 0, blocked: 0, totalRequests: 0 };
  }

  configure(key, config) {
    this.limiters.set(key, {
      maxTokens: config.maxTokens || config.requests || 10,
      refillRate: config.refillRate || config.requests || 10,
      refillInterval: config.refillInterval || config.window || 60000,
      tokens: config.maxTokens || config.requests || 10,
      lastRefill: Date.now(),
      blockDuration: config.blockDuration || 0
    });
  }

  isAllowed(key, tokens = 1) {
    this.stats.totalRequests++;

    const blockInfo = this.blocked.get(key);
    if (blockInfo && Date.now() < blockInfo.until) {
      this.stats.blocked++;
      return { allowed: false, reason: 'blocked', retryAfter: blockInfo.until - Date.now(), remaining: 0 };
    } else if (blockInfo) { this.blocked.delete(key); }

    let limiter = this.limiters.get(key);
    if (!limiter) { this.configure(key, { requests: 60, window: 60000 }); limiter = this.limiters.get(key); }

    this._refillTokens(limiter);

    if (limiter.tokens >= tokens) {
      limiter.tokens -= tokens;
      this.stats.allowed++;
      return { allowed: true, remaining: limiter.tokens, resetAt: limiter.lastRefill + limiter.refillInterval };
    }

    this.stats.blocked++;
    if (limiter.blockDuration > 0) {
      this.blocked.set(key, { until: Date.now() + limiter.blockDuration, reason: 'rate_limit_exceeded' });
    }

    return {
      allowed: false, reason: 'rate_limited', remaining: limiter.tokens,
      retryAfter: limiter.refillInterval - (Date.now() - limiter.lastRefill),
      resetAt: limiter.lastRefill + limiter.refillInterval
    };
  }

  consume(key, tokens = 1) { return this.isAllowed(key, tokens); }

  _refillTokens(limiter) {
    const now = Date.now();
    const elapsed = now - limiter.lastRefill;
    if (elapsed >= limiter.refillInterval) {
      const refillCount = Math.floor(elapsed / limiter.refillInterval);
      limiter.tokens = Math.min(limiter.maxTokens, limiter.tokens + refillCount * limiter.refillRate);
      limiter.lastRefill = now - (elapsed % limiter.refillInterval);
    }
  }

  block(key, duration = 60000) { this.blocked.set(key, { until: Date.now() + duration, reason: 'manual_block' }); }
  unblock(key) { return this.blocked.delete(key); }
  
  reset(key) {
    const limiter = this.limiters.get(key);
    if (limiter) { limiter.tokens = limiter.maxTokens; limiter.lastRefill = Date.now(); }
    this.blocked.delete(key);
  }

  getStatus(key) {
    const limiter = this.limiters.get(key);
    const blockInfo = this.blocked.get(key);
    if (blockInfo && Date.now() < blockInfo.until) return { status: 'blocked', retryAfter: blockInfo.until - Date.now() };
    if (!limiter) return { status: 'not_configured' };
    this._refillTokens(limiter);
    return { status: 'active', tokens: limiter.tokens, maxTokens: limiter.maxTokens, resetAt: limiter.lastRefill + limiter.refillInterval };
  }

  getStats() {
    return { ...this.stats, blockRate: this.stats.blocked / this.stats.totalRequests || 0, activeLimiters: this.limiters.size, blockedKeys: this.blocked.size };
  }
}

// ============================================================
// 🗂️ CONTEXT MANAGER
// ============================================================
class ContextManager {
  constructor(options = {}) {
    this.contexts = new Map();
    this.defaultTTL = options.defaultTTL || 1800000;
    this.maxDepth = options.maxDepth || 10;
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  set(contextId, key, value, ttl = null) {
    let context = this.contexts.get(contextId);
    if (!context) {
      context = { id: contextId, data: {}, metadata: {}, createdAt: Date.now(), lastAccess: Date.now() };
      this.contexts.set(contextId, context);
    }

    const keys = key.split('.');
    let current = context.data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    context.metadata[key] = { setAt: Date.now(), expiresAt: ttl !== null ? Date.now() + ttl : Date.now() + this.defaultTTL };
    context.lastAccess = Date.now();
    return true;
  }

  get(contextId, key, defaultValue = undefined) {
    const context = this.contexts.get(contextId);
    if (!context) return defaultValue;

    const meta = context.metadata[key];
    if (meta && Date.now() > meta.expiresAt) { this.delete(contextId, key); return defaultValue; }

    const keys = key.split('.');
    let current = context.data;
    for (const k of keys) {
      if (current === undefined || current === null) return defaultValue;
      current = current[k];
    }

    context.lastAccess = Date.now();
    return current !== undefined ? current : defaultValue;
  }

  has(contextId, key) { return this.get(contextId, key) !== undefined; }

  delete(contextId, key) {
    const context = this.contexts.get(contextId);
    if (!context) return false;
    const keys = key.split('.');
    let current = context.data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return false;
      current = current[keys[i]];
    }
    delete current[keys[keys.length - 1]];
    delete context.metadata[key];
    return true;
  }

  getContext(contextId) {
    const context = this.contexts.get(contextId);
    if (!context) return null;
    this._cleanExpired(context);
    context.lastAccess = Date.now();
    return { ...context.data };
  }

  merge(contextId, data, ttl = null) {
    Object.entries(data).forEach(([key, value]) => this.set(contextId, key, value, ttl));
  }

  clearContext(contextId) { return this.contexts.delete(contextId); }

  push(contextId, key, value, maxLength = 100) {
    const arr = this.get(contextId, key, []);
    arr.push(value);
    if (arr.length > maxLength) arr.shift();
    this.set(contextId, key, arr);
    return arr.length;
  }

  increment(contextId, key, amount = 1) {
    const current = this.get(contextId, key, 0);
    const newValue = (typeof current === 'number' ? current : 0) + amount;
    this.set(contextId, key, newValue);
    return newValue;
  }

  _cleanExpired(context) {
    const now = Date.now();
    Object.entries(context.metadata).forEach(([key, meta]) => {
      if (now > meta.expiresAt) this.delete(context.id, key);
    });
  }

  _cleanup() {
    const now = Date.now();
    this.contexts.forEach((context, contextId) => {
      if (now - context.lastAccess > this.defaultTTL * 2) this.contexts.delete(contextId);
      else this._cleanExpired(context);
    });
  }

  listContexts() { return Array.from(this.contexts.keys()); }
  
  getStats() {
    return {
      totalContexts: this.contexts.size,
      contexts: Array.from(this.contexts.entries()).map(([id, ctx]) => ({
        id, keysCount: Object.keys(ctx.data).length, lastAccess: ctx.lastAccess, age: Date.now() - ctx.createdAt
      }))
    };
  }

  destroy() { clearInterval(this.cleanupInterval); this.contexts.clear(); }
}

// ============================================================
// 🔐 SESSION MANAGER
// ============================================================
class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.defaultTimeout = options.timeout || 1800000;
    this.maxSessions = options.maxSessions || 10000;
    this.onExpire = options.onExpire || null;
    this.cleanupInterval = setInterval(() => this._cleanup(), 30000);
  }

  create(sessionId, data = {}) {
    if (this.sessions.size >= this.maxSessions) this._evictOldest();
    const session = {
      id: sessionId, data: { ...data }, createdAt: Date.now(), lastActivity: Date.now(),
      expiresAt: Date.now() + this.defaultTimeout, metadata: { userAgent: data.userAgent, ip: data.ip }
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) { this._expireSession(sessionId); return null; }
    return session;
  }

  touch(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() <= session.expiresAt) {
      session.lastActivity = Date.now();
      session.expiresAt = Date.now() + this.defaultTimeout;
      return true;
    }
    return false;
  }

  update(sessionId, data) {
    const session = this.get(sessionId);
    if (session) { session.data = { ...session.data, ...data }; session.lastActivity = Date.now(); return true; }
    return false;
  }

  set(sessionId, key, value) {
    const session = this.get(sessionId);
    if (session) { session.data[key] = value; session.lastActivity = Date.now(); return true; }
    return false;
  }

  getValue(sessionId, key, defaultValue = undefined) {
    const session = this.get(sessionId);
    return session ? (session.data[key] ?? defaultValue) : defaultValue;
  }

  destroy(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) { this.sessions.delete(sessionId); return true; }
    return false;
  }

  isValid(sessionId) {
    const session = this.sessions.get(sessionId);
    return session && Date.now() <= session.expiresAt;
  }

  renew(sessionId, timeout = null) {
    const session = this.get(sessionId);
    if (session) {
      session.expiresAt = Date.now() + (timeout || this.defaultTimeout);
      session.lastActivity = Date.now();
      return session.expiresAt;
    }
    return null;
  }

  getOrCreate(sessionId, initialData = {}) {
    let session = this.get(sessionId);
    if (!session) session = this.create(sessionId, initialData);
    return session;
  }

  _expireSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && this.onExpire) { try { this.onExpire(session); } catch (e) {} }
    this.sessions.delete(sessionId);
  }

  _evictOldest() {
    let oldest = null, oldestTime = Infinity;
    this.sessions.forEach((session, id) => {
      if (session.lastActivity < oldestTime) { oldestTime = session.lastActivity; oldest = id; }
    });
    if (oldest) this._expireSession(oldest);
  }

  _cleanup() {
    const now = Date.now();
    const toExpire = [];
    this.sessions.forEach((session, id) => { if (now > session.expiresAt) toExpire.push(id); });
    toExpire.forEach(id => this._expireSession(id));
  }

  listSessions() {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id, createdAt: session.createdAt, lastActivity: session.lastActivity,
      expiresAt: session.expiresAt, timeToExpire: session.expiresAt - Date.now()
    }));
  }

  getStats() {
    const now = Date.now();
    let totalAge = 0, activeCount = 0;
    this.sessions.forEach(session => {
      if (now <= session.expiresAt) { activeCount++; totalAge += now - session.createdAt; }
    });
    return { totalSessions: this.sessions.size, activeSessions: activeCount, avgAge: activeCount > 0 ? totalAge / activeCount : 0, maxSessions: this.maxSessions };
  }

  destroy() { clearInterval(this.cleanupInterval); this.sessions.clear(); }
}

// ============================================================
// 📊 FEEDBACK ANALYZER
// ============================================================
class FeedbackAnalyzer {
  constructor() {
    this.feedbacks = [];
    this.aggregates = {
      totalCount: 0, avgRating: 0,
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
      topIssues: [], topPraises: [], nps: 0
    };
    this.keywords = {
      positive: ['ótimo', 'excelente', 'perfeito', 'rápido', 'atencioso', 'resolveu', 'recomendo', 'parabéns'],
      negative: ['ruim', 'péssimo', 'demorou', 'não resolveu', 'problema', 'decepcionado', 'horrível'],
      issues: ['demora', 'erro', 'bug', 'lento', 'confuso', 'difícil', 'complicado'],
      praises: ['rápido', 'fácil', 'claro', 'eficiente', 'educado', 'prestativo']
    };
  }

  addFeedback(feedback) {
    const analysis = this._analyzeFeedback(feedback);
    const entry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rating: feedback.rating, text: feedback.text || '', source: feedback.source || 'direct',
      context: feedback.context || {}, analysis, createdAt: Date.now()
    };
    this.feedbacks.push(entry);
    this._updateAggregates(entry);
    return entry;
  }

  _analyzeFeedback(feedback) {
    const text = (feedback.text || '').toLowerCase();
    let sentimentScore = feedback.rating ? feedback.rating / 5 : 0.5;

    this.keywords.positive.forEach(kw => { if (text.includes(kw)) sentimentScore += 0.1; });
    this.keywords.negative.forEach(kw => { if (text.includes(kw)) sentimentScore -= 0.1; });
    sentimentScore = Math.max(0, Math.min(1, sentimentScore));

    const issues = this.keywords.issues.filter(kw => text.includes(kw));
    const praises = this.keywords.praises.filter(kw => text.includes(kw));
    const extractedKeywords = this._extractKeywords(text);

    let category = 'general';
    if (issues.length > praises.length) category = 'complaint';
    else if (praises.length > issues.length) category = 'praise';
    else if (text.includes('?')) category = 'question';
    else if (text.includes('sugestão') || text.includes('sugiro')) category = 'suggestion';

    return {
      sentiment: { score: sentimentScore, label: sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral' },
      issues, praises, keywords: extractedKeywords, category, wordCount: text.split(/\s+/).filter(w => w.length > 0).length
    };
  }

  _extractKeywords(text) {
    const stopwords = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com', 'não', 'que', 'se', 'na', 'no', 'por', 'mais', 'as', 'os', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele']);
    const words = text.toLowerCase().replace(/[^\w\sáéíóúâêôãõç]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w));
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word, count }));
  }

  _updateAggregates(entry) {
    this.aggregates.totalCount++;
    if (entry.rating) this.aggregates.avgRating = ((this.aggregates.avgRating * (this.aggregates.totalCount - 1) + entry.rating) / this.aggregates.totalCount);
    this.aggregates.sentimentDistribution[entry.analysis.sentiment.label]++;

    entry.analysis.issues.forEach(issue => {
      const existing = this.aggregates.topIssues.find(i => i.issue === issue);
      if (existing) existing.count++;
      else this.aggregates.topIssues.push({ issue, count: 1 });
    });
    this.aggregates.topIssues.sort((a, b) => b.count - a.count);
    this.aggregates.topIssues = this.aggregates.topIssues.slice(0, 10);

    entry.analysis.praises.forEach(praise => {
      const existing = this.aggregates.topPraises.find(p => p.praise === praise);
      if (existing) existing.count++;
      else this.aggregates.topPraises.push({ praise, count: 1 });
    });
    this.aggregates.topPraises.sort((a, b) => b.count - a.count);
    this.aggregates.topPraises = this.aggregates.topPraises.slice(0, 10);

    this._calculateNPS();
  }

  _calculateNPS() {
    const withRating = this.feedbacks.filter(f => f.rating !== undefined);
    if (withRating.length === 0) { this.aggregates.nps = 0; return; }
    const promoters = withRating.filter(f => f.rating >= 4.5).length;
    const detractors = withRating.filter(f => f.rating <= 2.5).length;
    this.aggregates.nps = Math.round(((promoters - detractors) / withRating.length) * 100);
  }

  getAnalysis() {
    return {
      ...this.aggregates,
      sentimentPercentages: {
        positive: this.aggregates.totalCount > 0 ? (this.aggregates.sentimentDistribution.positive / this.aggregates.totalCount * 100).toFixed(1) : 0,
        neutral: this.aggregates.totalCount > 0 ? (this.aggregates.sentimentDistribution.neutral / this.aggregates.totalCount * 100).toFixed(1) : 0,
        negative: this.aggregates.totalCount > 0 ? (this.aggregates.sentimentDistribution.negative / this.aggregates.totalCount * 100).toFixed(1) : 0
      }
    };
  }

  search(criteria = {}) {
    return this.feedbacks.filter(f => {
      if (criteria.minRating && f.rating < criteria.minRating) return false;
      if (criteria.maxRating && f.rating > criteria.maxRating) return false;
      if (criteria.sentiment && f.analysis.sentiment.label !== criteria.sentiment) return false;
      if (criteria.category && f.analysis.category !== criteria.category) return false;
      if (criteria.keyword && !f.text.toLowerCase().includes(criteria.keyword.toLowerCase())) return false;
      if (criteria.since && f.createdAt < criteria.since) return false;
      if (criteria.until && f.createdAt > criteria.until) return false;
      return true;
    });
  }

  getTrends(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = this.feedbacks.filter(f => f.createdAt >= cutoff);
    const byDay = {};
    recent.forEach(f => {
      const day = new Date(f.createdAt).toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { count: 0, totalRating: 0, sentiments: { positive: 0, neutral: 0, negative: 0 } };
      byDay[day].count++;
      if (f.rating) byDay[day].totalRating += f.rating;
      byDay[day].sentiments[f.analysis.sentiment.label]++;
    });
    return Object.entries(byDay).map(([day, data]) => ({
      day, count: data.count, avgRating: data.totalRating / data.count || 0, sentiments: data.sentiments
    })).sort((a, b) => a.day.localeCompare(b.day));
  }

  generateReport() {
    const analysis = this.getAnalysis();
    const trends = this.getTrends(30);
    return {
      summary: { totalFeedbacks: analysis.totalCount, averageRating: analysis.avgRating.toFixed(2), nps: analysis.nps, sentimentDistribution: analysis.sentimentPercentages },
      issues: analysis.topIssues.slice(0, 5), praises: analysis.topPraises.slice(0, 5), trends, generatedAt: new Date().toISOString()
    };
  }

  reset() {
    this.feedbacks = [];
    this.aggregates = { totalCount: 0, avgRating: 0, sentimentDistribution: { positive: 0, neutral: 0, negative: 0 }, topIssues: [], topPraises: [], nps: 0 };
  }
}

// ============================================================
// SMARTBOT EXTENDED SERVICE - MAIN CLASS
// ============================================================
class SmartBotExtendedService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dialogManager = new DialogManager(options.storage);
    this.entityManager = new EntityManager();
    this.intentManager = new IntentManager();
    this.humanAssistance = new HumanAssistanceSystem();
    this.cacheManager = new CacheManager({ maxSize: options.cacheSize || 500, defaultTTL: options.cacheTTL || 300000 });
    this.rateLimitManager = new RateLimitManager();
    this.contextManager = new ContextManager({ defaultTTL: options.contextTTL || 1800000 });
    this.sessionManager = new SessionManager({ timeout: options.sessionTimeout || 1800000 });
    this.feedbackAnalyzer = new FeedbackAnalyzer();

    // Forward events
    this.dialogManager.on('dialogStarted', (data) => this.emit('dialog:started', data));
    this.dialogManager.on('dialogEnded', (data) => this.emit('dialog:ended', data));
    this.dialogManager.on('stateChanged', (data) => this.emit('dialog:stateChanged', data));
    this.humanAssistance.on('escalationRequested', (data) => this.emit('escalation:requested', data));
    this.humanAssistance.on('chatAssigned', (data) => this.emit('escalation:assigned', data));
    this.humanAssistance.on('chatEnded', (data) => this.emit('escalation:ended', data));
    this.humanAssistance.on('chatTransferred', (data) => this.emit('escalation:transferred', data));

    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.emit('initialized');
    console.log('[SmartBot Extended Service] ✅ Initialized');
  }

  async processMessage(chatId, message, options = {}) {
    const rateCheck = this.rateLimitManager.consume(`chat:${chatId}`);
    if (!rateCheck.allowed) {
      return { blocked: true, reason: 'rate_limited', retryAfter: rateCheck.retryAfter };
    }

    const session = this.sessionManager.getOrCreate(chatId);
    this.sessionManager.touch(chatId);

    const messageText = message.text || message.body || '';
    this.contextManager.push(chatId, 'messages', { text: messageText, timestamp: Date.now(), from: message.from || 'user' }, 50);

    const entities = this.entityManager.extractAll(messageText);
    const intentResult = this.intentManager.classify(messageText, {
      previousIntent: this.contextManager.get(chatId, 'lastIntent'),
      entities
    });

    this.contextManager.set(chatId, 'lastIntent', intentResult.intent);
    this.contextManager.set(chatId, 'lastEntities', entities);

    let dialogResult = null;
    if (this.dialogManager.getActiveSession(chatId)) {
      dialogResult = this.dialogManager.processInput(chatId, messageText, { intent: intentResult.intent, entities, sentiment: options.sentiment });
    }

    let escalationInfo = null;
    if (intentResult.intent === 'urgent' || (options.sentiment !== undefined && options.sentiment < 0.3) || intentResult.intent === 'complaint') {
      escalationInfo = this.humanAssistance.getQueuePosition(chatId);
      if (escalationInfo.status === 'not_found' && options.autoEscalate) {
        escalationInfo = this.humanAssistance.requestEscalation(chatId, {
          reason: intentResult.intent, sentiment: options.sentiment, intent: intentResult.intent,
          urgency: intentResult.intent === 'urgent' ? 1 : 0.5
        });
      }
    }

    return {
      chatId, intent: intentResult, entities, dialog: dialogResult, escalation: escalationInfo,
      session: { id: session.id, isNew: Date.now() - session.createdAt < 5000 },
      context: this.contextManager.getContext(chatId)
    };
  }

  addFeedback(feedback) { return this.feedbackAnalyzer.addFeedback(feedback); }
  getFeedbackReport() { return this.feedbackAnalyzer.generateReport(); }

  getStats() {
    return {
      sessions: this.sessionManager.getStats(),
      cache: this.cacheManager.getStats(),
      rateLimit: this.rateLimitManager.getStats(),
      contexts: this.contextManager.getStats(),
      humanAssistance: this.humanAssistance.getQueueStatus(),
      feedback: this.feedbackAnalyzer.getAnalysis(),
      dialogs: { activeCount: this.dialogManager.getActiveDialogs().length, registeredCount: this.dialogManager.dialogs.size }
    };
  }

  exportData() {
    return { stats: this.getStats(), feedbackReport: this.getFeedbackReport(), exportedAt: new Date().toISOString() };
  }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  SmartBotExtendedService,
  DialogManager,
  EntityManager,
  IntentManager,
  HumanAssistanceSystem,
  CacheManager,
  RateLimitManager,
  ContextManager,
  SessionManager,
  FeedbackAnalyzer
};
