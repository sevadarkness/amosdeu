/**
 * WhatsHybrid Human Typing Simulator v7.5.0
 * Simula digitação humana com velocidade variável
 */
(function() {
  'use strict';

  const CONFIG = {
    minDelay: 30,
    maxDelay: 80,
    punctuationPause: 150,
    commaPause: 100
  };

  async function humanType(field, text, opts = {}) {
    if (!field || !text) return false;
    
    const min = opts.minDelay || CONFIG.minDelay;
    const max = opts.maxDelay || CONFIG.maxDelay;
    
    field.focus();
    await sleep(100);
    
    for (const char of text) {
      // Inserir caractere
      if (field.contentEditable === 'true') {
        document.execCommand('insertText', false, char);
      } else {
        const start = field.selectionStart || 0;
        field.value = field.value.substring(0, start) + char + field.value.substring(field.selectionEnd || 0);
        field.selectionStart = field.selectionEnd = start + 1;
      }
      
      // Disparar eventos
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Calcular delay
      let delay = Math.random() * (max - min) + min;
      if (['.', '!', '?', ';'].includes(char)) delay += CONFIG.punctuationPause;
      else if (char === ',') delay += CONFIG.commaPause;
      
      await sleep(delay);
    }
    
    console.log('[HumanTyping] ✅ Digitação concluída');
    return true;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Função para digitar no WhatsApp
  async function typeInWhatsApp(text, opts = {}) {
    const selectors = [
      'footer div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][role="textbox"]',
      '[data-testid="conversation-compose-box-input"]'
    ];
    
    for (const sel of selectors) {
      const field = document.querySelector(sel);
      if (field) return humanType(field, text, opts);
    }
    
    console.error('[HumanTyping] Campo não encontrado');
    return false;
  }

  // API Pública
  window.HumanTyping = {
    type: humanType,
    typeInWhatsApp: typeInWhatsApp,
    config: CONFIG
  };

  window.humanType = humanType;
  window.simulateHumanTyping = humanType;

  console.log('[HumanTyping] ✅ Módulo carregado');
})();
