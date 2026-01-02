/**
 * 🔄 EventBus v2.0 - Sistema de Eventos Central Aprimorado
 * Baseado no Quantum CRM EventDispatcher + WhatsFlow
 * 
 * Funcionalidades v2.0:
 * - Priorização de listeners
 * - Namespaces isolados
 * - Debounce nativo
 * - waitFor com timeout
 * - Pause/Resume
 * - Pipe de eventos
 * - Estatísticas
 * 
 * @version 2.0.0
 */

(function() {
  'use strict';

  // Namespaces disponíveis
  const NAMESPACES = {
    SUBSCRIPTION: 'subscription',
    CREDITS: 'credits',
    WORKSPACE: 'workspace',
    MODULE: 'module',
    OVERLAY: 'overlay',
    EXTRACTOR: 'extractor',
    METRICS: 'metrics',
    BRIDGE: 'bridge',
    UI: 'ui',
    SYSTEM: 'system',
    CRM: 'crm',
    TASK: 'task',
    CAMPAIGN: 'campaign',
    MESSAGE: 'message',
    SMART_REPLIES: 'smart_replies',
    FLOW: 'flow'
  };

  class EventBus {
    constructor() {
      this.listeners = new Map();
      this.onceListeners = new Map();
      this.history = [];
      this.maxHistorySize = 100;
      this.debounceTimers = new Map();
      this.stats = { emitted: 0, handled: 0, errors: 0 };
      this._paused = false;
      this._queue = [];
    }

    /**
     * Registra listener para evento
     * @param {string} event - Nome do evento
     * @param {Function} callback - Função callback
     * @param {Object} options - { priority, async, debounce, namespace }
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        console.warn('[EventBus] Callback deve ser uma função');
        return () => {};
      }

      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }

      const listener = {
        callback,
        priority: options.priority || 5,
        async: options.async || false,
        debounce: options.debounce || 0,
        namespace: options.namespace || null,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const listeners = this.listeners.get(event);
      listeners.push(listener);
      // Ordenar por prioridade (menor = maior prioridade)
      listeners.sort((a, b) => a.priority - b.priority);

      return () => this.off(event, callback);
    }

    /**
     * Registra listener que executa apenas uma vez
     */
    once(event, callback, options = {}) {
      const wrappedCallback = (data, eventData) => {
        this.off(event, wrappedCallback);
        callback(data, eventData);
      };
      return this.on(event, wrappedCallback, options);
    }

    /**
     * Remove listener
     */
    off(event, callback) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.findIndex(l => l.callback === callback);
        if (index > -1) listeners.splice(index, 1);
      }
    }

    /**
     * Remove todos os listeners de um namespace
     */
    offNamespace(namespace) {
      for (const [event, listeners] of this.listeners) {
        this.listeners.set(event, listeners.filter(l => l.namespace !== namespace));
      }
    }

    /**
     * Emite evento
     */
    emit(event, data = {}) {
      if (this._paused) {
        this._queue.push({ event, data });
        return this;
      }

      const timestamp = Date.now();
      const eventData = { event, data, timestamp };

      // Histórico
      this.history.push(eventData);
      if (this.history.length > this.maxHistorySize) this.history.shift();
      this.stats.emitted++;

      // Executar listeners
      this._executeListeners(event, data, eventData);

      // Wildcard
      if (event !== '*') {
        this._executeListeners('*', eventData, eventData);
      }

      // Namespace wildcard (ex: 'crm:*')
      const namespace = event.split(':')[0];
      if (namespace && namespace !== event) {
        this._executeListeners(`${namespace}:*`, data, eventData);
      }

      return this;
    }

    /**
     * Emite evento com debounce
     */
    emitDebounced(event, data = {}, delay = 300) {
      const key = `${event}:${JSON.stringify(data)}`;
      if (this.debounceTimers.has(key)) clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.set(key, setTimeout(() => {
        this.emit(event, data);
        this.debounceTimers.delete(key);
      }, delay));
      return this;
    }

    /**
     * Emite evento e aguarda todos os handlers async
     */
    async emitAsync(event, data = {}) {
      const timestamp = Date.now();
      const eventData = { event, data, timestamp };
      this.history.push(eventData);
      this.stats.emitted++;

      const listeners = this.listeners.get(event) || [];
      await Promise.all(listeners.map(async (listener) => {
        try {
          await Promise.resolve(listener.callback(data, eventData));
          this.stats.handled++;
        } catch (error) {
          this.stats.errors++;
          console.error(`[EventBus] Erro async em "${event}":`, error);
        }
      }));
      return this;
    }

    _executeListeners(event, data, eventData) {
      const listeners = this.listeners.get(event) || [];
      for (const listener of listeners) {
        try {
          if (listener.debounce > 0) {
            const key = `${event}:${listener.id}`;
            if (this.debounceTimers.has(key)) clearTimeout(this.debounceTimers.get(key));
            this.debounceTimers.set(key, setTimeout(() => {
              listener.callback(data, eventData);
              this.debounceTimers.delete(key);
            }, listener.debounce));
          } else if (listener.async) {
            setTimeout(() => { try { listener.callback(data, eventData); } catch(e) {} }, 0);
          } else {
            listener.callback(data, eventData);
          }
          this.stats.handled++;
        } catch (error) {
          this.stats.errors++;
          console.error(`[EventBus] Erro no listener de "${event}":`, error);
        }
      }
    }

    /**
     * Aguarda um evento com timeout
     */
    waitFor(event, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout aguardando evento: ${event}`));
        }, timeout);

        const handler = (data) => {
          clearTimeout(timer);
          resolve(data);
        };
        this.once(event, handler);
      });
    }

    /**
     * Pipe: redireciona eventos de um para outro
     */
    pipe(sourceEvent, targetEvent, transform = null) {
      return this.on(sourceEvent, (data) => {
        this.emit(targetEvent, transform ? transform(data) : data);
      });
    }

    /**
     * Pausa emissão de eventos (enfileira)
     */
    pause() {
      this._paused = true;
      return this;
    }

    /**
     * Resume emissão e processa fila
     */
    resume() {
      this._paused = false;
      const queue = [...this._queue];
      this._queue = [];
      queue.forEach(({ event, data }) => this.emit(event, data));
      return this;
    }

    /**
     * Cria namespace isolado
     */
    createNamespace(name) {
      return {
        on: (event, callback, options = {}) => this.on(`${name}:${event}`, callback, { ...options, namespace: name }),
        once: (event, callback, options = {}) => this.once(`${name}:${event}`, callback, { ...options, namespace: name }),
        emit: (event, data) => this.emit(`${name}:${event}`, data),
        off: (event, callback) => this.off(`${name}:${event}`, callback),
        clear: () => this.offNamespace(name)
      };
    }

    /**
     * Remove todos os listeners de um evento ou todos
     */
    clear(event) {
      if (event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
      } else {
        this.listeners.clear();
        this.onceListeners.clear();
        this.history = [];
      }
    }

    /**
     * Obtém histórico de eventos
     */
    getHistory(event = null, limit = 50) {
      let history = [...this.history];
      if (event) history = history.filter(h => h.event === event || h.event.startsWith(event));
      return history.slice(-limit);
    }

    /**
     * Retorna estatísticas
     */
    getStats() { return { ...this.stats }; }

    /**
     * Debug - retorna estado do EventBus
     */
    debug() {
      const events = {};
      for (const [event, listeners] of this.listeners) {
        events[event] = { count: listeners.length, priorities: listeners.map(l => l.priority) };
      }
      return { events, stats: this.stats, historySize: this.history.length, paused: this._paused, queueSize: this._queue.length };
    }
  }

  // Singleton
  const eventBus = new EventBus();

  // Eventos padronizados do sistema
  eventBus.EVENTS = {
    // Mensagens
    MESSAGE_SENT: 'message:sent',
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_FAILED: 'message:failed',
    MESSAGE_DELETED: 'message:deleted',
    
    // Campanha
    CAMPAIGN_CREATED: 'campaign:created',
    CAMPAIGN_STARTED: 'campaign:started',
    CAMPAIGN_PROGRESS: 'campaign:progress',
    CAMPAIGN_PAUSED: 'campaign:paused',
    CAMPAIGN_RESUMED: 'campaign:resumed',
    CAMPAIGN_COMPLETED: 'campaign:completed',
    CAMPAIGN_CANCELLED: 'campaign:cancelled',
    CAMPAIGN_ERROR: 'campaign:error',
    
    // CRM
    CONTACT_CREATED: 'crm:contact:created',
    CONTACT_UPDATED: 'crm:contact:updated',
    CONTACT_DELETED: 'crm:contact:deleted',
    DEAL_CREATED: 'crm:deal:created',
    DEAL_UPDATED: 'crm:deal:updated',
    DEAL_DELETED: 'crm:deal:deleted',
    DEAL_STAGE_CHANGED: 'crm:deal:stage_changed',
    
    // Tasks
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated',
    TASK_COMPLETED: 'task:completed',
    TASK_DELETED: 'task:deleted',
    TASK_REMINDER: 'task:reminder',
    TASK_OVERDUE: 'task:overdue',
    
    // Subscription
    SUBSCRIPTION_UPDATED: 'subscription:updated',
    SUBSCRIPTION_EXPIRED: 'subscription:expired',
    CREDITS_UPDATED: 'credits:updated',
    CREDITS_LOW: 'credits:low',
    CREDITS_DEPLETED: 'credits:depleted',
    
    // Smart Replies
    AI_RESPONSE_GENERATED: 'smart_replies:generated',
    AI_RESPONSE_SENT: 'smart_replies:sent',
    AI_RESPONSE_ERROR: 'smart_replies:error',
    
    // Extractor
    EXTRACTION_STARTED: 'extractor:started',
    EXTRACTION_PROGRESS: 'extractor:progress',
    EXTRACTION_COMPLETED: 'extractor:completed',
    EXTRACTION_ERROR: 'extractor:error',
    
    // Labels
    LABEL_CREATED: 'label:created',
    LABEL_UPDATED: 'label:updated',
    LABEL_DELETED: 'label:deleted',
    LABEL_ASSIGNED: 'label:assigned',
    
    // Analytics
    METRIC_TRACKED: 'analytics:metric',
    
    // UI
    VIEW_CHANGED: 'ui:view_changed',
    NOTIFICATION_SHOW: 'ui:notification:show',
    MODAL_OPENED: 'ui:modal_opened',
    MODAL_CLOSED: 'ui:modal_closed',
    
    // Sistema
    SYSTEM_READY: 'system:ready',
    MODULE_LOADED: 'system:module_loaded',
    MODULE_ERROR: 'system:module_error',
    STATE_CHANGED: 'state:changed',
    ERROR: 'system:error'
  };

  eventBus.NAMESPACES = NAMESPACES;

  // Expor globalmente
  window.EventBus = eventBus;
  window.WHL_EVENTS = eventBus.EVENTS;
  window.WHL_NAMESPACES = NAMESPACES;

  console.log('[EventBus] ✅ Sistema de eventos v2.0 inicializado');
  console.log('[EventBus] 📋 Eventos disponíveis:', Object.keys(eventBus.EVENTS).length);
})();
