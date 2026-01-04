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

    // ============================================
    // QUICK REPLIES HANDLERS - with storage-based implementation
    // ============================================
    
    const QUICK_REPLIES_STORAGE_KEY = 'whl_quick_replies';
    
    async function loadQuickReplies() {
        try {
            const data = await chrome.storage.local.get(QUICK_REPLIES_STORAGE_KEY);
            return data[QUICK_REPLIES_STORAGE_KEY] || [];
        } catch (e) {
            console.error('[QuickReplies] Error loading:', e);
            return [];
        }
    }
    
    async function saveQuickReplies(replies) {
        try {
            await chrome.storage.local.set({ [QUICK_REPLIES_STORAGE_KEY]: replies });
            return true;
        } catch (e) {
            console.error('[QuickReplies] Error saving:', e);
            return false;
        }
    }
    
    async function addQuickReply(trigger, response) {
        const replies = await loadQuickReplies();
        const cleanTrigger = trigger.toLowerCase().replace(/^\//, '');
        
        // Check for duplicates
        if (replies.some(r => r.trigger === cleanTrigger)) {
            throw new Error('Gatilho já existe');
        }
        
        const newReply = {
            id: `qr_${Date.now()}`,
            trigger: cleanTrigger,
            response: response,
            usageCount: 0,
            createdAt: new Date().toISOString()
        };
        
        replies.push(newReply);
        await saveQuickReplies(replies);
        return newReply;
    }
    
    async function deleteQuickReplyById(id) {
        const replies = await loadQuickReplies();
        const filtered = replies.filter(r => r.id !== id);
        await saveQuickReplies(filtered);
    }
    
    // Add quick reply
    document.getElementById('qr-add-btn')?.addEventListener('click', async () => {
        const trigger = document.getElementById('qr-trigger')?.value.trim();
        const response = document.getElementById('qr-response')?.value.trim();
        const btn = document.getElementById('qr-add-btn');
        
        if (!trigger || !response) {
            if (btn) {
                btn.textContent = '❌ Preencha campos!';
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar Resposta Rápida';
                }, 2000);
            }
            return;
        }
        
        try {
            if (btn) btn.textContent = '⏳ Salvando...';
            await addQuickReply(trigger, response);
            document.getElementById('qr-trigger').value = '';
            document.getElementById('qr-response').value = '';
            await renderQuickRepliesList();
            if (btn) {
                btn.textContent = '✅ Adicionada!';
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar Resposta Rápida';
                }, 2000);
            }
        } catch (e) {
            if (btn) {
                btn.textContent = `❌ ${e.message}`;
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar Resposta Rápida';
                }, 3000);
            }
        }
    });

    // ============================================
    // TEAM SYSTEM HANDLERS
    // ============================================
    
    // Sender name input
    document.getElementById('team-sender-name')?.addEventListener('change', async (e) => {
        await window.teamSystem?.setSenderName(e.target.value);
        console.log('[TeamSystem] Nome do remetente salvo:', e.target.value);
    });
    
    // Add team member
    document.getElementById('team-add-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('team-member-name')?.value.trim();
        const phone = document.getElementById('team-member-phone')?.value.trim();
        const btn = document.getElementById('team-add-btn');
        
        if (!phone) {
            if (btn) {
                btn.textContent = '❌ Número!';
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar';
                }, 2000);
            }
            return;
        }
        
        try {
            if (btn) btn.textContent = '⏳ Salvando...';
            await window.teamSystem?.addMember(name, phone);
            document.getElementById('team-member-name').value = '';
            document.getElementById('team-member-phone').value = '';
            renderTeamMembersList();
            renderTeamStats();
            if (btn) {
                btn.textContent = '✅ Adicionado!';
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar';
                }, 2000);
            }
        } catch (e) {
            if (btn) {
                btn.textContent = '❌ Erro!';
                setTimeout(() => {
                    btn.textContent = '➕ Adicionar';
                }, 3000);
            }
        }
    });
    
    // Select all members
    document.getElementById('team-select-all')?.addEventListener('click', () => {
        window.teamSystem?.selectAll();
        renderTeamMembersList();
        renderTeamStats();
    });
    
    // Clear selection
    document.getElementById('team-clear-selection')?.addEventListener('click', () => {
        window.teamSystem?.clearSelection();
        renderTeamMembersList();
        renderTeamStats();
    });
    
    // Send to team
    document.getElementById('team-send-btn')?.addEventListener('click', async () => {
        const message = document.getElementById('team-message')?.value.trim();
        const statusEl = document.getElementById('team-send-status');
        const btn = document.getElementById('team-send-btn');
        
        if (!message) {
            if (statusEl) {
                statusEl.textContent = '❌ Digite uma mensagem';
                statusEl.className = 'sp-status';
            }
            return;
        }
        
        const selected = window.teamSystem?.getSelected() || [];
        if (selected.length === 0) {
            if (statusEl) {
                statusEl.textContent = '❌ Selecione pelo menos um membro';
                statusEl.className = 'sp-status';
            }
            return;
        }
        
        // Simple confirmation via button feedback instead of blocking alert
        if (btn && !btn.dataset.confirmed) {
            btn.textContent = `⚠️ Confirmar envio para ${selected.length} membro(s)?`;
            btn.dataset.confirmed = 'pending';
            setTimeout(() => {
                if (btn.dataset.confirmed === 'pending') {
                    btn.textContent = '📤 Enviar para Selecionados';
                    delete btn.dataset.confirmed;
                }
            }, 3000);
            return;
        }
        
        if (btn) {
            delete btn.dataset.confirmed;
            btn.textContent = '⏳ Enviando...';
            btn.disabled = true;
        }
        
        if (statusEl) {
            statusEl.textContent = `⏳ Enviando para ${selected.length} membro(s)...`;
            statusEl.className = 'sp-status';
        }
        
        try {
            const results = await window.teamSystem?.sendToTeam(message);
            if (statusEl) {
                statusEl.textContent = `✅ Enviado: ${results.success}/${results.total} | ❌ Falhas: ${results.failed}`;
                statusEl.className = 'sp-status';
            }
            if (btn) {
                btn.textContent = '✅ Concluído!';
                setTimeout(() => {
                    btn.textContent = '📤 Enviar para Selecionados';
                    btn.disabled = false;
                }, 2000);
            }
            document.getElementById('team-message').value = '';
            renderTeamMembersList();
            renderTeamStats();
            
            // Show details if there were failures
            if (results.failed > 0) {
                const failedDetails = results.details
                    .filter(d => d.status === 'failed')
                    .map(d => `${d.member}: ${d.error || 'Erro desconhecido'}`)
                    .join('\n');
                if (statusEl) {
                    statusEl.textContent += `\n\nDetalhes das falhas:\n${failedDetails}`;
                }
            }
        } catch (e) {
            if (statusEl) {
                statusEl.textContent = `❌ Erro: ${e.message}`;
                statusEl.className = 'sp-status';
            }
            if (btn) {
                btn.textContent = '📤 Enviar para Selecionados';
                btn.disabled = false;
            }
        }
    });

    console.log('[Sidepanel] ✅ Todos os handlers configurados');
});

