/**
 * Testes para o ContactManager
 * Executar no console do navegador na página do WhatsApp Web
 */

(function() {
  'use strict';
  
  console.log('=== ContactManager Tests ===\n');
  
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
  
  // Check if ContactManager is loaded
  if (typeof window.ContactManager === 'undefined') {
    console.error('❌ ContactManager not found! Make sure the module is loaded.');
    return;
  }
  
  const cm = window.ContactManager;
  
  // Test 1: Normalização de telefone
  console.log('\n--- Test Group: normalizePhone ---');
  assertEquals(cm.normalizePhone('11987654321'), '5511987654321', 'Normalize BR mobile (11 digits)');
  assertEquals(cm.normalizePhone('1134567890'), '551134567890', 'Normalize BR landline (10 digits)');
  assertEquals(cm.normalizePhone('5511987654321'), '5511987654321', 'Already normalized phone');
  assertEquals(cm.normalizePhone('123'), null, 'Too short number');
  assertEquals(cm.normalizePhone(''), null, 'Empty string');
  
  // Test 2: Adicionar contato
  console.log('\n--- Test Group: addContact ---');
  const contact1 = cm.addContact('5511987654321', { name: 'Test User', email: 'test@example.com' });
  assertTrue(contact1 !== null, 'Add contact returns contact object');
  assertEquals(contact1.phone, '5511987654321', 'Contact phone is normalized');
  assertEquals(contact1.name, 'Test User', 'Contact name is set');
  
  // Test 3: Obter contato
  console.log('\n--- Test Group: getContact ---');
  const retrieved = cm.getContact('5511987654321');
  assertTrue(retrieved !== null, 'Get contact returns contact');
  assertEquals(retrieved.phone, '5511987654321', 'Retrieved contact has correct phone');
  
  // Test 4: Blacklist
  console.log('\n--- Test Group: Blacklist ---');
  assertTrue(cm.addToBlacklist('5511999999999', 'Spam'), 'Add to blacklist returns true');
  assertTrue(cm.isBlacklisted('5511999999999'), 'Contact is blacklisted');
  assertFalse(cm.isBlacklisted('5511987654321'), 'Other contact is not blacklisted');
  assertTrue(cm.removeFromBlacklist('5511999999999'), 'Remove from blacklist returns true');
  assertFalse(cm.isBlacklisted('5511999999999'), 'Contact is no longer blacklisted');
  
  // Test 5: Whitelist
  console.log('\n--- Test Group: Whitelist ---');
  assertTrue(cm.addToWhitelist('5511888888888'), 'Add to whitelist returns true');
  
  // Test 6: Tags
  console.log('\n--- Test Group: Tags ---');
  assertTrue(cm.addTag('5511987654321', 'cliente'), 'Add tag returns true');
  assertTrue(cm.addTag('5511987654321', 'vip'), 'Add second tag returns true');
  const contact = cm.getContact('5511987654321');
  assertTrue(contact.tags.includes('cliente'), 'Contact has first tag');
  assertTrue(contact.tags.includes('vip'), 'Contact has second tag');
  
  const taggedContacts = cm.getContactsByTag('cliente');
  assertTrue(taggedContacts.length > 0, 'Get contacts by tag returns results');
  
  assertTrue(cm.removeTag('5511987654321', 'vip'), 'Remove tag returns true');
  const updatedContact = cm.getContact('5511987654321');
  assertFalse(updatedContact.tags.includes('vip'), 'Tag is removed');
  
  // Test 7: Histórico de interações
  console.log('\n--- Test Group: Interaction History ---');
  const interaction = cm.recordInteraction('5511987654321', {
    type: 'message',
    direction: 'outgoing',
    content: 'Test message'
  });
  assertTrue(interaction !== null, 'Record interaction returns record');
  
  const history = cm.getHistory('5511987654321');
  assertTrue(history.length > 0, 'Get history returns records');
  assertEquals(history[0].content, 'Test message', 'History record has correct content');
  
  // Test 8: Busca de contatos
  console.log('\n--- Test Group: searchContacts ---');
  cm.addContact('5511888888888', { name: 'John Doe', email: 'john@example.com' });
  const searchResults = cm.searchContacts('john');
  assertTrue(searchResults.length > 0, 'Search returns results');
  assertTrue(searchResults[0].name.toLowerCase().includes('john'), 'Search result matches query');
  
  // Test 9: Filtros avançados
  console.log('\n--- Test Group: filterContacts ---');
  cm.addContact('5511777777777', { name: 'Jane Doe', tags: ['cliente', 'premium'] });
  const filtered = cm.filterContacts({ tags: ['cliente'] });
  assertTrue(filtered.length >= 2, 'Filter by tag returns results');
  
  // Test 10: Parse CSV
  console.log('\n--- Test Group: parseCSVLine ---');
  const csvLine = '"John Doe","5511987654321","john@example.com"';
  const parsed = cm.parseCSVLine(csvLine);
  assertEquals(parsed[0], 'John Doe', 'Parse CSV extracts first field');
  assertEquals(parsed[1], '5511987654321', 'Parse CSV extracts second field');
  assertEquals(parsed[2], 'john@example.com', 'Parse CSV extracts third field');
  
  // Test 11: Estatísticas
  console.log('\n--- Test Group: getStats ---');
  const stats = cm.getStats();
  assertTrue(stats.totalContacts > 0, 'Stats show total contacts');
  assertTrue(typeof stats.blacklisted === 'number', 'Stats show blacklist count');
  assertTrue(typeof stats.whitelisted === 'number', 'Stats show whitelist count');
  
  // Test 12: Update contact
  console.log('\n--- Test Group: updateContact ---');
  const updated = cm.updateContact('5511987654321', { name: 'Updated Name' });
  assertTrue(updated !== null, 'Update contact returns contact');
  assertEquals(updated.name, 'Updated Name', 'Contact name is updated');
  
  // Test 13: List contacts with pagination
  console.log('\n--- Test Group: listContacts ---');
  const list = cm.listContacts({ page: 1, limit: 10 });
  assertTrue(list.contacts.length > 0, 'List contacts returns results');
  assertTrue(typeof list.total === 'number', 'List has total count');
  assertTrue(typeof list.page === 'number', 'List has page number');
  
  // Test 14: List tags
  console.log('\n--- Test Group: listTags ---');
  const tagsList = cm.listTags();
  assertTrue(Array.isArray(tagsList), 'List tags returns array');
  if (tagsList.length > 0) {
    assertTrue(typeof tagsList[0].tag === 'string', 'Tag has name');
    assertTrue(typeof tagsList[0].count === 'number', 'Tag has count');
  }
  
  // Test 15: Delete contact
  console.log('\n--- Test Group: deleteContact ---');
  cm.addContact('5511666666666', { name: 'To Delete' });
  assertTrue(cm.deleteContact('5511666666666'), 'Delete contact returns true');
  assertEquals(cm.getContact('5511666666666'), null, 'Deleted contact no longer exists');
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Review the output above.');
  }
  
  // Store results globally for inspection
  window.ContactManager_TestResults = tests;
  
})();
