/**
 * 🧠 AIService v1.0 - Serviço Unificado de IA Enterprise
 * Abstração multi-provider com fallback, retry, rate limiting e cache
 * 
 * Features:
 * - Multi-provider (OpenAI, Anthropic, Venice, Google, Groq, Ollama)
 * - Fallback automático entre providers
 * - Retry com exponential backoff
 * - Rate limiting inteligente
 * - Cache de respostas
 * - Streaming support
 * - Token counting
 * - Cost tracking
 * - Health monitoring
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURAÇÃO DE PROVIDERS
  // ============================================
  const PROVIDERS = {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      models: {
        'gpt-4o': { name: 'GPT-4o', contextWindow: 128000, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
        'gpt-4o-mini': { name: 'GPT-4o Mini', contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
        'gpt-4-turbo': { name: 'GPT-4 Turbo', contextWindow: 128000, costPer1kInput: 0.01, costPer1kOutput: 0.03 },
        'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', contextWindow: 16385, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
        'o1-preview': { name: 'o1 Preview', contextWindow: 128000, costPer1kInput: 0.015, costPer1kOutput: 0.06 },
        'o1-mini': { name: 'o1 Mini', contextWindow: 128000, costPer1kInput: 0.003, costPer1kOutput: 0.012 }
      },
      defaultModel: 'gpt-4o-mini',
      headerAuth: (key) => ({ 'Authorization': `Bearer ${key}` }),
      formatRequest: (messages, options) => ({
        model: options.model,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: options.stream ?? false,
        ...(options.responseFormat && { response_format: options.responseFormat }),
        ...(options.tools && { tools: options.tools }),
        ...(options.toolChoice && { tool_choice: options.toolChoice })
      }),
      parseResponse: (data) => ({
        content: data.choices?.[0]?.message?.content || '',
        toolCalls: data.choices?.[0]?.message?.tool_calls || null,
        finishReason: data.choices?.[0]?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      }),
      parseStreamChunk: (chunk) => {
        if (chunk.includes('[DONE]')) return { done: true };
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return { content: data.choices?.[0]?.delta?.content || '', done: false };
        } catch { return { content: '', done: false }; }
      }
    },

    anthropic: {
      id: 'anthropic',
      name: 'Anthropic Claude',
      endpoint: 'https://api.anthropic.com/v1/messages',
      models: {
        'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet', contextWindow: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', contextWindow: 200000, costPer1kInput: 0.001, costPer1kOutput: 0.005 },
        'claude-3-opus-20240229': { name: 'Claude 3 Opus', contextWindow: 200000, costPer1kInput: 0.015, costPer1kOutput: 0.075 }
      },
      defaultModel: 'claude-3-5-sonnet-20241022',
      headerAuth: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
      formatRequest: (messages, options) => {
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');
        return {
          model: options.model,
          max_tokens: options.maxTokens ?? 1000,
          ...(systemMsg && { system: systemMsg.content }),
          messages: otherMsgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ...(options.temperature && { temperature: options.temperature }),
          stream: options.stream ?? false
        };
      },
      parseResponse: (data) => ({
        content: data.content?.[0]?.text || '',
        finishReason: data.stop_reason,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        }
      }),
      parseStreamChunk: (chunk) => {
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          if (data.type === 'message_stop') return { done: true };
          if (data.type === 'content_block_delta') return { content: data.delta?.text || '', done: false };
          return { content: '', done: false };
        } catch { return { content: '', done: false }; }
      }
    },

    venice: {
      id: 'venice',
      name: 'Venice AI',
      endpoint: 'https://api.venice.ai/api/v1/chat/completions',
      models: {
        'llama-3.3-70b': { name: 'Llama 3.3 70B', contextWindow: 128000, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
        'llama-3.1-405b': { name: 'Llama 3.1 405B', contextWindow: 128000, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
        'deepseek-r1-llama-70b': { name: 'DeepSeek R1 70B', contextWindow: 64000, costPer1kInput: 0.001, costPer1kOutput: 0.001 }
      },
      defaultModel: 'llama-3.3-70b',
      headerAuth: (key) => ({ 'Authorization': `Bearer ${key}` }),
      formatRequest: (messages, options) => ({
        model: options.model,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: options.stream ?? false
      }),
      parseResponse: (data) => ({
        content: data.choices?.[0]?.message?.content || '',
        finishReason: data.choices?.[0]?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      }),
      parseStreamChunk: (chunk) => {
        if (chunk.includes('[DONE]')) return { done: true };
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return { content: data.choices?.[0]?.delta?.content || '', done: false };
        } catch { return { content: '', done: false }; }
      }
    },

    groq: {
      id: 'groq',
      name: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      models: {
        'llama-3.3-70b-versatile': { name: 'Llama 3.3 70B', contextWindow: 128000, costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
        'llama-3.1-8b-instant': { name: 'Llama 3.1 8B', contextWindow: 128000, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
        'mixtral-8x7b-32768': { name: 'Mixtral 8x7B', contextWindow: 32768, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 }
      },
      defaultModel: 'llama-3.3-70b-versatile',
      headerAuth: (key) => ({ 'Authorization': `Bearer ${key}` }),
      formatRequest: (messages, options) => ({
        model: options.model,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: options.stream ?? false
      }),
      parseResponse: (data) => ({
        content: data.choices?.[0]?.message?.content || '',
        finishReason: data.choices?.[0]?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      }),
      parseStreamChunk: (chunk) => {
        if (chunk.includes('[DONE]')) return { done: true };
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return { content: data.choices?.[0]?.delta?.content || '', done: false };
        } catch { return { content: '', done: false }; }
      }
    },

    google: {
      id: 'google',
      name: 'Google Gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      models: {
        'gemini-2.0-flash-exp': { name: 'Gemini 2.0 Flash', contextWindow: 1000000, costPer1kInput: 0, costPer1kOutput: 0 },
        'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', contextWindow: 2000000, costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
        'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', contextWindow: 1000000, costPer1kInput: 0.000075, costPer1kOutput: 0.0003 }
      },
      defaultModel: 'gemini-2.0-flash-exp',
      headerAuth: (key) => ({}),
      getEndpoint: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      formatRequest: (messages, options) => ({
        contents: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        ...(messages.find(m => m.role === 'system') && {
          systemInstruction: { parts: [{ text: messages.find(m => m.role === 'system').content }] }
        }),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 1000
        }
      }),
      parseResponse: (data) => ({
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        finishReason: data.candidates?.[0]?.finishReason,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0
        }
      })
    },

    ollama: {
      id: 'ollama',
      name: 'Ollama (Local)',
      endpoint: 'http://localhost:11434/api/chat',
      models: {
        'llama3.2': { name: 'Llama 3.2', contextWindow: 128000, costPer1kInput: 0, costPer1kOutput: 0 },
        'mistral': { name: 'Mistral', contextWindow: 32000, costPer1kInput: 0, costPer1kOutput: 0 },
        'codellama': { name: 'Code Llama', contextWindow: 16000, costPer1kInput: 0, costPer1kOutput: 0 }
      },
      defaultModel: 'llama3.2',
      headerAuth: () => ({}),
      formatRequest: (messages, options) => ({
        model: options.model,
        messages: messages,
        stream: options.stream ?? false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 1000
        }
      }),
      parseResponse: (data) => ({
        content: data.message?.content || '',
        finishReason: data.done ? 'stop' : null,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      })
    }
  };

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  const CONFIG = {
    STORAGE_KEY: 'whl_ai_service',
    CACHE_TTL: 300000, // 5 minutos
    MAX_CACHE_SIZE: 100,
    RETRY_ATTEMPTS: 3,
    RETRY_BASE_DELAY: 1000,
    RATE_LIMIT_WINDOW: 60000, // 1 minuto
    RATE_LIMIT_MAX: 60, // requests por minuto
    REQUEST_TIMEOUT: 30000,
    HEALTH_CHECK_INTERVAL: 300000 // 5 minutos
  };

  // v7.5.0: Verificar se provider tem API key configurada
  function hasValidApiKey(provider) {
    const key = state.configs[provider]?.apiKey;
    return key && key.length > 10 && !key.startsWith('sk-xxx');
  }
  
  function getAvailableProviders() {
    return CONFIG.fallbackChain.filter(p => hasValidApiKey(p));
  }



  // ============================================
  // ESTADO
  // ============================================
  let state = {
    configs: {}, // { providerId: { apiKey, model, enabled, priority } }
    defaultProvider: 'openai',
    fallbackChain: ['openai', 'anthropic', 'venice', 'groq'],
    cache: new Map(),
    rateLimits: new Map(),
    healthStatus: {},
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {}
    }
  };

  let initialized = false;

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  async function init() {
    if (initialized) return;
    
    try {
      await loadState();
      startHealthMonitor();
      initialized = true;
      console.log('[AIService] ✅ Inicializado');
      
      if (window.EventBus) {
        window.EventBus.emit('ai:service:ready', { providers: Object.keys(PROVIDERS) });
      }
    } catch (error) {
      console.error('[AIService] ❌ Erro na inicialização:', error);
    }
  }

  async function loadState() {
    try {
      const stored = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
      if (stored[CONFIG.STORAGE_KEY]) {
        const loaded = JSON.parse(stored[CONFIG.STORAGE_KEY]);
        state.configs = loaded.configs || {};
        state.defaultProvider = loaded.defaultProvider || 'openai';
        state.fallbackChain = loaded.fallbackChain || ['openai', 'anthropic', 'venice', 'groq'];
        state.stats = loaded.stats || state.stats;
      }
    } catch (e) {
      console.warn('[AIService] Falha ao carregar estado:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEY]: JSON.stringify({
          configs: state.configs,
          defaultProvider: state.defaultProvider,
          fallbackChain: state.fallbackChain,
          stats: state.stats
        })
      });
    } catch (e) {
      console.error('[AIService] Falha ao salvar estado:', e);
    }
  }

  // ============================================
  // CONFIGURAÇÃO DE PROVIDERS
  // ============================================
  function configureProvider(providerId, config) {
    if (!PROVIDERS[providerId]) {
      throw new Error(`Provider não suportado: ${providerId}`);
    }

    state.configs[providerId] = {
      apiKey: config.apiKey,
      model: config.model || PROVIDERS[providerId].defaultModel,
      enabled: config.enabled ?? true,
      priority: config.priority ?? 50,
      customEndpoint: config.customEndpoint || null
    };

    saveState();
    
    if (window.EventBus) {
      window.EventBus.emit('ai:provider:configured', { providerId, enabled: config.enabled });
    }

    return true;
  }

  function getProviderConfig(providerId) {
    return state.configs[providerId] || null;
  }

  function setDefaultProvider(providerId) {
    if (!PROVIDERS[providerId]) {
      throw new Error(`Provider não suportado: ${providerId}`);
    }
    state.defaultProvider = providerId;
    saveState();
  }

  function setFallbackChain(chain) {
    state.fallbackChain = chain.filter(p => PROVIDERS[p]);
    saveState();
  }

  function isProviderConfigured(providerId) {
    const config = state.configs[providerId];
    return config && config.apiKey && config.enabled;
  }

  function getConfiguredProviders() {
    return Object.keys(state.configs).filter(id => isProviderConfigured(id));
  }

  // ============================================
  // CACHE
  // ============================================
  function getCacheKey(messages, options) {
    return JSON.stringify({ m: messages.map(m => m.content.slice(0, 100)), o: options.model, t: options.temperature });
  }

  function getFromCache(key) {
    const cached = state.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
      return cached.response;
    }
    state.cache.delete(key);
    return null;
  }

  function setCache(key, response) {
    if (state.cache.size >= CONFIG.MAX_CACHE_SIZE) {
      const oldestKey = state.cache.keys().next().value;
      state.cache.delete(oldestKey);
    }
    state.cache.set(key, { response, timestamp: Date.now() });
  }

  function clearCache() {
    state.cache.clear();
  }

  // ============================================
  // RATE LIMITING
  // ============================================
  function checkRateLimit(providerId) {
    const now = Date.now();
    const limits = state.rateLimits.get(providerId) || { requests: [], window: CONFIG.RATE_LIMIT_WINDOW };
    
    // Limpar requests antigos
    limits.requests = limits.requests.filter(t => now - t < limits.window);
    
    if (limits.requests.length >= CONFIG.RATE_LIMIT_MAX) {
      return false;
    }
    
    limits.requests.push(now);
    state.rateLimits.set(providerId, limits);
    return true;
  }

  // ============================================
  // HEALTH MONITORING
  // ============================================
  function startHealthMonitor() {
    setInterval(async () => {
      for (const providerId of getConfiguredProviders()) {
        try {
          const start = Date.now();
          await testProvider(providerId);
          state.healthStatus[providerId] = {
            status: 'healthy',
            latency: Date.now() - start,
            lastCheck: Date.now()
          };
        } catch (e) {
          state.healthStatus[providerId] = {
            status: 'unhealthy',
            error: e.message,
            lastCheck: Date.now()
          };
        }
      }
      
      if (window.EventBus) {
        window.EventBus.emit('ai:health:updated', state.healthStatus);
      }
    }, CONFIG.HEALTH_CHECK_INTERVAL);
  }

  async function testProvider(providerId) {
    const config = state.configs[providerId];
    if (!config || !config.apiKey) {
      throw new Error('Provider não configurado');
    }

    return await complete([{ role: 'user', content: 'ping' }], {
      provider: providerId,
      maxTokens: 5,
      skipCache: true,
      skipFallback: true
    });
  }

  function getHealthStatus(providerId) {
    return state.healthStatus[providerId] || { status: 'unknown' };
  }

  // ============================================
  // CHAMADA PRINCIPAL
  // ============================================
  async function complete(messages, options = {}) {
    const startTime = Date.now();
    
    // PRIORIDADE 1: Tentar usar BackendClient se conectado
    if (window.BackendClient && window.BackendClient.isConnected()) {
      try {
        console.log('[AIService] 🔗 Usando Backend conectado para IA');
        const result = await window.BackendClient.ai.complete(messages, {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens
        });
        
        if (result && (result.content || result.text)) {
          return {
            content: result.content || result.text,
            provider: 'backend',
            model: result.model || 'groq',
            usage: result.usage || { totalTokens: 0 },
            latency: Date.now() - startTime
          };
        }
      } catch (backendError) {
        console.warn('[AIService] Backend falhou, tentando providers locais:', backendError.message);
      }
    }
    
    // PRIORIDADE 2: Providers configurados localmente
    const providerId = options.provider || state.defaultProvider;
    const useCache = options.cache !== false && !options.skipCache;
    const useFallback = options.fallback !== false && !options.skipFallback;
    
    // Verificar cache
    if (useCache) {
      const cacheKey = getCacheKey(messages, { ...options, provider: providerId });
      const cached = getFromCache(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Tentar provider principal e fallbacks
    const providersToTry = useFallback
      ? [providerId, ...state.fallbackChain.filter(p => p !== providerId && isProviderConfigured(p))]
      : [providerId];

    let lastError = null;

    for (const pid of providersToTry) {
      if (!isProviderConfigured(pid)) continue;
      if (!checkRateLimit(pid)) continue;

      try {
        const result = await callProvider(pid, messages, options);
        
        // Atualizar stats
        updateStats(pid, result, true, Date.now() - startTime);
        
        // Cachear resultado
        if (useCache) {
          const cacheKey = getCacheKey(messages, { ...options, provider: pid });
          setCache(cacheKey, result);
        }

        // Emitir evento
        if (window.EventBus) {
          window.EventBus.emit('ai:completion:success', {
            provider: pid,
            tokens: result.usage?.totalTokens,
            latency: Date.now() - startTime
          });
        }

        return { ...result, provider: pid, latency: Date.now() - startTime };
      } catch (error) {
        lastError = error;
        console.warn(`[AIService] Falha no provider ${pid}:`, error.message);
        updateStats(pid, null, false, Date.now() - startTime);
      }
    }

    // Emitir evento de erro
    if (window.EventBus) {
      window.EventBus.emit('ai:completion:error', { error: lastError?.message });
    }

    throw lastError || new Error('Nenhum provider disponível');
  }

  async function callProvider(providerId, messages, options) {
    const provider = PROVIDERS[providerId];
    const config = state.configs[providerId];
    
    if (!provider || !config) {
      throw new Error(`Provider ${providerId} não configurado`);
    }

    const model = options.model || config.model || provider.defaultModel;
    const endpoint = provider.getEndpoint
      ? provider.getEndpoint(model, config.apiKey)
      : (config.customEndpoint || provider.endpoint);

    const headers = {
      'Content-Type': 'application/json',
      ...provider.headerAuth(config.apiKey)
    };

    const body = provider.formatRequest(messages, { ...options, model });

    // Retry com exponential backoff
    let lastError = null;
    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return provider.parseResponse(data);
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
          await sleep(CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  // ============================================
  // STREAMING
  // ============================================
  async function* stream(messages, options = {}) {
    const providerId = options.provider || state.defaultProvider;
    const provider = PROVIDERS[providerId];
    const config = state.configs[providerId];

    if (!provider || !config) {
      throw new Error(`Provider ${providerId} não configurado`);
    }

    if (!provider.parseStreamChunk) {
      throw new Error(`Provider ${providerId} não suporta streaming`);
    }

    const model = options.model || config.model || provider.defaultModel;
    const endpoint = provider.getEndpoint
      ? provider.getEndpoint(model, config.apiKey)
      : (config.customEndpoint || provider.endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...provider.headerAuth(config.apiKey)
      },
      body: JSON.stringify(provider.formatRequest(messages, { ...options, model, stream: true }))
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        const parsed = provider.parseStreamChunk(line);
        if (parsed.done) return;
        if (parsed.content) yield parsed.content;
      }
    }
  }

  // ============================================
  // FUNÇÕES UTILITÁRIAS
  // ============================================
  function estimateTokens(text) {
    // Estimativa simples: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }

  function estimateCost(providerId, model, inputTokens, outputTokens) {
    const provider = PROVIDERS[providerId];
    const modelInfo = provider?.models[model];
    if (!modelInfo) return 0;

    return (inputTokens / 1000 * modelInfo.costPer1kInput) +
           (outputTokens / 1000 * modelInfo.costPer1kOutput);
  }

  function updateStats(providerId, result, success, latency) {
    state.stats.totalRequests++;
    if (success) {
      state.stats.successfulRequests++;
      if (result?.usage) {
        state.stats.totalTokens += result.usage.totalTokens || 0;
        const config = state.configs[providerId];
        state.stats.totalCost += estimateCost(
          providerId,
          config?.model,
          result.usage.promptTokens,
          result.usage.completionTokens
        );
      }
    } else {
      state.stats.failedRequests++;
    }

    if (!state.stats.byProvider[providerId]) {
      state.stats.byProvider[providerId] = { requests: 0, tokens: 0, errors: 0, avgLatency: 0 };
    }

    const providerStats = state.stats.byProvider[providerId];
    providerStats.requests++;
    if (success && result?.usage) {
      providerStats.tokens += result.usage.totalTokens || 0;
      providerStats.avgLatency = (providerStats.avgLatency * (providerStats.requests - 1) + latency) / providerStats.requests;
    } else {
      providerStats.errors++;
    }

    // Salvar periodicamente
    if (state.stats.totalRequests % 10 === 0) {
      saveState();
    }
  }

  function getStats() {
    return { ...state.stats };
  }

  function resetStats() {
    state.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {}
    };
    saveState();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // FUNÇÕES DE CONVENIÊNCIA
  // ============================================
  async function chat(userMessage, options = {}) {
    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options.history) {
      messages.push(...options.history);
    }
    messages.push({ role: 'user', content: userMessage });
    return complete(messages, options);
  }

  async function generateText(prompt, options = {}) {
    return complete([{ role: 'user', content: prompt }], options);
  }

  /**
   * Gera uma resposta baseada em mensagem e contexto
   * @param {string} message - Mensagem a responder
   * @param {Array} context - Histórico de mensagens [{role, content}]
   * @param {Object} options - Opções adicionais
   * @returns {Promise<string>} Texto da resposta
   */
  async function generateResponse(message, context = [], options = {}) {
    const systemPrompt = options.systemPrompt || `Você é um assistente profissional de atendimento ao cliente.
Diretrizes:
- Seja cordial e prestativo
- Responda de forma clara e objetiva
- Use linguagem profissional mas acessível
- Se não souber algo, seja honesto
- Mantenha as respostas concisas (máximo 3 parágrafos)`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Adicionar contexto
    if (context && context.length > 0) {
      // Limitar a últimas 10 mensagens
      const recentContext = context.slice(-10);
      messages.push(...recentContext);
    }
    
    // Adicionar mensagem atual
    messages.push({ role: 'user', content: message });
    
    try {
      const result = await complete(messages, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500,
        ...options
      });
      
      return result.content || result.text || '';
    } catch (error) {
      console.error('[AIService] Erro em generateResponse:', error);
      throw error;
    }
  }

  async function analyzeText(text, instruction, options = {}) {
    return complete([
      { role: 'system', content: instruction },
      { role: 'user', content: text }
    ], options);
  }

  async function translateText(text, targetLanguage, options = {}) {
    return complete([
      { role: 'system', content: `Você é um tradutor. Traduza o texto para ${targetLanguage}. Retorne apenas a tradução, sem explicações.` },
      { role: 'user', content: text }
    ], options);
  }

  async function summarize(text, options = {}) {
    return complete([
      { role: 'system', content: 'Resuma o texto de forma concisa, mantendo os pontos principais.' },
      { role: 'user', content: text }
    ], { ...options, maxTokens: options.maxTokens || 500 });
  }

  async function extractJSON(text, schema, options = {}) {
    const result = await complete([
      { role: 'system', content: `Extraia informações do texto e retorne um JSON válido seguindo este schema: ${JSON.stringify(schema)}. Retorne APENAS o JSON, sem markdown ou explicações.` },
      { role: 'user', content: text }
    ], options);

    try {
      return JSON.parse(result.content.replace(/```json\n?|\n?```/g, ''));
    } catch {
      throw new Error('Falha ao parsear JSON da resposta');
    }
  }

  // ============================================
  // EXPORT
  // ============================================
  window.AIService = {
    // Lifecycle
    init,
    
    // Configuration
    configureProvider,
    getProviderConfig,
    setDefaultProvider,
    setFallbackChain,
    isProviderConfigured,
    getConfiguredProviders,
    
    // Core
    complete,
    stream,
    chat,
    generateText,
    generateResponse,
    analyzeText,
    translateText,
    summarize,
    extractJSON,
    
    // Provider testing
    testProvider,
    getHealthStatus,
    
    // Cache
    clearCache,
    
    // Stats
    getStats,
    resetStats,
    estimateTokens,
    estimateCost,
    
    // Constants
    PROVIDERS,
    CONFIG
  };

  console.log('[AIService] 🧠 Serviço de IA v1.0 carregado');
  console.log('[AIService] 📋 Providers:', Object.keys(PROVIDERS).join(', '));
})();
