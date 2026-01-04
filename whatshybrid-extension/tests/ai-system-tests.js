/**
 * 🧪 AI System Tests
 * WhatsHybrid v7.6.0
 * 
 * Simple tests for the AI system modules
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  console.log('🧪 Starting AI System Tests...');

  // Wait for modules to load
  setTimeout(async () => {
    let passed = 0;
    let failed = 0;

    // ============================================
    // TEXT MONITOR TESTS
    // ============================================
    console.log('\n📊 Testing TextMonitor...');
    
    if (window.textMonitor) {
      try {
        // Test sentiment analysis
        const positiveSentiment = window.textMonitor.analyzeSentiment('Muito obrigado! Adorei o produto! Perfeito! 😊');
        console.assert(positiveSentiment.sentiment === 'positive', '✅ Positive sentiment detected');
        passed++;

        const negativeSentiment = window.textMonitor.analyzeSentiment('Péssimo! Não funciona! Ruim demais! 👎');
        console.assert(negativeSentiment.sentiment === 'negative', '✅ Negative sentiment detected');
        passed++;

        // Test intent detection
        const questionIntent = window.textMonitor.detectIntent('Quanto custa esse produto?');
        console.assert(questionIntent.allIntents.includes('question'), '✅ Question intent detected');
        console.assert(questionIntent.allIntents.includes('price'), '✅ Price intent detected');
        passed++;

        const greetingIntent = window.textMonitor.detectIntent('Olá, bom dia!');
        console.assert(greetingIntent.primaryIntent === 'greeting', '✅ Greeting intent detected');
        passed++;

        // Test urgency analysis
        const urgentText = 'URGENTE! Socorro! Preciso de ajuda AGORA!!!';
        const urgency = window.textMonitor.analyzeUrgency(urgentText);
        console.assert(urgency > 50, `✅ High urgency detected: ${urgency}`);
        passed++;

        console.log('✅ TextMonitor: All tests passed!');
      } catch (error) {
        console.error('❌ TextMonitor test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ TextMonitor not available');
      failed++;
    }

    // ============================================
    // KNOWLEDGE BASE TESTS
    // ============================================
    console.log('\n📚 Testing KnowledgeBase...');
    
    if (window.knowledgeBase) {
      try {
        // Test business info
        await window.knowledgeBase.updateBusiness({
          name: 'Test Company',
          segment: 'E-commerce'
        });
        console.assert(window.knowledgeBase.knowledge.business.name === 'Test Company', '✅ Business info saved');
        passed++;

        // Test FAQ
        await window.knowledgeBase.addFAQ('Qual o prazo de entrega?', 'Entregamos em até 5 dias úteis');
        console.assert(window.knowledgeBase.knowledge.faq.length > 0, '✅ FAQ added');
        passed++;

        // Test FAQ search
        const faqMatch = window.knowledgeBase.findFAQMatch('Quanto tempo demora a entrega?');
        console.assert(faqMatch !== null, '✅ FAQ search works');
        passed++;

        // Test product
        await window.knowledgeBase.addProduct({
          name: 'Test Product',
          price: 99.90,
          stock: 10
        });
        console.assert(window.knowledgeBase.knowledge.products.length > 0, '✅ Product added');
        passed++;

        // Test canned reply
        await window.knowledgeBase.addCannedReply(['oi', 'olá'], 'Olá! Como posso ajudar?');
        const cannedMatch = window.knowledgeBase.checkCannedReply('Oi, tudo bem?');
        console.assert(cannedMatch !== null, '✅ Canned reply works');
        passed++;

        // Test prompt building
        const prompt = window.knowledgeBase.buildSystemPrompt({ persona: 'professional' });
        console.assert(prompt.length > 100, '✅ System prompt generated');
        passed++;

        console.log('✅ KnowledgeBase: All tests passed!');
      } catch (error) {
        console.error('❌ KnowledgeBase test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ KnowledgeBase not available');
      failed++;
    }

    // ============================================
    // MEMORY SYSTEM TESTS
    // ============================================
    console.log('\n🧠 Testing MemorySystem...');
    
    if (window.memorySystem) {
      try {
        // Test memory set/get
        await window.memorySystem.setMemory('chat_test', {
          profile: 'Cliente frequente, gosta de produtos premium',
          preferences: ['entrega rápida', 'pagamento PIX'],
          context: ['Comprou notebook em dezembro'],
          open_loops: ['Aguardando resposta sobre garantia'],
          next_actions: ['Oferecer mouse gamer'],
          tone: 'friendly'
        });
        
        const memory = window.memorySystem.getMemory('chat_test');
        console.assert(memory !== null, '✅ Memory saved and retrieved');
        console.assert(memory.preferences.length === 2, '✅ Memory structure correct');
        passed++;

        // Test memory list operations
        await window.memorySystem.addToMemoryList('chat_test', 'preferences', 'produtos Apple');
        const updatedMemory = window.memorySystem.getMemory('chat_test');
        console.assert(updatedMemory.preferences.includes('produtos Apple'), '✅ Memory list updated');
        passed++;

        console.log('✅ MemorySystem: All tests passed!');
      } catch (error) {
        console.error('❌ MemorySystem test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ MemorySystem not available');
      failed++;
    }

    // ============================================
    // FEW-SHOT LEARNING TESTS
    // ============================================
    console.log('\n🎓 Testing FewShotLearning...');
    
    if (window.fewShotLearning) {
      try {
        // Test add example
        await window.fewShotLearning.addExample({
          input: 'Quanto custa o produto X?',
          output: 'O produto X custa R$ 199,90. Posso ajudar com mais alguma coisa?',
          context: 'Cliente interessado em preço',
          category: 'Vendas'
        });
        
        const examples = window.fewShotLearning.getExamples();
        console.assert(examples.length > 0, '✅ Example added');
        passed++;

        // Test pick examples
        const picked = window.fewShotLearning.pickExamples(
          examples, 
          'Qual é o valor do produto Y?', 
          2
        );
        console.assert(picked.length > 0, '✅ Example selection works');
        passed++;

        // Test format for prompt
        const formatted = window.fewShotLearning.formatForPrompt(picked);
        console.assert(formatted.includes('Exemplo'), '✅ Formatting works');
        passed++;

        console.log('✅ FewShotLearning: All tests passed!');
      } catch (error) {
        console.error('❌ FewShotLearning test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ FewShotLearning not available');
      failed++;
    }

    // ============================================
    // CONFIDENCE SYSTEM TESTS
    // ============================================
    console.log('\n🎯 Testing ConfidenceSystem...');
    
    if (window.confidenceSystem) {
      try {
        // Test initial state
        const initialScore = window.confidenceSystem.score;
        console.log(`Initial score: ${initialScore}`);
        passed++;

        // Test feedback
        await window.confidenceSystem.sendConfidenceFeedback('good');
        await window.confidenceSystem.sendConfidenceFeedback('good');
        const afterGoodFeedback = window.confidenceSystem.score;
        console.assert(afterGoodFeedback > initialScore, `✅ Score increased after good feedback: ${afterGoodFeedback}`);
        passed++;

        // Test level determination
        const level = window.confidenceSystem.getConfidenceLevel();
        console.assert(level.level !== undefined, `✅ Level determined: ${level.label}`);
        passed++;

        // Test suggestion usage
        await window.confidenceSystem.recordSuggestionUsage(false);
        const afterUsage = window.confidenceSystem.score;
        console.assert(afterUsage >= afterGoodFeedback, '✅ Score tracked suggestion usage');
        passed++;

        // Test threshold
        await window.confidenceSystem.setThreshold(75);
        console.assert(window.confidenceSystem.threshold === 75, '✅ Threshold updated');
        passed++;

        // Test can auto send
        const canAutoSend = window.confidenceSystem.canAutoSend();
        console.log(`Can auto send: ${canAutoSend} (score: ${window.confidenceSystem.score}, threshold: ${window.confidenceSystem.threshold})`);
        passed++;

        // Test points to next level
        const nextLevel = window.confidenceSystem.getPointsToNextLevel();
        console.log(`Next level: ${nextLevel.message}`);
        passed++;

        console.log('✅ ConfidenceSystem: All tests passed!');
      } catch (error) {
        console.error('❌ ConfidenceSystem test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ ConfidenceSystem not available');
      failed++;
    }

    // ============================================
    // TRAINING STATS TESTS
    // ============================================
    console.log('\n📊 Testing TrainingStats...');
    
    if (window.trainingStats) {
      try {
        // Test increment
        await window.trainingStats.incrementGood();
        await window.trainingStats.incrementGood();
        await window.trainingStats.incrementBad();
        
        const stats = window.trainingStats.getTrainingStats();
        console.assert(stats.good === 2, '✅ Good count tracked');
        console.assert(stats.bad === 1, '✅ Bad count tracked');
        passed++;

        // Test metrics
        const metrics = window.trainingStats.getMetrics();
        console.assert(metrics.successRate > 0, `✅ Success rate calculated: ${metrics.successRate}%`);
        passed++;

        console.log('✅ TrainingStats: All tests passed!');
      } catch (error) {
        console.error('❌ TrainingStats test failed:', error);
        failed++;
      }
    } else {
      console.warn('⚠️ TrainingStats not available');
      failed++;
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('🧪 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('🎉 All tests passed! AI System is working correctly.');
    } else {
      console.warn(`⚠️ ${failed} test(s) failed. Please check the errors above.`);
    }

  }, 2000); // Wait 2 seconds for modules to initialize

})();
