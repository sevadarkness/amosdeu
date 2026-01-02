/**
 * 🤖 Auto-Pilot Sidepanel Handlers
 * 
 * Handlers para a aba Auto-Pilot no sidepanel
 * Conecta a UI à lógica do smartbot-autopilot.js
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  let initialized = false;
  let updateInterval = null;

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  function init() {
    if (initialized) return;

    console.log('[AP-Handlers] 🤖 Inicializando handlers do Auto-Pilot...');

    // Aguarda o DOM e o módulo AutoPilot
    waitForAutoPilot(() => {
      setupControlButtons();
      setupConfigToggles();
      setupEventListeners();
      startStatsUpdate();
      initialized = true;
      console.log('[AP-Handlers] ✅ Handlers inicializados');
    });
  }

  function waitForAutoPilot(callback, attempts = 0) {
    if (window.AutoPilot) {
      callback();
    } else if (attempts < 50) {
      setTimeout(() => waitForAutoPilot(callback, attempts + 1), 100);
    } else {
      console.warn('[AP-Handlers] AutoPilot não encontrado');
    }
  }

  // ============================================================
  // BOTÕES DE CONTROLE
  // ============================================================

  function setupControlButtons() {
    const startBtn = document.getElementById('ap_btn_start');
    const pauseBtn = document.getElementById('ap_btn_pause');
    const resumeBtn = document.getElementById('ap_btn_resume');
    const stopBtn = document.getElementById('ap_btn_stop');
    const clearLogBtn = document.getElementById('ap_clear_log');
    const addBlacklistBtn = document.getElementById('ap_add_current_to_blacklist');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (window.AutoPilot) {
          window.AutoPilot.start();
          addLogEntry('info', 'Auto-Pilot iniciado');
          updateUI();
        }
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (window.AutoPilot) {
          window.AutoPilot.pause();
          addLogEntry('info', 'Auto-Pilot pausado');
          updateUI();
        }
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        if (window.AutoPilot) {
          window.AutoPilot.resume();
          addLogEntry('info', 'Auto-Pilot retomado');
          updateUI();
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (window.AutoPilot) {
          window.AutoPilot.stop();
          addLogEntry('info', 'Auto-Pilot parado');
          updateUI();
        }
      });
    }

    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        const logContainer = document.getElementById('ap_activity_log');
        if (logContainer) {
          logContainer.innerHTML = '<div style="padding: 8px; color: var(--mod-text-muted); text-align: center;">Log limpo</div>';
        }
      });
    }

    if (addBlacklistBtn) {
      addBlacklistBtn.addEventListener('click', () => {
        // Pegar chat atual do WhatsApp
        const chatHeader = document.querySelector('[data-testid="conversation-header"]') ||
                          document.querySelector('header span[title]');
        
        if (chatHeader) {
          const chatName = chatHeader.textContent || chatHeader.getAttribute('title') || 'Chat atual';
          if (window.AutoPilot && window.AutoPilot.addToBlacklist) {
            window.AutoPilot.addToBlacklist(chatName);
            addLogEntry('info', `${chatName} adicionado à blacklist`);
            updateBlacklistUI();
          }
        } else {
          addLogEntry('error', 'Nenhum chat aberto');
        }
      });
    }
  }

  // ============================================================
  // CONFIGURAÇÕES
  // ============================================================

  function setupConfigToggles() {
    const skipGroupsToggle = document.getElementById('ap_config_skip_groups');
    const limitSelect = document.getElementById('ap_config_limit');
    const delaySelect = document.getElementById('ap_config_delay');
    const workingHoursToggle = document.getElementById('ap_config_working_hours');
    const startTimeInput = document.getElementById('ap_config_start_time');
    const endTimeInput = document.getElementById('ap_config_end_time');
    const workingHoursConfig = document.getElementById('ap_working_hours_config');

    if (skipGroupsToggle) {
      skipGroupsToggle.addEventListener('change', (e) => {
        if (window.AutoPilot && window.AutoPilot.setConfig) {
          window.AutoPilot.setConfig({ SKIP_GROUPS: e.target.checked });
          addLogEntry('info', `Pular grupos: ${e.target.checked ? 'Ativado' : 'Desativado'}`);
        }
      });
    }

    if (limitSelect) {
      limitSelect.addEventListener('change', (e) => {
        if (window.AutoPilot && window.AutoPilot.setConfig) {
          window.AutoPilot.setConfig({ MAX_RESPONSES_PER_HOUR: parseInt(e.target.value) });
          addLogEntry('info', `Limite: ${e.target.value} respostas/hora`);
        }
      });
    }

    if (delaySelect) {
      delaySelect.addEventListener('change', (e) => {
        if (window.AutoPilot && window.AutoPilot.setConfig) {
          window.AutoPilot.setConfig({ DELAY_BETWEEN_CHATS: parseInt(e.target.value) });
          addLogEntry('info', `Delay: ${parseInt(e.target.value) / 1000}s entre chats`);
        }
      });
    }

    if (workingHoursToggle && workingHoursConfig) {
      workingHoursToggle.addEventListener('change', (e) => {
        workingHoursConfig.style.display = e.target.checked ? 'block' : 'none';
        updateWorkingHours();
      });
    }

    if (startTimeInput) {
      startTimeInput.addEventListener('change', updateWorkingHours);
    }

    if (endTimeInput) {
      endTimeInput.addEventListener('change', updateWorkingHours);
    }
  }

  function updateWorkingHours() {
    const toggle = document.getElementById('ap_config_working_hours');
    const startTime = document.getElementById('ap_config_start_time');
    const endTime = document.getElementById('ap_config_end_time');

    if (toggle && startTime && endTime && window.AutoPilot && window.AutoPilot.setConfig) {
      const enabled = toggle.checked;
      const start = parseInt(startTime.value.split(':')[0]) || 8;
      const end = parseInt(endTime.value.split(':')[0]) || 22;

      window.AutoPilot.setConfig({
        WORKING_HOURS: { enabled, start, end }
      });

      if (enabled) {
        addLogEntry('info', `Horário: ${startTime.value} - ${endTime.value}`);
      }
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function setupEventListeners() {
    // Escuta eventos do AutoPilot
    window.addEventListener('autopilot:started', () => {
      addLogEntry('success', '✅ Auto-Pilot iniciado');
      updateUI();
    });

    window.addEventListener('autopilot:paused', () => {
      addLogEntry('info', '⏸️ Auto-Pilot pausado');
      updateUI();
    });

    window.addEventListener('autopilot:resumed', () => {
      addLogEntry('success', '▶️ Auto-Pilot retomado');
      updateUI();
    });

    window.addEventListener('autopilot:stopped', () => {
      addLogEntry('info', '⏹️ Auto-Pilot parado');
      updateUI();
    });

    window.addEventListener('autopilot:messageSent', (e) => {
      const detail = e.detail || {};
      addLogEntry('success', `📤 Mensagem enviada para ${detail.chatId || 'contato'}`);
      updateStats();
    });

    window.addEventListener('autopilot:error', (e) => {
      const detail = e.detail || {};
      addLogEntry('error', `❌ Erro: ${detail.error || 'Desconhecido'}`);
      updateStats();
    });

    window.addEventListener('autopilot:limitReached', () => {
      addLogEntry('info', '⚠️ Limite de respostas por hora atingido');
    });
  }

  // ============================================================
  // ATUALIZAÇÃO DE UI
  // ============================================================

  function startStatsUpdate() {
    // Atualiza a cada 2 segundos
    updateInterval = setInterval(() => {
      if (document.getElementById('whlViewAutoPilot') && 
          !document.getElementById('whlViewAutoPilot').classList.contains('hidden')) {
        updateUI();
      }
    }, 2000);
  }

  function updateUI() {
    if (!window.AutoPilot || !window.AutoPilot.getStats) return;

    const stats = window.AutoPilot.getStats();
    const config = window.AutoPilot.getConfig ? window.AutoPilot.getConfig() : {};

    updateStatus(stats);
    updateStats(stats);
    updateButtons(stats);
    updateProgress(stats, config);
  }

  function updateStatus(stats) {
    const statusCard = document.getElementById('autopilot_status_card');
    const statusIndicator = document.getElementById('autopilot_status_indicator');
    const statusText = document.getElementById('autopilot_status_text');
    const statusDetail = document.getElementById('autopilot_status_detail');
    const statusBadge = document.getElementById('autopilot_status_badge');

    if (!statusCard) return;

    // Remove classes anteriores
    statusCard.classList.remove('ap-status-running', 'ap-status-paused');

    if (!stats.isRunning) {
      // PARADO
      if (statusIndicator) statusIndicator.innerHTML = '⏹️';
      if (statusText) statusText.textContent = 'Parado';
      if (statusDetail) statusDetail.textContent = 'Clique em Iniciar para começar';
      if (statusBadge) {
        statusBadge.textContent = 'PARADO';
        statusBadge.style.background = 'rgba(107, 114, 128, 0.2)';
        statusBadge.style.color = '#9ca3af';
      }
    } else if (stats.isPaused) {
      // PAUSADO
      statusCard.classList.add('ap-status-paused');
      if (statusIndicator) statusIndicator.innerHTML = '⏸️';
      if (statusText) statusText.textContent = 'Pausado';
      if (statusDetail) statusDetail.textContent = 'Clique em Continuar para retomar';
      if (statusBadge) {
        statusBadge.textContent = 'PAUSADO';
        statusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        statusBadge.style.color = '#f59e0b';
      }
    } else {
      // ATIVO
      statusCard.classList.add('ap-status-running');
      if (statusIndicator) statusIndicator.innerHTML = '🤖';
      if (statusText) statusText.textContent = 'Ativo';
      const pending = stats.pendingChats || 0;
      if (statusDetail) {
        statusDetail.textContent = pending > 0 
          ? `Processando... ${pending} chat(s) na fila`
          : 'Aguardando novas mensagens';
      }
      if (statusBadge) {
        statusBadge.textContent = 'ATIVO';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.color = '#10b981';
      }
    }
  }

  function updateStats(stats) {
    if (!stats && window.AutoPilot && window.AutoPilot.getStats) {
      stats = window.AutoPilot.getStats();
    }
    if (!stats) return;

    const sentEl = document.getElementById('ap_stat_sent');
    const pendingEl = document.getElementById('ap_stat_pending');
    const skippedEl = document.getElementById('ap_stat_skipped');
    const errorsEl = document.getElementById('ap_stat_errors');

    if (sentEl) sentEl.textContent = stats.totalSent || 0;
    if (pendingEl) pendingEl.textContent = stats.pendingChats || 0;
    if (skippedEl) skippedEl.textContent = stats.totalSkipped || 0;
    if (errorsEl) errorsEl.textContent = stats.totalErrors || 0;
  }

  function updateButtons(stats) {
    const startBtn = document.getElementById('ap_btn_start');
    const pauseBtn = document.getElementById('ap_btn_pause');
    const resumeBtn = document.getElementById('ap_btn_resume');
    const stopBtn = document.getElementById('ap_btn_stop');

    if (!stats.isRunning) {
      // PARADO
      if (startBtn) startBtn.style.display = 'flex';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'none';
    } else if (stats.isPaused) {
      // PAUSADO
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'flex';
      if (stopBtn) stopBtn.style.display = 'flex';
    } else {
      // ATIVO
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'flex';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'flex';
    }
  }

  function updateProgress(stats, config) {
    const progressBar = document.getElementById('ap_progress_bar');
    const progressText = document.getElementById('ap_progress_text');

    const limit = config.MAX_RESPONSES_PER_HOUR || 30;
    const current = stats.responsesThisHour || 0;
    const percent = Math.min((current / limit) * 100, 100);

    if (progressBar) {
      progressBar.style.width = `${percent}%`;
      
      // Cor baseada no progresso
      if (percent >= 90) {
        progressBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (percent >= 70) {
        progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        progressBar.style.background = 'linear-gradient(90deg, var(--mod-primary), var(--mod-accent))';
      }
    }

    if (progressText) {
      progressText.textContent = `${current} / ${limit}`;
    }
  }

  function updateBlacklistUI() {
    const container = document.getElementById('ap_blacklist');
    if (!container || !window.AutoPilot) return;

    const blacklist = window.AutoPilot.getBlacklist ? window.AutoPilot.getBlacklist() : [];

    if (blacklist.length === 0) {
      container.innerHTML = '<div style="color: var(--mod-text-muted); font-size: 11px; text-align: center;">Nenhum contato na lista</div>';
      return;
    }

    container.innerHTML = blacklist.map(item => `
      <div class="ap-blacklist-item">
        <span class="name">${escapeHtml(item)}</span>
        <button class="remove" data-id="${escapeHtml(item)}" title="Remover">×</button>
      </div>
    `).join('');

    // Event listeners para remover
    container.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (window.AutoPilot && window.AutoPilot.removeFromBlacklist) {
          window.AutoPilot.removeFromBlacklist(id);
          addLogEntry('info', `${id} removido da blacklist`);
          updateBlacklistUI();
        }
      });
    });
  }

  // ============================================================
  // LOG DE ATIVIDADES
  // ============================================================

  function addLogEntry(type, message) {
    const container = document.getElementById('ap_activity_log');
    if (!container) return;

    // Remove mensagem de "nenhuma atividade"
    const emptyMsg = container.querySelector('div[style*="text-align: center"]');
    if (emptyMsg && container.children.length === 1) {
      emptyMsg.remove();
    }

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const entry = document.createElement('div');
    entry.className = `ap-log-entry ${type}`;
    entry.innerHTML = `
      <span class="time">${time}</span>
      <span class="message">${escapeHtml(message)}</span>
    `;

    container.insertBefore(entry, container.firstChild);

    // Limita a 50 entradas
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  // Aguarda DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expõe para debug
  window.APHandlers = {
    updateUI,
    addLogEntry
  };

})();


// ============================================
// INTEGRAÇÃO COM AUTOPILOT V2 (v7.5.0)
// ============================================

(function setupAutopilotV2Integration() {
  function getAutopilot() {
    return window.AutopilotV2 || window.Autopilot;
  }

  document.getElementById('ap_btn_start')?.addEventListener('click', () => {
    const ap = getAutopilot();
    if (ap?.start) {
      ap.start();
      updateAutopilotUI('running');
    }
  });

  document.getElementById('ap_btn_pause')?.addEventListener('click', () => {
    const ap = getAutopilot();
    if (ap?.pause) {
      ap.pause();
      updateAutopilotUI('paused');
    }
  });

  document.getElementById('ap_btn_resume')?.addEventListener('click', () => {
    const ap = getAutopilot();
    if (ap?.resume) {
      ap.resume();
      updateAutopilotUI('running');
    }
  });

  document.getElementById('ap_btn_stop')?.addEventListener('click', () => {
    const ap = getAutopilot();
    if (ap?.stop) {
      ap.stop();
      updateAutopilotUI('stopped');
    }
  });

  function updateAutopilotUI(state) {
    const startBtn = document.getElementById('ap_btn_start');
    const pauseBtn = document.getElementById('ap_btn_pause');
    const resumeBtn = document.getElementById('ap_btn_resume');
    const stopBtn = document.getElementById('ap_btn_stop');
    const indicator = document.getElementById('autopilot_status_indicator');
    const statusText = document.getElementById('autopilot_status_text');
    const statusBadge = document.getElementById('autopilot_status_badge');

    if (state === 'running') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'flex';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'flex';
      if (indicator) { indicator.innerHTML = '🤖'; indicator.style.background = 'rgba(16, 185, 129, 0.2)'; }
      if (statusText) statusText.textContent = 'Rodando';
      if (statusBadge) { statusBadge.textContent = 'ATIVO'; statusBadge.style.background = 'rgba(16, 185, 129, 0.2)'; statusBadge.style.color = '#10b981'; }
    } else if (state === 'paused') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'flex';
      if (stopBtn) stopBtn.style.display = 'flex';
      if (indicator) { indicator.innerHTML = '⏸️'; indicator.style.background = 'rgba(245, 158, 11, 0.2)'; }
      if (statusText) statusText.textContent = 'Pausado';
      if (statusBadge) { statusBadge.textContent = 'PAUSADO'; statusBadge.style.background = 'rgba(245, 158, 11, 0.2)'; statusBadge.style.color = '#f59e0b'; }
    } else {
      if (startBtn) startBtn.style.display = 'flex';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'none';
      if (indicator) { indicator.innerHTML = '⏹️'; indicator.style.background = 'rgba(107, 114, 128, 0.2)'; }
      if (statusText) statusText.textContent = 'Parado';
      if (statusBadge) { statusBadge.textContent = 'PARADO'; statusBadge.style.background = 'rgba(107, 114, 128, 0.2)'; statusBadge.style.color = '#9ca3af'; }
    }
  }

  // Atualizar estatísticas periodicamente
  setInterval(() => {
    const ap = getAutopilot();
    if (ap?.getStats) {
      const stats = ap.getStats();
      const sentEl = document.getElementById('ap_stat_sent');
      const pendingEl = document.getElementById('ap_stat_pending');
      const errorsEl = document.getElementById('ap_stat_errors');
      
      if (sentEl) sentEl.textContent = stats.replied || 0;
      if (pendingEl) pendingEl.textContent = (ap.getQueue?.()?.length) || 0;
      if (errorsEl) errorsEl.textContent = stats.failed || 0;
    }
  }, 2000);

  console.log('[AutopilotHandlers] ✅ Integração com AutopilotV2 configurada');
})();

