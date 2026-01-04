/**
 * 🧠 Memory System - Sistema de Memória por Chat (Estilo Leão)
 * WhatsHybrid v7.6.0
 * 
 * Funcionalidades:
 * - Memória persistente por chat
 * - Geração de resumo com IA
 * - Perfil do contato
 * - Preferências detectadas
 * - Contexto da conversa
 * - Pendências (open loops)
 * - Próximas ações sugeridas
 * - Sincronização com backend
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_memory_system';
  const MAX_MEMORIES = 100;
  const MAX_SUMMARY_LENGTH = 2000;

  class MemorySystem {
    constructor() {
      this.memories = new Map();
      this.initialized = false;
    }

    /**
     * Inicializa e carrega memórias do storage
     */
    async init() {
      if (this.initialized) return;

      try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY]) {
          const stored = JSON.parse(data[STORAGE_KEY]);
          Object.entries(stored).forEach(([key, value]) => {
            this.memories.set(key, value);
          });
          console.log('[MemorySystem] Memórias carregadas:', this.memories.size);
        }
        this.initialized = true;
      } catch (error) {
        console.error('[MemorySystem] Erro ao inicializar:', error);
      }
    }

    /**
     * Salva memórias no storage
     */
    async save() {
      try {
        const data = Object.fromEntries(this.memories);
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(data)
        });
        console.log('[MemorySystem] Memórias salvas');
        return true;
      } catch (error) {
        console.error('[MemorySystem] Erro ao salvar:', error);
        return false;
      }
    }

    /**
     * Obtém chave do chat
     * @param {string} chatId - ID do chat
     * @returns {string} - Chave formatada
     */
    getChatKey(chatId) {
      return `chat_${chatId}`;
    }

    /**
     * Obtém memória de um chat
     * @param {string} chatKey - Chave do chat
     * @returns {Object|null} - Memória do chat
     */
    getMemory(chatKey) {
      return this.memories.get(chatKey) || null;
    }

    /**
     * Define memória de um chat
     * @param {string} chatKey - Chave do chat
     * @param {Object} memoryObj - Objeto de memória
     */
    async setMemory(chatKey, memoryObj) {
      // Valida estrutura
      const memory = {
        profile: memoryObj.profile || '',
        preferences: Array.isArray(memoryObj.preferences) ? memoryObj.preferences : [],
        context: Array.isArray(memoryObj.context) ? memoryObj.context : [],
        open_loops: Array.isArray(memoryObj.open_loops) ? memoryObj.open_loops : [],
        next_actions: Array.isArray(memoryObj.next_actions) ? memoryObj.next_actions : [],
        tone: memoryObj.tone || 'neutral',
        lastUpdated: Date.now(),
        version: '1.0.0'
      };

      // Limita tamanho do resumo
      if (memory.profile.length > MAX_SUMMARY_LENGTH) {
        memory.profile = memory.profile.substring(0, MAX_SUMMARY_LENGTH) + '...';
      }

      this.memories.set(chatKey, memory);

      // Limita número de memórias (remove mais antigas)
      if (this.memories.size > MAX_MEMORIES) {
        const sorted = Array.from(this.memories.entries())
          .sort((a, b) => (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0));
        
        this.memories.clear();
        sorted.slice(0, MAX_MEMORIES).forEach(([key, value]) => {
          this.memories.set(key, value);
        });
        
        console.log('[MemorySystem] Limite de memórias atingido, removendo antigas');
      }

      await this.save();

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('memory-system:updated', { chatKey, memory });
      }

      // Envia para backend se disponível
      this.pushToBackend(chatKey, memory);

      return memory;
    }

    /**
     * Remove memória de um chat
     * @param {string} chatKey - Chave do chat
     */
    async removeMemory(chatKey) {
      this.memories.delete(chatKey);
      await this.save();
      console.log('[MemorySystem] Memória removida:', chatKey);
    }

    /**
     * Gera memória a partir de transcrição usando IA
     * @param {string} transcript - Transcrição da conversa
     * @param {Object} options - Opções { chatKey, provider, model }
     * @returns {Object|null} - Memória gerada
     */
    async aiMemoryFromTranscript(transcript, options = {}) {
      if (!transcript || transcript.length < 50) {
        console.warn('[MemorySystem] Transcrição muito curta para gerar memória');
        return null;
      }

      try {
        const prompt = `Analise a seguinte conversa e gere um resumo estruturado em JSON com os seguintes campos:

{
  "profile": "resumo breve do contato (quem é, o que faz, contexto geral)",
  "preferences": ["lista de preferências detectadas"],
  "context": ["fatos confirmados e informações importantes"],
  "open_loops": ["pendências, coisas não resolvidas"],
  "next_actions": ["próximos passos sugeridos"],
  "tone": "tom recomendado para próximas interações (formal, casual, técnico, etc)"
}

Conversa:
${transcript}

Retorne APENAS o JSON, sem explicações adicionais.`;

        console.log('[MemorySystem] Gerando memória com IA...');

        // Usa AIService se disponível
        let response = null;
        if (window.AIService) {
          response = await window.AIService.generateCompletion(prompt, {
            provider: options.provider || 'openai',
            model: options.model || 'gpt-4o-mini',
            temperature: 0.3,
            maxTokens: 800
          });
        } else {
          console.warn('[MemorySystem] AIService não disponível');
          return null;
        }

        if (!response || !response.text) {
          throw new Error('Resposta vazia da IA');
        }

        // Parse JSON da resposta
        let memory = null;
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          memory = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Não foi possível extrair JSON da resposta');
        }

        console.log('[MemorySystem] Memória gerada:', memory);

        // Salva se chatKey fornecido
        if (options.chatKey) {
          await this.setMemory(options.chatKey, memory);
        }

        return memory;

      } catch (error) {
        console.error('[MemorySystem] Erro ao gerar memória:', error);
        return null;
      }
    }

    /**
     * Atualiza memória incrementalmente
     * @param {string} chatKey - Chave do chat
     * @param {Object} updates - Atualizações parciais
     */
    async updateMemory(chatKey, updates) {
      const current = this.getMemory(chatKey) || {
        profile: '',
        preferences: [],
        context: [],
        open_loops: [],
        next_actions: [],
        tone: 'neutral'
      };

      const updated = {
        profile: updates.profile !== undefined ? updates.profile : current.profile,
        preferences: updates.preferences || current.preferences,
        context: updates.context || current.context,
        open_loops: updates.open_loops || current.open_loops,
        next_actions: updates.next_actions || current.next_actions,
        tone: updates.tone || current.tone
      };

      return this.setMemory(chatKey, updated);
    }

    /**
     * Adiciona item a uma lista na memória
     * @param {string} chatKey - Chave do chat
     * @param {string} field - Campo (preferences, context, open_loops, next_actions)
     * @param {string} item - Item a adicionar
     */
    async addToMemoryList(chatKey, field, item) {
      const memory = this.getMemory(chatKey);
      if (!memory) {
        console.warn('[MemorySystem] Memória não encontrada:', chatKey);
        return;
      }

      if (!Array.isArray(memory[field])) {
        console.warn('[MemorySystem] Campo não é array:', field);
        return;
      }

      if (!memory[field].includes(item)) {
        memory[field].push(item);
        await this.setMemory(chatKey, memory);
      }
    }

    /**
     * Remove item de uma lista na memória
     * @param {string} chatKey - Chave do chat
     * @param {string} field - Campo
     * @param {string} item - Item a remover
     */
    async removeFromMemoryList(chatKey, field, item) {
      const memory = this.getMemory(chatKey);
      if (!memory) return;

      if (Array.isArray(memory[field])) {
        memory[field] = memory[field].filter(i => i !== item);
        await this.setMemory(chatKey, memory);
      }
    }

    /**
     * Envia memória para backend via MEMORY_PUSH
     * @param {string} chatKey - Chave do chat
     * @param {Object} memory - Memória
     */
    pushToBackend(chatKey, memory) {
      try {
        const event = {
          type: 'memory_update',
          chatKey,
          memory,
          timestamp: Date.now()
        };

        // Envia via runtime message
        chrome.runtime.sendMessage({
          action: 'MEMORY_PUSH',
          event
        }).catch(err => {
          console.warn('[MemorySystem] Erro ao enviar para backend:', err);
        });

      } catch (error) {
        console.error('[MemorySystem] Erro ao fazer push:', error);
      }
    }

    /**
     * Consulta memória do servidor
     * @param {string} chatKey - Chave do chat
     * @returns {Object|null} - Memória do servidor
     */
    async queryFromBackend(chatKey) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'MEMORY_QUERY',
          chatKey
        });

        if (response && response.success && response.memory) {
          // Atualiza memória local
          await this.setMemory(chatKey, response.memory);
          return response.memory;
        }

        return null;
      } catch (error) {
        console.error('[MemorySystem] Erro ao consultar backend:', error);
        return null;
      }
    }

    /**
     * Formata memória para exibição
     * @param {Object} memory - Memória
     * @returns {string} - Texto formatado
     */
    formatMemory(memory) {
      if (!memory) return 'Nenhuma memória disponível';

      let text = '';

      if (memory.profile) {
        text += `👤 Perfil: ${memory.profile}\n\n`;
      }

      if (memory.preferences && memory.preferences.length > 0) {
        text += `⭐ Preferências:\n`;
        memory.preferences.forEach(pref => {
          text += `  • ${pref}\n`;
        });
        text += '\n';
      }

      if (memory.context && memory.context.length > 0) {
        text += `📝 Contexto:\n`;
        memory.context.forEach(ctx => {
          text += `  • ${ctx}\n`;
        });
        text += '\n';
      }

      if (memory.open_loops && memory.open_loops.length > 0) {
        text += `⏳ Pendências:\n`;
        memory.open_loops.forEach(loop => {
          text += `  • ${loop}\n`;
        });
        text += '\n';
      }

      if (memory.next_actions && memory.next_actions.length > 0) {
        text += `🎯 Próximas Ações:\n`;
        memory.next_actions.forEach(action => {
          text += `  • ${action}\n`;
        });
        text += '\n';
      }

      if (memory.tone) {
        text += `💬 Tom Recomendado: ${memory.tone}\n`;
      }

      return text.trim();
    }

    /**
     * Obtém todas as memórias
     * @returns {Array} - Lista de memórias
     */
    getAllMemories() {
      return Array.from(this.memories.entries()).map(([key, value]) => ({
        chatKey: key,
        ...value
      }));
    }

    /**
     * Limpa memórias antigas (mais de X dias)
     * @param {number} days - Número de dias
     */
    async cleanOldMemories(days = 30) {
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      let removed = 0;

      for (const [key, memory] of this.memories.entries()) {
        if (memory.lastUpdated && memory.lastUpdated < cutoff) {
          this.memories.delete(key);
          removed++;
        }
      }

      if (removed > 0) {
        await this.save();
        console.log(`[MemorySystem] ${removed} memórias antigas removidas`);
      }
    }

    /**
     * Obtém estatísticas
     * @returns {Object} - Estatísticas
     */
    getStats() {
      return {
        totalMemories: this.memories.size,
        maxMemories: MAX_MEMORIES,
        maxSummaryLength: MAX_SUMMARY_LENGTH
      };
    }

    /**
     * Obtém contexto híbrido (local + servidor)
     * Baseado em CERTO-WHATSAPPLITE-main-21/05chromeextensionwhatsapp/content/content.js getHybridContext()
     * 
     * @param {string} chatTitle - Título do chat
     * @param {string} transcript - Transcrição
     * @returns {Object} - { memory, examples, context, source }
     */
    async getHybridContext(chatTitle, transcript = '') {
      const localMemory = await this.getMemory(chatTitle);
      
      let localExamples = [];
      if (window.fewShotLearning) {
        localExamples = window.fewShotLearning.getAll();
      }
      
      // Tenta buscar do servidor se configurado
      try {
        const settings = await this.getSettings();
        
        if (settings?.memorySyncEnabled && settings?.memoryServerUrl) {
          const response = await chrome.runtime.sendMessage({
            action: 'MEMORY_QUERY',
            payload: { 
              chatTitle, 
              transcript, 
              topK: 4 
            }
          });
          
          if (response?.ok && response?.data) {
            return {
              memory: response.data.memory || localMemory,
              examples: Array.isArray(response.data.examples) ? response.data.examples : localExamples,
              context: response.data.context || null,
              source: 'server'
            };
          }
        }
      } catch (error) {
        console.warn('[MemorySystem] Fallback para memória local:', error.message);
      }
      
      return {
        memory: localMemory,
        examples: localExamples,
        context: null,
        source: 'local'
      };
    }

    async getSettings() {
      try {
        const data = await chrome.storage.local.get('whl_settings');
        return data.whl_settings || {};
      } catch (e) {
        console.warn('[MemorySystem] Erro ao carregar settings:', e.message);
        return {};
      }
    }

    /**
     * Limpa todas as memórias
     */
    async clearAll() {
      this.memories.clear();
      await this.save();
      console.log('[MemorySystem] Todas as memórias limpas');
    }
  }

  // Debounce timer para auto-update
  let autoUpdateDebounceTimer = null;

  /**
   * Atualiza memória automaticamente com debounce
   * @param {string} transcript - Transcrição da conversa
   * @param {string} chatTitle - Título do chat
   * @param {number} debounceMs - Tempo de debounce em ms (padrão: 5000)
   * @returns {Promise<boolean>} - true se atualizado
   */
  async function autoUpdateMemory(transcript, chatTitle, debounceMs = 5000) {
    // Valida entrada
    if (!transcript || typeof transcript !== 'string' || transcript.length < 60) {
      console.log('[MemorySystem] Transcript muito curto para auto-update (<60 chars)');
      return false;
    }

    if (!chatTitle || typeof chatTitle !== 'string') {
      console.warn('[MemorySystem] chatTitle inválido para auto-update');
      return false;
    }

    // Cancela timer anterior
    if (autoUpdateDebounceTimer) {
      clearTimeout(autoUpdateDebounceTimer);
    }

    // Retorna promise que resolve após debounce
    return new Promise((resolve) => {
      autoUpdateDebounceTimer = setTimeout(async () => {
        try {
          console.log('[MemorySystem] Auto-update iniciado após debounce de', debounceMs, 'ms');
          
          // Gera summary estruturado
          const summary = {
            profile: extractProfile(transcript),
            tone: detectTone(transcript),
            preferences: extractPreferences(transcript),
            context: extractContext(transcript),
            open_loops: extractOpenLoops(transcript),
            next_actions: suggestNextActions(transcript)
          };

          // Salva memória
          if (window.memorySystem) {
            const chatKey = window.memorySystem.getChatKey(chatTitle);
            await window.memorySystem.setMemory(chatKey, summary);
            console.log('[MemorySystem] Memória auto-atualizada para:', chatTitle);
            resolve(true);
          } else {
            console.warn('[MemorySystem] memorySystem não disponível');
            resolve(false);
          }
        } catch (error) {
          console.error('[MemorySystem] Erro no auto-update:', error);
          resolve(false);
        }
      }, debounceMs);
    });
  }

  /**
   * Extrai perfil do cliente do transcript
   */
  function extractProfile(transcript) {
    const lowerText = transcript.toLowerCase();
    let profile = [];
    
    // Detecta tipo de cliente
    if (lowerText.includes('empresa') || lowerText.includes('cnpj')) {
      profile.push('Cliente corporativo');
    } else if (lowerText.includes('pessoal') || lowerText.includes('cpf')) {
      profile.push('Cliente individual');
    }
    
    // Detecta frequência
    if (lowerText.includes('primeira vez') || lowerText.includes('novo')) {
      profile.push('Primeiro contato');
    } else if (lowerText.includes('sempre') || lowerText.includes('costum')) {
      profile.push('Cliente recorrente');
    }

    return profile.length > 0 ? profile.join(', ') : 'Cliente padrão';
  }

  /**
   * Detecta tom da conversa
   */
  function detectTone(transcript) {
    const lowerText = transcript.toLowerCase();
    
    const formalWords = ['senhor', 'senhora', 'prezado', 'cordialmente', 'atenciosamente'];
    const casualWords = ['oi', 'tudo bem', 'valeu', 'vlw', 'blz', 'tmj'];
    
    let formalCount = 0;
    let casualCount = 0;
    
    formalWords.forEach(word => {
      if (lowerText.includes(word)) formalCount++;
    });
    
    casualWords.forEach(word => {
      if (lowerText.includes(word)) casualCount++;
    });
    
    if (formalCount > casualCount) return 'formal';
    if (casualCount > formalCount) return 'casual';
    return 'neutral';
  }

  /**
   * Extrai preferências do cliente
   */
  function extractPreferences(transcript) {
    const preferences = [];
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('email') || lowerText.includes('e-mail')) {
      preferences.push('Prefere contato por email');
    }
    if (lowerText.includes('whatsapp') || lowerText.includes('mensagem')) {
      preferences.push('Prefere contato por WhatsApp');
    }
    if (lowerText.includes('ligar') || lowerText.includes('telefone')) {
      preferences.push('Prefere contato por telefone');
    }
    if (lowerText.includes('rápid') || lowerText.includes('urgente')) {
      preferences.push('Valoriza velocidade no atendimento');
    }
    
    return preferences;
  }

  /**
   * Extrai contexto relevante
   */
  function extractContext(transcript) {
    const context = [];
    const sentences = transcript.split(/[.!?]/).filter(s => s.trim().length > 20);
    
    // Pega até 3 sentenças mais relevantes
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * Extrai pendências (open loops)
   */
  function extractOpenLoops(transcript) {
    const loops = [];
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('aguardan') || lowerText.includes('esperan')) {
      loops.push('Aguardando resposta/ação');
    }
    if (lowerText.includes('enviar') || lowerText.includes('mandar')) {
      loops.push('Envio de material/informação pendente');
    }
    if (lowerText.includes('confirma') || lowerText.includes('verifica')) {
      loops.push('Confirmação pendente');
    }
    if (lowerText.includes('orçamento') || lowerText.includes('proposta')) {
      loops.push('Orçamento/proposta em análise');
    }
    
    return loops;
  }

  /**
   * Sugere próximas ações
   */
  function suggestNextActions(transcript) {
    const actions = [];
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('dúvida') || lowerText.includes('?')) {
      actions.push('Responder dúvidas pendentes');
    }
    if (lowerText.includes('preço') || lowerText.includes('quanto')) {
      actions.push('Enviar informações de preço');
    }
    if (lowerText.includes('reunião') || lowerText.includes('conversar')) {
      actions.push('Agendar reunião/call');
    }
    if (lowerText.includes('comprar') || lowerText.includes('adquirir')) {
      actions.push('Enviar link de pagamento/contrato');
    }
    
    return actions;
  }

  // Exporta globalmente
  window.MemorySystem = MemorySystem;
  window.autoUpdateMemory = autoUpdateMemory;

  // Cria instância global
  if (!window.memorySystem) {
    window.memorySystem = new MemorySystem();
    window.memorySystem.init().then(() => {
      console.log('[MemorySystem] ✅ Módulo carregado e inicializado');
    });
  }

})();
