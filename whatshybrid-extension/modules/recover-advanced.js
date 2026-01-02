/**
 * WhatsHybrid Recover Advanced v7.5.0
 * Sistema completo de recuperação de mensagens
 * 
 * Implementa todas as 34 tarefas do Recover (6.1-6.18 + 8.1-8.16)
 */
(function() {
  'use strict';

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  const CONFIG = {
    MAX_MESSAGES: 100,           // 8.16 - Limite de mensagens
    MAX_MEDIA_SIZE: 5242880,     // 8.16 - 5MB
    PAGE_SIZE: 20,               // 8.14 - Paginação
    STORAGE_KEY: 'whl_recover_history',
    FAVORITES_KEY: 'whl_recover_favorites',
    NOTIFICATIONS_KEY: 'whl_recover_notifications',
    RETRY_ATTEMPTS: 3,           // 8.13 - Retry com backoff
    RETRY_DELAYS: [1000, 2000, 4000],
    BACKEND_URL: 'http://localhost:3000'
  };

  // ============================================
  // PHASE 1: CORE MESSAGE VERSIONS
  // ============================================
  
  // Estrutura principal de versões por mensagem
  const messageVersions = new Map();

  // Modelo de estados
  const MESSAGE_STATES = {
    NORMAL: 'normal',
    CREATED: 'created',
    EDITED: 'edited',
    REVOKED_GLOBAL: 'revoked_global',
    DELETED_LOCAL: 'deleted_local',
    FAILED: 'failed',
    CACHED_ONLY: 'cached_only',
    SNAPSHOT_INITIAL: 'snapshot_initial',
    SNAPSHOT_LOADED: 'snapshot_loaded',
    REMOVED: 'removed',
    STATUS_PUBLISHED: 'status_published',
    STATUS_DELETED: 'status_deleted'
  };

  // Estados que compõem o "Universo Revogado"
  const REVOKED_UNIVERSE_STATES = [
    MESSAGE_STATES.DELETED_LOCAL,
    MESSAGE_STATES.REVOKED_GLOBAL,
    MESSAGE_STATES.EDITED,
    MESSAGE_STATES.FAILED,
    MESSAGE_STATES.CACHED_ONLY,
    MESSAGE_STATES.STATUS_DELETED,
    MESSAGE_STATES.SNAPSHOT_INITIAL,
    MESSAGE_STATES.SNAPSHOT_LOADED,
    MESSAGE_STATES.REMOVED
  ];

  // ============================================
  // ESTADO
  // ============================================
  const state = {
    messages: [],
    favorites: new Set(),
    contactNotifications: new Set(),
    filters: { 
      type: 'all',      // all, revoked, deleted, edited, media
      chat: null,       // filtrar por número
      dateFrom: null, 
      dateTo: null,
      direction: 'all', // PHASE 2: all, incoming, outgoing, third_party
      state: 'all'      // PHASE 2: all, revoked_global, deleted_local, edited, revoked_universe
    },
    page: 0,
    initialized: false,
    cachedOwner: null // PHASE 2: Cache do owner para evitar múltiplas detecções
  };

  // ============================================
  // 8.12 - CACHE LRU INTELIGENTE
  // ============================================
  class LRUCache {
    constructor(maxSize = 50) {
      this.maxSize = maxSize;
      this.cache = new Map();
    }

    get(key) {
      if (!this.cache.has(key)) return null;
      const value = this.cache.get(key);
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    set(key, value) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.maxSize) {
        // Remove oldest (first item)
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
    }

    has(key) {
      return this.cache.has(key);
    }

    clear() {
      this.cache.clear();
    }

    get size() {
      return this.cache.size;
    }
  }

  const mediaCache = new LRUCache(50);

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  async function init() {
    if (state.initialized) return;
    
    console.log('[RecoverAdvanced] 🚀 Inicializando...');
    
    await loadFromStorage();
    setupEventListeners();
    
    // PHASE 1: Migrar mensagens antigas para novo sistema
    if (state.messages.length > 0) {
      migrateFromLegacy(state.messages);
    }
    
    state.initialized = true;
    console.log('[RecoverAdvanced] ✅ Inicializado -', state.messages.length, 'mensagens carregadas');
    console.log('[RecoverAdvanced] ✅ messageVersions:', messageVersions.size, 'entradas');
  }

  async function loadFromStorage() {
    try {
      // Usar chrome.storage.local para compartilhar entre contextos
      const result = await new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get([CONFIG.STORAGE_KEY, CONFIG.FAVORITES_KEY, CONFIG.NOTIFICATIONS_KEY, 'whl_message_versions'], resolve);
        } else {
          // Fallback para localStorage (content script)
          resolve({
            [CONFIG.STORAGE_KEY]: localStorage.getItem(CONFIG.STORAGE_KEY),
            [CONFIG.FAVORITES_KEY]: localStorage.getItem(CONFIG.FAVORITES_KEY),
            [CONFIG.NOTIFICATIONS_KEY]: localStorage.getItem(CONFIG.NOTIFICATIONS_KEY),
            'whl_message_versions': localStorage.getItem('whl_message_versions')
          });
        }
      });
      
      // PHASE 1: Carregar messageVersions primeiro
      let versionsData = result['whl_message_versions'];
      if (typeof versionsData === 'string') {
        try {
          versionsData = JSON.parse(versionsData);
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear messageVersions:', e);
          versionsData = null;
        }
      }
      if (versionsData && typeof versionsData === 'object') {
        // Restaurar Map de messageVersions
        Object.entries(versionsData).forEach(([id, entry]) => {
          messageVersions.set(id, entry);
        });
        console.log('[RecoverAdvanced] ✅ messageVersions carregado:', messageVersions.size, 'entradas');
      }
      
      // Carregar histórico
      let saved = result[CONFIG.STORAGE_KEY];
      if (typeof saved === 'string') {
        try {
          saved = JSON.parse(saved);
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear dados salvos:', e);
          saved = null;
        }
      }
      if (Array.isArray(saved)) {
        // CORREÇÃO 4.1: Aplicar análise de sentimento ao carregar mensagens
        state.messages = saved.slice(0, CONFIG.MAX_MESSAGES).map(m => ({
          ...m,
          sentiment: m.sentiment || (m.body ? analyzeSentiment(m.body) : 'neutral')
        }));
      }
      
      // Carregar favoritos
      let favs = result[CONFIG.FAVORITES_KEY];
      if (typeof favs === 'string') {
        try {
          favs = JSON.parse(favs);
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear favoritos:', e);
          favs = null;
        }
      }
      if (Array.isArray(favs)) {
        state.favorites = new Set(favs);
      }
      
      // Carregar configurações de notificações por contato
      let notifs = result[CONFIG.NOTIFICATIONS_KEY];
      if (typeof notifs === 'string') {
        try {
          notifs = JSON.parse(notifs);
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear notificações:', e);
          notifs = null;
        }
      }
      if (Array.isArray(notifs)) {
        state.contactNotifications = new Set(notifs);
      }
      
      console.log('[RecoverAdvanced] ✅ Storage carregado:', state.messages.length, 'mensagens');
    } catch (e) {
      console.warn('[RecoverAdvanced] Erro ao carregar storage:', e);
    }
  }

  async function saveToStorage() {
    try {
      // Limitar tamanho
      const toSave = state.messages.slice(0, CONFIG.MAX_MESSAGES);
      
      // PHASE 1: Converter messageVersions Map para objeto serializável
      const versionsToSave = {};
      messageVersions.forEach((entry, id) => {
        versionsToSave[id] = entry;
      });
      
      const data = {
        [CONFIG.STORAGE_KEY]: toSave,
        [CONFIG.FAVORITES_KEY]: [...state.favorites],
        [CONFIG.NOTIFICATIONS_KEY]: [...state.contactNotifications],
        'whl_message_versions': versionsToSave
      };
      
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set(data);
      } else {
        // Fallback para localStorage
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(toSave));
        localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify([...state.favorites]));
        localStorage.setItem(CONFIG.NOTIFICATIONS_KEY, JSON.stringify([...state.contactNotifications]));
        localStorage.setItem('whl_message_versions', JSON.stringify(versionsToSave));
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] Erro ao salvar storage:', e);
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  function setupEventListeners() {
    // Receber mensagens do wpp-hooks.js
    window.addEventListener('message', async (e) => {
      if (e.origin !== window.location.origin) return;
      
      const recoverTypes = [
        'WHL_RECOVER_MESSAGE',
        'WHL_RECOVER_NEW_MESSAGE', 
        'WHL_RECOVERED_MESSAGE',
        'WHL_MESSAGE_REVOKED',
        'WHL_MESSAGE_DELETED',
        'WHL_MESSAGE_EDITED'
      ];
      
      if (recoverTypes.includes(e.data?.type)) {
        await handleNewMessage(e.data.payload || e.data);
      }
    });

    // EventBus listeners
    if (window.EventBus) {
      window.EventBus.on('recover:new_message', handleNewMessage);
      window.EventBus.on('recover:set_filter', ({ type, value }) => setFilter(type, value));
      window.EventBus.on('recover:sync', syncWithBackend);
      window.EventBus.on('recover:export', ({ format }) => {
        if (format === 'csv') exportToCSV();
        else if (format === 'txt') exportToTXT();
        else if (format === 'pdf') exportToPDF();
      });
    }
  }

  // ============================================
  // PHASE 1: MESSAGE VERSIONS REGISTRY
  // ============================================
  
  // ============================================
  // BUG 3: ANTI-DUPLICAÇÃO ROBUSTA
  // ============================================
  
  // Configurable threshold for duplicate detection
  const DUPLICATE_TIME_THRESHOLD_MS = 5000; // 5 seconds
  
  function normalizeContent(content) {
    if (!content || typeof content !== 'string') return '';
    return content.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  
  function isDuplicateEvent(msgId, newEvent) {
    const entry = messageVersions.get(msgId);
    if (!entry || !entry.history || entry.history.length === 0) return false;
    
    const {
      state: newState,
      body: newBody,
      timestamp: newTimestamp
    } = newEvent;
    
    const normalizedNewBody = normalizeContent(newBody);
    
    // Check last 3 events for duplicates (most likely to be recent duplicates)
    const recentEvents = entry.history.slice(-3);
    
    for (const existingEvent of recentEvents) {
      const {
        state: existingState,
        body: existingBody,
        timestamp: existingTimestamp
      } = existingEvent;
      
      // 1. Check if states match
      if (existingState !== newState) continue;
      
      // 2. Check if content matches (normalized)
      const normalizedExistingBody = normalizeContent(existingBody);
      if (normalizedExistingBody !== normalizedNewBody) continue;
      
      // 3. Check if timestamps are close (configurable threshold)
      const timeDiff = Math.abs((newTimestamp || 0) - (existingTimestamp || 0));
      if (timeDiff < DUPLICATE_TIME_THRESHOLD_MS) {
        console.log('[RecoverAdvanced] Duplicate event detected and ignored:', {
          msgId,
          state: newState,
          timeDiff: `${timeDiff}ms`
        });
        return true; // It's a duplicate
      }
    }
    
    return false; // Not a duplicate
  }
  
  function registerMessageEvent(msgData, state, origin = 'unknown') {
    const id = msgData.id || msgData.msgId || Date.now().toString();
    
    // BUG 3: Check for duplicates BEFORE adding
    const newEvent = {
      state,
      body: msgData.body || msgData.text || msgData.caption || '',
      previousBody: msgData.previousBody || msgData.previousContent || null,
      mediaType: msgData.mediaType || msgData.mimetype || null,
      mediaDataPreview: msgData.mediaDataPreview || msgData.thumbnail || null,
      mediaDataFull: null, // Só preenchido quando usuário solicitar
      transcription: msgData.transcription || null,
      timestamp: msgData.timestamp || Date.now(),
      origin,
      capturedAt: Date.now()
    };
    
    if (!messageVersions.has(id)) {
      // Criar nova entrada
      messageVersions.set(id, {
        id,
        chatId: msgData.chatId || msgData.chat || extractChatId(msgData),
        from: extractPhoneNumber(msgData.from || msgData.author || msgData.sender),
        to: extractPhoneNumber(msgData.to || msgData.chatId),
        type: msgData.type || 'chat',
        direction: determineDirection(msgData),
        owner: getOwner(),
        history: []
      });
    }
    
    const entry = messageVersions.get(id);
    
    // BUG 3: Only add if not duplicate
    if (!isDuplicateEvent(id, newEvent)) {
      // BUG 2: NUNCA sobrescrever - apenas adicionar ao history
      entry.history.push(newEvent);
      
      // BUG 2: Save imediately after each registration
      saveToStorage().catch(e => {
        console.warn('[RecoverAdvanced] Falha ao salvar após registrar evento:', e);
      });
    }
    
    // Atualizar campos principais se necessário
    if (msgData.from) entry.from = extractPhoneNumber(msgData.from);
    if (msgData.to) entry.to = extractPhoneNumber(msgData.to);
    if (msgData.type) entry.type = msgData.type;
    
    return entry;
  }

  // Obter histórico completo de uma mensagem
  function getMessageHistory(id) {
    return messageVersions.get(id) || null;
  }

  // Obter estado atual (último estado no histórico)
  function getCurrentState(id) {
    const entry = messageVersions.get(id);
    if (!entry || entry.history.length === 0) return null;
    return entry.history[entry.history.length - 1].state;
  }

  // Verificar se mensagem está no "Universo Revogado"
  function isInRevokedUniverse(id) {
    const entry = messageVersions.get(id);
    if (!entry) return false;
    return entry.history.some(h => REVOKED_UNIVERSE_STATES.includes(h.state));
  }

  // Obter todas as mensagens do Universo Revogado
  function getRevokedUniverseMessages() {
    const result = [];
    messageVersions.forEach((entry, id) => {
      if (isInRevokedUniverse(id)) {
        result.push(entry);
      }
    });
    return result;
  }

  // ============================================
  // PHASE 1: LEGACY MIGRATION
  // ============================================
  
  function mapLegacyActionToState(action) {
    const mapping = {
      'revoked': MESSAGE_STATES.REVOKED_GLOBAL,
      'deleted': MESSAGE_STATES.DELETED_LOCAL,
      'edited': MESSAGE_STATES.EDITED,
      'failed': MESSAGE_STATES.FAILED
    };
    return mapping[action] || MESSAGE_STATES.CACHED_ONLY;
  }

  // Migrar mensagens do formato antigo (array plano) para messageVersions
  function migrateFromLegacy(legacyMessages) {
    if (!Array.isArray(legacyMessages)) return;
    
    legacyMessages.forEach(msg => {
      const state = mapLegacyActionToState(msg.action);
      registerMessageEvent(msg, state, 'legacy_migration');
    });
    
    console.log(`[RecoverAdvanced] Migrados ${legacyMessages.length} registros do formato antigo`);
  }

  // ============================================
  // 6.1-6.7 - CAPTURA DE MENSAGENS
  // ============================================
  async function handleNewMessage(data) {
    if (!data) return;
    
    const msg = {
      id: data.id || data.msgId || Date.now().toString(),
      from: extractPhone(data.from || data.author || data.sender),
      to: extractPhone(data.to || data.chatId || data.chat),
      body: data.body || data.text || data.caption || '',
      type: data.type || 'chat',           // 6.4-6.7: chat, image, video, audio, ptt, sticker, document
      action: data.action || data.kind || 'revoked',  // 6.1-6.3: revoked, deleted, edited
      timestamp: data.timestamp || data.ts || Date.now(),
      mediaData: null,
      mediaType: data.mediaType || data.mimetype || null,
      filename: data.filename || null,
      previousContent: data.previousContent || data.originalBody || null,  // Para mensagens editadas
      sentiment: null
    };

    // 8.4 - Análise de sentimento
    if (msg.body) {
      msg.sentiment = analyzeSentiment(msg.body);
    }

    // 6.16-6.18 - Capturar mídia em qualidade original
    if (data.mediaData && data.mediaData !== '__HAS_MEDIA__') {
      msg.mediaData = data.mediaData;
    } else if (data.mediaKey || ['image', 'video', 'audio', 'ptt', 'sticker', 'document'].includes(msg.type)) {
      // 8.1 - Tentar download ativo
      const downloaded = await downloadMediaActive(data);
      if (downloaded) {
        msg.mediaData = downloaded;
      }
    }

    // 8.15 - Compressão se necessário
    if (msg.mediaData && msg.mediaData.length > CONFIG.MAX_MEDIA_SIZE) {
      msg.mediaData = await compressMedia(msg.mediaData, msg.type);
    }

    // PHASE 1: Registrar no novo sistema de versões
    const messageState = mapLegacyActionToState(msg.action);
    registerMessageEvent({
      ...data,
      ...msg,
      mediaDataPreview: msg.mediaData
    }, messageState, 'handle_new_message');

    // Adicionar ao início (mais recente primeiro) - MANTER COMPATIBILIDADE
    state.messages.unshift(msg);
    
    // Manter limite
    if (state.messages.length > CONFIG.MAX_MESSAGES) {
      state.messages = state.messages.slice(0, CONFIG.MAX_MESSAGES);
    }

    await saveToStorage();

    // 8.5/8.11 - Notificações
    if (state.contactNotifications.has(msg.from) || state.contactNotifications.has('all')) {
      await showNotification(msg);
    }

    // Emitir evento para UI
    if (window.EventBus) {
      window.EventBus.emit('recover:message_added', msg);
    }

    console.log('[RecoverAdvanced] ✅ Mensagem capturada:', msg.action, msg.type, msg.from);
  }

  // ============================================
  // PHASE 2: ENHANCED PHONE EXTRACTION
  // ============================================
  
  function cleanPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return '';
    
    // Remover sufixos do WhatsApp
    let cleaned = phone
      .replace(/@c\.us$/i, '')
      .replace(/@s\.whatsapp\.net$/i, '')
      .replace(/@g\.us$/i, '')
      .replace(/@broadcast$/i, '')
      .replace(/@lid$/i, '')
      .replace(/@newsletter$/i, '');
    
    // Manter apenas números
    cleaned = cleaned.replace(/\D/g, '');
    
    return cleaned;
  }

  function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Número válido: 8-15 dígitos
    return phone.length >= 8 && phone.length <= 15 && /^\d+$/.test(phone);
  }

  function extractPhoneNumber(value) {
    if (!value) return 'Desconhecido';
    
    // Lista de campos a tentar (em ordem de prioridade)
    const fieldsToTry = [
      // Direto
      () => value,
      // Objeto com _serialized
      () => value?._serialized,
      () => value?.user,
      () => value?.id,
      // Campos específicos
      () => value?.to,
      () => value?.to?._serialized,
      () => value?.to?.user,
      () => value?.from,
      () => value?.from?._serialized,
      () => value?.from?.user,
      // Chat
      () => value?.chat?.id?.user,
      () => value?.chat?.id?._serialized,
      () => value?.chat?.contact?.id?.user,
      () => value?.chat?.contact?.number,
      // ID
      () => value?.id?.remote?.user,
      () => value?.id?.remote?._serialized,
      () => value?.id?.participant?.user,
      () => value?.id?.participant?._serialized,
      // Author
      () => value?.author,
      () => value?.author?._serialized,
      () => value?.author?.user,
      // Sender
      () => value?.sender,
      () => value?.sender?._serialized,
      () => value?.phoneNumber,
      () => value?.number
    ];
    
    for (const getter of fieldsToTry) {
      try {
        const result = getter();
        if (result && typeof result === 'string') {
          const cleaned = cleanPhoneNumber(result);
          if (isValidPhoneNumber(cleaned)) {
            return cleaned;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fallback: tentar converter objeto para string
    if (typeof value === 'object') {
      const str = String(value);
      const cleaned = cleanPhoneNumber(str);
      if (isValidPhoneNumber(cleaned)) {
        return cleaned;
      }
    }
    
    return 'Desconhecido';
  }

  // ============================================
  // 6.13-6.15 - EXTRAÇÃO DE TELEFONE (LEGACY)
  // ============================================
  function extractPhone(value) {
    // Backward compatibility: use new extractPhoneNumber
    return extractPhoneNumber(value);
  }

  // ============================================
  // PHASE 2: DIRECTION AND OWNER DETECTION
  // ============================================
  
  function getOwner() {
    if (state.cachedOwner) return state.cachedOwner;
    
    try {
      // Método 1: Store.Conn.me._serialized
      if (window.Store?.Conn?.me?._serialized) {
        state.cachedOwner = cleanPhoneNumber(window.Store.Conn.me._serialized);
        return state.cachedOwner;
      }
      
      // Método 2: Store.Conn.wid._serialized
      if (window.Store?.Conn?.wid?._serialized) {
        state.cachedOwner = cleanPhoneNumber(window.Store.Conn.wid._serialized);
        return state.cachedOwner;
      }
      
      // Método 3: localStorage - last-wid-md
      const storedMd = localStorage.getItem('last-wid-md');
      if (storedMd) {
        try {
          const parsed = JSON.parse(storedMd);
          const phoneNumber = cleanPhoneNumber(parsed._serialized || parsed);
          if (isValidPhoneNumber(phoneNumber)) {
            state.cachedOwner = phoneNumber;
            return state.cachedOwner;
          }
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear last-wid-md:', e);
        }
      }
      
      // Método 4: localStorage - last-wid
      const stored = localStorage.getItem('last-wid');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const phoneNumber = cleanPhoneNumber(parsed._serialized || parsed);
          if (isValidPhoneNumber(phoneNumber)) {
            state.cachedOwner = phoneNumber;
            return state.cachedOwner;
          }
        } catch (e) {
          console.warn('[RecoverAdvanced] Erro ao parsear last-wid:', e);
        }
      }
      
      // Método 5: Tentar do DOM
      const profileEl = document.querySelector('[data-testid="chatlist-header"] img');
      if (profileEl?.src) {
        const match = profileEl.src.match(/u=(\d+)/);
        if (match && isValidPhoneNumber(match[1])) {
          state.cachedOwner = match[1];
          return state.cachedOwner;
        }
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] Erro ao detectar owner:', e);
    }
    
    return null;
  }

  function mentionsOwner(msg, owner) {
    if (!msg || !owner) return false;
    
    // Verificar menções
    if (msg.mentionedJidList) {
      return msg.mentionedJidList.some(jid => 
        cleanPhoneNumber(jid) === owner
      );
    }
    
    // Verificar quotedMsg (resposta a mim)
    if (msg.quotedMsg || msg.quotedStanzaID) {
      const quotedFrom = extractPhoneNumber(msg.quotedMsg?.from || msg.quotedParticipant);
      if (quotedFrom === owner) return true;
    }
    
    return false;
  }

  function determineDirection(msg) {
    const owner = getOwner();
    if (!owner) return 'unknown';
    
    const from = extractPhoneNumber(msg.from || msg.author || msg.sender);
    const to = extractPhoneNumber(msg.to || msg.chatId);
    
    // Mensagem enviada por mim
    if (msg.fromMe === true || from === owner) {
      return 'outgoing';
    }
    
    // Mensagem destinada a mim (chat privado ou menção)
    if (to === owner || mentionsOwner(msg, owner)) {
      return 'incoming';
    }
    
    // Mensagem entre terceiros (em grupo/comunidade)
    return 'third_party';
  }

  function extractChatId(msg) {
    if (!msg) return null;
    
    // Tentar várias fontes
    const sources = [
      msg.chatId,
      msg.chat?.id?._serialized,
      msg.chat?.id,
      msg.id?.remote?._serialized,
      msg.id?.remote,
      msg.from?.chat,
      msg.to
    ];
    
    for (const source of sources) {
      if (source) {
        const cleaned = typeof source === 'string' ? source : source?._serialized || String(source);
        if (cleaned && cleaned.includes('@')) {
          return cleaned;
        }
      }
    }
    
    return null;
  }

  // ============================================
  // 8.1 - DOWNLOAD ATIVO DE MÍDIAS
  // ============================================
  async function downloadMediaActive(msg) {
    if (!msg) return null;

    // CORREÇÃO 3.2: Verificar cache LRU primeiro
    const cacheKey = msg.id || msg.msgId || JSON.stringify(msg);
    if (mediaCache.has(cacheKey)) {
      console.log('[RecoverAdvanced] 📦 Mídia encontrada no cache');
      return mediaCache.get(cacheKey);
    }

    // 8.13 - Retry com backoff
    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        // Método 1: Via Store do WhatsApp
        if (window.Store?.DownloadManager?.downloadMedia) {
          const media = await window.Store.DownloadManager.downloadMedia(msg);
          if (media) {
            const base64 = await blobToBase64(media);
            if (base64) {
              // CORREÇÃO 3.2: Armazenar no cache
              mediaCache.set(cacheKey, base64);
              return base64;
            }
          }
        }

        // Método 2: Via mediaData direto
        if (msg.mediaData && msg.mediaData !== '__HAS_MEDIA__') {
          mediaCache.set(cacheKey, msg.mediaData);
          return msg.mediaData;
        }

        // Método 3: Via backend
        if (msg.mediaKey) {
          const response = await fetch(`${CONFIG.BACKEND_URL}/api/media/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mediaKey: msg.mediaKey,
              directPath: msg.directPath,
              mimetype: msg.mimetype
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.base64) {
              mediaCache.set(cacheKey, data.base64);
              return data.base64;
            }
          }
        }
      } catch (e) {
        console.warn(`[RecoverAdvanced] Download attempt ${attempt + 1} failed:`, e.message);
        if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
          await sleep(CONFIG.RETRY_DELAYS[attempt]);
        }
      }
    }

    return null;
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result?.split(',')[1] || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // BUG 1: DOWNLOAD FULL-SIZE MEDIA (REAL, NOT THUMBNAIL)
  // ============================================
  
  /**
   * BUG 1 SOLUTION: Download real media content, not just thumbnail
   * Implements DOM traversal + Store API + Backend fallback
   * 
   * @param {string} messageId - The ID of the message to download media from
   * @param {string} mediaType - Type of media (image, video, audio, document, etc.)
   * @returns {Promise<Object>} Result object with success flag, data, and method used
   */
  async function downloadRealMedia(messageId, mediaType) {
    console.log('[RecoverAdvanced] 🔽 Downloading real media for:', messageId, mediaType);
    
    try {
      // Step 1: Try to locate message element in DOM
      const msgElement = document.querySelector(`[data-id="${messageId}"]`);
      
      if (msgElement) {
        console.log('[RecoverAdvanced] Found message in DOM, trying navigation...');
        
        // Step 2: Navigate to previous sibling (where real content is)
        const parentContainer = msgElement.closest('[data-testid="msg-container"]');
        const previousSibling = parentContainer?.previousElementSibling;
        
        if (previousSibling) {
          // Step 3: Find download button or media link
          const downloadBtn = previousSibling.querySelector('[data-testid="media-download"]') ||
                            previousSibling.querySelector('button[aria-label*="Download"]') ||
                            previousSibling.querySelector('[data-testid="download"]');
          
          if (downloadBtn) {
            // Step 4: Click download button
            console.log('[RecoverAdvanced] Found download button, triggering download...');
            downloadBtn.click();
            // Note: Actual download is handled by browser
            return { success: true, method: 'dom_click', message: 'Download triggered' };
          }
        }
      }
      
      // Step 5: Fallback to Store.Msg API
      if (window.Store?.Msg?.get) {
        console.log('[RecoverAdvanced] Trying Store.Msg.get...');
        const msg = await window.Store.Msg.get(messageId);
        if (msg) {
          return await downloadMediaFromStore(msg);
        }
      }
      
      // Step 6: Last fallback - use existing downloadFullMedia
      console.log('[RecoverAdvanced] Using downloadFullMedia fallback...');
      const media = await downloadFullMedia(messageId);
      return media ? { success: true, data: media, method: 'download_full_media' } : { success: false };
      
    } catch (e) {
      console.error('[RecoverAdvanced] downloadRealMedia failed:', e);
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Helper: Download media from Store message object
   * @param {Object} msg - WhatsApp message object from Store
   * @returns {Promise<Object>} Result object with success flag, data, and method used
   */
  async function downloadMediaFromStore(msg) {
    try {
      if (!msg.mediaData) {
        console.warn('[RecoverAdvanced] No mediaData in message');
        return null;
      }
      
      // Method 1: Direct blob
      if (msg.mediaData.mediaBlob) {
        const base64 = await blobToBase64(msg.mediaData.mediaBlob);
        return { success: true, data: base64, method: 'media_blob' };
      }
      
      // Method 2: Download and decrypt via mediaKey + filehash
      if (msg.mediaKey && msg.filehash && window.Store?.DownloadManager?.downloadAndDecrypt) {
        try {
          const decrypted = await window.Store.DownloadManager.downloadAndDecrypt({
            directPath: msg.directPath,
            mediaKey: msg.mediaKey,
            type: msg.type,
            filehash: msg.filehash
          });
          
          if (decrypted) {
            const base64 = await blobToBase64(decrypted);
            return { success: true, data: base64, method: 'download_decrypt' };
          }
        } catch (e) {
          console.warn('[RecoverAdvanced] downloadAndDecrypt failed:', e);
        }
      }
      
      // Method 3: Use DownloadManager.downloadMedia
      if (window.Store?.DownloadManager?.downloadMedia) {
        try {
          const blob = await window.Store.DownloadManager.downloadMedia(msg);
          if (blob) {
            const base64 = await blobToBase64(blob);
            return { success: true, data: base64, method: 'download_media' };
          }
        } catch (e) {
          console.warn('[RecoverAdvanced] downloadMedia failed:', e);
        }
      }
      
      return { success: false, error: 'No download method succeeded' };
    } catch (e) {
      console.error('[RecoverAdvanced] downloadMediaFromStore failed:', e);
      return { success: false, error: e.message };
    }
  }
  
  // ============================================
  // EXISTING: DOWNLOAD FULL-SIZE MEDIA
  // ============================================
  async function downloadFullMedia(messageId) {
    try {
      const entry = messageVersions.get(messageId);
      if (!entry) {
        console.warn('[RecoverAdvanced] Message not found:', messageId);
        return null;
      }
      
      // Check if already have full media
      const latestEvent = entry.history[entry.history.length - 1];
      if (latestEvent?.mediaDataFull) {
        console.log('[RecoverAdvanced] Full media already cached');
        return latestEvent.mediaDataFull;
      }
      
      // Try to find the message in Store and download
      let mediaData = null;
      
      // Method 1: Use WHL_RecoverHelpers if available
      if (window.WHL_RecoverHelpers?.findMessageById) {
        const msg = await window.WHL_RecoverHelpers.findMessageById(messageId);
        if (msg) {
          // Try Store.DownloadManager
          if (window.Store?.DownloadManager?.downloadMedia) {
            try {
              const blob = await window.Store.DownloadManager.downloadMedia(msg);
              if (blob) {
                mediaData = await blobToBase64(blob);
              }
            } catch (e) {
              console.warn('[RecoverAdvanced] DownloadManager failed:', e);
            }
          }
          
          // Fallback: Try getBuffer()
          if (!mediaData && msg.mediaData && typeof msg.mediaData.getBuffer === 'function') {
            try {
              const buffer = await msg.mediaData.getBuffer();
              if (buffer) {
                const blob = new Blob([buffer], { type: msg.mimetype || 'application/octet-stream' });
                mediaData = await blobToBase64(blob);
              }
            } catch (e) {
              console.warn('[RecoverAdvanced] getBuffer failed:', e);
            }
          }
          
          // Fallback 2: Use directPath if available
          if (!mediaData && msg.directPath) {
            try {
              const response = await fetch(`${CONFIG.BACKEND_URL}/api/media/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  directPath: msg.directPath,
                  mediaKey: msg.mediaKey,
                  mimetype: msg.mimetype
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                mediaData = data.base64 || null;
              }
            } catch (e) {
              console.warn('[RecoverAdvanced] Backend download failed:', e);
            }
          }
        }
      }
      
      // Save to mediaDataFull in the latest event
      if (mediaData && latestEvent) {
        latestEvent.mediaDataFull = mediaData;
        await saveToStorage();
        console.log('[RecoverAdvanced] Full media downloaded and saved');
      }
      
      return mediaData;
    } catch (e) {
      console.error('[RecoverAdvanced] downloadFullMedia failed:', e);
      return null;
    }
  }
  
  // Helper: Save full media to a specific message event
  async function saveMediaFull(messageId, mediaData) {
    try {
      const entry = messageVersions.get(messageId);
      if (!entry || !entry.history || entry.history.length === 0) {
        console.warn('[RecoverAdvanced] Cannot save media: message not found');
        return false;
      }
      
      // Save to the latest event
      const latestEvent = entry.history[entry.history.length - 1];
      latestEvent.mediaDataFull = mediaData;
      
      await saveToStorage();
      console.log('[RecoverAdvanced] Full media saved for message:', messageId);
      return true;
    } catch (e) {
      console.error('[RecoverAdvanced] saveMediaFull failed:', e);
      return false;
    }
  }

  // ============================================
  // 8.2 - TRANSCRIÇÃO DE ÁUDIOS
  // ============================================
  async function transcribeAudio(audioBase64) {
    try {
      // Método 1: Backend (mais confiável)
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64 })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.text) return data.text;
      } else if (response.status === 404) {
        console.warn('[RecoverAdvanced] Backend transcription endpoint not available (404)');
      } else {
        console.warn('[RecoverAdvanced] Backend transcription failed with status:', response.status);
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] Transcrição via backend falhou:', e.message);
    }

    // Método 2: Web Speech API (Chrome)
    if ('webkitSpeechRecognition' in window) {
      try {
        return await transcribeWithWebSpeech(audioBase64);
      } catch (e) {
        console.warn('[RecoverAdvanced] Web Speech falhou:', e.message);
      }
    }

    return null;
  }

  async function transcribeWithWebSpeech(audioBase64) {
    return new Promise((resolve, reject) => {
      const recognition = new webkitSpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (e) => resolve(e.results[0][0].transcript);
      recognition.onerror = (e) => reject(e.error);
      recognition.onend = () => resolve(null);

      // Tocar áudio para reconhecimento
      const audio = new Audio(`data:audio/ogg;base64,${audioBase64}`);
      audio.onended = () => recognition.stop();
      audio.play().then(() => recognition.start()).catch(reject);

      // Timeout
      setTimeout(() => {
        recognition.stop();
        resolve(null);
      }, 30000);
    });
  }

  // ============================================
  // 8.3 - OCR EM IMAGENS
  // ============================================
  async function extractTextFromImage(imageBase64) {
    try {
      // Método 1: Backend (mais confiável)
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.text) return data.text;
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] OCR via backend falhou:', e.message);
    }

    // Método 2: Tesseract.js (se disponível)
    if (window.Tesseract) {
      try {
        const result = await window.Tesseract.recognize(
          `data:image/jpeg;base64,${imageBase64}`,
          'por',
          { logger: () => {} }
        );
        return result?.data?.text || null;
      } catch (e) {
        console.warn('[RecoverAdvanced] Tesseract falhou:', e.message);
      }
    }

    return null;
  }

  // ============================================
  // 8.4 - ANÁLISE DE SENTIMENTO
  // ============================================
  function analyzeSentiment(text) {
    if (!text || typeof text !== 'string') return 'neutral';

    const lower = text.toLowerCase();
    
    const positiveWords = [
      'obrigado', 'obrigada', 'ótimo', 'ótima', 'excelente', 'perfeito', 'perfeita',
      'legal', 'bom', 'boa', 'maravilhoso', 'maravilhosa', 'incrível', 'parabéns',
      'feliz', 'amor', 'amei', 'adorei', 'top', 'show', 'massa', 'dahora',
      '👍', '❤️', '😊', '🎉', '😍', '🥰', '💕', '✨', '🙏', '👏'
    ];

    const negativeWords = [
      'ruim', 'péssimo', 'péssima', 'horrível', 'problema', 'erro', 'falha',
      'raiva', 'triste', 'decepcionado', 'decepcionada', 'irritado', 'irritada',
      'odeio', 'odiei', 'merda', 'porra', 'droga', 'inferno', 'desgraça',
      '👎', '😠', '😢', '💔', '😤', '😡', '🤬', '😭', '😞'
    ];

    let score = 0;
    positiveWords.forEach(w => { if (lower.includes(w)) score++; });
    negativeWords.forEach(w => { if (lower.includes(w)) score--; });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  // ============================================
  // 8.5 - NOTIFICAÇÕES DESKTOP
  // ============================================
  async function showNotification(msg) {
    if (!('Notification' in window)) return;

    // Pedir permissão se necessário
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    const titles = {
      revoked: '❌ Mensagem Revogada',
      deleted: '🗑️ Mensagem Apagada',
      edited: '✏️ Mensagem Editada'
    };

    const icons = {
      revoked: '❌',
      deleted: '🗑️',
      edited: '✏️'
    };

    const notification = new Notification(titles[msg.action] || '📩 Mensagem Recuperada', {
      body: `De: ${msg.from}\n${msg.body?.substring(0, 100) || '[Mídia]'}`,
      icon: icons[msg.action] || '📩',
      tag: `recover-${msg.id}`,
      requireInteraction: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close após 5s
    setTimeout(() => notification.close(), 5000);
  }

  // ============================================
  // 8.6 - EXPORTAÇÃO CSV/TXT/PDF
  // ============================================
  function exportToCSV() {
    const filtered = getFilteredMessages();
    if (filtered.length === 0) {
      alert('Nenhuma mensagem para exportar.');
      return;
    }

    const headers = ['ID', 'De', 'Para', 'Tipo', 'Ação', 'Mensagem', 'Sentimento', 'Data'];
    const rows = filtered.map(m => [
      m.id,
      m.from,
      m.to || '',
      m.type,
      m.action,
      (m.body || '').replace(/"/g, '""').replace(/\n/g, ' '),
      m.sentiment || '',
      new Date(m.timestamp).toLocaleString('pt-BR')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');

    download(csv, `recover_${Date.now()}.csv`, 'text/csv;charset=utf-8');
    console.log('[RecoverAdvanced] ✅ CSV exportado:', filtered.length, 'mensagens');
  }

  function exportToTXT() {
    const filtered = getFilteredMessages();
    if (filtered.length === 0) {
      alert('Nenhuma mensagem para exportar.');
      return;
    }

    const lines = filtered.map(m => {
      const date = new Date(m.timestamp).toLocaleString('pt-BR');
      const action = { revoked: 'REVOGADA', deleted: 'APAGADA', edited: 'EDITADA' }[m.action] || m.action?.toUpperCase();
      const sentiment = m.sentiment ? ` | Sentimento: ${m.sentiment}` : '';
      
      return `[${date}] ${action} | De: ${m.from}${sentiment}\n${m.body || '[Mídia: ' + m.type + ']'}\n${'─'.repeat(50)}`;
    });

    const txt = `WhatsHybrid Recover - Exportado em ${new Date().toLocaleString('pt-BR')}\nTotal: ${filtered.length} mensagens\n${'═'.repeat(50)}\n\n${lines.join('\n\n')}`;

    download(txt, `recover_${Date.now()}.txt`, 'text/plain;charset=utf-8');
    console.log('[RecoverAdvanced] ✅ TXT exportado:', filtered.length, 'mensagens');
  }

  function exportToPDF() {
    const filtered = getFilteredMessages();
    if (filtered.length === 0) {
      alert('Nenhuma mensagem para exportar.');
      return;
    }

    // Usar jsPDF se disponível
    if (window.jspdf?.jsPDF || window.jsPDF) {
      const { jsPDF } = window.jspdf || window;
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('WhatsHybrid Recover', 20, 20);
      doc.setFontSize(10);
      doc.text(`Exportado em: ${new Date().toLocaleString('pt-BR')}`, 20, 30);
      doc.text(`Total: ${filtered.length} mensagens`, 20, 36);
      
      let y = 50;
      filtered.forEach((m, i) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        const date = new Date(m.timestamp).toLocaleString('pt-BR');
        const action = { revoked: 'REVOGADA', deleted: 'APAGADA', edited: 'EDITADA' }[m.action] || m.action;
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`[${date}] ${action} - De: ${m.from}`, 20, y);
        y += 5;
        
        doc.setFontSize(10);
        doc.setTextColor(0);
        const body = m.body || `[Mídia: ${m.type}]`;
        const lines = doc.splitTextToSize(body, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 8;
      });
      
      doc.save(`recover_${Date.now()}.pdf`);
      console.log('[RecoverAdvanced] ✅ PDF exportado:', filtered.length, 'mensagens');
    } else {
      // Fallback: gerar HTML e abrir para impressão
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsHybrid Recover</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #00a884; }
            .msg { border-bottom: 1px solid #ddd; padding: 10px 0; }
            .meta { color: #666; font-size: 12px; }
            .body { margin-top: 5px; }
          </style>
        </head>
        <body>
          <h1>WhatsHybrid Recover</h1>
          <p>Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
          <p>Total: ${filtered.length} mensagens</p>
          <hr>
          ${filtered.map(m => `
            <div class="msg">
              <div class="meta">
                [${new Date(m.timestamp).toLocaleString('pt-BR')}] 
                ${m.action?.toUpperCase()} - De: ${m.from}
              </div>
              <div class="body">${(m.body || `[Mídia: ${m.type}]`).replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
        </body>
        </html>
      `;
      
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // 8.7 - SINCRONIZAÇÃO COM BACKEND
  // ============================================
  async function syncWithBackend() {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/recover/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.messages,
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[RecoverAdvanced] ✅ Sincronizado com backend:', data.synced, 'mensagens');
        
        // Mesclar mensagens do backend (mais recentes primeiro)
        if (data.messages?.length) {
          const existingIds = new Set(state.messages.map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));
          state.messages = [...newMessages, ...state.messages].slice(0, CONFIG.MAX_MESSAGES);
          await saveToStorage();
        }
        
        return true;
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] Sync falhou:', e.message);
    }
    return false;
  }

  // ============================================
  // 8.8 - AGRUPAMENTO POR CHAT
  // ============================================
  function getGroupedByChat() {
    const groups = new Map();
    
    getFilteredMessages().forEach(msg => {
      const chat = msg.from || 'unknown';
      if (!groups.has(chat)) {
        groups.set(chat, {
          chat,
          messages: [],
          count: 0,
          lastMessage: null
        });
      }
      
      const group = groups.get(chat);
      group.messages.push(msg);
      group.count++;
      
      if (!group.lastMessage || msg.timestamp > group.lastMessage.timestamp) {
        group.lastMessage = msg;
      }
    });
    
    // Ordenar por última mensagem
    return Array.from(groups.values()).sort((a, b) => 
      (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)
    );
  }

  // ============================================
  // 8.9 - FAVORITOS
  // ============================================
  function toggleFavorite(id) {
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }
    saveToStorage();
    return state.favorites.has(id);
  }

  function isFavorite(id) {
    return state.favorites.has(id);
  }

  function getFavorites() {
    return state.messages.filter(m => state.favorites.has(m.id));
  }

  // ============================================
  // 8.10 - COMPARAR VERSÕES EDITADAS
  // ============================================
  function compareEdited(id) {
    const msg = state.messages.find(m => m.id === id);
    if (!msg || msg.action !== 'edited') return null;

    const original = msg.previousContent || '';
    const edited = msg.body || '';

    return {
      original,
      edited,
      diff: generateDiff(original, edited)
    };
  }

  function generateDiff(original, edited) {
    const origWords = original.split(/\s+/);
    const editWords = edited.split(/\s+/);
    
    const added = editWords.filter(w => !origWords.includes(w));
    const removed = origWords.filter(w => !editWords.includes(w));
    
    return {
      added,
      removed,
      addedText: added.join(' '),
      removedText: removed.join(' ')
    };
  }

  // ============================================
  // 8.11 - NOTIFICAÇÕES POR CONTATO
  // ============================================
  function setContactNotification(phone, enabled) {
    const cleanPhone = extractPhone(phone);
    if (enabled) {
      state.contactNotifications.add(cleanPhone);
    } else {
      state.contactNotifications.delete(cleanPhone);
    }
    saveToStorage();
    return enabled;
  }

  function getContactNotifications() {
    return [...state.contactNotifications];
  }

  // ============================================
  // 8.14 - PAGINAÇÃO
  // ============================================
  function getPage(page = 0) {
    const filtered = getFilteredMessages();
    const start = page * CONFIG.PAGE_SIZE;
    const end = start + CONFIG.PAGE_SIZE;
    
    return {
      messages: filtered.slice(start, end),
      page,
      totalPages: Math.ceil(filtered.length / CONFIG.PAGE_SIZE),
      total: filtered.length,
      hasNext: end < filtered.length,
      hasPrev: page > 0
    };
  }

  function nextPage() {
    const result = getPage(state.page + 1);
    if (result.messages.length > 0) {
      state.page++;
    }
    return getPage(state.page);
  }

  function prevPage() {
    if (state.page > 0) {
      state.page--;
    }
    return getPage(state.page);
  }

  // ============================================
  // 8.15 - COMPRESSÃO DE MÍDIA
  // ============================================
  async function compressMedia(base64, type) {
    if (!base64 || type === 'audio' || type === 'ptt' || type === 'document') {
      return base64; // Não comprimir áudios e documentos
    }

    try {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height * maxDim) / width;
              width = maxDim;
            } else {
              width = (width * maxDim) / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressed = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          resolve(compressed);
        };
        
        img.onerror = () => resolve(base64);
        img.src = `data:image/jpeg;base64,${base64}`;
      });
    } catch (e) {
      return base64;
    }
  }

  // ============================================
  // 6.8-6.11 - FILTROS
  // ============================================
  function setFilter(type, value) {
    if (type === 'type') {
      state.filters.type = value || 'all';
    } else if (type === 'chat') {
      state.filters.chat = value || null;
    } else if (type === 'dateFrom') {
      state.filters.dateFrom = value ? new Date(value).getTime() : null;
    } else if (type === 'dateTo') {
      state.filters.dateTo = value ? new Date(value).getTime() : null;
    } else if (type === 'direction') {
      // PHASE 2: Filtro de direção
      state.filters.direction = value || 'all';
    } else if (type === 'state') {
      // PHASE 2: Filtro de estado
      state.filters.state = value || 'all';
    }
    
    state.page = 0; // Reset página ao mudar filtro
    
    if (window.EventBus) {
      window.EventBus.emit('recover:filter_changed', state.filters);
    }
  }

  function getFilteredMessages() {
    let filtered = [...state.messages];

    // Filtro por tipo de ação
    if (state.filters.type !== 'all') {
      if (state.filters.type === 'media') {
        filtered = filtered.filter(m => 
          ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(m.type)
        );
      } else if (state.filters.type === 'favorites') {
        // CORREÇÃO 2.1: Adicionar filtro de favoritos
        filtered = filtered.filter(m => state.favorites.has(m.id));
      } else {
        filtered = filtered.filter(m => m.action === state.filters.type);
      }
    }

    // PHASE 2: Filtro por direção
    if (state.filters.direction !== 'all') {
      filtered = filtered.filter(m => {
        // Calcular direção se não estiver armazenada
        const msgDirection = m.direction || determineDirection(m);
        return msgDirection === state.filters.direction;
      });
    }

    // PHASE 2: Filtro por estado (verifica histórico no messageVersions)
    if (state.filters.state !== 'all') {
      if (state.filters.state === 'revoked_universe') {
        filtered = filtered.filter(m => isInRevokedUniverse(m.id));
      } else {
        filtered = filtered.filter(m => {
          const entry = messageVersions.get(m.id);
          if (!entry) return false;
          return entry.history.some(h => h.state === state.filters.state);
        });
      }
    }

    // Filtro por chat/número
    if (state.filters.chat) {
      const search = state.filters.chat.toLowerCase().replace(/\D/g, '');
      filtered = filtered.filter(m => 
        (m.from || '').includes(search) || 
        (m.to || '').includes(search)
      );
    }

    // Filtro por data
    if (state.filters.dateFrom) {
      filtered = filtered.filter(m => (m.timestamp || 0) >= state.filters.dateFrom);
    }

    if (state.filters.dateTo) {
      filtered = filtered.filter(m => (m.timestamp || 0) <= state.filters.dateTo);
    }

    return filtered;
  }

  // ============================================
  // ESTATÍSTICAS
  // ============================================
  function getStats() {
    const all = state.messages;
    return {
      total: all.length,
      revoked: all.filter(m => m.action === 'revoked').length,
      deleted: all.filter(m => m.action === 'deleted').length,
      edited: all.filter(m => m.action === 'edited').length,
      favorites: state.favorites.size,
      byType: {
        chat: all.filter(m => m.type === 'chat').length,
        image: all.filter(m => m.type === 'image').length,
        video: all.filter(m => m.type === 'video').length,
        audio: all.filter(m => ['audio', 'ptt'].includes(m.type)).length,
        sticker: all.filter(m => m.type === 'sticker').length,
        document: all.filter(m => m.type === 'document').length
      },
      bySentiment: {
        positive: all.filter(m => m.sentiment === 'positive').length,
        negative: all.filter(m => m.sentiment === 'negative').length,
        neutral: all.filter(m => m.sentiment === 'neutral').length
      }
    };
  }

  // ============================================
  // LIMPEZA
  // ============================================
  function clearHistory() {
    state.messages = [];
    state.favorites.clear();
    state.page = 0;
    saveToStorage();
    
    if (window.EventBus) {
      window.EventBus.emit('recover:cleared');
    }
  }

  // ============================================
  // BUG 5: REFRESH BUTTON - RELOAD WITH REAL DATA
  // ============================================
  async function refreshMessages() {
    console.log('[RecoverAdvanced] 🔄 Refreshing messages...');
    
    try {
      // Step 1: Clear memory cache
      const processedIds = new Set();
      console.log('[RecoverAdvanced] Cache cleared');
      
      // Step 2: Reload from storage
      await loadFromStorage();
      console.log('[RecoverAdvanced] Loaded from storage:', state.messages.length, 'messages');
      
      // Step 3: Check for new deleted messages via hooks
      const newMessages = await checkForNewDeletedMessages();
      console.log('[RecoverAdvanced] Found', newMessages.length, 'new messages');
      
      // Step 4: Merge without duplicates
      const allMessages = mergeWithoutDuplicates(state.messages, newMessages);
      state.messages = allMessages.slice(0, CONFIG.MAX_MESSAGES);
      
      // Step 5: Save back to storage
      await saveToStorage();
      
      console.log('[RecoverAdvanced] ✅ Refresh complete:', state.messages.length, 'total messages');
      
      return {
        success: true,
        total: state.messages.length,
        newCount: newMessages.length
      };
    } catch (e) {
      console.error('[RecoverAdvanced] Refresh failed:', e);
      return {
        success: false,
        error: e.message
      };
    }
  }
  
  /**
   * BUG 5: Check for new deleted messages from WhatsApp Store
   */
  async function checkForNewDeletedMessages() {
    const newMessages = [];
    
    try {
      if (!window.Store?.Msg?.getModelsArray) {
        return newMessages;
      }
      
      // Get all messages and filter for revoked ones
      const allMsgs = window.Store.Msg.getModelsArray() || [];
      const revokedMsgs = allMsgs.filter(m => m.isRevoked || m.type === 'revoked');
      
      for (const msg of revokedMsgs) {
        const id = msg.id?.id || msg.id?._serialized;
        
        // Check if we already have this message
        const existing = state.messages.find(m => m.id === id);
        if (!existing) {
          const normalized = normalizeMessage(msg);
          if (normalized) {
            newMessages.push(normalized);
          }
        }
      }
    } catch (e) {
      console.warn('[RecoverAdvanced] checkForNewDeletedMessages failed:', e);
    }
    
    return newMessages;
  }
  
  /**
   * BUG 5: Normalize WhatsApp message to our format
   */
  function normalizeMessage(msg) {
    try {
      return {
        id: msg.id?.id || msg.id?._serialized || Date.now().toString(),
        from: extractPhone(msg.from || msg.author || msg.sender),
        to: extractPhone(msg.to || msg.chatId),
        body: msg.body || msg.caption || '[Mídia]',
        type: msg.type || 'chat',
        action: msg.isRevoked ? 'revoked' : 'deleted',
        timestamp: msg.t || msg.timestamp || Date.now(),
        mediaType: msg.type,
        mediaData: null
      };
    } catch (e) {
      return null;
    }
  }
  
  /**
   * BUG 5: Merge messages without duplicates
   */
  function mergeWithoutDuplicates(existing, newMsgs) {
    const merged = [...existing];
    const existingIds = new Set(existing.map(m => m.id));
    
    for (const msg of newMsgs) {
      if (!existingIds.has(msg.id)) {
        merged.unshift(msg); // Add to beginning (most recent first)
        existingIds.add(msg.id);
      }
    }
    
    return merged;
  }

  // ============================================
  // BUG 6: SYNC - BACKEND CONNECTION CHECK
  // ============================================
  async function checkBackendConnection() {
    console.log('[RecoverAdvanced] 🔍 Checking backend connection...');
    
    try {
      // Step 1: Check if we have a token in storage
      const stored = await chrome.storage.local.get(['whl_access_token', 'whl_user']);
      const token = stored.whl_access_token;
      const user = stored.whl_user;
      
      if (!token) {
        console.log('[RecoverAdvanced] No token found');
        return { connected: false, reason: 'no_token' };
      }
      
      // Step 2: Check if socket is connected
      if (window.BackendClient?.socket?.connected) {
        console.log('[RecoverAdvanced] Socket already connected');
        return { connected: true, user };
      }
      
      // Step 3: Try to reconnect socket if we have token
      if (token && window.BackendClient) {
        console.log('[RecoverAdvanced] Attempting to reconnect socket...');
        
        // Try to connect
        if (typeof window.BackendClient.connectSocket === 'function') {
          window.BackendClient.connectSocket();
        }
        
        // Wait a bit for connection
        await sleep(2000);
        
        if (window.BackendClient.socket?.connected) {
          console.log('[RecoverAdvanced] Socket reconnected successfully');
          return { connected: true, user, reconnected: true };
        }
      }
      
      // Step 4: Fallback - try HTTP health check
      try {
        const baseUrl = window.BackendClient?.getBaseUrl?.() || CONFIG.BACKEND_URL;
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${baseUrl}/api/health`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('[RecoverAdvanced] Backend reachable via HTTP');
          return { connected: true, user, viaHttp: true };
        }
      } catch (e) {
        console.warn('[RecoverAdvanced] HTTP health check failed:', e);
      }
      
      console.log('[RecoverAdvanced] Connection failed');
      return { connected: false, reason: 'connection_failed' };
      
    } catch (e) {
      console.error('[RecoverAdvanced] checkBackendConnection error:', e);
      return { connected: false, reason: 'error', error: e.message };
    }
  }

  // ============================================
  // BUG 7: DEEPSCAN - COMPLETE WITH PROGRESS
  // ============================================
  async function executeDeepScan(onProgress) {
    console.log('[RecoverAdvanced] 🔍 Starting DeepScan...');
    
    const results = {
      success: false,
      found: 0,
      scanned: 0,
      errors: []
    };
    
    try {
      // Phase 1: Get list of chats (0-20%)
      onProgress?.({ phase: 1, progress: 10, status: 'Obtaining chat list...' });
      const chats = await getAllChats();
      onProgress?.({ phase: 1, progress: 20, status: `Found ${chats.length} chats` });
      
      if (chats.length === 0) {
        throw new Error('No chats found');
      }
      
      // Phase 2: Scan messages in each chat (20-60%)
      const foundMessages = [];
      const totalChats = chats.length;
      
      for (let i = 0; i < totalChats; i++) {
        const chat = chats[i];
        const progress = 20 + Math.floor((i / totalChats) * 40);
        
        onProgress?.({ 
          phase: 2, 
          progress, 
          status: `Scanning: ${chat.name || chat.id}`,
          detail: `${i + 1}/${totalChats} chats`
        });
        
        try {
          const deleted = await scanChatForDeletedMessages(chat.id);
          foundMessages.push(...deleted);
          results.scanned++;
          
          // Small delay to not overload
          await sleep(100);
        } catch (e) {
          console.warn('[RecoverAdvanced] Error scanning chat:', chat.id, e);
          results.errors.push({ chat: chat.id, error: e.message });
        }
      }
      
      onProgress?.({ 
        phase: 2, 
        progress: 60, 
        status: `Found ${foundMessages.length} messages`,
        detail: 'Phase 2/4 complete'
      });
      
      // Phase 3: Process and deduplicate (60-80%)
      onProgress?.({ phase: 3, progress: 70, status: 'Processing messages...' });
      const processed = await processAndDeduplicate(foundMessages);
      results.found = processed.length;
      onProgress?.({ 
        phase: 3, 
        progress: 80, 
        status: `${processed.length} unique messages`,
        detail: 'Phase 3/4 complete'
      });
      
      // Phase 4: Save and update (80-100%)
      onProgress?.({ phase: 4, progress: 90, status: 'Saving to history...' });
      
      // Merge with existing messages
      state.messages = mergeWithoutDuplicates(state.messages, processed);
      state.messages = state.messages.slice(0, CONFIG.MAX_MESSAGES);
      
      await saveToStorage();
      
      onProgress?.({ 
        phase: 4, 
        progress: 100, 
        status: '✅ DeepScan complete!',
        detail: `${results.found} new messages recovered`
      });
      
      results.success = true;
      console.log('[RecoverAdvanced] ✅ DeepScan complete:', results);
      
      return results;
      
    } catch (e) {
      console.error('[RecoverAdvanced] DeepScan error:', e);
      results.errors.push({ global: e.message });
      onProgress?.({ 
        phase: 0, 
        progress: 0, 
        status: '❌ Error: ' + e.message
      });
      
      return results;
    }
  }
  
  /**
   * BUG 7: Get all chats from WhatsApp
   */
  async function getAllChats() {
    try {
      if (!window.Store?.Chat?.getModelsArray) {
        throw new Error('WhatsApp Store not available');
      }
      
      const chats = window.Store.Chat.getModelsArray() || [];
      
      return chats.map(chat => ({
        id: chat.id?._serialized || chat.id,
        name: chat.name || chat.formattedTitle || 'Unknown',
        isGroup: chat.isGroup || false
      }));
    } catch (e) {
      console.error('[RecoverAdvanced] getAllChats failed:', e);
      return [];
    }
  }
  
  /**
   * BUG 7: Scan specific chat for deleted messages
   */
  async function scanChatForDeletedMessages(chatId) {
    const deleted = [];
    
    try {
      // Method 1: Via Store.Msg
      if (window.Store?.Msg?.getModelsArray) {
        const msgs = window.Store.Msg.getModelsArray() || [];
        const chatMsgs = msgs.filter(m => {
          const msgChatId = m.id?.remote?._serialized || m.chatId?._serialized;
          return msgChatId === chatId && (m.isRevoked || m.type === 'revoked');
        });
        
        for (const msg of chatMsgs) {
          const normalized = normalizeMessage(msg);
          if (normalized) {
            deleted.push(normalized);
          }
        }
      }
      
      // Method 2: Via DOM (visible messages)
      const container = document.querySelector(`[data-id="${chatId}"]`);
      if (container) {
        const revokedEls = container.querySelectorAll('[data-testid="recalled-message"], .message-revoked');
        
        for (const el of revokedEls) {
          const msgData = extractMessageFromElement(el);
          if (msgData) {
            deleted.push(msgData);
          }
        }
      }
      
    } catch (e) {
      console.warn('[RecoverAdvanced] scanChatForDeletedMessages failed:', chatId, e);
    }
    
    return deleted;
  }
  
  /**
   * BUG 7: Extract message data from DOM element
   */
  function extractMessageFromElement(element) {
    try {
      const id = element.getAttribute('data-id') || Date.now().toString();
      const text = element.textContent || '';
      
      return {
        id,
        body: text || '[Deleted message]',
        type: 'chat',
        action: 'revoked',
        timestamp: Date.now(),
        from: 'Unknown',
        to: 'Unknown'
      };
    } catch (e) {
      return null;
    }
  }
  
  /**
   * BUG 7: Process and deduplicate messages
   * @param {Array} messages - Array of messages to process
   * @returns {Promise<Array>} Deduplicated array of messages
   */
  async function processAndDeduplicate(messages) {
    const unique = new Map();
    
    for (const msg of messages) {
      // Use robust key with fallbacks for undefined values
      const timestamp = msg.timestamp || Date.now();
      const from = msg.from || 'unknown';
      const id = msg.id || `generated_${Date.now()}_${Math.random()}`;
      const key = `${id}_${from}_${timestamp}`;
      
      if (!unique.has(key)) {
        unique.set(key, msg);
      }
    }
    
    return Array.from(unique.values());
  }

  // ============================================
  // API PÚBLICA
  // ============================================
  window.RecoverAdvanced = {
    // Inicialização
    init,
    
    // Mensagens
    getMessages: () => [...state.messages],
    getFilteredMessages,
    addMessage: handleNewMessage,
    
    // PHASE 1: Message Versions API
    registerMessageEvent,
    getMessageHistory,
    getMessageVersions: () => {
      // Retornar cópia do Map como objeto
      const result = {};
      messageVersions.forEach((entry, id) => {
        result[id] = entry;
      });
      return result;
    },
    getCurrentState,
    isInRevokedUniverse,
    getRevokedUniverseMessages,
    messageVersions: messageVersions, // Direct access for advanced use
    MESSAGE_STATES,
    REVOKED_UNIVERSE_STATES,
    
    // PHASE 2: Enhanced extraction and direction
    extractPhoneNumber,
    cleanPhoneNumber,
    isValidPhoneNumber,
    getOwner,
    determineDirection,
    extractChatId,
    
    // Paginação
    getPage,
    nextPage,
    prevPage,
    
    // Filtros
    setFilter,
    getFilters: () => ({ ...state.filters }),
    
    // Favoritos
    toggleFavorite,
    isFavorite,
    getFavorites,
    
    // Agrupamento
    getGroupedByChat,
    
    // Comparação de edições
    compareEdited,
    
    // Mídia
    downloadMediaActive,
    downloadFullMedia, // BUG 1/5: Full-size media download (old method)
    downloadRealMedia, // BUG 1: NEW - Download real media with DOM traversal
    downloadMediaFromStore, // BUG 1: Helper for Store API
    saveMediaFull, // BUG 1/5: Save full media separately
    transcribeAudio,
    extractTextFromImage,
    compressMedia,
    
    // Análise
    analyzeSentiment,
    
    // Exportação
    exportToCSV,
    exportToTXT,
    exportToPDF,
    
    // Sincronização
    syncWithBackend,
    
    // Notificações
    showNotification,
    setContactNotification,
    getContactNotifications,
    
    // Cache
    mediaCache,
    
    // Estatísticas
    getStats,
    
    // Limpeza
    clearHistory,
    
    // BUG 5: Refresh functionality
    refreshMessages,
    checkForNewDeletedMessages,
    
    // BUG 6: SYNC - Backend connection check
    checkBackendConnection,
    
    // BUG 7: DeepScan with progress
    executeDeepScan,
    getAllChats,
    scanChatForDeletedMessages,
    
    // Utilitários
    extractPhone
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

  console.log('[RecoverAdvanced] 📦 Módulo carregado');

})();
