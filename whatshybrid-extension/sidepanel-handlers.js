/**
 * Sidepanel Inline Scripts - Movido para arquivo separado por CSP
 * WhatsHybrid v6.8.2
 */

// Initialize all modules after page load
window.addEventListener('load', async function() {
    console.log('[Modules] Inicializando módulos v53...');
    
    // Aguarda módulos estarem carregados via init.js
    // O init.js já faz a inicialização automática
    
    // Onboarding
    setTimeout(function() {
        if (typeof OnboardingSystem !== 'undefined') {
            const onboarding = new OnboardingSystem();
            if (onboarding.shouldShow()) {
                onboarding.start();
            }
            window.whlOnboarding = onboarding;
        }
    }, 500);

    // Garantir renderização após 1 segundo
    setTimeout(function() {
        if (typeof window.renderModuleViews === 'function') {
            console.log('[Modules] Chamando renderModuleViews após load...');
            window.renderModuleViews();
        }
    }, 1000);
});

// Atualiza estatísticas de tarefas
function updateTasksStats() {
    if (!window.TasksModule) return;
    const stats = window.TasksModule.getStats();
    
    const el1 = document.getElementById('stat_total');
    const el2 = document.getElementById('stat_pending');
    const el3 = document.getElementById('stat_overdue');
    const el4 = document.getElementById('stat_completed');
    
    if (el1) el1.textContent = stats.total || 0;
    if (el2) el2.textContent = stats.pending || 0;
    if (el3) el3.textContent = stats.overdue || 0;
    if (el4) el4.textContent = stats.completed || 0;
}

