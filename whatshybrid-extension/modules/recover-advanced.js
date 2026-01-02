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
    BACKEND_URL: 'http://localhost:4000'
  };

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
      dateTo: null 
    },
    page: 0,
    initialized: false
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
    
    state.initialized = true;
    console.log('[RecoverAdvanced] ✅ Inicializado -', state.messages.length, 'mensagens carregadas');
  }

  async function loadFromStorage() {
    try {
      // Usar chrome.storage.local para compartilhar entre contextos
      const result = await new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get([CONFIG.STORAGE_KEY, CONFIG.FAVORITES_KEY, CONFIG.NOTIFICATIONS_KEY], resolve);
        } else {
          // Fallback para localStorage (content script)
          resolve({
            [CONFIG.STORAGE_KEY]: localStorage.getItem(CONFIG.STORAGE_KEY),
            [CONFIG.FAVORITES_KEY]: localStorage.getItem(CONFIG.FAVORITES_KEY),
            [CONFIG.NOTIFICATIONS_KEY]: localStorage.getItem(CONFIG.NOTIFICATIONS_KEY)
          });
        }
      });
      
      // Carregar histórico
      let saved = result[CONFIG.STORAGE_KEY];
      if (typeof saved === 'string') saved = JSON.parse(saved);
      if (Array.isArray(saved)) {
        state.messages = saved.slice(0, CONFIG.MAX_MESSAGES);
      }
      
      // Carregar favoritos
      let favs = result[CONFIG.FAVORITES_KEY];
      if (typeof favs === 'string') favs = JSON.parse(favs);
      if (Array.isArray(favs)) {
        state.favorites = new Set(favs);
      }
      
      // Carregar configurações de notificações por contato
      let notifs = result[CONFIG.NOTIFICATIONS_KEY];
      if (typeof notifs === 'string') notifs = JSON.parse(notifs);
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
      const data = {
        [CONFIG.STORAGE_KEY]: toSave,
        [CONFIG.FAVORITES_KEY]: [...state.favorites],
        [CONFIG.NOTIFICATIONS_KEY]: [...state.contactNotifications]
      };
      
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set(data);
      } else {
        // Fallback para localStorage
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(toSave));
        localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify([...state.favorites]));
        localStorage.setItem(CONFIG.NOTIFICATIONS_KEY, JSON.stringify([...state.contactNotifications]));
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

    // Adicionar ao início (mais recente primeiro)
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
  // 6.13-6.15 - EXTRAÇÃO DE TELEFONE
  // ============================================
  function extractPhone(value) {
    if (!value) return 'Desconhecido';
    
    let phone = value;
    
    // Se for objeto
    if (typeof value === 'object') {
      phone = value._serialized || value.user || value.id || String(value);
    }
    
    // Converter para string
    phone = String(phone);
    
    // Remover sufixos do WhatsApp
    phone = phone.replace(/@[cs]\.us$/i, '')
                 .replace(/@g\.us$/i, '')
                 .replace(/@broadcast$/i, '');
    
    // Manter apenas números
    phone = phone.replace(/\D/g, '');
    
    // Se vazio, retornar desconhecido
    if (!phone || phone.length < 8) return 'Desconhecido';
    
    return phone;
  }

  // ============================================
  // 8.1 - DOWNLOAD ATIVO DE MÍDIAS
  // ============================================
  async function downloadMediaActive(msg) {
    if (!msg) return null;

    // 8.13 - Retry com backoff
    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        // Método 1: Via Store do WhatsApp
        if (window.Store?.DownloadManager?.downloadMedia) {
          const media = await window.Store.DownloadManager.downloadMedia(msg);
          if (media) {
            const base64 = await blobToBase64(media);
            if (base64) return base64;
          }
        }

        // Método 2: Via mediaData direto
        if (msg.mediaData && msg.mediaData !== '__HAS_MEDIA__') {
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
            if (data.base64) return data.base64;
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
      } else {
        filtered = filtered.filter(m => m.action === state.filters.type);
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
  // API PÚBLICA
  // ============================================
  window.RecoverAdvanced = {
    // Inicialização
    init,
    
    // Mensagens
    getMessages: () => [...state.messages],
    getFilteredMessages,
    addMessage: handleNewMessage,
    
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