// ============================================
// RENDER FUNCTIONS FOR NEW FEATURES
// ============================================

async function renderQuickRepliesList() {
    const list = document.getElementById('qr-list');
    const countEl = document.getElementById('qr-count');
    const replies = await loadQuickReplies();
    
    if (countEl) {
        countEl.textContent = `${replies.length} resposta${replies.length !== 1 ? 's' : ''}`;
    }
    
    if (!list) return;
    
    if (replies.length === 0) {
        list.innerHTML = '<div class="sp-muted" style="text-align: center; padding: 20px;">Nenhuma resposta rápida cadastrada</div>';
        await updateQuickRepliesStats();
        return;
    }
    
    list.innerHTML = replies.map(r => `
        <div class="sp-card" style="margin-bottom: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: var(--mod-primary);">/${r.trigger}</span>
                        <span class="sp-muted" style="font-size: 11px;">Usado ${r.usageCount || 0}x</span>
                    </div>
                    <div style="font-size: 12px; color: var(--mod-text-muted); white-space: pre-wrap; word-break: break-word;">
                        ${escapeHtml(r.response.slice(0, 100))}${r.response.length > 100 ? '...' : ''}
                    </div>
                </div>
                <button class="sp-btn sp-btn-danger" data-id="${r.id}" style="padding: 4px 8px; font-size: 11px;" onclick="deleteQuickReply('${r.id}')">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
    
    await updateQuickRepliesStats();
}

async function updateQuickRepliesStats() {
    const replies = await loadQuickReplies();
    const stats = {
        total: replies.length,
        totalUsage: replies.reduce((sum, r) => sum + (r.usageCount || 0), 0),
        mostUsed: [...replies].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 1)
    };
    
    const totalEl = document.getElementById('qr-stat-total');
    const usageEl = document.getElementById('qr-stat-usage');
    const mostUsedEl = document.getElementById('qr-stat-most-used');
    
    if (totalEl) totalEl.textContent = stats.total;
    if (usageEl) usageEl.textContent = stats.totalUsage;
    if (mostUsedEl) {
        if (stats.mostUsed.length > 0) {
            mostUsedEl.textContent = `/${stats.mostUsed[0].trigger}`;
        } else {
            mostUsedEl.textContent = '-';
        }
    }
}

async function deleteQuickReply(id) {
    // Use inline confirmation instead of blocking alert
    const btn = event?.target;
    if (btn && !btn.dataset.confirmDelete) {
        btn.textContent = '⚠️';
        btn.dataset.confirmDelete = 'pending';
        setTimeout(() => {
            delete btn.dataset.confirmDelete;
            btn.textContent = '🗑️';
        }, 3000);
        return;
    }
    
    try {
        await deleteQuickReplyById(id);
        await renderQuickRepliesList();
    } catch (e) {
        console.error('[QuickReplies] Error deleting:', e);
    }
}
            if (btn.dataset.confirmDelete === 'pending') {
                btn.textContent = '🗑️';
                delete btn.dataset.confirmDelete;
            }
        }, 3000);
        return;
    }
    
    if (btn) delete btn.dataset.confirmDelete;
    
    await window.quickReplies?.removeReply(id);
    renderQuickRepliesList();
}

function renderTeamMembersList() {
    const list = document.getElementById('team-members-list');
    const members = window.teamSystem?.getAll() || [];
    
    if (!list) return;
    
    if (members.length === 0) {
        list.innerHTML = '<div class="sp-muted" style="text-align: center; padding: 20px;">Nenhum membro cadastrado</div>';
        return;
    }
    
    list.innerHTML = members.map(m => `
        <div class="sp-card ${m.selected ? 'selected' : ''}" style="margin-bottom: 6px; padding: 8px; ${m.selected ? 'background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);' : ''}">
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" ${m.selected ? 'checked' : ''} onchange="toggleTeamMember('${m.id}')" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 13px;">
                        ${escapeHtml(m.name || 'Sem nome')}
                    </div>
                    <div style="font-size: 11px; color: var(--mod-text-muted);">
                        ${window.teamSystem?.formatPhone(m.phone) || m.phone}
                    </div>
                    ${m.messagesSent > 0 ? `
                        <div style="font-size: 10px; color: var(--mod-text-muted); margin-top: 2px;">
                            📤 ${m.messagesSent} mensagem${m.messagesSent !== 1 ? 's' : ''} enviada${m.messagesSent !== 1 ? 's' : ''}
                        </div>
                    ` : ''}
                </div>
                <button class="sp-btn sp-btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteTeamMember('${m.id}')">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function renderTeamStats() {
    const stats = window.teamSystem?.getStats();
    if (!stats) return;
    
    const totalEl = document.getElementById('team-stat-total');
    const selectedEl = document.getElementById('team-stat-selected');
    const sentEl = document.getElementById('team-stat-sent');
    
    if (totalEl) totalEl.textContent = stats.totalMembers;
    if (selectedEl) selectedEl.textContent = stats.selectedCount;
    if (sentEl) sentEl.textContent = stats.totalMessagesSent;
}

function toggleTeamMember(id) {
    window.teamSystem?.toggleSelection(id);
    renderTeamMembersList();
    renderTeamStats();
}

async function deleteTeamMember(id) {
    // Use inline confirmation instead of blocking alert
    const btn = event?.target;
    if (btn && !btn.dataset.confirmDelete) {
        btn.textContent = '⚠️';
        btn.dataset.confirmDelete = 'pending';
        setTimeout(() => {
            if (btn.dataset.confirmDelete === 'pending') {
                btn.textContent = '🗑️';
                delete btn.dataset.confirmDelete;
            }
        }, 3000);
        return;
    }
    
    if (btn) delete btn.dataset.confirmDelete;
    
    await window.teamSystem?.removeMember(id);
    renderTeamMembersList();
    renderTeamStats();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize new features when views are loaded
window.addEventListener('load', () => {
    setTimeout(() => {
        // Load sender name
        if (window.teamSystem) {
            const senderNameInput = document.getElementById('team-sender-name');
            if (senderNameInput) {
                senderNameInput.value = window.teamSystem.getSenderName();
            }
        }
        
        // Initial render
        renderQuickRepliesList();
        renderTeamMembersList();
        renderTeamStats();
    }, 1000);
});