// Setup eventos dos botões
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Sidepanel] DOMContentLoaded - configurando handlers...');

    // CRM Header button - Abrir em nova aba
    const btnCrmHeader = document.getElementById('btnOpenCrmFullscreen');
    if (btnCrmHeader) {
        btnCrmHeader.addEventListener('click', () => {
            console.log('[Sidepanel] Abrindo CRM em nova aba...');
            chrome.tabs.create({ url: chrome.runtime.getURL('crm/crm.html') });
        });
        console.log('[Sidepanel] ✅ Handler btnOpenCrmFullscreen configurado');
    }

    // CRM Fullscreen button - Abrir em nova aba
    const btnCrmFullscreen = document.getElementById('crm_open_fullscreen');
    if (btnCrmFullscreen) {
        btnCrmFullscreen.addEventListener('click', () => {
            console.log('[Sidepanel] Abrindo CRM em nova aba (fullscreen)...');
            chrome.tabs.create({ url: chrome.runtime.getURL('crm/crm.html') });
        });
        console.log('[Sidepanel] ✅ Handler crm_open_fullscreen configurado');
    }

    // CRM buttons
    document.getElementById('crm_new_deal')?.addEventListener('click', () => {
        // Tentar função global primeiro, depois módulo
        if (window.showNewDealModal) {
            window.showNewDealModal();
        } else if (window.CRMModule?.showDealModal) {
            window.CRMModule.showDealModal();
        } else {
            console.warn('[Sidepanel] Nenhuma função de modal de negócio disponível');
        }
    });

    document.getElementById('crm_new_contact')?.addEventListener('click', () => {
        // Tentar função global primeiro, depois módulo
        if (window.showNewContactModal) {
            window.showNewContactModal();
        } else if (window.CRMModule?.showContactModal) {
            window.CRMModule.showContactModal();
        } else {
            console.warn('[Sidepanel] Nenhuma função de modal de contato disponível');
        }
    });

    document.getElementById('crm_refresh')?.addEventListener('click', async () => {
        if (window.CRMModule?.reloadData) {
            await window.CRMModule.reloadData();
        }
        if (window.renderModuleViews) {
            window.renderModuleViews();
        }
    });

    // Analytics buttons
    document.getElementById('analytics_refresh')?.addEventListener('click', () => {
        if (window.renderModuleViews) window.renderModuleViews();
        if (window.NotificationsModule) {
            window.NotificationsModule.success('Dashboard atualizado!');
        }
    });

    document.getElementById('analytics_reset')?.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja resetar todas as métricas? Esta ação não pode ser desfeita.')) {
            if (window.AnalyticsModule) {
                await window.AnalyticsModule.resetAll();
                if (window.renderModuleViews) window.renderModuleViews();
                if (window.NotificationsModule) {
                    window.NotificationsModule.success('Métricas resetadas!');
                }
            }
        }
    });

    // AI Test buttons
    document.getElementById('ai_test_btn')?.addEventListener('click', async () => {
        const input = document.getElementById('ai_test_input')?.value?.trim();
        if (!input) return;

        if (!window.SmartRepliesModule?.isConfigured()) {
            alert('Configure o provedor de IA primeiro');
            return;
        }

        try {
            document.getElementById('ai_test_btn').disabled = true;
            document.getElementById('ai_test_btn').textContent = '⏳ Gerando...';

            const reply = await window.SmartRepliesModule.generateReply('test', [
                { role: 'user', content: input }
            ]);

            document.getElementById('ai_test_output').style.display = 'block';
            document.getElementById('ai_test_result').textContent = reply;
        } catch (error) {
            alert('Erro ao gerar resposta: ' + error.message);
        } finally {
            document.getElementById('ai_test_btn').disabled = false;
            document.getElementById('ai_test_btn').textContent = '🚀 Gerar Resposta';
        }
    });

    document.getElementById('ai_correct_btn')?.addEventListener('click', async () => {
        const input = document.getElementById('ai_test_input')?.value?.trim();
        if (!input) return;

        if (!window.SmartRepliesModule?.isConfigured()) {
            alert('Configure o provedor de IA primeiro');
            return;
        }

        try {
            document.getElementById('ai_correct_btn').disabled = true;
            document.getElementById('ai_correct_btn').textContent = '⏳...';

            const result = await window.SmartRepliesModule.correctText(input);

            document.getElementById('ai_test_output').style.display = 'block';
            document.getElementById('ai_test_result').innerHTML = result.hasChanges 
                ? '<strong>Corrigido:</strong><br>' + result.corrected
                : '<em>Texto já está correto!</em>';
        } catch (error) {
            alert('Erro ao corrigir texto: ' + error.message);
        } finally {
            document.getElementById('ai_correct_btn').disabled = false;
            document.getElementById('ai_correct_btn').textContent = '✏️ Corrigir Texto';
        }
    });

    // Dispatch settings buttons
    document.getElementById('sp_save_settings')?.addEventListener('click', async () => {
        const delayMin = parseFloat(document.getElementById('sp_delay_min')?.value) || 2;
        const delayMax = parseFloat(document.getElementById('sp_delay_max')?.value) || 6;
        
        try {
            await chrome.storage.local.set({
                whl_delay_min: delayMin,
                whl_delay_max: delayMax
            });
            
            const statusEl = document.getElementById('sp_config_status');
            if (statusEl) {
                statusEl.textContent = '✅ Configurações salvas!';
                setTimeout(() => statusEl.textContent = 'Pronto.', 2000);
            }
        } catch (error) {
            console.error('[Sidepanel] Erro ao salvar configurações:', error);
            alert('Erro ao salvar configurações: ' + error.message);
        }
    });

    document.getElementById('sp_reload_settings')?.addEventListener('click', async () => {
        try {
            const { whl_delay_min, whl_delay_max } = await chrome.storage.local.get(['whl_delay_min', 'whl_delay_max']);
            
            const minEl = document.getElementById('sp_delay_min');
            const maxEl = document.getElementById('sp_delay_max');
            
            if (minEl) minEl.value = whl_delay_min || 2;
            if (maxEl) maxEl.value = whl_delay_max || 6;
            
            const statusEl = document.getElementById('sp_config_status');
            if (statusEl) {
                statusEl.textContent = '✅ Configurações recarregadas!';
                setTimeout(() => statusEl.textContent = 'Pronto.', 2000);
            }
        } catch (error) {
            console.error('[Sidepanel] Erro ao recarregar configurações:', error);
            alert('Erro ao recarregar configurações: ' + error.message);
        }
    });

    // Scheduler button
    document.getElementById('sp_add_schedule')?.addEventListener('click', async () => {
        if (window.addSchedule) {
            await window.addSchedule();
        } else {
            console.warn('[Sidepanel] addSchedule function not available');
        }
    });

    // Anti-ban buttons
    document.getElementById('sp_save_antiban')?.addEventListener('click', async () => {
        if (window.saveAntiBanSettings) {
            await window.saveAntiBanSettings();
        } else {
            console.warn('[Sidepanel] saveAntiBanSettings function not available');
        }
    });

    document.getElementById('sp_reset_daily_count')?.addEventListener('click', async () => {
        if (confirm('Resetar o contador diário de mensagens?')) {
            try {
                await chrome.storage.local.set({ whl_daily_count: 0, whl_daily_count_date: new Date().toDateString() });
                alert('Contador resetado!');
            } catch (error) {
                console.error('[Sidepanel] Erro ao resetar contador:', error);
                alert('Erro ao resetar contador: ' + error.message);
            }
        }
    });

    // Notification test button
    document.getElementById('sp_test_notification')?.addEventListener('click', async () => {
        if (window.testNotification) {
            await window.testNotification();
        } else {
            console.warn('[Sidepanel] testNotification function not available');
        }
    });

    // Template save button
    document.getElementById('sp_save_draft')?.addEventListener('click', async () => {
        if (window.saveDraft) {
            await window.saveDraft();
        } else {
            console.warn('[Sidepanel] saveDraft function not available');
        }
    });

    // Report buttons
    document.getElementById('sp_export_report')?.addEventListener('click', async () => {
        if (window.exportReportCSV) {
            await window.exportReportCSV();
        } else {
            console.warn('[Sidepanel] exportReportCSV function not available');
        }
    });

    document.getElementById('sp_copy_failed')?.addEventListener('click', async () => {
        if (window.copyFailedNumbers) {
            await window.copyFailedNumbers();
        } else {
            console.warn('[Sidepanel] copyFailedNumbers function not available');
        }
    });

    console.log('[Sidepanel] ✅ Todos os handlers configurados');
});
