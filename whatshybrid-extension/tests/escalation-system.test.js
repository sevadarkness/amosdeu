/**
 * Tests for Escalation System
 * Run this in browser console on WhatsApp Web page
 */

(function() {
  'use strict';
  
  console.log('=== Escalation System Tests ===\n');
  
  const tests = [];
  let passed = 0;
  let failed = 0;
  
  function assertEquals(actual, expected, testName) {
    const success = JSON.stringify(actual) === JSON.stringify(expected);
    tests.push({ testName, success, actual, expected });
    if (success) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${testName}`);
      console.error(`  Expected: ${JSON.stringify(expected)}`);
      console.error(`  Actual: ${JSON.stringify(actual)}`);
    }
  }
  
  function assertTrue(actual, testName) {
    const success = actual === true;
    tests.push({ testName, success, actual, expected: true });
    if (success) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${testName}`);
      console.error(`  Expected: true`);
      console.error(`  Actual: ${actual}`);
    }
  }
  
  function assertNotNull(actual, testName) {
    const success = actual !== null && actual !== undefined;
    tests.push({ testName, success, actual, expected: 'not null' });
    if (success) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${testName}`);
      console.error(`  Expected: not null`);
      console.error(`  Actual: ${actual}`);
    }
  }

  // Test 1: EscalationSystem class exists
  assertTrue(typeof window.EscalationSystem === 'function', 'EscalationSystem class exists');

  // Test 2: Create new instance
  let escalation = null;
  try {
    escalation = new window.EscalationSystem();
    assertNotNull(escalation, 'Can create EscalationSystem instance');
  } catch (e) {
    failed++;
    console.error(`❌ FAIL: Can create EscalationSystem instance - ${e.message}`);
  }

  if (escalation) {
    // Test 3: Check initial properties
    assertTrue(escalation.queue instanceof Map, 'queue is a Map');
    assertTrue(escalation.agents instanceof Map, 'agents is a Map');
    assertTrue(Array.isArray(escalation.rules), 'rules is an Array');
    assertTrue(Array.isArray(escalation.webhooks), 'webhooks is an Array');

    // Test 4: Check SLA config
    assertNotNull(escalation.slaConfig.urgent, 'urgent SLA config exists');
    assertNotNull(escalation.slaConfig.high, 'high SLA config exists');
    assertNotNull(escalation.slaConfig.medium, 'medium SLA config exists');
    assertNotNull(escalation.slaConfig.low, 'low SLA config exists');

    // Test 5: Create ticket
    const ticket = escalation.createTicket({
      chatId: 'test-chat-123',
      phone: '1234567890',
      customerName: 'Test Customer',
      reason: 'Test escalation',
      priority: 'high'
    });
    assertNotNull(ticket, 'Can create ticket');
    assertEquals(ticket.status, 'open', 'Ticket status is open');
    assertEquals(ticket.priority, 'high', 'Ticket priority is high');
    assertTrue(ticket.id.startsWith('TKT-'), 'Ticket ID format is correct');

    // Test 6: Determine priority
    const urgentPriority = escalation.determinePriority({
      urgency: { level: 'high' }
    });
    assertEquals(urgentPriority, 'urgent', 'Urgent priority detection works');

    const highPriority = escalation.determinePriority({
      sentiment: { sentiment: 'negative' },
      urgency: { level: 'medium' }
    });
    assertEquals(highPriority, 'high', 'High priority detection works');

    // Test 7: Extract tags
    const tags = escalation.extractTags({
      sentiment: { sentiment: 'negative' },
      intent: { primaryIntent: 'complaint' },
      urgency: { level: 'high' }
    });
    assertTrue(tags.includes('sentiment:negative'), 'Sentiment tag extracted');
    assertTrue(tags.includes('intent:complaint'), 'Intent tag extracted');
    assertTrue(tags.includes('urgency:high'), 'Urgency tag extracted');

    // Test 8: Register agent
    const agent = escalation.registerAgent({
      name: 'Test Agent',
      email: 'test@example.com',
      maxLoad: 5
    });
    assertNotNull(agent, 'Can register agent');
    assertEquals(agent.status, 'available', 'Agent status is available');
    assertTrue(agent.id.startsWith('AGT-'), 'Agent ID format is correct');

    // Test 9: Assign ticket
    const assignedTicket = escalation.assignTicket(ticket.id, agent.id);
    assertNotNull(assignedTicket, 'Can assign ticket');
    assertEquals(assignedTicket.status, 'assigned', 'Ticket status is assigned');
    assertEquals(assignedTicket.assignedTo, agent.id, 'Ticket assigned to correct agent');

    // Test 10: Add rule
    const rule = escalation.addRule({
      name: 'Test Rule',
      conditions: [
        { type: 'sentiment', value: 'negative' }
      ],
      actions: [
        { type: 'escalate', reason: 'Test escalation' }
      ],
      priority: 80
    });
    assertNotNull(rule, 'Can add rule');
    assertTrue(rule.id.startsWith('RULE-'), 'Rule ID format is correct');
    assertEquals(rule.enabled, true, 'Rule is enabled by default');

    // Test 11: Check conditions
    const matches = escalation.checkConditions(
      [{ type: 'sentiment', value: 'negative' }],
      { text: 'This is terrible' },
      { sentiment: { sentiment: 'negative' } }
    );
    assertTrue(matches, 'Condition checking works');

    // Test 12: Get stats
    const stats = escalation.getStats('day');
    assertNotNull(stats, 'Can get stats');
    assertTrue(stats.total >= 0, 'Stats total is valid');
    assertNotNull(stats.byPriority, 'Stats has byPriority');

    // Test 13: List tickets
    const tickets = escalation.listTickets({ status: 'assigned' });
    assertTrue(Array.isArray(tickets), 'listTickets returns array');

    // Test 14: Add webhook
    const webhook = escalation.addWebhook('https://example.com/webhook', ['new_ticket']);
    assertNotNull(webhook, 'Can add webhook');
    assertTrue(webhook.id.startsWith('WH-'), 'Webhook ID format is correct');
    assertEquals(webhook.enabled, true, 'Webhook is enabled by default');

    // Test 15: Resolve ticket
    const resolvedTicket = escalation.resolveTicket(ticket.id, 'Test resolution', agent.id);
    assertNotNull(resolvedTicket, 'Can resolve ticket');
    assertEquals(resolvedTicket.status, 'resolved', 'Ticket status is resolved');
    assertNotNull(resolvedTicket.resolvedAt, 'Ticket has resolvedAt timestamp');

    // Test 16: Close ticket
    const closedTicket = escalation.closeTicket(ticket.id, 'Good service');
    assertNotNull(closedTicket, 'Can close ticket');
    assertEquals(closedTicket.status, 'closed', 'Ticket status is closed');
    assertEquals(closedTicket.feedback, 'Good service', 'Feedback is saved');

    // Test 17: Reopen ticket
    const reopenedTicket = escalation.reopenTicket(ticket.id, 'Customer requested reopen');
    assertNotNull(reopenedTicket, 'Can reopen ticket');
    assertEquals(reopenedTicket.status, 'open', 'Ticket status is open after reopen');

    // Test 18: Get available agents
    const availableAgents = escalation.getAvailableAgents();
    assertTrue(Array.isArray(availableAgents), 'getAvailableAgents returns array');

    // Test 19: Update agent status
    const updatedAgent = escalation.updateAgentStatus(agent.id, 'busy');
    assertNotNull(updatedAgent, 'Can update agent status');
    assertEquals(updatedAgent.status, 'busy', 'Agent status updated correctly');

    // Test 20: Helper methods
    assertTrue(escalation.generateTicketId().startsWith('TKT-'), 'generateTicketId works');
    assertTrue(escalation.generateRuleId().startsWith('RULE-'), 'generateRuleId works');
    assertTrue(escalation.generateAgentId().startsWith('AGT-'), 'generateAgentId works');
    assertTrue(escalation.generateWebhookId().startsWith('WH-'), 'generateWebhookId works');
  }

  // Final summary
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(2)}%`);
  
  return {
    tests,
    passed,
    failed,
    successRate: (passed / tests.length) * 100
  };
})();
