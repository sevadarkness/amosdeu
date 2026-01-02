/**
 * 🌐 BackendClient v1.0 - Cliente de API para Backend
 * Conecta a extensão ao WhatsHybrid Backend API
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_backend_client',
    DEFAULT_BASE_URL: 'http://localhost:3000',
    REQUEST_TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  };

  let state = {
    baseUrl: null,
    accessToken: null,
    refreshToken: null,
    user: null,
    workspace: null,
    connected: false,
    socket: null
  };

  let initialized = false;

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  async function init() {
    if (initialized) return;
    
    try {
      await loadState();
      
      // Auto-connect se tiver tokens
      if (state.accessToken) {
        await validateToken();
      }

      initialized = true;
      console.log('[BackendClient] ✅ Inicializado');
      
      if (window.EventBus) {
        window.EventBus.emit('backend:initialized', { connected: state.connected });
      }
    } catch (error) {
      console.error('[BackendClient] ❌ Erro na inicialização:', error);
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
      console.warn('[BackendClient] Falha ao carregar estado:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEY]: JSON.stringify({
          baseUrl: state.baseUrl,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
          workspace: state.workspace
        })
      });
    } catch (e) {
      console.error('[BackendClient] Falha ao salvar estado:', e);
    }
  }

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  function setBaseUrl(url) {
    state.baseUrl = url.replace(/\/$/, '');
    saveState();
  }

  function getBaseUrl() {
    return state.baseUrl || CONFIG.DEFAULT_BASE_URL;
  }

  function isConnected() {
    return state.connected && !!state.accessToken;
  }

  function getUser() {
    return state.user;
  }

  function getWorkspace() {
    return state.workspace;
  }

  // ============================================
  // HTTP CLIENT
  // ============================================
  async function request(endpoint, options = {}) {
    const url = `${getBaseUrl()}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(state.accessToken && { 'Authorization': `Bearer ${state.accessToken}` }),
      ...options.headers
    };

    const config = {
      method: options.method || 'GET',
      headers,
      ...(options.body && { body: JSON.stringify(options.body) })
    };

    let lastError = null;

    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(url, { ...config, signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          // Token expirado - tentar refresh
          if (response.status === 401 && state.refreshToken && !options._isRetry) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              return request(endpoint, { ...options, _isRetry: true });
            }
          }

          throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data;
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
          await sleep(CONFIG.RETRY_DELAY * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  function get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`${endpoint}${query ? '?' + query : ''}`);
  }

  function post(endpoint, body) {
    return request(endpoint, { method: 'POST', body });
  }

  function put(endpoint, body) {
    return request(endpoint, { method: 'PUT', body });
  }

  function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  // ============================================
  // AUTENTICAÇÃO
  // ============================================
  async function register(email, password, name) {
    const data = await post('/api/v1/auth/register', { email, password, name });
    
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    state.workspace = data.workspace;
    state.connected = true;
    
    await saveState();
    connectSocket();
    
    if (window.EventBus) {
      window.EventBus.emit('backend:authenticated', { user: state.user });
    }

    return data;
  }

  async function login(email, password) {
    const data = await post('/api/v1/auth/login', { email, password });
    
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    state.workspace = data.workspace;
    state.connected = true;
    
    await saveState();
    connectSocket();
    
    if (window.EventBus) {
      window.EventBus.emit('backend:authenticated', { user: state.user });
    }

    return data;
  }

  async function logout() {
    try {
      await post('/api/v1/auth/logout', {});
    } catch (e) {}

    disconnectSocket();
    
    state.accessToken = null;
    state.refreshToken = null;
    state.user = null;
    state.workspace = null;
    state.connected = false;
    
    await saveState();
    
    if (window.EventBus) {
      window.EventBus.emit('backend:disconnected');
    }
  }

  async function refreshAccessToken() {
    try {
      const data = await post('/api/v1/auth/refresh', { refreshToken: state.refreshToken });
      state.accessToken = data.accessToken;
      state.refreshToken = data.refreshToken;
      await saveState();
      console.log('[BackendClient] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[BackendClient] Token refresh failed:', error);
      // IMPORTANTE: Limpar tokens para evitar loops de refresh
      state.accessToken = null;
      state.refreshToken = null;
      state.connected = false;
      state.user = null;
      await saveState();
      console.log('[BackendClient] Tokens cleared - user needs to login again');
      return false;
    }
  }

  async function validateToken() {
    try {
      const data = await get('/api/v1/auth/me');
      state.user = data.user;
      state.workspace = data.workspace;
      state.connected = true;
      connectSocket();
      return true;
    } catch (error) {
      state.connected = false;
      return false;
    }
  }

  async function getCurrentUser() {
    return get('/api/v1/auth/me');
  }

  // ============================================
  // SOCKET.IO
  // ============================================
  
  // ============================================
  // RECONEXÃO AUTOMÁTICA (v7.5.0)
  // ============================================
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[BackendClient] Máximo de tentativas atingido');
      updateSocketUI(false, 'Falha na reconexão');
      return;
    }
    
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    reconnectAttempts++;
    
    console.log('[BackendClient] Reconectando em', delay/1000, 's (tentativa', reconnectAttempts + ')');
    updateSocketUI(false, 'Reconectando... (' + reconnectAttempts + ')');
    
    setTimeout(() => {
      if (state.accessToken && !state.socket?.connected) {
        connectSocket();
      }
    }, delay);
  }

  function resetReconnect() {
    reconnectAttempts = 0;
  }


  
  // ============================================
  // HEARTBEAT (v7.5.0)
  // ============================================
  let heartbeatInterval = null;

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
      if (state.socket?.connected) {
        state.socket.emit('ping');
        console.log('[BackendClient] ❤️ Heartbeat enviado');
      }
    }, 30000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }


  function connectSocket() {
    if (state.socket || !state.accessToken) return;

    try {
      // Verifica se Socket.IO está disponível
      if (typeof io === 'undefined') {
        // Tenta carregar dinamicamente
        loadSocketIO().then(() => {
          if (typeof io !== 'undefined') {
            initializeSocket();
          } else {
            console.warn('[BackendClient] Socket.IO não disponível após carregamento');
            updateSocketUI(false, 'Aguardando login');
          }
        }).catch(err => {
          console.warn('[BackendClient] Erro ao carregar Socket.IO:', err);
          updateSocketUI(false, 'Aguardando login');
        });
        return;
      }

      initializeSocket();
    } catch (error) {
      console.error('[BackendClient] Socket connection failed:', error);
      updateSocketUI(false, 'Erro de conexão');
    }
  }

  async function loadSocketIO() {
    return new Promise((resolve, reject) => {
      if (typeof io !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initializeSocket() {
    try {
      state.socket = io(getBaseUrl(), {
        auth: { token: state.accessToken },
        transports: ['websocket', 'polling']
      });

      state.socket.on('connect', () => {
        console.log('[BackendClient] Socket conectado');
        resetReconnect();
        startHeartbeat();
        state.socket.emit('join:workspace', state.workspace?.id);
        updateSocketUI(true, 'Conectado');
        
        // v7.5.0: Sincronizar tudo após conexão
        setTimeout(() => {
          console.log('[BackendClient] 🔄 Iniciando sincronização completa...');
          syncAll();
        }, 1000);
        
        if (window.EventBus) {
          window.EventBus.emit('backend:socket:connected');
        }
      });

      state.socket.on('disconnect', (reason) => {
        console.log('[BackendClient] Socket desconectado:', reason);
        if (reason !== 'io client disconnect' && state.accessToken) {
          scheduleReconnect();
        }
        updateSocketUI(false, 'Desconectado');
        if (window.EventBus) {
          window.EventBus.emit('backend:socket:disconnected');
        }
      });

      state.socket.on('connect_error', (err) => {
        console.warn('[BackendClient] Socket connect error:', err.message);
        updateSocketUI(false, 'Erro: ' + err.message);
      });

      // Forward events to EventBus
      const events = [
        'contact:created', 'contact:updated', 'contact:deleted',
        'message:created', 'conversation:updated',
        'campaign:created', 'campaign:updated',
        'deal:created', 'deal:updated',
        'task:created', 'task:updated', 'task:completed'
      ];

      events.forEach(event => {
        state.socket.on(event, (data) => {
          if (window.EventBus) {
            window.EventBus.emit(`backend:${event}`, data);
          }
        });
      });
    } catch (error) {
      console.error('[BackendClient] Socket init failed:', error);
      updateSocketUI(false, 'Erro de inicialização');
    }
  }

  function updateSocketUI(connected, text) {
    const statusIcon = document.getElementById('backend_ws_status');
    const statusText = document.getElementById('backend_ws_text');
    const hintText = document.getElementById('backend_ws_hint');
    
    if (statusIcon) {
      statusIcon.textContent = connected ? '🟢' : '🔴';
    }
    if (statusText) {
      statusText.textContent = text || (connected ? 'Conectado' : 'Desconectado');
    }
    if (hintText) {
      hintText.style.display = connected ? 'none' : 'block';
      if (!connected && text && text.includes('Erro')) {
        hintText.textContent = '❌ ' + text;
        hintText.style.color = '#ef4444';
      } else if (!connected) {
        hintText.textContent = '⚠️ Faça login acima para ativar a sincronização em tempo real';
        hintText.style.color = 'var(--mod-text-muted)';
      }
    }
  }

  function disconnectSocket() {
    stopHeartbeat();
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
  }

  // ============================================
  // API METHODS
  // ============================================

  // Contacts
  const contacts = {
    list: (params) => get('/api/v1/contacts', params),
    get: (id) => get(`/api/v1/contacts/${id}`),
    create: (data) => post('/api/v1/contacts', data),
    update: (id, data) => put(`/api/v1/contacts/${id}`, data),
    delete: (id) => del(`/api/v1/contacts/${id}`),
    import: (contacts) => post('/api/v1/contacts/import', { contacts })
  };

  // Conversations
  const conversations = {
    list: (params) => get('/api/v1/conversations', params),
    get: (id) => get(`/api/v1/conversations/${id}`),
    addMessage: (id, content, type) => post(`/api/v1/conversations/${id}/messages`, { content, message_type: type }),
    update: (id, data) => put(`/api/v1/conversations/${id}`, data)
  };

  // Campaigns
  const campaigns = {
    list: (params) => get('/api/v1/campaigns', params),
    get: (id) => get(`/api/v1/campaigns/${id}`),
    create: (data) => post('/api/v1/campaigns', data),
    update: (id, data) => put(`/api/v1/campaigns/${id}`, data),
    delete: (id) => del(`/api/v1/campaigns/${id}`)
  };

  // CRM
  const crm = {
    deals: {
      list: (params) => get('/api/v1/crm/deals', params),
      get: (id) => get(`/api/v1/crm/deals/${id}`),
      create: (data) => post('/api/v1/crm/deals', data),
      update: (id, data) => put(`/api/v1/crm/deals/${id}`, data),
      delete: (id) => del(`/api/v1/crm/deals/${id}`)
    },
    pipeline: {
      get: () => get('/api/v1/crm/pipeline'),
      createStage: (data) => post('/api/v1/crm/pipeline/stages', data),
      updateStage: (id, data) => put(`/api/v1/crm/pipeline/stages/${id}`, data),
      deleteStage: (id) => del(`/api/v1/crm/pipeline/stages/${id}`)
    },
    labels: {
      list: () => get('/api/v1/crm/labels'),
      create: (data) => post('/api/v1/crm/labels', data),
      update: (id, data) => put(`/api/v1/crm/labels/${id}`, data),
      delete: (id) => del(`/api/v1/crm/labels/${id}`)
    }
  };

  // Tasks
  const tasks = {
    list: (params) => get('/api/v1/tasks', params),
    getOverdue: () => get('/api/v1/tasks/overdue'),
    get: (id) => get(`/api/v1/tasks/${id}`),
    create: (data) => post('/api/v1/tasks', data),
    update: (id, data) => put(`/api/v1/tasks/${id}`, data),
    complete: (id) => post(`/api/v1/tasks/${id}/complete`),
    delete: (id) => del(`/api/v1/tasks/${id}`)
  };

  // Templates
  const templates = {
    list: (params) => get('/api/v1/templates', params),
    get: (id) => get(`/api/v1/templates/${id}`),
    create: (data) => post('/api/v1/templates', data),
    update: (id, data) => put(`/api/v1/templates/${id}`, data),
    use: (id) => post(`/api/v1/templates/${id}/use`),
    delete: (id) => del(`/api/v1/templates/${id}`)
  };

  // Analytics
  const analytics = {
    dashboard: (period) => get('/api/v1/analytics/dashboard', { period }),
    trackEvent: (event_type, event_data) => post('/api/v1/analytics/events', { event_type, event_data }),
    getEvents: (params) => get('/api/v1/analytics/events', params)
  };

  // AI
  const ai = {
    complete: (messages, options = {}) => post('/api/v1/ai/complete', { messages, ...options }),
    getCredits: () => get('/api/v1/ai/credits'),
    getUsage: (days) => get('/api/v1/ai/usage', { days }),
    knowledge: {
      list: (params) => get('/api/v1/ai/knowledge', params),
      add: (data) => post('/api/v1/ai/knowledge', data),
      delete: (id) => del(`/api/v1/ai/knowledge/${id}`)
    }
  };

  // Webhooks
  const webhooks = {
    list: () => get('/api/v1/webhooks'),
    get: (id) => get(`/api/v1/webhooks/${id}`),
    create: (data) => post('/api/v1/webhooks', data),
    update: (id, data) => put(`/api/v1/webhooks/${id}`, data),
    test: (id) => post(`/api/v1/webhooks/${id}/test`),
    delete: (id) => del(`/api/v1/webhooks/${id}`)
  };

  // Settings
  const settings = {
    getWorkspace: () => get('/api/v1/settings/workspace'),
    updateWorkspace: (data) => put('/api/v1/settings/workspace', data),
    generateApiKey: () => post('/api/v1/settings/workspace/api-key'),
    updateAiKeys: (keys) => put('/api/v1/settings/ai-keys', keys),
    getUser: () => get('/api/v1/settings/user'),
    updateUser: (data) => put('/api/v1/settings/user', data),
    getBilling: () => get('/api/v1/settings/billing'),
    export: () => get('/api/v1/settings/export')
  };

  // ============================================
  // SYNC
  // ============================================
  async function syncContacts(localContacts) {
    const result = await contacts.import(localContacts);
    
    if (window.EventBus) {
      window.EventBus.emit('backend:sync:contacts', result);
    }

    return result;
  }

  async function syncAll() {
    if (!isConnected()) {
      throw new Error('Not connected to backend');
    }

    const results = {
      contacts: await contacts.list({ limit: 1000 }),
      deals: await crm.deals.list(),
      tasks: await tasks.list(),
      templates: await templates.list(),
      labels: await crm.labels.list()
    };

    if (window.EventBus) {
      window.EventBus.emit('backend:sync:complete', results);
    }

    return results;
  }

  // ============================================
  // HELPERS
  // ============================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function debug() {
    return {
      initialized,
      connected: state.connected,
      baseUrl: getBaseUrl(),
      hasToken: !!state.accessToken,
      user: state.user,
      workspace: state.workspace,
      socketConnected: state.socket?.connected
    };
  }

  // ============================================
  // EXPORT
  // ============================================
  window.BackendClient = {
    // Lifecycle
    init,
    
    // Configuration
    setBaseUrl,
    getBaseUrl,
    isConnected,
    getUser,
    getWorkspace,
    
    // Auth
    register,
    login,
    logout,
    getCurrentUser,
    
    // API
    contacts,
    conversations,
    campaigns,
    crm,
    tasks,
    templates,
    analytics,
    ai,
    webhooks,
    settings,
    
    // Sync
    syncContacts,
    syncAll,
    
    // Raw HTTP
    get,
    post,
    put,
    del,
    request,
    
    // Debug
    debug
  };

  console.log('[BackendClient] 🌐 Cliente de backend v1.0 carregado');
  
  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }
})();

  // ============================================
  // SINCRONIZAÇÃO EM TEMPO REAL (v7.5.0)
  // ============================================
  
  // 1.3 - Sincronização de Contatos
  function syncContacts() {
    if (!state.socket?.connected) return;
    state.socket.emit('sync:contacts', { timestamp: Date.now() });
    console.log('[BackendClient] 📇 Sync contatos solicitado');
  }
  
  // 1.4 - Sincronização de Deals
  function syncDeals() {
    if (!state.socket?.connected) return;
    state.socket.emit('sync:deals', { timestamp: Date.now() });
    console.log('[BackendClient] 💰 Sync deals solicitado');
  }
  
  // 1.5 - Sincronização de Tarefas
  function syncTasks() {
    if (!state.socket?.connected) return;
    state.socket.emit('sync:tasks', { timestamp: Date.now() });
    console.log('[BackendClient] ✅ Sync tarefas solicitado');
  }
  
  // 1.6 - Sincronização de Mensagens
  function syncMessages() {
    if (!state.socket?.connected) return;
    state.socket.emit('sync:messages', { timestamp: Date.now() });
    console.log('[BackendClient] 💬 Sync mensagens solicitado');
  }
  
  // Função para sincronizar tudo após conexão
  function syncAll() {
    if (!state.socket?.connected) return;
    console.log('[BackendClient] 🔄 Iniciando sincronização completa...');
    syncContacts();
    setTimeout(syncDeals, 500);
    setTimeout(syncTasks, 1000);
    setTimeout(syncMessages, 1500);
  }
  
  // 1.2 - Atualizar UI após conexão
  function updateSocketUI(connected, message) {
    const statusEl = document.getElementById('sp_socket_status');
    if (statusEl) {
      statusEl.innerHTML = connected 
        ? '🟢 Conectado' 
        : '🔴 ' + (message || 'Desconectado');
      statusEl.style.color = connected ? '#25D366' : '#ea4335';
    }
    
    // Emitir evento para outros módulos
    if (window.EventBus) {
      window.EventBus.emit('socket:status', { connected, message });
    }
  }

