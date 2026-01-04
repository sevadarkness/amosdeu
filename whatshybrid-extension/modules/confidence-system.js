/**
 * 🎯 Confidence System - Sistema de Confiança e Copilot Mode
 * WhatsHybrid v7.6.0
 * 
 * Funcionalidades:
 * - Cálculo de score de confiança (0-100%)
 * - Níveis de confiança (Iniciante → Copiloto → Autônomo)
 * - Feedback de usuário (bom, ruim, correção)
 * - Registro de uso de sugestões
 * - Registro de envios automáticos
 * - Decisão de auto-send baseada em threshold
 * - Sincronização com backend
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_confidence_system';

  // Níveis de confiança
  const CONFIDENCE_LEVELS = {
    autonomous: {
      threshold: 90,
      emoji: '🔵',
      label: 'Autônomo',
      description: 'IA responde automaticamente com alta confiança'
    },
    copilot: {
      threshold: 70,
      emoji: '🟢',
      label: 'Copiloto',
      description: 'IA pode responder casos simples automaticamente'
    },
    assisted: {
      threshold: 50,
      emoji: '🟡',
      label: 'Assistido',
      description: 'IA sugere respostas, você decide'
    },
    learning: {
      threshold: 30,
      emoji: '🟠',
      label: 'Aprendendo',
      description: 'IA em treinamento ativo'
    },
    beginner: {
      threshold: 0,
      emoji: '🔴',
      label: 'Iniciante',
      description: 'IA apenas sugere respostas básicas'
    }
  };

  // Configuração de pontos
  const POINTS_CONFIG = {
    feedback_good: 2.0,
    feedback_bad: -1.0,
    feedback_correction: 1.0,
    suggestion_used: 1.5,
    suggestion_edited: 0.5,
    auto_sent: 2.0,
    faq_added: 0.25,
    product_added: 0.1,
    example_added: 0.5
  };

  class ConfidenceSystem {
    constructor() {
      this.metrics = {
        feedbackGood: 0,
        feedbackBad: 0,
        feedbackCorrections: 0,
        suggestionsUsed: 0,
        suggestionsEdited: 0,
        autoSent: 0,
        faqsAdded: 0,
        productsAdded: 0,
        examplesAdded: 0,
        totalInteractions: 0
      };
      this.score = 0;
      this.level = 'beginner';
      this.copilotEnabled = false;
      this.threshold = 70; // Threshold padrão para copilot mode
      this.initialized = false;
    }

    /**
     * Inicializa e carrega dados do storage
     */
    async init() {
      if (this.initialized) return;

      try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY]) {
          const stored = JSON.parse(data[STORAGE_KEY]);
          this.metrics = stored.metrics || this.metrics;
          this.score = stored.score || 0;
          this.level = stored.level || 'beginner';
          this.copilotEnabled = stored.copilotEnabled || false;
          this.threshold = stored.threshold || 70;
          console.log('[ConfidenceSystem] Dados carregados:', { score: this.score, level: this.level });
        }
        this.initialized = true;
      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao inicializar:', error);
      }
    }

    /**
     * Salva dados no storage
     */
    async save() {
      try {
        const data = {
          metrics: this.metrics,
          score: this.score,
          level: this.level,
          copilotEnabled: this.copilotEnabled,
          threshold: this.threshold,
          lastUpdated: Date.now()
        };

        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(data)
        });

        console.log('[ConfidenceSystem] Dados salvos');
        return true;
      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao salvar:', error);
        return false;
      }
    }

    /**
     * Calcula score de confiança baseado em métricas
     * @returns {number} - Score (0-100)
     */
    calculateScore() {
      let points = 0;

      // Pontos por feedback
      points += this.metrics.feedbackGood * POINTS_CONFIG.feedback_good;
      points += this.metrics.feedbackBad * POINTS_CONFIG.feedback_bad;
      points += this.metrics.feedbackCorrections * POINTS_CONFIG.feedback_correction;

      // Pontos por uso de sugestões
      points += this.metrics.suggestionsUsed * POINTS_CONFIG.suggestion_used;
      points += this.metrics.suggestionsEdited * POINTS_CONFIG.suggestion_edited;

      // Pontos por envios automáticos
      points += this.metrics.autoSent * POINTS_CONFIG.auto_sent;

      // Pontos por conhecimento adicionado
      points += this.metrics.faqsAdded * POINTS_CONFIG.faq_added;
      points += this.metrics.productsAdded * POINTS_CONFIG.product_added;
      points += this.metrics.examplesAdded * POINTS_CONFIG.example_added;

      // Normaliza para 0-100
      // Assume que 100 pontos = 100% de confiança
      this.score = Math.max(0, Math.min(100, points));

      // Atualiza nível
      this.updateLevel();

      return this.score;
    }

    /**
     * Atualiza nível baseado no score
     */
    updateLevel() {
      const oldLevel = this.level;

      if (this.score >= CONFIDENCE_LEVELS.autonomous.threshold) {
        this.level = 'autonomous';
      } else if (this.score >= CONFIDENCE_LEVELS.copilot.threshold) {
        this.level = 'copilot';
      } else if (this.score >= CONFIDENCE_LEVELS.assisted.threshold) {
        this.level = 'assisted';
      } else if (this.score >= CONFIDENCE_LEVELS.learning.threshold) {
        this.level = 'learning';
      } else {
        this.level = 'beginner';
      }

      if (oldLevel !== this.level) {
        console.log(`[ConfidenceSystem] Nível atualizado: ${oldLevel} → ${this.level}`);
        
        // Emite evento
        if (window.EventBus) {
          window.EventBus.emit('confidence:level-changed', {
            oldLevel,
            newLevel: this.level,
            score: this.score
          });
        }
      }
    }

    /**
     * Obtém nível de confiança atual
     * @returns {Object} - { level, emoji, label, description, threshold, score }
     */
    getConfidenceLevel() {
      const levelData = CONFIDENCE_LEVELS[this.level];
      return {
        level: this.level,
        emoji: levelData.emoji,
        label: levelData.label,
        description: levelData.description,
        threshold: levelData.threshold,
        score: this.score
      };
    }

    /**
     * Envia feedback de confiança
     * @param {string} type - Tipo: 'good', 'bad', 'correction'
     * @param {Object} metadata - Metadados adicionais
     */
    async sendConfidenceFeedback(type, metadata = {}) {
      this.metrics.totalInteractions++;

      if (type === 'good') {
        this.metrics.feedbackGood++;
      } else if (type === 'bad') {
        this.metrics.feedbackBad++;
      } else if (type === 'correction') {
        this.metrics.feedbackCorrections++;
      }

      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Feedback registrado:', type, 'Score:', this.score);

      // Envia para backend
      this.pushToBackend('feedback', { type, metadata });

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:feedback', {
          type,
          score: this.score,
          level: this.level,
          metadata
        });
      }
    }

    /**
     * Registra uso de sugestão
     * @param {boolean} edited - Se a sugestão foi editada
     * @param {Object} metadata - Metadados
     */
    async recordSuggestionUsage(edited, metadata = {}) {
      if (edited) {
        this.metrics.suggestionsEdited++;
      } else {
        this.metrics.suggestionsUsed++;
      }

      this.metrics.totalInteractions++;
      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Uso de sugestão registrado. Editada:', edited);

      // Envia para backend
      this.pushToBackend('suggestion_usage', { edited, metadata });
    }

    /**
     * Registra envio automático
     * @param {Object} metadata - Metadados
     */
    async recordAutoSend(metadata = {}) {
      this.metrics.autoSent++;
      this.metrics.totalInteractions++;
      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Auto-send registrado. Total:', this.metrics.autoSent);

      // Envia para backend
      this.pushToBackend('auto_send', { metadata });
    }

    /**
     * Registra adição de FAQ
     */
    async recordFAQAdded() {
      this.metrics.faqsAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Registra adição de produto
     */
    async recordProductAdded() {
      this.metrics.productsAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Registra adição de exemplo
     */
    async recordExampleAdded() {
      this.metrics.examplesAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Verifica se pode enviar automaticamente
     * @param {Object} message - Mensagem a ser enviada
     * @param {string} chatTitle - Título do chat
     * @returns {boolean} - Pode enviar?
     */
    canAutoSend(message = null, chatTitle = '') {
      // Verifica se copilot está ativado
      if (!this.copilotEnabled) {
        return false;
      }

      // Verifica se score atinge threshold
      if (this.score < this.threshold) {
        return false;
      }

      // Verificações adicionais podem ser feitas aqui
      // Ex: horário, tipo de mensagem, histórico do chat, etc.

      return true;
    }

    /**
     * Ativa/desativa copilot mode
     * @param {boolean} enabled - Ativar?
     */
    async toggleCopilot(enabled) {
      this.copilotEnabled = enabled;
      await this.save();

      console.log('[ConfidenceSystem] Copilot mode:', enabled ? 'ativado' : 'desativado');

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:copilot-toggled', {
          enabled,
          score: this.score,
          level: this.level
        });
      }

      // Envia para backend
      this.pushToBackend('copilot_toggle', { enabled });
    }

    /**
     * Define threshold do copilot
     * @param {number} threshold - Threshold (50-95)
     */
    async setThreshold(threshold) {
      this.threshold = Math.max(50, Math.min(95, threshold));
      await this.save();

      console.log('[ConfidenceSystem] Threshold atualizado:', this.threshold);

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:threshold-changed', {
          threshold: this.threshold,
          score: this.score
        });
      }
    }

    /**
     * Envia dados para backend
     * @param {string} eventType - Tipo do evento
     * @param {Object} data - Dados
     */
    pushToBackend(eventType, data) {
      try {
        const event = {
          type: eventType,
          data,
          score: this.score,
          level: this.level,
          timestamp: Date.now()
        };

        chrome.runtime.sendMessage({
          action: 'UPDATE_CONFIDENCE',
          event
        }).catch(err => {
          console.warn('[ConfidenceSystem] Erro ao enviar para backend:', err);
        });

      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao fazer push:', error);
      }
    }

    /**
     * Obtém métricas
     * @returns {Object} - Métricas
     */
    getMetrics() {
      return {
        ...this.metrics,
        score: this.score,
        level: this.level,
        copilotEnabled: this.copilotEnabled,
        threshold: this.threshold
      };
    }

    /**
     * Calcula pontos faltantes para próximo nível
     * @returns {Object} - { nextLevel, pointsNeeded, scoreNeeded }
     */
    getPointsToNextLevel() {
      const levels = ['beginner', 'learning', 'assisted', 'copilot', 'autonomous'];
      const currentIndex = levels.indexOf(this.level);
      
      if (currentIndex === levels.length - 1) {
        return {
          nextLevel: 'autonomous',
          pointsNeeded: 0,
          scoreNeeded: 0,
          message: 'Nível máximo alcançado!'
        };
      }

      const nextLevel = levels[currentIndex + 1];
      const nextThreshold = CONFIDENCE_LEVELS[nextLevel].threshold;
      const scoreNeeded = nextThreshold - this.score;

      return {
        nextLevel: CONFIDENCE_LEVELS[nextLevel].label,
        pointsNeeded: scoreNeeded,
        scoreNeeded,
        currentScore: this.score,
        nextThreshold,
        message: `Faltam ${scoreNeeded} pontos para ${CONFIDENCE_LEVELS[nextLevel].label}`
      };
    }

    /**
     * Reseta métricas (manter apenas conhecimento)
     */
    async resetMetrics() {
      this.metrics = {
        feedbackGood: 0,
        feedbackBad: 0,
        feedbackCorrections: 0,
        suggestionsUsed: 0,
        suggestionsEdited: 0,
        autoSent: 0,
        faqsAdded: this.metrics.faqsAdded, // Mantém conhecimento
        productsAdded: this.metrics.productsAdded,
        examplesAdded: this.metrics.examplesAdded,
        totalInteractions: 0
      };
      
      this.calculateScore();
      await this.save();
      console.log('[ConfidenceSystem] Métricas resetadas');
    }

    /**
     * Obtém estatísticas formatadas
     * @returns {Object} - Estatísticas
     */
    getStats() {
      const total = this.metrics.feedbackGood + this.metrics.feedbackBad;
      const accuracy = total > 0 
        ? Math.round((this.metrics.feedbackGood / total) * 100) 
        : 0;

      return {
        score: this.score,
        level: this.getConfidenceLevel(),
        accuracy: `${accuracy}%`,
        feedbackGood: this.metrics.feedbackGood,
        feedbackBad: this.metrics.feedbackBad,
        corrections: this.metrics.feedbackCorrections,
        suggestionsUsed: this.metrics.suggestionsUsed,
        autoSent: this.metrics.autoSent,
        knowledgeBase: {
          faqs: this.metrics.faqsAdded,
          products: this.metrics.productsAdded,
          examples: this.metrics.examplesAdded
        },
        totalInteractions: this.metrics.totalInteractions
      };
    }
  }

  // Exporta globalmente
  window.ConfidenceSystem = ConfidenceSystem;

  // Cria instância global
  if (!window.confidenceSystem) {
    window.confidenceSystem = new ConfidenceSystem();
    window.confidenceSystem.init().then(() => {
      console.log('[ConfidenceSystem] ✅ Módulo carregado e inicializado');
    });
  }

})();
