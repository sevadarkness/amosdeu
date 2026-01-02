/**
 * 🧪 Testes de Regressão - EventBus v2.0 & StateManager v1.0
 * Execute: WHLTests.run() no console
 * Atalho: Ctrl+Shift+T
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
      console.log(`📊 RELATÓRIO DE TESTES`);
      console.log('='.repeat(50));
      console.log(`Total: ${this.passed + this.failed}`);
      console.log(`✅ Passed: ${this.passed}`);
      console.log(`❌ Failed: ${this.failed}`);
      console.log('='.repeat(50));
      if (this.failed > 0) {
        console.log('\n❌ FALHAS:');
        this.results.filter(r => r.status === 'FAILED').forEach(r => console.log(`  - ${r.name}: ${r.error}`));
      }
      return { total: this.passed + this.failed, passed: this.passed, failed: this.failed, results: this.results };
    },
    
    reset() { this.results = []; this.passed = 0; this.failed = 0; }
  };

  // ============================================
  // TESTES EVENTBUS v2.0
  // ============================================
  async function testEventBus() {
    console.log('\n📢 TESTANDO EVENTBUS v2.0...\n');
    const bus = window.EventBus;
    if (!bus) { console.error('❌ EventBus não encontrado!'); return; }
    bus.clear();

    TestRunner.test('EventBus: on/emit básico', () => {
      let received = null;
      const unsub = bus.on('test:basic', (data) => { received = data; });
      bus.emit('test:basic', { value: 42 });
      TestRunner.assertEqual(received.value, 42);
      unsub();
    });

    TestRunner.test('EventBus: múltiplos listeners', () => {
      let count = 0;
      const u1 = bus.on('test:multi', () => count++);
      const u2 = bus.on('test:multi', () => count++);
      bus.emit('test:multi');
      TestRunner.assertEqual(count, 2);
      u1(); u2();
    });

    TestRunner.test('EventBus: once', () => {
      let count = 0;
      bus.once('test:once', () => count++);
      bus.emit('test:once'); bus.emit('test:once');
      TestRunner.assertEqual(count, 1);
    });

    TestRunner.test('EventBus: prioridade de listeners', () => {
      const order = [];
      bus.on('test:prio', () => order.push('normal'), { priority: 5 });
      bus.on('test:prio', () => order.push('first'), { priority: 1 });
      bus.on('test:prio', () => order.push('last'), { priority: 10 });
      bus.emit('test:prio');
      TestRunner.assertDeepEqual(order, ['first', 'normal', 'last']);
      bus.clear('test:prio');
    });

    TestRunner.test('EventBus: wildcard', () => {
      let called = false;
      const unsub = bus.on('*', () => { called = true; });
      bus.emit('test:wildcard');
      TestRunner.assert(called);
      unsub();
    });

    TestRunner.test('EventBus: off', () => {
      let count = 0;
      const handler = () => count++;
      bus.on('test:off', handler);
      bus.emit('test:off');
      bus.off('test:off', handler);
      bus.emit('test:off');
      TestRunner.assertEqual(count, 1);
    });

    TestRunner.test('EventBus: histórico', () => {
      bus.emit('test:h1'); bus.emit('test:h2');
      const history = bus.getHistory('test:h', 10);
      TestRunner.assert(history.length >= 2);
    });

    TestRunner.test('EventBus: namespace', () => {
      const crm = bus.createNamespace('crm_test');
      let received = null;
      crm.on('contact', (data) => { received = data; });
      crm.emit('contact', { id: 123 });
      TestRunner.assertEqual(received.id, 123);
      crm.clear();
    });

    await TestRunner.testAsync('EventBus: waitFor', async () => {
      setTimeout(() => bus.emit('test:wait', { ok: true }), 50);
      const result = await bus.waitFor('test:wait', 5000);
      TestRunner.assert(result.ok);
    });

    TestRunner.test('EventBus: pause/resume', () => {
      let received = false;
      bus.on('test:pause', () => { received = true; });
      bus.pause();
      bus.emit('test:pause');
      TestRunner.assert(!received, 'Não deve receber enquanto pausado');
      bus.resume();
      TestRunner.assert(received, 'Deve receber após resume');
      bus.clear('test:pause');
    });

    TestRunner.test('EventBus: pipe', () => {
      let piped = null;
      bus.on('test:target', (d) => { piped = d; });
      bus.pipe('test:src', 'test:target', (d) => ({ ...d, piped: true }));
      bus.emit('test:src', { v: 1 });
      TestRunner.assert(piped.piped);
      bus.clear('test:src'); bus.clear('test:target');
    });

    TestRunner.test('EventBus: stats', () => {
      const stats = bus.getStats();
      TestRunner.assert(typeof stats.emitted === 'number');
      TestRunner.assert(typeof stats.handled === 'number');
    });

    TestRunner.test('EventBus: debug', () => {
      const debug = bus.debug();
      TestRunner.assert(typeof debug === 'object');
      TestRunner.assert('stats' in debug);
      TestRunner.assert('events' in debug);
    });

    TestRunner.test('EventBus: EVENTS constantes', () => {
      TestRunner.assert(bus.EVENTS);
      TestRunner.assert(bus.EVENTS.MESSAGE_SENT);
      TestRunner.assert(bus.EVENTS.CAMPAIGN_STARTED);
      TestRunner.assert(bus.EVENTS.CONTACT_CREATED);
    });

    TestRunner.test('EventBus: NAMESPACES', () => {
      TestRunner.assert(bus.NAMESPACES);
      TestRunner.assert(bus.NAMESPACES.CRM);
      TestRunner.assert(bus.NAMESPACES.CAMPAIGN);
    });
  }

  // ============================================
  // TESTES STATEMANAGER v1.0
  // ============================================
  async function testStateManager() {
    console.log('\n🗄️ TESTANDO STATEMANAGER v1.0...\n');
    const state = window.StateManager;
    if (!state) { console.error('❌ StateManager não encontrado!'); return; }

    TestRunner.test('StateManager: get básico', () => {
      const plan = state.get('user.plan');
      TestRunner.assert(plan !== undefined);
    });

    TestRunner.test('StateManager: get com default', () => {
      const v = state.get('nao.existe', 'default');
      TestRunner.assertEqual(v, 'default');
    });

    TestRunner.test('StateManager: set/get', () => {
      state.set('test.value', 123);
      TestRunner.assertEqual(state.get('test.value'), 123);
    });

    TestRunner.test('StateManager: update parcial', () => {
      state.set('test.obj', { a: 1, b: 2 });
      state.update('test.obj', { c: 3 });
      const obj = state.get('test.obj');
      TestRunner.assertEqual(obj.a, 1);
      TestRunner.assertEqual(obj.c, 3);
    });

    TestRunner.test('StateManager: push', () => {
      state.set('test.arr', [1, 2]);
      state.push('test.arr', 3);
      TestRunner.assertDeepEqual(state.get('test.arr'), [1, 2, 3]);
    });

    TestRunner.test('StateManager: remove', () => {
      state.set('test.rem', [1, 2, 3, 4]);
      state.remove('test.rem', (i) => i === 3);
      TestRunner.assertDeepEqual(state.get('test.rem'), [1, 2, 4]);
    });

    TestRunner.test('StateManager: increment', () => {
      state.set('test.cnt', 10);
      state.increment('test.cnt', 5);
      TestRunner.assertEqual(state.get('test.cnt'), 15);
    });

    TestRunner.test('StateManager: toggle', () => {
      state.set('test.bool', false);
      state.toggle('test.bool');
      TestRunner.assertEqual(state.get('test.bool'), true);
    });

    TestRunner.test('StateManager: subscribe', () => {
      let received = null;
      const unsub = state.subscribe('test.sub', (v) => { received = v; });
      state.set('test.sub', 'hello');
      TestRunner.assertEqual(received, 'hello');
      unsub();
    });

    TestRunner.test('StateManager: unsubscribe', () => {
      let count = 0;
      const unsub = state.subscribe('test.unsub', () => count++);
      state.set('test.unsub', 1);
      unsub();
      state.set('test.unsub', 2);
      TestRunner.assertEqual(count, 1);
    });

    TestRunner.test('StateManager: setMultiple', () => {
      state.setMultiple({ 'test.m1': 'a', 'test.m2': 'b' });
      TestRunner.assertEqual(state.get('test.m1'), 'a');
      TestRunner.assertEqual(state.get('test.m2'), 'b');
    });

    TestRunner.test('StateManager: getState imutável', () => {
      const s1 = state.getState();
      s1.mutated = true;
      const s2 = state.getState();
      TestRunner.assert(!s2.mutated);
    });

    TestRunner.test('StateManager: undo', () => {
      state.set('test.undo', 'original');
      state.set('test.undo', 'modified');
      state.undo();
      TestRunner.assertEqual(state.get('test.undo'), 'original');
    });

    TestRunner.test('StateManager: redo', () => {
      state.set('test.redo', 'first');
      state.set('test.redo', 'second');
      state.undo();
      state.redo();
      TestRunner.assertEqual(state.get('test.redo'), 'second');
    });

    TestRunner.test('StateManager: silent', () => {
      let called = false;
      const unsub = state.subscribe('test.silent', () => { called = true; });
      state.set('test.silent', 'v', { silent: true });
      TestRunner.assert(!called);
      unsub();
    });

    TestRunner.test('StateManager: wildcard subscriber', () => {
      let called = false;
      const unsub = state.subscribe('*', () => { called = true; });
      state.set('test.wild', 'x');
      TestRunner.assert(called);
      unsub();
    });

    TestRunner.test('StateManager: computed', () => {
      state.set('test.n1', 10);
      state.set('test.n2', 20);
      const getSum = state.computed('sum', ['test.n1', 'test.n2'], (a, b) => a + b);
      TestRunner.assertEqual(getSum(), 30);
      state.set('test.n1', 15);
      TestRunner.assertEqual(getSum(), 35);
    });

    TestRunner.test('StateManager: debug', () => {
      const debug = state.debug();
      TestRunner.assert('state' in debug);
      TestRunner.assert('initialized' in debug);
    });

    TestRunner.test('StateManager: export', () => {
      const exported = state.export();
      TestRunner.assert(typeof exported === 'string');
      TestRunner.assert(exported.includes('user'));
    });

    // Limpar testes
    state.set('test', null);
  }

  // ============================================
  // TESTES DE INTEGRAÇÃO
  // ============================================
  async function testIntegration() {
    console.log('\n🔗 TESTANDO INTEGRAÇÃO...\n');
    const bus = window.EventBus;
    const state = window.StateManager;
    if (!bus || !state) { console.error('❌ Módulos não encontrados!'); return; }

    TestRunner.test('Integração: STATE_CHANGED event', () => {
      let received = false;
      const unsub = bus.on('state:changed', (d) => { if (d.path === 'integ.t1') received = true; });
      state.set('integ.t1', 'v');
      TestRunner.assert(received);
      unsub();
    });

    await TestRunner.testAsync('Integração: MESSAGE_SENT métricas', async () => {
      const before = state.get('metrics.messagesSentToday', 0);
      bus.emit(bus.EVENTS.MESSAGE_SENT, { phone: '123' });
      await new Promise(r => setTimeout(r, 50));
      const after = state.get('metrics.messagesSentToday', 0);
      TestRunner.assert(after > before);
    });

    TestRunner.test('Integração: comunicação entre módulos', () => {
      let m1 = false, m2 = false;
      const ns1 = bus.createNamespace('mod1');
      const ns2 = bus.createNamespace('mod2');
      ns1.on('evt', () => { m1 = true; });
      ns2.on('evt', () => { m2 = true; });
      ns1.emit('evt'); ns2.emit('evt');
      TestRunner.assert(m1 && m2);
      ns1.clear(); ns2.clear();
    });

    TestRunner.test('Integração: fluxo de campanha', () => {
      const events = [];
      const u1 = bus.on(bus.EVENTS.CAMPAIGN_STARTED, () => events.push('started'));
      const u2 = bus.on(bus.EVENTS.CAMPAIGN_PROGRESS, () => events.push('progress'));
      const u3 = bus.on(bus.EVENTS.CAMPAIGN_COMPLETED, () => events.push('completed'));
      bus.emit(bus.EVENTS.CAMPAIGN_STARTED, { id: 1 });
      bus.emit(bus.EVENTS.CAMPAIGN_PROGRESS, { id: 1, progress: 50 });
      bus.emit(bus.EVENTS.CAMPAIGN_COMPLETED, { id: 1 });
      TestRunner.assertDeepEqual(events, ['started', 'progress', 'completed']);
      u1(); u2(); u3();
    });

    state.set('integ', null);
  }

  // ============================================
  // EXECUÇÃO
  // ============================================
  async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🧪 TESTES DE REGRESSÃO - WhatsHybrid v7.0      ║');
    console.log('║   EventBus v2.0 + StateManager v1.0              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    TestRunner.reset();
    await testEventBus();
    await testStateManager();
    await testIntegration();
    return TestRunner.report();
  }

  // Atalho Ctrl+Shift+T
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      runAllTests();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      console.log('=== DEBUG INFO ===');
      console.log('EventBus:', window.EventBus?.debug());
      console.log('StateManager:', window.StateManager?.debug());
    }
  });

  window.WHLTests = { run: runAllTests, testEventBus, testStateManager, testIntegration, runner: TestRunner };
  console.log('[Tests] 🧪 Testes de regressão carregados');
  console.log('[Tests] Execute: WHLTests.run() ou Ctrl+Shift+T');
})();
