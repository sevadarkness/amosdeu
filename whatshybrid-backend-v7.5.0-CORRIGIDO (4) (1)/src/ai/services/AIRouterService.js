/**
 * 🧠 AI Router Service - Roteamento inteligente entre providers
 * WhatsHybrid Pro v7.1.0
 * 
 * Features:
 * - Multiple providers (OpenAI, Anthropic, Groq, Google, etc.)
 * - Automatic fallback on failures
 * - Cost optimization
 * - Load balancing
 * - Circuit breaker per provider
 * - Caching
 */

const OpenAIProvider = require('../providers/OpenAIProvider');
const AnthropicProvider = require('../providers/AnthropicProvider');
const GroqProvider = require('../providers/GroqProvider');

// Routing strategies
const STRATEGIES = {
  COST_OPTIMIZED: 'cost_optimized',
  SPEED_OPTIMIZED: 'speed_optimized',
  QUALITY_OPTIMIZED: 'quality_optimized',
  BALANCED: 'balanced',
  FAILOVER: 'failover',
  ROUND_ROBIN: 'round_robin'
};

// Provider priority for each strategy
const STRATEGY_PRIORITY = {
  [STRATEGIES.COST_OPTIMIZED]: ['groq', 'openai', 'anthropic'],
  [STRATEGIES.SPEED_OPTIMIZED]: ['groq', 'openai', 'anthropic'],
  [STRATEGIES.QUALITY_OPTIMIZED]: ['anthropic', 'openai', 'groq'],
  [STRATEGIES.BALANCED]: ['openai', 'anthropic', 'groq'],
  [STRATEGIES.FAILOVER]: ['openai', 'anthropic', 'groq'],
  [STRATEGIES.ROUND_ROBIN]: ['openai', 'anthropic', 'groq']
};

class AIRouterService {
  constructor(config = {}) {
    this.config = config;
    this.providers = new Map();
    this.strategy = config.strategy || STRATEGIES.BALANCED;
    this.roundRobinIndex = 0;
    
    // Cache for responses
    this.cache = new Map();
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour
    
    // Initialize providers
    this.initializeProviders(config);
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbacks: 0,
      errors: 0
    };
    
