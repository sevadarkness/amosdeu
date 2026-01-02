/**
 * Tests for RECOVER Module Phases 1-2 Implementation
 * Phase 1: Core messageVersions Map with History Arrays
 * Phase 2: Enhanced from/to/direction Tracking
 * 
 * Run this in browser console on WhatsApp Web page after loading recover-advanced.js
 */

(function() {
  'use strict';
  
  console.log('=== RECOVER Phases 1-2 Tests ===\n');
  
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
  
  function assertFalse(actual, testName) {
    const success = actual === false;
    tests.push({ testName, success, actual, expected: false });
    if (success) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${testName}`);
      console.error(`  Expected: false`);
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
  
  // Check if RecoverAdvanced is loaded
  if (typeof window.RecoverAdvanced === 'undefined') {
    console.error('❌ RecoverAdvanced not found! Make sure recover-advanced.js is loaded.');
    return;
  }
  
  const RA = window.RecoverAdvanced;
  
  // ========================================
  // PHASE 1: Core messageVersions Tests
  // ========================================
  
  console.log('\n--- Phase 1: MESSAGE_STATES Constants ---');
  assertNotNull(RA.MESSAGE_STATES, 'MESSAGE_STATES exists');
  assertNotNull(RA.MESSAGE_STATES.REVOKED_GLOBAL, 'MESSAGE_STATES.REVOKED_GLOBAL exists');
  assertNotNull(RA.MESSAGE_STATES.DELETED_LOCAL, 'MESSAGE_STATES.DELETED_LOCAL exists');
  assertNotNull(RA.MESSAGE_STATES.EDITED, 'MESSAGE_STATES.EDITED exists');
  assertEquals(RA.MESSAGE_STATES.REVOKED_GLOBAL, 'revoked_global', 'REVOKED_GLOBAL value');
  assertEquals(RA.MESSAGE_STATES.DELETED_LOCAL, 'deleted_local', 'DELETED_LOCAL value');
  assertEquals(RA.MESSAGE_STATES.EDITED, 'edited', 'EDITED value');
  
  console.log('\n--- Phase 1: REVOKED_UNIVERSE_STATES Constants ---');
  assertNotNull(RA.REVOKED_UNIVERSE_STATES, 'REVOKED_UNIVERSE_STATES exists');
  assertTrue(Array.isArray(RA.REVOKED_UNIVERSE_STATES), 'REVOKED_UNIVERSE_STATES is array');
  assertTrue(RA.REVOKED_UNIVERSE_STATES.includes('revoked_global'), 'Includes REVOKED_GLOBAL');
  assertTrue(RA.REVOKED_UNIVERSE_STATES.includes('deleted_local'), 'Includes DELETED_LOCAL');
  assertTrue(RA.REVOKED_UNIVERSE_STATES.includes('edited'), 'Includes EDITED');
  
  console.log('\n--- Phase 1: registerMessageEvent Function ---');
  assertNotNull(RA.registerMessageEvent, 'registerMessageEvent function exists');
  
  // Test registering a message
  const testMsg = {
    id: 'test-msg-001',
    from: '5511987654321',
    to: '5511123456789',
    body: 'Test message',
    type: 'chat',
    timestamp: Date.now()
  };
  
  const entry = RA.registerMessageEvent(testMsg, RA.MESSAGE_STATES.CREATED, 'test_origin');
  assertNotNull(entry, 'registerMessageEvent returns entry');
  assertEquals(entry.id, 'test-msg-001', 'Entry has correct ID');
  assertTrue(Array.isArray(entry.history), 'Entry has history array');
  assertTrue(entry.history.length > 0, 'History has at least one entry');
  assertEquals(entry.history[0].state, RA.MESSAGE_STATES.CREATED, 'First history entry has correct state');
  assertEquals(entry.history[0].origin, 'test_origin', 'First history entry has correct origin');
  
  console.log('\n--- Phase 1: Query Functions ---');
  assertNotNull(RA.getMessageHistory, 'getMessageHistory function exists');
  assertNotNull(RA.getCurrentState, 'getCurrentState function exists');
  assertNotNull(RA.isInRevokedUniverse, 'isInRevokedUniverse function exists');
  assertNotNull(RA.getRevokedUniverseMessages, 'getRevokedUniverseMessages function exists');
  
  // Test getMessageHistory
  const history = RA.getMessageHistory('test-msg-001');
  assertNotNull(history, 'getMessageHistory returns data');
  assertEquals(history.id, 'test-msg-001', 'getMessageHistory returns correct message');
  
  // Test getCurrentState
  const currentState = RA.getCurrentState('test-msg-001');
  assertEquals(currentState, RA.MESSAGE_STATES.CREATED, 'getCurrentState returns correct state');
  
  // Test adding another event to same message
  RA.registerMessageEvent({ ...testMsg }, RA.MESSAGE_STATES.REVOKED_GLOBAL, 'test_revoke');
  const updatedHistory = RA.getMessageHistory('test-msg-001');
  assertEquals(updatedHistory.history.length, 2, 'Message now has 2 history entries');
  assertEquals(RA.getCurrentState('test-msg-001'), RA.MESSAGE_STATES.REVOKED_GLOBAL, 'Current state updated to REVOKED_GLOBAL');
  
  // Test isInRevokedUniverse
  assertTrue(RA.isInRevokedUniverse('test-msg-001'), 'Message is in revoked universe');
  
  // Test getRevokedUniverseMessages
  const revokedMessages = RA.getRevokedUniverseMessages();
  assertTrue(Array.isArray(revokedMessages), 'getRevokedUniverseMessages returns array');
  assertTrue(revokedMessages.length > 0, 'Revoked universe has messages');
  
  // ========================================
  // PHASE 2: Enhanced Phone Extraction Tests
  // ========================================
  
  console.log('\n--- Phase 2: cleanPhoneNumber Function ---');
  assertNotNull(RA.cleanPhoneNumber, 'cleanPhoneNumber function exists');
  assertEquals(RA.cleanPhoneNumber('5511987654321@c.us'), '5511987654321', 'Remove @c.us suffix');
  assertEquals(RA.cleanPhoneNumber('5511987654321@s.whatsapp.net'), '5511987654321', 'Remove @s.whatsapp.net suffix');
  assertEquals(RA.cleanPhoneNumber('5511987654321@g.us'), '5511987654321', 'Remove @g.us suffix');
  assertEquals(RA.cleanPhoneNumber('5511987654321@lid'), '5511987654321', 'Remove @lid suffix');
  assertEquals(RA.cleanPhoneNumber('(55) 11 98765-4321'), '5511987654321', 'Remove non-digits');
  
  console.log('\n--- Phase 2: isValidPhoneNumber Function ---');
  assertNotNull(RA.isValidPhoneNumber, 'isValidPhoneNumber function exists');
  assertTrue(RA.isValidPhoneNumber('5511987654321'), 'Valid 13-digit number');
  assertTrue(RA.isValidPhoneNumber('11987654321'), 'Valid 11-digit number');
  assertTrue(RA.isValidPhoneNumber('12345678'), 'Valid 8-digit number');
  assertFalse(RA.isValidPhoneNumber('1234567'), 'Invalid - too short (7 digits)');
  assertFalse(RA.isValidPhoneNumber('1234567890123456'), 'Invalid - too long (16 digits)');
  assertFalse(RA.isValidPhoneNumber(''), 'Invalid - empty string');
  assertFalse(RA.isValidPhoneNumber(null), 'Invalid - null');
  
  console.log('\n--- Phase 2: extractPhoneNumber Function ---');
  assertNotNull(RA.extractPhoneNumber, 'extractPhoneNumber function exists');
  
  // Test with simple string
  assertEquals(RA.extractPhoneNumber('5511987654321@c.us'), '5511987654321', 'Extract from string with suffix');
  
  // Test with object
  assertEquals(RA.extractPhoneNumber({ _serialized: '5511987654321@c.us' }), '5511987654321', 'Extract from object with _serialized');
  assertEquals(RA.extractPhoneNumber({ user: '5511987654321' }), '5511987654321', 'Extract from object with user');
  
  // Test with nested object
  const nestedObj = {
    from: {
      _serialized: '5511987654321@c.us'
    }
  };
  assertEquals(RA.extractPhoneNumber(nestedObj), '5511987654321', 'Extract from nested object');
  
  // Test with invalid input
  assertEquals(RA.extractPhoneNumber(null), 'Desconhecido', 'Return Desconhecido for null');
  assertEquals(RA.extractPhoneNumber('invalid'), 'Desconhecido', 'Return Desconhecido for invalid');
  
  console.log('\n--- Phase 2: extractChatId Function ---');
  assertNotNull(RA.extractChatId, 'extractChatId function exists');
  
  const msgWithChatId = {
    chatId: '5511987654321@c.us'
  };
  assertEquals(RA.extractChatId(msgWithChatId), '5511987654321@c.us', 'Extract chatId from message');
  
  const msgWithChat = {
    chat: {
      id: {
        _serialized: '5511987654321@c.us'
      }
    }
  };
  assertEquals(RA.extractChatId(msgWithChat), '5511987654321@c.us', 'Extract chatId from nested chat object');
  
  console.log('\n--- Phase 2: getOwner Function ---');
  assertNotNull(RA.getOwner, 'getOwner function exists');
  // Note: getOwner might return null if not on WhatsApp Web or owner not detected
  // This is expected behavior
  const owner = RA.getOwner();
  console.log(`  Owner detected: ${owner || 'null (expected if not on WhatsApp Web)'}`);
  
  console.log('\n--- Phase 2: determineDirection Function ---');
  assertNotNull(RA.determineDirection, 'determineDirection function exists');
  
  const testMsgWithDirection = {
    id: 'test-msg-002',
    from: '5511987654321',
    to: '5511123456789',
    fromMe: false,
    body: 'Test message for direction',
    type: 'chat'
  };
  
  const direction = RA.determineDirection(testMsgWithDirection);
  assertTrue(['incoming', 'outgoing', 'third_party', 'unknown'].includes(direction), 
    `Direction is valid value: ${direction}`);
  
  console.log('\n--- Phase 2: Filter Integration ---');
  
  // Test that setFilter supports new filters
  assertNotNull(RA.setFilter, 'setFilter function exists');
  assertNotNull(RA.getFilters, 'getFilters function exists');
  
  // Set direction filter
  RA.setFilter('direction', 'incoming');
  const filters1 = RA.getFilters();
  assertEquals(filters1.direction, 'incoming', 'Direction filter set correctly');
  
  // Set state filter
  RA.setFilter('state', 'revoked_global');
  const filters2 = RA.getFilters();
  assertEquals(filters2.state, 'revoked_global', 'State filter set correctly');
  
  // Reset filters
  RA.setFilter('direction', 'all');
  RA.setFilter('state', 'all');
  
  // ========================================
  // Summary
  // ========================================
  
  console.log('\n======================');
  console.log(`Total tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log('======================\n');
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Check details above.');
  }
  
  // Return test results
  return {
    total: tests.length,
    passed,
    failed,
    successRate: (passed / tests.length) * 100,
    tests
  };
})();
