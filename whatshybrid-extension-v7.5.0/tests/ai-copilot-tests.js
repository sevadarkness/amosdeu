/**
 * 🧪 Testes - AIService & CopilotEngine
 * Execute: AITests.run() no console
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const TestRunner = {
    results: [], passed: 0, failed: 0,
    
    test(name, fn) {
      try { fn(); this.passed++; this.results.push({ name, status: 'PASSED' }); console.log(`✅ ${name}`); }
      catch (e) { this.failed++; this.results.push({ name, status: 'FAILED', error: e.message }); console.error(`❌ ${name}: ${e.message}`); }
    },
    
    async testAsync(name, fn) {
      try { await fn(); this.passed++; this.results.push({ name, status: 'PASSED' }); console.log(`✅ ${name}`); }
      catch (e) { this.failed++; this.results.push({ name, status: 'FAILED', error: e.message }); console.error(`❌ ${name}: ${e.message}`); }
    },
    
    assert(condition, msg) { if (!condition) throw new Error(msg || 'Assertion failed'); },
    assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
    assertDeepEqual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || 'Deep equality failed'); },
    
    report() {
      console.log('\n' + '='.repeat(50));
      console.log(`📊 RELATÓRIO - AIService & CopilotEngine`);
      console.log('='.repeat(50));
      console.log(`Total: ${this.passed + this.failed}`);
      console.log(`✅ Passed: ${this.passed}`);
      console.log(`❌ Failed: ${this.failed}`);
      console.log('='.repeat(50));
      if (this.failed > 0) {
        console.log('\n❌ FALHAS:');
        this.results.filter(r => r.status === 'FAILED').forEach(r => console.log(`  - ${r.name}: ${r.error}`));
      }
      return { total: this.passed + this.failed, passed: this.passed, failed: this.failed };
    },
    
    reset() { this.results = []; this.passed = 0; this.failed = 0; }
  };

  // ============================================
  // TESTES AISERVICE
  // ============================================
  async function testAIService() {
    console.log('\n🧠 TESTANDO AISERVICE...\n');
    const ai = window.AIService;
    if (!ai) { console.error('❌ AIService não encontrado!'); return; }

    TestRunner.test('AIService: PROVIDERS definidos', () => {
      TestRunner.assert(ai.PROVIDERS);
      TestRunner.assert(ai.PROVIDERS.openai);
      TestRunner.assert(ai.PROVIDERS.anthropic);
      TestRunner.assert(ai.PROVIDERS.venice);
      TestRunner.assert(ai.PROVIDERS.groq);
      TestRunner.assert(ai.PROVIDERS.google);
    });

    TestRunner.test('AIService: Provider OpenAI tem modelos', () => {
      const openai = ai.PROVIDERS.openai;
      TestRunner.assert(openai.models['gpt-4o']);
      TestRunner.assert(openai.models['gpt-4o-mini']);
      TestRunner.assert(openai.defaultModel);
    });

    TestRunner.test('AIService: Provider Anthropic tem modelos', () => {
      const anthropic = ai.PROVIDERS.anthropic;
      TestRunner.assert(anthropic.models['claude-3-5-sonnet-20241022']);
      TestRunner.assert(anthropic.defaultModel);
    });

    TestRunner.test('AIService: configureProvider funciona', () => {
      const result = ai.configureProvider('openai', {
        apiKey: 'test-key-123',
        model: 'gpt-4o-mini',
        enabled: true
      });
      TestRunner.assert(result);
    });

    TestRunner.test('AIService: getProviderConfig retorna config', () => {
      const config = ai.getProviderConfig('openai');
      TestRunner.assert(config);
      TestRunner.assertEqual(config.apiKey, 'test-key-123');
    });

    TestRunner.test('AIService: isProviderConfigured funciona', () => {
      const configured = ai.isProviderConfigured('openai');
      TestRunner.assert(configured);
    });

    TestRunner.test('AIService: getConfiguredProviders retorna array', () => {
      const providers = ai.getConfiguredProviders();
      TestRunner.assert(Array.isArray(providers));
      TestRunner.assert(providers.includes('openai'));
    });

    TestRunner.test('AIService: setDefaultProvider funciona', () => {
      ai.setDefaultProvider('openai');
      // Se não deu erro, passou
      TestRunner.assert(true);
    });

    TestRunner.test('AIService: estimateTokens funciona', () => {
      const tokens = ai.estimateTokens('Hello world, this is a test message.');
      TestRunner.assert(tokens > 0);
      TestRunner.assert(tokens < 50);
    });

    TestRunner.test('AIService: estimateCost funciona', () => {
      const cost = ai.estimateCost('openai', 'gpt-4o-mini', 1000, 500);
      TestRunner.assert(typeof cost === 'number');
      TestRunner.assert(cost >= 0);
    });

    TestRunner.test('AIService: getStats retorna objeto', () => {
      const stats = ai.getStats();
      TestRunner.assert(typeof stats === 'object');
      TestRunner.assert('totalRequests' in stats);
      TestRunner.assert('totalTokens' in stats);
    });

    TestRunner.test('AIService: clearCache não dá erro', () => {
      ai.clearCache();
      TestRunner.assert(true);
    });

    TestRunner.test('AIService: getHealthStatus retorna status', () => {
      const health = ai.getHealthStatus('openai');
      TestRunner.assert(typeof health === 'object');
      TestRunner.assert('status' in health);
    });

    // Limpar configuração de teste
    ai.configureProvider('openai', { apiKey: null, enabled: false });
  }

  // ============================================
  // TESTES COPILOTENGINE
  // ============================================
  async function testCopilotEngine() {
    console.log('\n🤖 TESTANDO COPILOTENGINE...\n');
    const copilot = window.CopilotEngine;
    if (!copilot) { console.error('❌ CopilotEngine não encontrado!'); return; }

    TestRunner.test('CopilotEngine: MODES definidos', () => {
      TestRunner.assert(copilot.MODES);
      TestRunner.assert(copilot.MODES.OFF);
      TestRunner.assert(copilot.MODES.SUGGEST);
      TestRunner.assert(copilot.MODES.FULL_AUTO);
    });

    TestRunner.test('CopilotEngine: INTENTS definidos', () => {
      TestRunner.assert(copilot.INTENTS);
      TestRunner.assert(copilot.INTENTS.GREETING);
      TestRunner.assert(copilot.INTENTS.QUESTION);
      TestRunner.assert(copilot.INTENTS.COMPLAINT);
    });

    TestRunner.test('CopilotEngine: DEFAULT_PERSONAS definidos', () => {
      TestRunner.assert(copilot.DEFAULT_PERSONAS);
      TestRunner.assert(copilot.DEFAULT_PERSONAS.professional);
      TestRunner.assert(copilot.DEFAULT_PERSONAS.friendly);
      TestRunner.assert(copilot.DEFAULT_PERSONAS.sales);
    });

    TestRunner.test('CopilotEngine: setMode funciona', () => {
      copilot.setMode('suggest');
      TestRunner.assertEqual(copilot.getMode(), 'suggest');
    });

    TestRunner.test('CopilotEngine: setActivePersona funciona', () => {
      copilot.setActivePersona('professional');
      const persona = copilot.getActivePersona();
      TestRunner.assertEqual(persona.id, 'professional');
    });

    TestRunner.test('CopilotEngine: getAllPersonas retorna todas', () => {
      const personas = copilot.getAllPersonas();
      TestRunner.assert(personas.professional);
      TestRunner.assert(personas.friendly);
      TestRunner.assert(personas.sales);
    });

    TestRunner.test('CopilotEngine: detectIntent - saudação', () => {
      const intent = copilot.detectIntent('Olá, bom dia!');
      TestRunner.assertEqual(intent.id, 'greeting');
    });

    TestRunner.test('CopilotEngine: detectIntent - pergunta', () => {
      const intent = copilot.detectIntent('Quanto custa o produto?');
      TestRunner.assertEqual(intent.id, 'purchase');
    });

    TestRunner.test('CopilotEngine: detectIntent - reclamação', () => {
      const intent = copilot.detectIntent('Estou com um problema sério');
      TestRunner.assertEqual(intent.id, 'complaint');
    });

    TestRunner.test('CopilotEngine: detectIntent - urgência', () => {
      const intent = copilot.detectIntent('Preciso de ajuda urgente agora!');
      TestRunner.assertEqual(intent.id, 'urgency');
    });

    TestRunner.test('CopilotEngine: analyzeSentiment - positivo', () => {
      const sentiment = copilot.analyzeSentiment('Muito obrigado, excelente atendimento!');
      TestRunner.assertEqual(sentiment.label, 'positive');
    });

    TestRunner.test('CopilotEngine: analyzeSentiment - negativo', () => {
      const sentiment = copilot.analyzeSentiment('Péssimo serviço, quero cancelar!');
      TestRunner.assertEqual(sentiment.label, 'negative');
    });

    TestRunner.test('CopilotEngine: analyzeSentiment - neutro', () => {
      const sentiment = copilot.analyzeSentiment('Ok, entendi.');
      TestRunner.assertEqual(sentiment.label, 'neutral');
    });

    TestRunner.test('CopilotEngine: extractEntities - telefone', () => {
      const entities = copilot.extractEntities('Meu número é 11 99999-8888');
      TestRunner.assert(entities.phones.length > 0);
    });

    TestRunner.test('CopilotEngine: extractEntities - email', () => {
      const entities = copilot.extractEntities('Meu email é teste@exemplo.com');
      TestRunner.assert(entities.emails.length > 0);
      TestRunner.assertEqual(entities.emails[0], 'teste@exemplo.com');
    });

    TestRunner.test('CopilotEngine: extractEntities - valor', () => {
      const entities = copilot.extractEntities('O preço é R$ 199,90');
      TestRunner.assert(entities.money.length > 0);
    });

    TestRunner.test('CopilotEngine: addToContext funciona', () => {
      copilot.addToContext('test-chat-123', {
        role: 'user',
        content: 'Mensagem de teste',
        timestamp: Date.now()
      });
      const context = copilot.getConversationContext('test-chat-123');
      TestRunner.assert(context.messages.length > 0);
    });

    TestRunner.test('CopilotEngine: clearConversationContext funciona', () => {
      copilot.clearConversationContext('test-chat-123');
      const context = copilot.getConversationContext('test-chat-123');
      TestRunner.assertEqual(context.messages.length, 0);
    });

    TestRunner.test('CopilotEngine: createCustomPersona funciona', () => {
      const id = copilot.createCustomPersona({
        name: 'Test Persona',
        description: 'Persona de teste',
        temperature: 0.5,
        maxTokens: 200,
        systemPrompt: 'Você é um assistente de teste.'
      });
      TestRunner.assert(id);
      const personas = copilot.getAllPersonas();
      TestRunner.assert(personas[id]);
    });

    TestRunner.test('CopilotEngine: deleteCustomPersona funciona', () => {
      const id = copilot.createCustomPersona({
        name: 'To Delete',
        description: 'Será deletado',
        temperature: 0.5,
        maxTokens: 200,
        systemPrompt: 'Test'
      });
      const result = copilot.deleteCustomPersona(id);
      TestRunner.assert(result);
    });

    TestRunner.test('CopilotEngine: updateSettings funciona', () => {
      copilot.updateSettings({ autoGreeting: false });
      const settings = copilot.getSettings();
      TestRunner.assertEqual(settings.autoGreeting, false);
      copilot.updateSettings({ autoGreeting: true });
    });

    TestRunner.test('CopilotEngine: getMetrics retorna objeto', () => {
      const metrics = copilot.getMetrics();
      TestRunner.assert(typeof metrics === 'object');
      TestRunner.assert('totalResponses' in metrics);
    });

    TestRunner.test('CopilotEngine: recordFeedback funciona', () => {
      copilot.recordFeedback({
        responseId: 'test-123',
        rating: 5,
        correctedResponse: null
      });
      // Se não deu erro, passou
      TestRunner.assert(true);
    });

    TestRunner.test('CopilotEngine: debug retorna info', () => {
      const debug = copilot.debug();
      TestRunner.assert('initialized' in debug);
      TestRunner.assert('mode' in debug);
      TestRunner.assert('activePersona' in debug);
    });

    TestRunner.test('CopilotEngine: searchKnowledgeBase retorna array', () => {
      const results = copilot.searchKnowledgeBase('horário atendimento');
      TestRunner.assert(Array.isArray(results));
    });
  }

  // ============================================
  // TESTES DE INTEGRAÇÃO
  // ============================================
  async function testIntegration() {
    console.log('\n🔗 TESTANDO INTEGRAÇÃO AI...\n');
    const ai = window.AIService;
    const copilot = window.CopilotEngine;
    const bus = window.EventBus;

    if (!ai || !copilot || !bus) {
      console.error('❌ Módulos não encontrados!');
      return;
    }

    TestRunner.test('Integração: AIService + CopilotEngine conectados', () => {
      // CopilotEngine deve poder usar AIService
      TestRunner.assert(window.AIService);
      TestRunner.assert(window.CopilotEngine);
    });

    TestRunner.test('Integração: EventBus recebe eventos do Copilot', () => {
      let received = false;
      const unsub = bus.on('copilot:mode:changed', () => { received = true; });
      copilot.setMode('suggest');
      TestRunner.assert(received);
      unsub();
    });

    await TestRunner.testAsync('Integração: analyzeMessage completo', async () => {
      const analysis = await copilot.analyzeMessage('Olá, quanto custa o produto?', 'test-chat');
      TestRunner.assert(analysis.intent);
      TestRunner.assert(analysis.sentiment);
      TestRunner.assert(analysis.entities);
      TestRunner.assert('confidence' in analysis);
    });

    TestRunner.test('Integração: fluxo de contexto funciona', () => {
      const chatId = 'integration-test-' + Date.now();
      
      // Adicionar mensagens
      copilot.addToContext(chatId, { role: 'user', content: 'Primeira mensagem' });
      copilot.addToContext(chatId, { role: 'assistant', content: 'Resposta' });
      copilot.addToContext(chatId, { role: 'user', content: 'Segunda mensagem' });
      
      // Verificar contexto
      const context = copilot.getConversationContext(chatId);
      TestRunner.assertEqual(context.messages.length, 3);
      
      // Limpar
      copilot.clearConversationContext(chatId);
    });
  }

  // ============================================
  // EXECUÇÃO
  // ============================================
  async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🧪 TESTES - AIService & CopilotEngine          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    TestRunner.reset();
    await testAIService();
    await testCopilotEngine();
    await testIntegration();
    return TestRunner.report();
  }

  window.AITests = {
    run: runAllTests,
    testAIService,
    testCopilotEngine,
    testIntegration,
    runner: TestRunner
  };

  console.log('[AITests] 🧪 Testes de IA carregados');
  console.log('[AITests] Execute: AITests.run()');
})();