    console.log('[AIRouter] ✅ Initialized with strategy:', this.strategy);
  }

  /**
   * Initialize all available providers
   */
  initializeProviders(config) {
    // OpenAI
    if (config.openai?.apiKey || process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider(config.openai || {}));
      console.log('[AIRouter] ✅ OpenAI provider configured');
    }

    // Anthropic
    if (config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider(config.anthropic || {}));
      console.log('[AIRouter] ✅ Anthropic provider configured');
    }

    // Groq
    if (config.groq?.apiKey || process.env.GROQ_API_KEY) {
      this.providers.set('groq', new GroqProvider(config.groq || {}));
      console.log('[AIRouter] ✅ Groq provider configured');
    }

    console.log(`[AIRouter] Total providers: ${this.providers.size}`);
  }

  /**
   * Add or update a provider
   */
  setProvider(name, config) {
    let provider;
    switch (name) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(config);
        break;
      case 'groq':
        provider = new GroqProvider(config);
        break;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
    this.providers.set(name, provider);
    return provider;
  }

  /**
   * Get a specific provider
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders() {
    const result = [];
    for (const [name, provider] of this.providers) {
      if (provider.isConfigured()) {
        result.push({
          name,
          displayName: provider.displayName,
          models: provider.getModels(),
          defaultModel: provider.getDefaultModel(),
          isAvailable: provider.isAvailable(),
          metrics: provider.getMetrics()
        });
      }
    }
    return result;
  }

  /**
   * Set routing strategy
   */
  setStrategy(strategy) {
    if (!STRATEGIES[strategy] && !Object.values(STRATEGIES).includes(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.strategy = strategy;
  }

  /**
   * Get next provider based on strategy
   */
  getNextProvider(preferredProvider = null) {
    // If preferred provider is specified and available, use it
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider?.isConfigured() && provider?.isAvailable()) {
        return provider;
      }
    }

    // Get priority list based on strategy
    const priority = STRATEGY_PRIORITY[this.strategy] || STRATEGY_PRIORITY[STRATEGIES.BALANCED];
    
    // Round robin special handling
    if (this.strategy === STRATEGIES.ROUND_ROBIN) {
      const available = priority.filter(name => {
        const p = this.providers.get(name);
        return p?.isConfigured() && p?.isAvailable();
      });
      
      if (available.length === 0) return null;
      
      const providerName = available[this.roundRobinIndex % available.length];
      this.roundRobinIndex++;
      return this.providers.get(providerName);
    }

    // Find first available provider in priority order
    for (const name of priority) {
      const provider = this.providers.get(name);
      if (provider?.isConfigured() && provider?.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get fallback providers (excluding the one that failed)
   */
  getFallbackProviders(excludeProvider) {
    const priority = STRATEGY_PRIORITY[this.strategy] || STRATEGY_PRIORITY[STRATEGIES.BALANCED];
    
    return priority
      .filter(name => name !== excludeProvider)
      .map(name => this.providers.get(name))
      .filter(p => p?.isConfigured() && p?.isAvailable());
  }

  /**
   * Generate cache key
   */
  getCacheKey(messages, options) {
    const messagesStr = JSON.stringify(messages);
    const optionsStr = JSON.stringify({
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });
    return `${messagesStr}:${optionsStr}`;
  }

  /**
   * Check cache
   */
  checkCache(key) {
    if (!this.cacheEnabled) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.response;
  }

  /**
   * Store in cache
   */
  setCache(key, response) {
    if (!this.cacheEnabled) return;
    
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + this.cacheTTL
    });
    
    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Main completion method with automatic routing and fallback
   */
  async complete(messages, options = {}) {
    this.metrics.totalRequests++;
    
    // Check cache first
    const cacheKey = this.getCacheKey(messages, options);
    const cached = this.checkCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return { ...cached, cached: true };
    }
    this.metrics.cacheMisses++;

    // Get provider
    let provider = this.getNextProvider(options.provider);
    
    if (!provider) {
      this.metrics.errors++;
      throw new Error('No AI provider available');
    }

    // Try primary provider
    try {
      const result = await provider.complete(messages, options);
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn(`[AIRouter] ${provider.name} failed:`, error.message);
      
      // Try fallback providers
      const fallbacks = this.getFallbackProviders(provider.name);
      
      for (const fallback of fallbacks) {
        try {
          console.log(`[AIRouter] Trying fallback: ${fallback.name}`);
          this.metrics.fallbacks++;
          
          const result = await fallback.complete(messages, {
            ...options,
            model: undefined // Use fallback's default model
          });
          
          result.fallbackFrom = provider.name;
          this.setCache(cacheKey, result);
          return result;
        } catch (fallbackError) {
          console.warn(`[AIRouter] Fallback ${fallback.name} failed:`, fallbackError.message);
        }
      }
      
      // All providers failed
      this.metrics.errors++;
      throw new Error(`All AI providers failed. Last error: ${error.message}`);
    }
  }

  /**
   * Streaming completion
   */
  async *stream(messages, options = {}) {
    const provider = this.getNextProvider(options.provider);
    
    if (!provider) {
      throw new Error('No AI provider available');
    }

    try {
      for await (const chunk of provider.stream(messages, options)) {
        yield chunk;
      }
    } catch (error) {
      // Try fallback for streaming
      const fallbacks = this.getFallbackProviders(provider.name);
      
      for (const fallback of fallbacks) {
        try {
          for await (const chunk of fallback.stream(messages, {
            ...options,
            model: undefined
          })) {
            yield chunk;
          }
          return;
        } catch (fallbackError) {
          console.warn(`[AIRouter] Streaming fallback ${fallback.name} failed`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get embeddings (from provider that supports it)
   */
  async embed(text, options = {}) {
    // OpenAI has the best embeddings
    const openai = this.providers.get('openai');
    if (openai?.isConfigured()) {
      return openai.embed(text, options);
    }
    
    throw new Error('No embedding provider available');
  }

  /**
   * Health check all providers
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, provider] of this.providers) {
      if (provider.isConfigured()) {
        results[name] = await provider.healthCheck();
      } else {
        results[name] = { healthy: false, error: 'Not configured' };
      }
    }
    
    return results;
  }

  /**
   * Get router metrics
   */
  getMetrics() {
    const providerMetrics = {};
    for (const [name, provider] of this.providers) {
      providerMetrics[name] = provider.getMetrics();
    }
    
    return {
      router: this.metrics,
      providers: providerMetrics,
      strategy: this.strategy,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get available models across all providers
   */
  getAllModels() {
    const models = [];
    
    for (const [providerName, provider] of this.providers) {
      if (provider.isConfigured()) {
        for (const model of provider.getModels()) {
          models.push({
            ...model,
            provider: providerName,
            providerDisplayName: provider.displayName
          });
        }
      }
    }
    
    return models;
  }
}

// Export singleton and class
const instance = new AIRouterService();
module.exports = instance;
module.exports.AIRouterService = AIRouterService;
module.exports.STRATEGIES = STRATEGIES;
