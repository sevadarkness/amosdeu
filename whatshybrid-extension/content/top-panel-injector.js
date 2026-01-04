// top-panel-injector.js - Injects a top panel into WhatsApp Web
// The Top Panel is the main navigation bar and can (re)open the Side Panel
// based on user interaction (Chrome requires a user gesture to open Side Panel).

(function() {
    'use strict';

    console.log('[TopPanel] 🚀 Initializing top panel injector...');

    const TOP_PANEL_ID = 'wa-extractor-top-panel';
    const RESTORE_BTN_ID = 'wa-extractor-restore-btn';

    let autoOpenArmed = false;
    let autoOpenDone = false;

    // Wait for WhatsApp to load
    function waitForWhatsApp() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const whatsappRoot = document.getElementById('app');
                if (whatsappRoot) {
                    clearInterval(checkInterval);
                    console.log('[TopPanel] ✅ WhatsApp loaded, injecting panel...');
                    resolve();
                }
            }, 500);
        });
    }

    // Helpers for Side Panel
    function setSidePanelEnabled(enabled) {
        try {
            chrome.runtime.sendMessage({ action: 'WHL_SET_SIDE_PANEL_ENABLED', enabled })
                .then(() => {
                    console.log(`[TopPanel] Side panel ${enabled ? 'enabled' : 'disabled'}`);
                })
                .catch((err) => {
                    console.warn('[TopPanel] Failed to set side panel enabled state:', err);
                });
        } catch (e) {
            console.warn('[TopPanel] Error in setSidePanelEnabled:', e);
        }
    }

    function openSidePanel(view) {
        try {
            console.log(`[TopPanel] ▶️ Opening side panel with view: ${view}`);
            
            // Enviar mensagem para background
            chrome.runtime.sendMessage({ action: 'WHL_OPEN_SIDE_PANEL_VIEW', view })
                .then((response) => {
                    console.log('[TopPanel] ✅ Response from background:', response);
                    if (response && response.success) {
                        console.log(`[TopPanel] ✅ Side panel opened successfully for view: ${view}`);
                    } else {
                        console.log('[TopPanel] ⚠️ Side panel response not success:', response);
                    }
                })
                .catch((err) => {
                    console.log('[TopPanel] Side panel não disponível - clique no ícone da extensão');
                });
        } catch (e) {
            console.log('[TopPanel] Erro ao abrir side panel:', e);
        }
    }

    function getActiveView() {
        const panel = document.getElementById(TOP_PANEL_ID);
        const active = panel?.querySelector('.top-panel-tab.active');
        return active?.dataset?.view || 'principal';
    }

    // Create the top panel HTML
    function createTopPanel() {
        const panel = document.createElement('div');
        panel.id = TOP_PANEL_ID;
        panel.className = 'wa-extractor-top-panel';

        panel.innerHTML = `
            <div class="top-panel-container">
                <div class="top-panel-left">
                    <div class="top-panel-logo" title="WhatsHybrid">
                        <img src="${chrome.runtime.getURL('icons/48.png')}" alt="WhatsHybrid" class="logo-icon-img" style="width:24px;height:24px;border-radius:4px;">
                        <span class="logo-text">WhatsHybrid</span>
                    </div>
                </div>
                <div class="top-panel-center">
                    <div class="top-panel-tabs">
                        <button class="top-panel-tab active" data-view="principal" title="Disparo de mensagens">
                            <span class="tab-icon">📨</span>
                            <span class="tab-label">Disparo</span>
                        </button>
                        <button class="top-panel-tab" data-view="extrator" title="Extrator">
                            <span class="tab-icon">📥</span>
                            <span class="tab-label">Extrator</span>
                        </button>
                        <button class="top-panel-tab" data-view="groups" title="Grupos">
                            <span class="tab-icon">👥</span>
                            <span class="tab-label">Grupos</span>
                        </button>
                        <button class="top-panel-tab" data-view="recover" title="Recover - Mensagens apagadas/editadas">
                            <span class="tab-icon">🔄</span>
                            <span class="tab-label">Recover</span>
                        </button>
                        <button class="top-panel-tab" data-view="crm" title="CRM">
                            <span class="tab-icon">💼</span>
                            <span class="tab-label">CRM</span>
                        </button>
                        <button class="top-panel-tab" data-view="analytics" title="Analytics">
                            <span class="tab-icon">📊</span>
                            <span class="tab-label">Analytics</span>
                        </button>
                        <button class="top-panel-tab" data-view="tasks" title="Tarefas">
                            <span class="tab-icon">📋</span>
                            <span class="tab-label">Tarefas</span>
                        </button>
                        <button class="top-panel-tab" data-view="ai" title="Smart Replies">
                            <span class="tab-icon">🧠</span>
                            <span class="tab-label">IA</span>
                        </button>
                        <button class="top-panel-tab" data-view="autopilot" title="Auto-Pilot">
                            <span class="tab-icon">🤖</span>
                            <span class="tab-label">Auto-Pilot</span>
                        </button>
                        <button class="top-panel-tab" data-view="quickreplies" title="Respostas Rápidas">
                            <span class="tab-icon">⚡</span>
                            <span class="tab-label">Quick Replies</span>
                        </button>
                        <button class="top-panel-tab" data-view="team" title="Sistema de Equipe">
                            <span class="tab-icon">👥</span>
                            <span class="tab-label">Equipe</span>
                        </button>
                        <button class="top-panel-tab" data-view="backend" title="Backend Sync">
                            <span class="tab-icon">🌐</span>
                            <span class="tab-label">Backend</span>
                        </button>
                        <button class="top-panel-tab" data-view="config" title="Configurações">
                            <span class="tab-icon">⚙️</span>
                            <span class="tab-label">Config</span>
                        </button>
                        <button class="top-panel-tab" data-view="backup" title="Backup">
                            <span class="tab-icon">💾</span>
                            <span class="tab-label">Backup</span>
                        </button>
                    </div>
                </div>
                <div class="top-panel-right">
                    <button class="top-panel-action" data-action="toggle" title="Minimizar (oculta painel superior + lateral)">🗕</button>
                </div>
            </div>
        `;

        return panel;
    }

    // Restore button (to bring the panels back)
    function ensureRestoreButton() {
        let btn = document.getElementById(RESTORE_BTN_ID);
        if (btn) return btn;

        btn = document.createElement('button');
        btn.id = RESTORE_BTN_ID;
        btn.className = 'wa-extractor-restore-btn';
        btn.type = 'button';
        btn.textContent = 'WHL';
        btn.title = 'Mostrar painéis (WhatsHybrid Lite)';

        btn.addEventListener('click', () => {
            // User gesture: we can reopen side panel here
            showTopPanel();
            hideRestoreButton();

            setSidePanelEnabled(true);
            openSidePanel(getActiveView());
        });

        document.body.appendChild(btn);
        return btn;
    }

    function showRestoreButton() {
        const btn = ensureRestoreButton();
        btn.style.display = '';
    }

    function hideRestoreButton() {
        const btn = document.getElementById(RESTORE_BTN_ID);
        if (btn) btn.style.display = 'none';
    }

    // Compress WhatsApp to make room for the panel
    function compressWhatsAppContent() {
        const whatsappRoot = document.getElementById('app');
        if (whatsappRoot) {
            whatsappRoot.style.setProperty('margin-top', '64px', 'important');
            whatsappRoot.style.setProperty('height', 'calc(100vh - 64px)', 'important');
            document.body.classList.add('wa-extractor-top-panel-visible');
        }
    }

    function restoreWhatsAppContent() {
        const whatsappRoot = document.getElementById('app');
        if (whatsappRoot) {
            whatsappRoot.style.removeProperty('margin-top');
            whatsappRoot.style.removeProperty('height');
        }
        document.body.classList.remove('wa-extractor-top-panel-visible');
    }

    // Show top panel
    function showTopPanel() {
        const panel = document.getElementById(TOP_PANEL_ID);
        if (panel) {
            panel.classList.remove('hidden');
            compressWhatsAppContent();
            console.log('[TopPanel] ✅ Top panel shown');
        }
    }

    // Hide top panel
    function hideTopPanel() {
        const panel = document.getElementById(TOP_PANEL_ID);
        if (panel) {
            panel.classList.add('hidden');
            restoreWhatsAppContent();

            // Sync with Side Panel: disable it (this closes/hides it for this tab)
            setSidePanelEnabled(false);

            showRestoreButton();
            console.log('[TopPanel] ✅ Top panel hidden');
        }
    }

    // Auto-open Side Panel on the first user interaction after WhatsApp loads
    // (Chrome requires a user gesture for sidePanel.open)
    function armAutoOpenSidePanelOnce() {
        if (autoOpenArmed) return;
        autoOpenArmed = true;

        const handler = () => {
            if (autoOpenDone) return;
            autoOpenDone = true;

            document.removeEventListener('click', handler, true);
            document.removeEventListener('keydown', handler, true);

            const panel = document.getElementById(TOP_PANEL_ID);
            if (panel?.classList.contains('hidden')) return;

            setSidePanelEnabled(true);
            openSidePanel(getActiveView());
        };

        // Use capture to catch the first interaction early
        document.addEventListener('click', handler, true);
        document.addEventListener('keydown', handler, true);
    }

    // Setup event listeners for the panel
    function setupEventListeners(panel) {
        // View switching (Top Panel is the main router)
        const tabs = panel.querySelectorAll('.top-panel-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                console.log('[TopPanel] 🖱️ Tab clicked:', tab.dataset.view);
                
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const view = tab.dataset.view || 'principal';
                console.log(`[TopPanel] View switched to: ${view}`);

                // Garantir que side panel está habilitado
                setSidePanelEnabled(true);
                
                // Abrir com a nova view
                openSidePanel(view);
                
                console.log(`[TopPanel] ✅ Message sent for view: ${view}`);
            });
        });

        // Minimize button
        const toggleBtn = panel.querySelector('.top-panel-action[data-action="toggle"]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                hideTopPanel();
            });
        }
    }

    // Listen for custom events from content.js (which receives messages from background)
    function registerEventListeners() {
        window.addEventListener('wa-extractor-show-top-panel', () => {
            console.log('[TopPanel] Received show event');
            showTopPanel();
            hideRestoreButton();
            setSidePanelEnabled(true);
        });

        window.addEventListener('wa-extractor-hide-top-panel', () => {
            console.log('[TopPanel] Received hide event');
            hideTopPanel();
        });

        console.log('[TopPanel] ✅ Event listeners registered');
    }

    // Inject the panel into WhatsApp
    function injectPanel() {
        if (document.getElementById(TOP_PANEL_ID)) {
            console.log('[TopPanel] ⚠️ Panel already injected');
            return;
        }

        const panel = createTopPanel();
        document.body.insertBefore(panel, document.body.firstChild);

        // Visible by default
        compressWhatsAppContent();

        setupEventListeners(panel);
        registerEventListeners();

        // Ensure side panel is enabled on this tab (opening still requires user gesture)
        setSidePanelEnabled(true);

        // Arm auto-open on first user gesture
        armAutoOpenSidePanelOnce();

        // Restore button hidden by default
        hideRestoreButton();

        console.log('[TopPanel] ✅ Panel injected successfully (visible by default)');
    }

    // Initialize
    async function init() {
        await waitForWhatsApp();
        setTimeout(() => {
            injectPanel();
        }, 1000);
    }

    // Start the injection process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
