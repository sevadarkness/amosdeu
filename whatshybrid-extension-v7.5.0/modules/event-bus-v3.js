/**
 * 📡 EventBus v3.0 - Sistema de eventos pub/sub avançado
 * WhatsHybrid Pro v7.1.0
 * 
 * Features:
 * - Pub/sub pattern
 * - Wildcard subscriptions
 * - Event history
 * - Error boundaries
 * - Async event handling
 * - Event priorities
 */

(function() {
  'use strict';

  const VERSION = '3.0.0';

  class EventBusCore {
    constructor() {
      this.listeners = new Map();
      this.wildcardListeners = new Map();
      this.history = [];
      this.maxHistorySize = 100;
      this.debugMode = false;
      this.errorHandler = null;
      this.stats = {
        totalEmitted: 0,
        totalHandled: 0,
        errors: 0
      };
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name (supports wildcards like 'contact:*')
     * @param {Function} callback - Handler function
     * @param {Object} options - { priority: number, once: boolean, context: any }
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        throw new Error('EventBus: callback must be a function');
      }

      const listener = {
        callback,
        priority: options.priority || 0,
        once: options.once || false,
        context: options.context || null,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Check for wildcard
      if (event.includes('*')) {
        const pattern = event.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        
        if (!this.wildcardListeners.has(event)) {
          this.wildcardListeners.set(event, { regex, listeners: [] });
        }
        this.wildcardListeners.get(event).listeners.push(listener);
      } else {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
        
        // Sort by priority (higher first)
        this.listeners.get(event).sort((a, b) => b.priority - a.priority);
      }

      if (this.debugMode) {
        console.log(`[EventBus] Subscribed to "${event}" (id: ${listener.id})`);
      }

      // Return unsubscribe function
      return () => this.off(event, listener.id);
    }

    /**
     * Subscribe once (auto-unsubscribe after first call)
     */
    once(event, callback, options = {}) {
      return this.on(event, callback, { ...options, once: true });
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {string|Function} callbackOrId - Callback function or listener ID
     */
    off(event, callbackOrId) {
      // Handle wildcard
      if (event.includes('*')) {
        const entry = this.wildcardListeners.get(event);
        if (entry) {
          entry.listeners = entry.listeners.filter(l => 
            typeof callbackOrId === 'function' 
              ? l.callback !== callbackOrId 
              : l.id !== callbackOrId
          );
          if (entry.listeners.length === 0) {
            this.wildcardListeners.delete(event);
          }
        }
        return;
      }

      const listeners = this.listeners.get(event);
      if (!listeners) return;

      this.listeners.set(event, listeners.filter(l =>
        typeof callbackOrId === 'function'
          ? l.callback !== callbackOrId
          : l.id !== callbackOrId
      ));

      if (this.listeners.get(event).length === 0) {
        this.listeners.delete(event);
      }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     * @param {Object} options - { async: boolean, stopOnError: boolean }
     */
    emit(event, data = {}, options = {}) {
      this.stats.totalEmitted++;
      
      const eventObj = {
        name: event,
        data,
        timestamp: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Add to history
      this.history.push(eventObj);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }

      if (this.debugMode) {
        console.log(`[EventBus] Emit "${event}"`, data);
      }

      // Get all matching listeners
      const listenersToCall = [];

      // Exact match listeners
      const exactListeners = this.listeners.get(event) || [];
      listenersToCall.push(...exactListeners);

      // Wildcard listeners
      for (const [pattern, entry] of this.wildcardListeners) {
        if (entry.regex.test(event)) {
          listenersToCall.push(...entry.listeners);
        }
      }

      // Sort by priority
      listenersToCall.sort((a, b) => b.priority - a.priority);

      // Call listeners
      const toRemove = [];
      
      for (const listener of listenersToCall) {
        try {
          const context = listener.context || this;
          
          if (options.async) {
            Promise.resolve(listener.callback.call(context, data, eventObj))
              .catch(err => this.handleError(err, event, listener));
          } else {
            listener.callback.call(context, data, eventObj);
          }
          
          this.stats.totalHandled++;
          
          if (listener.once) {
            toRemove.push({ event, id: listener.id });
          }
        } catch (error) {
          this.handleError(error, event, listener);
          
          if (options.stopOnError) {
            break;
          }
        }
      }

      // Remove once listeners
      for (const { event: evt, id } of toRemove) {
        this.off(evt, id);
      }

      return listenersToCall.length;
    }

    /**
     * Emit async (returns Promise)
     */
    async emitAsync(event, data = {}) {
      return new Promise((resolve, reject) => {
        try {
          const count = this.emit(event, data, { async: true });
          resolve(count);
        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Handle errors
     */
    handleError(error, event, listener) {
      this.stats.errors++;
      
      console.error(`[EventBus] Error in handler for "${event}":`, error);
      
      if (this.errorHandler) {
        this.errorHandler(error, event, listener);
      }
    }

    /**
     * Set global error handler
     */
    setErrorHandler(handler) {
      this.errorHandler = handler;
    }

    /**
     * Check if event has listeners
     */
    hasListeners(event) {
      if (this.listeners.has(event)) {
        return this.listeners.get(event).length > 0;
      }
      
      // Check wildcards
      for (const [pattern, entry] of this.wildcardListeners) {
        if (entry.regex.test(event)) {
          return entry.listeners.length > 0;
        }
      }
      
      return false;
    }

    /**
     * Get listener count for event
     */
    listenerCount(event) {
      let count = 0;
      
      if (this.listeners.has(event)) {
        count += this.listeners.get(event).length;
      }
      
      for (const [pattern, entry] of this.wildcardListeners) {
        if (entry.regex.test(event)) {
          count += entry.listeners.length;
        }
      }
      
      return count;
    }

    /**
     * Get all registered events
     */
    getEvents() {
      return [
        ...this.listeners.keys(),
        ...this.wildcardListeners.keys()
      ];
    }

    /**
     * Get event history
     */
    getHistory(event = null, limit = 50) {
      let history = this.history;
      
      if (event) {
        history = history.filter(e => e.name === event);
      }
      
      return history.slice(-limit);
    }

    /**
     * Clear all listeners for an event
     */
    clear(event) {
      if (event) {
        this.listeners.delete(event);
        this.wildcardListeners.delete(event);
      } else {
        this.listeners.clear();
        this.wildcardListeners.clear();
      }
    }

    /**
     * Get stats
     */
    getStats() {
      return {
        ...this.stats,
        listeners: this.listeners.size,
        wildcardListeners: this.wildcardListeners.size,
        historySize: this.history.length
      };
    }

    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
      this.debugMode = enabled;
    }

    /**
     * Debug info
     */
    debug() {
      return {
        version: VERSION,
        stats: this.getStats(),
        events: this.getEvents(),
        recentHistory: this.getHistory(null, 10)
      };
    }
  }

  // Create singleton instance
  const EventBus = new EventBusCore();

  // Standard events
  const EVENTS = {
    // System
    INIT: 'system:init',
    READY: 'system:ready',
    ERROR: 'system:error',
    
    // Auth
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_REFRESH: 'auth:refresh',
    
    // Contacts
    CONTACT_CREATED: 'contact:created',
    CONTACT_UPDATED: 'contact:updated',
    CONTACT_DELETED: 'contact:deleted',
    CONTACT_SELECTED: 'contact:selected',
    
    // Messages
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_SENT: 'message:sent',
    MESSAGE_FAILED: 'message:failed',
    
    // CRM
    DEAL_CREATED: 'deal:created',
    DEAL_UPDATED: 'deal:updated',
    DEAL_DELETED: 'deal:deleted',
    DEAL_WON: 'deal:won',
    DEAL_LOST: 'deal:lost',
    
    // Tasks
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated',
    TASK_COMPLETED: 'task:completed',
    TASK_DELETED: 'task:deleted',
    
    // AI/Copilot
    AI_REQUEST: 'ai:request',
    AI_RESPONSE: 'ai:response',
    AI_ERROR: 'ai:error',
    AI_SUGGESTION: 'ai:suggestion',
    
    // Backend
    BACKEND_CONNECTED: 'backend:connected',
    BACKEND_DISCONNECTED: 'backend:disconnected',
    BACKEND_SYNC: 'backend:sync',
    
    // View
    VIEW_CHANGED: 'view:changed',
    VIEW_REFRESH: 'view:refresh',
    
    // Campaigns
    CAMPAIGN_STARTED: 'campaign:started',
    CAMPAIGN_PAUSED: 'campaign:paused',
    CAMPAIGN_COMPLETED: 'campaign:completed',
    CAMPAIGN_PROGRESS: 'campaign:progress'
  };

  // Export
  if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
    window.EventBus.EVENTS = EVENTS;
    window.EventBus.VERSION = VERSION;
    console.log(`[EventBus] v${VERSION} initialized`);
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
    module.exports.EVENTS = EVENTS;
  }

})();
