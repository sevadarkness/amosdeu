/**
 * 📚 Knowledge Base - Base de Conhecimento para IA
 * WhatsHybrid v7.6.0
 * 
 * Funcionalidades:
 * - Armazenamento de informações do negócio
 * - FAQs (perguntas frequentes)
 * - Produtos e catálogo
 * - Políticas (pagamento, entrega, trocas)
 * - Respostas prontas (canned replies)
 * - Documentos
 * - Tom de voz e personalidade
 * - Geração de prompts para IA
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_knowledge_base';

  const defaultKnowledge = {
    business: {
      name: '',
      description: '',
      segment: '',
      hours: 'Segunda a Sexta, 9h às 18h'
    },
    policies: {
      payment: '',
      delivery: '',
      returns: ''
    },
    products: [],  // { id, name, price, stock, description, category }
    faq: [],       // { id, question, answer, category, tags }
    cannedReplies: [], // { id, triggers: [], reply, category }
    documents: [], // { id, name, type, content, uploadedAt }
    tone: {
      style: 'professional', // professional, friendly, formal, casual
      useEmojis: true,
      greeting: 'Olá! Como posso ajudar?',
      closing: 'Estou à disposição para qualquer dúvida!'
    },
    version: '1.0.0',
    lastUpdated: Date.now()
  };

  class KnowledgeBase {
    constructor() {
      this.knowledge = { ...defaultKnowledge };
      this.initialized = false;
    }

    /**
     * Inicializa e carrega conhecimento do storage
     */
    async init() {
      if (this.initialized) return;

      try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY]) {
          this.knowledge = JSON.parse(data[STORAGE_KEY]);
          console.log('[KnowledgeBase] Conhecimento carregado:', this.knowledge);
        } else {
          console.log('[KnowledgeBase] Usando conhecimento padrão');
          await this.save();
        }
        this.initialized = true;
      } catch (error) {
        console.error('[KnowledgeBase] Erro ao inicializar:', error);
        this.knowledge = { ...defaultKnowledge };
      }
    }

    /**
     * Obtém todo o conhecimento
     * @returns {Object} - Conhecimento completo
     */
    getKnowledge() {
      return this.knowledge;
    }

    /**
     * Salva conhecimento no storage
     * @param {Object} knowledge - Conhecimento para salvar
     */
    async saveKnowledge(knowledge) {
      try {
        this.knowledge = {
          ...knowledge,
          lastUpdated: Date.now(),
          version: '1.0.0'
        };
        
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(this.knowledge)
        });

        console.log('[KnowledgeBase] Conhecimento salvo');

        // Emite evento
        if (window.EventBus) {
          window.EventBus.emit('knowledge-base:updated', this.knowledge);
        }

        return true;
      } catch (error) {
        console.error('[KnowledgeBase] Erro ao salvar:', error);
        return false;
      }
    }

    /**
     * Salva conhecimento atual
     */
    async save() {
      return this.saveKnowledge(this.knowledge);
    }

    /**
     * Atualiza informações do negócio
     * @param {Object} business - Dados do negócio
     */
    async updateBusiness(business) {
      this.knowledge.business = { ...this.knowledge.business, ...business };
      return this.save();
    }

    /**
     * Atualiza políticas
     * @param {Object} policies - Políticas
     */
    async updatePolicies(policies) {
      this.knowledge.policies = { ...this.knowledge.policies, ...policies };
      return this.save();
    }

    /**
     * Atualiza tom de voz
     * @param {Object} tone - Tom de voz
     */
    async updateTone(tone) {
      this.knowledge.tone = { ...this.knowledge.tone, ...tone };
      return this.save();
    }

    /**
     * Importa produtos de CSV
     * @param {string} csvText - Texto CSV
     * @returns {Array} - Produtos importados
     */
    parseProductsCSV(csvText) {
      try {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('CSV vazio ou inválido');
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const products = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const product = {
            id: Date.now() + i,
            name: '',
            price: 0,
            stock: 0,
            description: '',
            category: ''
          };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            
            if (header.includes('name') || header.includes('nome') || header.includes('produto')) {
              product.name = value;
            } else if (header.includes('price') || header.includes('preço') || header.includes('preco') || header.includes('valor')) {
              product.price = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            } else if (header.includes('stock') || header.includes('estoque') || header.includes('quantidade')) {
              product.stock = parseInt(value) || 0;
            } else if (header.includes('description') || header.includes('descrição') || header.includes('descricao')) {
              product.description = value;
            } else if (header.includes('category') || header.includes('categoria')) {
              product.category = value;
            }
          });

          if (product.name) {
            products.push(product);
          }
        }

        console.log('[KnowledgeBase] Produtos importados do CSV:', products.length);
        return products;
      } catch (error) {
        console.error('[KnowledgeBase] Erro ao importar CSV:', error);
        return [];
      }
    }

    /**
     * Adiciona produto
     * @param {Object} product - Produto
     */
    async addProduct(product) {
      const newProduct = {
        id: Date.now(),
        ...product
      };
      this.knowledge.products.push(newProduct);
      await this.save();
      return newProduct;
    }

    /**
     * Remove produto
     * @param {number} id - ID do produto
     */
    async removeProduct(id) {
      this.knowledge.products = this.knowledge.products.filter(p => p.id !== id);
      await this.save();
    }

    /**
     * Adiciona FAQ
     * @param {string} question - Pergunta
     * @param {string} answer - Resposta
     * @param {string} category - Categoria
     */
    async addFAQ(question, answer, category = 'Geral') {
      const faq = {
        id: Date.now(),
        question,
        answer,
        category,
        tags: this.extractTags(question + ' ' + answer),
        createdAt: Date.now()
      };
      this.knowledge.faq.push(faq);
      await this.save();
      return faq;
    }

    /**
     * Remove FAQ
     * @param {number} id - ID do FAQ
     */
    async removeFAQ(id) {
      this.knowledge.faq = this.knowledge.faq.filter(f => f.id !== id);
      await this.save();
    }

    /**
     * Adiciona resposta pronta
     * @param {Array} triggers - Palavras-chave que ativam a resposta
     * @param {string} reply - Resposta
     * @param {string} category - Categoria
     */
    async addCannedReply(triggers, reply, category = 'Geral') {
      const cannedReply = {
        id: Date.now(),
        triggers: Array.isArray(triggers) ? triggers : [triggers],
        reply,
        category,
        createdAt: Date.now()
      };
      this.knowledge.cannedReplies.push(cannedReply);
      await this.save();
      return cannedReply;
    }

    /**
     * Remove resposta pronta
     * @param {number} id - ID da resposta
     */
    async removeCannedReply(id) {
      this.knowledge.cannedReplies = this.knowledge.cannedReplies.filter(r => r.id !== id);
      await this.save();
    }

    /**
     * Verifica se mensagem corresponde a alguma resposta pronta
     * @param {string} message - Mensagem recebida
     * @param {Array} cannedReplies - Lista de respostas prontas (opcional)
     * @returns {Object|null} - Resposta pronta correspondente
     */
    checkCannedReply(message, cannedReplies = null) {
      const replies = cannedReplies || this.knowledge.cannedReplies;
      if (!message || replies.length === 0) return null;

      const lowerMessage = message.toLowerCase();

      for (const reply of replies) {
        for (const trigger of reply.triggers) {
          const lowerTrigger = trigger.toLowerCase();
          if (lowerMessage.includes(lowerTrigger)) {
            return reply;
          }
        }
      }

      return null;
    }

    /**
     * Busca FAQ correspondente
     * @param {string} message - Mensagem recebida
     * @param {Array} faqs - Lista de FAQs (opcional)
     * @returns {Object|null} - FAQ correspondente
     */
    findFAQMatch(message, faqs = null) {
      const faqList = faqs || this.knowledge.faq;
      if (!message || faqList.length === 0) return null;

      const lowerMessage = message.toLowerCase();
      let bestMatch = null;
      let bestScore = 0;

      for (const faq of faqList) {
        const lowerQuestion = faq.question.toLowerCase();
        
        // Calcula similaridade simples
        let score = 0;
        const words = lowerMessage.split(/\s+/);
        
        words.forEach(word => {
          if (word.length > 3 && lowerQuestion.includes(word)) {
            score += 1;
          }
        });

        // Verifica tags
        if (faq.tags) {
          faq.tags.forEach(tag => {
            if (lowerMessage.includes(tag.toLowerCase())) {
              score += 2;
            }
          });
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = faq;
        }
      }

      // Retorna apenas se o score for razoável
      return bestScore >= 2 ? bestMatch : null;
    }

    /**
     * Busca produto correspondente
     * @param {string} message - Mensagem recebida
     * @param {Array} products - Lista de produtos (opcional)
     * @returns {Object|null} - Produto correspondente
     */
    findProductMatch(message, products = null) {
      const productList = products || this.knowledge.products;
      if (!message || productList.length === 0) return null;

      const lowerMessage = message.toLowerCase();

      for (const product of productList) {
        const lowerName = product.name.toLowerCase();
        if (lowerMessage.includes(lowerName)) {
          return product;
        }

        // Verifica categoria
        if (product.category && lowerMessage.includes(product.category.toLowerCase())) {
          return product;
        }
      }

      return null;
    }

    /**
     * Adiciona documento
     * @param {string} name - Nome do documento
     * @param {string} type - Tipo (pdf, txt, md)
     * @param {string} content - Conteúdo
     */
    async addDocument(name, type, content) {
      const doc = {
        id: Date.now(),
        name,
        type,
        content,
        size: content.length,
        uploadedAt: Date.now()
      };
      this.knowledge.documents.push(doc);
      await this.save();
      return doc;
    }

    /**
     * Remove documento
     * @param {number} id - ID do documento
     */
    async removeDocument(id) {
      this.knowledge.documents = this.knowledge.documents.filter(d => d.id !== id);
      await this.save();
    }

    /**
     * Extrai tags de um texto
     * @param {string} text - Texto
     * @returns {Array} - Tags extraídas
     */
    extractTags(text) {
      const words = text.toLowerCase()
        .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // Remove duplicatas
      return [...new Set(words)].slice(0, 10);
    }

    /**
     * Constrói prompt de sistema para IA
     * @param {Object} options - Opções { persona, businessContext }
     * @returns {string} - Prompt de sistema
     */
    buildSystemPrompt({ persona = 'professional', businessContext = true } = {}) {
      let prompt = '';

      // Informações do negócio
      if (businessContext && this.knowledge.business.name) {
        prompt += `Você está atendendo pela empresa "${this.knowledge.business.name}".\n`;
        
        if (this.knowledge.business.description) {
          prompt += `Sobre a empresa: ${this.knowledge.business.description}\n`;
        }
        
        if (this.knowledge.business.segment) {
          prompt += `Segmento: ${this.knowledge.business.segment}\n`;
        }
        
        if (this.knowledge.business.hours) {
          prompt += `Horário de atendimento: ${this.knowledge.business.hours}\n`;
        }
        
        prompt += '\n';
      }

      // Tom de voz
      const tone = this.knowledge.tone;
      if (tone.style) {
        const styleMap = {
          professional: 'Mantenha um tom profissional, educado e objetivo.',
          friendly: 'Seja amigável, acolhedor e use um tom descontraído.',
          formal: 'Use um tom formal e respeitoso.',
          casual: 'Seja casual e informal, como um amigo.'
        };
        prompt += `${styleMap[tone.style] || styleMap.professional}\n`;
      }

      if (tone.useEmojis) {
        prompt += 'Você pode usar emojis ocasionalmente para tornar a conversa mais amigável.\n';
      }

      prompt += '\n';

      // Políticas
      if (this.knowledge.policies.payment) {
        prompt += `Política de Pagamento: ${this.knowledge.policies.payment}\n`;
      }
      if (this.knowledge.policies.delivery) {
        prompt += `Política de Entrega: ${this.knowledge.policies.delivery}\n`;
      }
      if (this.knowledge.policies.returns) {
        prompt += `Política de Trocas/Devoluções: ${this.knowledge.policies.returns}\n`;
      }

      if (this.knowledge.policies.payment || this.knowledge.policies.delivery || this.knowledge.policies.returns) {
        prompt += '\n';
      }

      // FAQs
      if (this.knowledge.faq.length > 0) {
        prompt += 'Perguntas Frequentes:\n';
        this.knowledge.faq.slice(0, 10).forEach((faq, i) => {
          prompt += `${i + 1}. ${faq.question}\n   R: ${faq.answer}\n`;
        });
        prompt += '\n';
      }

      // Produtos
      if (this.knowledge.products.length > 0) {
        prompt += 'Produtos disponíveis:\n';
        this.knowledge.products.slice(0, 20).forEach((product, i) => {
          prompt += `${i + 1}. ${product.name}`;
          if (product.price > 0) {
            prompt += ` - R$ ${product.price.toFixed(2)}`;
          }
          if (product.stock !== undefined) {
            prompt += ` (Estoque: ${product.stock})`;
          }
          if (product.description) {
            prompt += ` - ${product.description}`;
          }
          prompt += '\n';
        });
        prompt += '\n';
      }

      // Instruções finais
      prompt += 'Responda de forma clara, útil e contextualizada. Seja conciso mas completo.';

      return prompt;
    }

    /**
     * Exporta conhecimento como JSON
     * @returns {string} - JSON do conhecimento
     */
    exportJSON() {
      return JSON.stringify(this.knowledge, null, 2);
    }

    /**
     * Importa conhecimento de JSON
     * @param {string} json - JSON do conhecimento
     */
    async importJSON(json) {
      try {
        const imported = JSON.parse(json);
        
        // Valida estrutura básica
        if (!imported.business || !imported.policies || !imported.tone) {
          throw new Error('JSON inválido: estrutura incorreta');
        }

        await this.saveKnowledge(imported);
        console.log('[KnowledgeBase] Conhecimento importado');
        return true;
      } catch (error) {
        console.error('[KnowledgeBase] Erro ao importar JSON:', error);
        return false;
      }
    }

    /**
     * Limpa todo o conhecimento
     */
    async clear() {
      this.knowledge = { ...defaultKnowledge };
      await this.save();
      console.log('[KnowledgeBase] Conhecimento limpo');
    }

    /**
     * Obtém estatísticas
     * @returns {Object} - Estatísticas
     */
    getStats() {
      return {
        products: this.knowledge.products.length,
        faqs: this.knowledge.faq.length,
        cannedReplies: this.knowledge.cannedReplies.length,
        documents: this.knowledge.documents.length,
        hasBusinessInfo: !!this.knowledge.business.name,
        hasPolicies: !!(this.knowledge.policies.payment || this.knowledge.policies.delivery || this.knowledge.policies.returns),
        lastUpdated: this.knowledge.lastUpdated
      };
    }
  }

  // Exporta globalmente
  window.KnowledgeBase = KnowledgeBase;

  // Cria instância global
  if (!window.knowledgeBase) {
    window.knowledgeBase = new KnowledgeBase();
    window.knowledgeBase.init().then(() => {
      console.log('[KnowledgeBase] ✅ Módulo carregado e inicializado');
    });
  }

})();
