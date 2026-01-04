/**
 * 🎓 Few-Shot Learning - Sistema de Exemplos de Treinamento
 * WhatsHybrid v7.6.0
 * 
 * Funcionalidades:
 * - Armazenamento de exemplos de treinamento
 * - Seleção inteligente de exemplos relevantes
 * - Sincronização com backend
 * - Limite de exemplos para otimização
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_few_shot_examples';
  const MAX_EXAMPLES = 60;

  class FewShotLearning {
    constructor() {
      this.examples = [];
      this.initialized = false;
    }

    /**
     * Inicializa e carrega exemplos do storage
     */
    async init() {
      if (this.initialized) return;

      try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY]) {
          this.examples = JSON.parse(data[STORAGE_KEY]);
          console.log('[FewShotLearning] Exemplos carregados:', this.examples.length);
        }
        this.initialized = true;
      } catch (error) {
        console.error('[FewShotLearning] Erro ao inicializar:', error);
        this.examples = [];
      }
    }

    /**
     * Salva exemplos no storage
     */
    async save() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(this.examples)
        });
        console.log('[FewShotLearning] Exemplos salvos');
        return true;
      } catch (error) {
        console.error('[FewShotLearning] Erro ao salvar:', error);
        return false;
      }
    }

    /**
     * Adiciona exemplo de treinamento
     * @param {Object} example - { input, output, context, category, tags }
     * @returns {Object} - Exemplo adicionado
     */
    async addExample(example) {
      if (!example.input || !example.output) {
        console.warn('[FewShotLearning] Exemplo inválido: input e output são obrigatórios');
        return null;
      }

      const newExample = {
        id: Date.now(),
        input: example.input,
        output: example.output,
        context: example.context || '',
        category: example.category || 'Geral',
        tags: example.tags || this.extractTags(example.input + ' ' + example.output),
        createdAt: Date.now(),
        usageCount: 0,
        lastUsed: null,
        score: 1.0
      };

      this.examples.push(newExample);

      // Limita número de exemplos (remove menos utilizados)
      if (this.examples.length > MAX_EXAMPLES) {
        this.examples.sort((a, b) => {
          // Ordena por score e usageCount
          const scoreA = a.score + (a.usageCount * 0.1);
          const scoreB = b.score + (b.usageCount * 0.1);
          return scoreB - scoreA;
        });

        this.examples = this.examples.slice(0, MAX_EXAMPLES);
        console.log('[FewShotLearning] Limite de exemplos atingido, removendo menos utilizados');
      }

      await this.save();

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('few-shot:example-added', newExample);
      }

      // Envia para backend
      this.pushToBackend(newExample);

      return newExample;
    }

    /**
     * Remove exemplo
     * @param {number} id - ID do exemplo
     */
    async removeExample(id) {
      this.examples = this.examples.filter(ex => ex.id !== id);
      await this.save();
      console.log('[FewShotLearning] Exemplo removido:', id);
    }

    /**
     * Obtém todos os exemplos
     * @returns {Array} - Lista de exemplos (cópia)
     */
    getExamples() {
      return [...this.examples];
    }

    /**
     * Alias para getExamples (compatibilidade)
     * @returns {Array} - Lista de exemplos (cópia)
     */
    getAll() {
      return [...this.examples];
    }

    /**
     * Obtém exemplos por categoria
     * @param {string} category - Categoria
     * @returns {Array} - Exemplos da categoria
     */
    getExamplesByCategory(category) {
      return this.examples.filter(ex => ex.category === category);
    }

    /**
     * Seleciona exemplos mais relevantes baseado em keyword overlap
     * Baseado em CERTO-WHATSAPPLITE-main-21/05chromeextensionwhatsapp/content/content.js pickExamples()
     * 
     * @param {string} transcript - Transcrição atual
     * @param {number} max - Máximo de exemplos
     * @returns {Array} - Exemplos ordenados por relevância
     */
    pickRelevantExamples(transcript, max = 3) {
      const examples = this.getAll();
      
      if (!examples.length || !transcript) {
        return examples.slice(0, max);
      }
      
      const transcriptLower = transcript.toLowerCase();
      const transcriptWords = new Set(
        transcriptLower.split(/\W+/).filter(w => w.length >= 4)
      );
      
      // Calcula score de cada exemplo baseado em overlap de keywords
      const scored = examples.map(ex => {
        const userText = (ex.user || ex.input || '').toLowerCase();
        const userWords = userText.split(/\W+/).filter(w => w.length >= 4);
        
        let score = 0;
        for (const word of userWords.slice(0, 18)) {
          if (transcriptWords.has(word)) {
            score += 1;
          }
        }
        
        return { example: ex, score };
      });
      
      // Ordena por score e retorna top N
      return scored
        .sort((a, b) => b.score - a.score)
        .filter(s => s.score > 0)
        .slice(0, max)
        .map(s => s.example);
    }

    /**
     * Seleciona exemplos mais relevantes para um contexto
     * @param {Array} examples - Lista de exemplos (opcional, usa todos se não fornecido)
     * @param {string} transcript - Transcrição/contexto atual
     * @param {number} max - Número máximo de exemplos a retornar
     * @returns {Array} - Exemplos selecionados
     */
    pickExamples(examples = null, transcript = '', max = 3) {
      const exampleList = examples || this.examples;
      
      if (exampleList.length === 0) {
        return [];
      }

      if (!transcript) {
        // Se não há contexto, retorna exemplos mais recentes/usados
        return exampleList
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, max);
      }

      // Calcula relevância por keyword overlap
      const transcriptWords = this.extractTags(transcript.toLowerCase());
      
      const scored = exampleList.map(example => {
        let score = 0;
        
        // Conta palavras em comum
        example.tags.forEach(tag => {
          if (transcriptWords.includes(tag)) {
            score += 2;
          }
        });

        // Bonus por usage count (exemplos bem sucedidos)
        score += example.usageCount * 0.5;

        // Bonus por score do exemplo
        score += example.score;

        // Penalidade por idade (favorece exemplos mais recentes)
        const ageInDays = (Date.now() - example.createdAt) / (1000 * 60 * 60 * 24);
        score -= ageInDays * 0.01;

        return { ...example, relevanceScore: score };
      });

      // Ordena por relevância e retorna top N
      return scored
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, max);
    }

    /**
     * Registra uso de um exemplo
     * @param {number} id - ID do exemplo
     */
    async recordUsage(id) {
      const example = this.examples.find(ex => ex.id === id);
      if (example) {
        example.usageCount = (example.usageCount || 0) + 1;
        example.lastUsed = Date.now();
        await this.save();
      }
    }

    /**
     * Atualiza score de um exemplo
     * @param {number} id - ID do exemplo
     * @param {number} delta - Mudança no score (+/-)
     */
    async updateScore(id, delta) {
      const example = this.examples.find(ex => ex.id === id);
      if (example) {
        example.score = Math.max(0, Math.min(10, example.score + delta));
        await this.save();
      }
    }

    /**
     * Extrai tags/keywords de um texto
     * @param {string} text - Texto
     * @returns {Array} - Tags extraídas
     */
    extractTags(text) {
      const words = text.toLowerCase()
        .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // Remove duplicatas
      return [...new Set(words)];
    }

    /**
     * Formata exemplos para uso em prompt
     * @param {Array} examples - Lista de exemplos
     * @returns {string} - Exemplos formatados
     */
    formatForPrompt(examples) {
      if (!examples || examples.length === 0) {
        return '';
      }

      let formatted = 'Exemplos de conversas anteriores:\n\n';

      examples.forEach((example, index) => {
        formatted += `Exemplo ${index + 1}:\n`;
        if (example.context) {
          formatted += `Contexto: ${example.context}\n`;
        }
        formatted += `Cliente: ${example.input}\n`;
        formatted += `Atendente: ${example.output}\n\n`;
      });

      return formatted;
    }

    /**
     * Envia exemplo para backend
     * @param {Object} example - Exemplo
     */
    pushToBackend(example) {
      try {
        const event = {
          type: 'example_added',
          example,
          timestamp: Date.now()
        };

        chrome.runtime.sendMessage({
          action: 'FEW_SHOT_PUSH',
          event
        }).catch(err => {
          console.warn('[FewShotLearning] Erro ao enviar para backend:', err);
        });

      } catch (error) {
        console.error('[FewShotLearning] Erro ao fazer push:', error);
      }
    }

    /**
     * Sincroniza exemplos com backend
     */
    async syncWithBackend() {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'FEW_SHOT_SYNC'
        });

        if (response && response.success && response.examples) {
          // Mescla com exemplos locais
          this.mergeExamples(response.examples);
          await this.save();
          console.log('[FewShotLearning] Sincronizado com backend');
        }
      } catch (error) {
        console.error('[FewShotLearning] Erro ao sincronizar:', error);
      }
    }

    /**
     * Mescla exemplos externos com locais
     * @param {Array} externalExamples - Exemplos externos
     */
    mergeExamples(externalExamples) {
      const existingIds = new Set(this.examples.map(ex => ex.id));

      externalExamples.forEach(external => {
        if (!existingIds.has(external.id)) {
          this.examples.push(external);
        } else {
          // Atualiza exemplo existente se o externo for mais recente
          const index = this.examples.findIndex(ex => ex.id === external.id);
          if (index >= 0 && external.lastUsed > this.examples[index].lastUsed) {
            this.examples[index] = external;
          }
        }
      });

      // Aplica limite
      if (this.examples.length > MAX_EXAMPLES) {
        this.examples.sort((a, b) => b.usageCount - a.usageCount);
        this.examples = this.examples.slice(0, MAX_EXAMPLES);
      }
    }

    /**
     * Exporta exemplos como JSON
     * @returns {string} - JSON dos exemplos
     */
    exportJSON() {
      return JSON.stringify(this.examples, null, 2);
    }

    /**
     * Importa exemplos de JSON
     * @param {string} json - JSON dos exemplos
     */
    async importJSON(json) {
      try {
        const imported = JSON.parse(json);
        
        if (!Array.isArray(imported)) {
          throw new Error('JSON inválido: deve ser um array');
        }

        this.mergeExamples(imported);
        await this.save();
        console.log('[FewShotLearning] Exemplos importados:', imported.length);
        return true;
      } catch (error) {
        console.error('[FewShotLearning] Erro ao importar JSON:', error);
        return false;
      }
    }

    /**
     * Limpa todos os exemplos
     */
    async clearAll() {
      this.examples = [];
      await this.save();
      console.log('[FewShotLearning] Todos os exemplos limpos');
    }

    /**
     * Obtém estatísticas
     * @returns {Object} - Estatísticas
     */
    getStats() {
      const totalUsage = this.examples.reduce((sum, ex) => sum + ex.usageCount, 0);
      const avgScore = this.examples.length > 0
        ? this.examples.reduce((sum, ex) => sum + ex.score, 0) / this.examples.length
        : 0;

      return {
        totalExamples: this.examples.length,
        maxExamples: MAX_EXAMPLES,
        totalUsage,
        avgScore: avgScore.toFixed(2)
      };
    }
  }

  // Exporta globalmente
  window.FewShotLearning = FewShotLearning;

  // Cria instância global
  if (!window.fewShotLearning) {
    window.fewShotLearning = new FewShotLearning();
    window.fewShotLearning.init().then(() => {
      console.log('[FewShotLearning] ✅ Módulo carregado e inicializado');
    });
  }

})();
