/**
 * Campaign Manager Tests
 * Run this in browser console on WhatsApp Web page to test
 */

(function() {
  'use strict';
  
  console.log('=== Campaign Manager Tests ===\n');
  
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
  
  // Test 1: CampaignManager exists
  assertNotNull(window.CampaignManager, 'CampaignManager should be globally available');
  
  // Test 2: normalizePhone with Brazilian format
  const normalized1 = window.CampaignManager.normalizePhone('11999999999');
  assertEquals(normalized1, '5511999999999', 'Should normalize 11-digit number to include country code');
  
  // Test 3: normalizePhone with country code already present
  const normalized2 = window.CampaignManager.normalizePhone('5511999999999');
  assertEquals(normalized2, '5511999999999', 'Should keep 13-digit number with country code');
  
  // Test 4: normalizePhone with 10 digits
  const normalized3 = window.CampaignManager.normalizePhone('1199999999');
  assertEquals(normalized3, '551199999999', 'Should normalize 10-digit number');
  
  // Test 5: normalizePhone with invalid number
  const normalized4 = window.CampaignManager.normalizePhone('123');
  assertEquals(normalized4, null, 'Should return null for invalid number');
  
  // Test 6: parseCSVLine with simple values
  const csvLine1 = 'John Doe,11999999999,john@example.com';
  const parsed1 = window.CampaignManager.parseCSVLine(csvLine1);
  assertEquals(parsed1, ['John Doe', '11999999999', 'john@example.com'], 'Should parse simple CSV line');
  
  // Test 7: parseCSVLine with quoted values
  const csvLine2 = '"John, Jr.",11999999999,"john@example.com"';
  const parsed2 = window.CampaignManager.parseCSVLine(csvLine2);
  assertEquals(parsed2, ['John, Jr.', '11999999999', 'john@example.com'], 'Should parse quoted CSV values');
  
  // Test 8: processTemplate with variables
  const template = 'Olá {nome}, seu telefone é {telefone}';
  const contact = { name: 'João Silva', phone: '5511999999999', variables: {} };
  const processed = window.CampaignManager.processTemplate(template, contact);
  assertTrue(processed.includes('João Silva'), 'Should replace {nome} variable');
  assertTrue(processed.includes('5511999999999'), 'Should replace {telefone} variable');
  
  // Test 9: processTemplate with primeiro_nome
  const template2 = 'Oi {primeiro_nome}!';
  const processed2 = window.CampaignManager.processTemplate(template2, contact);
  assertTrue(processed2.includes('João'), 'Should extract first name from full name');
  
  // Test 10: processTemplate with custom variables
  const template3 = 'Olá {nome}, seu pedido #{pedido} está pronto';
  const contact2 = { 
    name: 'Maria',
    phone: '5511888888888',
    variables: { pedido: '12345' }
  };
  const processed3 = window.CampaignManager.processTemplate(template3, contact2);
  assertTrue(processed3.includes('12345'), 'Should replace custom variable {pedido}');
  
  // Test 11: isSafeHour
  const hour = new Date().getHours();
  const isSafe = window.CampaignManager.isSafeHour();
  if (hour >= 8 && hour <= 20) {
    assertTrue(isSafe, 'Should return true during safe hours (8h-20h)');
  } else {
    assertEquals(isSafe, false, 'Should return false outside safe hours');
  }
  
  // Test 12: getRandomDelay
  const delay = window.CampaignManager.getRandomDelay({ min: 1000, max: 2000 });
  assertTrue(delay >= 1000 && delay <= 2000, 'Random delay should be within specified range');
  
  // Test 13: generateCampaignId
  const id = window.CampaignManager.generateCampaignId();
  assertTrue(id.startsWith('camp_'), 'Campaign ID should start with camp_');
  assertTrue(id.length > 10, 'Campaign ID should be reasonably long');
  
  // Test 14: Create campaign
  async function testCreateCampaign() {
    const testName = 'Should create campaign';
    try {
      const campaign = await window.CampaignManager.createCampaign('Test Campaign', {
        template: 'Hello {nome}',
        delay: { min: 30000, max: 60000 }
      });
      assertNotNull(campaign, testName + ' - campaign object');
      assertEquals(campaign.status, 'draft', testName + ' - status should be draft');
      assertEquals(campaign.name, 'Test Campaign', testName + ' - name should match');
      assertTrue(campaign.id.startsWith('camp_'), testName + ' - should have valid ID');
    } catch (error) {
      console.error('Error in testCreateCampaign:', error);
      tests.push({ testName, success: false, actual: error.message, expected: 'no error' });
      failed++;
    }
  }
  
  // Test 15: List campaigns
  async function testListCampaigns() {
    const testName = 'Should list campaigns';
    try {
      const campaigns = await window.CampaignManager.listCampaigns();
      assertTrue(Array.isArray(campaigns), testName + ' - should return array');
    } catch (error) {
      console.error('Error in testListCampaigns:', error);
      tests.push({ testName, success: false, actual: error.message, expected: 'no error' });
      failed++;
    }
  }
  
  // Run async tests
  (async () => {
    await testCreateCampaign();
    await testListCampaigns();
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${tests.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️ Some tests failed. Check details above.');
    }
  })();
  
})();
