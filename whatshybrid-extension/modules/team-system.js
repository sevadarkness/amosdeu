/**
 * 👥 Team System - Sistema de Equipe e Colaboração
 *
 * Permite gerenciar múltiplos usuários/agentes trabalhando no mesmo WhatsApp.
 *
 * Features:
 * - Gestão de membros da equipe
 * - Atribuição de conversas
 * - Status de disponibilidade
 * - Transferência de atendimento
 * - Estatísticas por membro
 * - Notas internas
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_team_system_v1';

  // Roles disponíveis
  const ROLES = {
    ADMIN: { id: 'admin', name: 'Administrador', color: '#ef4444', permissions: ['all'] },
    MANAGER: { id: 'manager', name: 'Gerente', color: '#f59e0b', permissions: ['assign', 'view_all', 'stats'] },
    AGENT: { id: 'agent', name: 'Agente', color: '#10b981', permissions: ['chat', 'notes'] },
    VIEWER: { id: 'viewer', name: 'Visualizador', color: '#6b7280', permissions: ['view'] }
  };

  // Status de disponibilidade
  const STATUSES = {
    AVAILABLE: { id: 'available', name: 'Disponível', icon: '🟢', color: '#10b981' },
    BUSY: { id: 'busy', name: 'Ocupado', icon: '🟡', color: '#f59e0b' },
    AWAY: { id: 'away', name: 'Ausente', icon: '🔴', color: '#ef4444' },
    OFFLINE: { id: 'offline', name: 'Offline', icon: '⚫', color: '#6b7280' }
  };

  let state = {
    currentUser: null,
    members: [],
    assignments: {}, // chatId -> userId
    notes: {}, // chatId -> [{ userId, text, timestamp }]
    statistics: {},
    initialized: false
  };

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  async function init() {
    if (state.initialized) return;

    console.log('[TeamSystem] 👥 Inicializando Sistema de Equipe...');

    await loadState();
    await identifyCurrentUser();

    state.initialized = true;
    console.log('[TeamSystem] ✅ Inicializado - Usuário:', state.currentUser?.name);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:initialized', {
        user: state.currentUser,
        members: state.members.length
      });
    }
  }

  // ============================================================
  // PERSISTÊNCIA
  // ============================================================

  async function loadState() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        state = { ...state, ...result[STORAGE_KEY] };
      }

      // Criar usuário padrão se não existir
      if (state.members.length === 0) {
        state.members.push({
          id: 'default_user',
          name: 'Usuário Principal',
          email: '',
          role: 'admin',
          status: 'available',
          avatar: '👤',
          joinedAt: Date.now(),
          stats: {
            chatsHandled: 0,
            messagesСent: 0,
            avgResponseTime: 0,
            satisfaction: 0
          }
        });
        await saveState();
      }
    } catch (e) {
      console.error('[TeamSystem] Erro ao carregar estado:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
    } catch (e) {
      console.error('[TeamSystem] Erro ao salvar estado:', e);
    }
  }

  // ============================================================
  // GERENCIAMENTO DE USUÁRIOS
  // ============================================================

  async function identifyCurrentUser() {
    // Tentar identificar usuário atual
    // Por padrão, usa o primeiro membro da lista
    if (!state.currentUser && state.members.length > 0) {
      state.currentUser = state.members[0];
      await saveState();
    }
  }

  function setCurrentUser(userId) {
    const user = state.members.find(m => m.id === userId);
    if (!user) return false;

    state.currentUser = user;
    saveState();

    console.log('[TeamSystem] Usuário atual:', user.name);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:user_changed', { user });
    }

    return true;
  }

  function addMember(name, email, role = 'agent', avatar = '👤') {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const member = {
      id,
      name,
      email,
      role,
      status: 'available',
      avatar,
      joinedAt: Date.now(),
      stats: {
        chatsHandled: 0,
        messagesSent: 0,
        avgResponseTime: 0,
        satisfaction: 0
      }
    };

    state.members.push(member);
    saveState();

    console.log('[TeamSystem] Membro adicionado:', name);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:member_added', { member });
    }

    return member;
  }

  function removeMember(userId) {
    const index = state.members.findIndex(m => m.id === userId);
    if (index === -1) return false;

    // Não permitir remover o último admin
    const member = state.members[index];
    if (member.role === 'admin') {
      const admins = state.members.filter(m => m.role === 'admin');
      if (admins.length === 1) {
        console.warn('[TeamSystem] Não é possível remover o último administrador');
        return false;
      }
    }

    state.members.splice(index, 1);

    // Remover atribuições deste usuário
    Object.keys(state.assignments).forEach(chatId => {
      if (state.assignments[chatId] === userId) {
        delete state.assignments[chatId];
      }
    });

    saveState();

    console.log('[TeamSystem] Membro removido:', userId);

    return true;
  }

  function updateMemberStatus(userId, status) {
    const member = state.members.find(m => m.id === userId);
    if (!member) return false;

    member.status = status;
    saveState();

    console.log('[TeamSystem] Status atualizado:', member.name, '→', status);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:status_changed', { userId, status });
    }

    return true;
  }

  function updateMemberRole(userId, role) {
    const member = state.members.find(m => m.id === userId);
    if (!member) return false;

    member.role = role;
    saveState();

    console.log('[TeamSystem] Role atualizado:', member.name, '→', role);

    return true;
  }

  // ============================================================
  // ATRIBUIÇÃO DE CONVERSAS
  // ============================================================

  function assignChat(chatId, userId) {
    const member = state.members.find(m => m.id === userId);
    if (!member) return false;

    const previousAssignee = state.assignments[chatId];
    state.assignments[chatId] = userId;

    // Atualizar estatísticas
    if (!member.stats) {
      member.stats = { chatsHandled: 0, messagesSent: 0, avgResponseTime: 0, satisfaction: 0 };
    }
    member.stats.chatsHandled++;

    saveState();

    console.log('[TeamSystem] Chat', chatId, 'atribuído para', member.name);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:chat_assigned', {
        chatId,
        userId,
        previousAssignee
      });
    }

    return true;
  }

  function unassignChat(chatId) {
    if (!state.assignments[chatId]) return false;

    const userId = state.assignments[chatId];
    delete state.assignments[chatId];

    saveState();

    console.log('[TeamSystem] Chat', chatId, 'desatribuído');

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:chat_unassigned', { chatId, userId });
    }

    return true;
  }

  function getAssignedUser(chatId) {
    const userId = state.assignments[chatId];
    if (!userId) return null;

    return state.members.find(m => m.id === userId);
  }

  function getUserChats(userId) {
    return Object.entries(state.assignments)
      .filter(([_, assignedUserId]) => assignedUserId === userId)
      .map(([chatId]) => chatId);
  }

  function transferChat(chatId, fromUserId, toUserId) {
    const fromUser = state.members.find(m => m.id === fromUserId);
    const toUser = state.members.find(m => m.id === toUserId);

    if (!fromUser || !toUser) return false;

    if (state.assignments[chatId] !== fromUserId) {
      console.warn('[TeamSystem] Chat não está atribuído para', fromUser.name);
      return false;
    }

    assignChat(chatId, toUserId);

    console.log('[TeamSystem] Chat transferido de', fromUser.name, 'para', toUser.name);

    // Adicionar nota automática
    addNote(chatId, null, `Chat transferido de ${fromUser.name} para ${toUser.name}`, true);

    return true;
  }

  // ============================================================
  // NOTAS INTERNAS
  // ============================================================

  function addNote(chatId, userId, text, isSystem = false) {
    if (!state.notes[chatId]) {
      state.notes[chatId] = [];
    }

    const note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: isSystem ? null : (userId || state.currentUser?.id),
      text,
      timestamp: Date.now(),
      isSystem
    };

    state.notes[chatId].push(note);

    // Manter apenas últimas 50 notas por chat
    if (state.notes[chatId].length > 50) {
      state.notes[chatId] = state.notes[chatId].slice(-50);
    }

    saveState();

    console.log('[TeamSystem] Nota adicionada ao chat', chatId);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('teamsystem:note_added', { chatId, note });
    }

    return note;
  }

  function getNotes(chatId) {
    return state.notes[chatId] || [];
  }

  function deleteNote(chatId, noteId) {
    if (!state.notes[chatId]) return false;

    const index = state.notes[chatId].findIndex(n => n.id === noteId);
    if (index === -1) return false;

    state.notes[chatId].splice(index, 1);
    saveState();

    return true;
  }

  // ============================================================
  // ESTATÍSTICAS
  // ============================================================

  function getTeamStats() {
    const stats = {
      totalMembers: state.members.length,
      activeMembers: state.members.filter(m => m.status === 'available').length,
      totalChatsAssigned: Object.keys(state.assignments).length,
      memberStats: state.members.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status,
        chatsHandled: m.stats?.chatsHandled || 0,
        messagesSent: m.stats?.messagesSent || 0,
        avgResponseTime: m.stats?.avgResponseTime || 0
      }))
    };

    return stats;
  }

  function getMemberStats(userId) {
    const member = state.members.find(m => m.id === userId);
    if (!member) return null;

    return {
      ...member.stats,
      currentChats: getUserChats(userId).length
    };
  }

  // ============================================================
  // UI - RENDERIZAÇÃO
  // ============================================================

  function renderTeamPanel(container) {
    const stats = getTeamStats();

    container.innerHTML = `
      <div class="team-panel">
        <div class="team-header">
          <h3>👥 Equipe</h3>
          <button id="team-add-member-btn" class="mod-btn mod-btn-sm mod-btn-primary">➕ Adicionar</button>
        </div>

        <div class="team-stats">
          <div class="team-stat">
            <span class="stat-value">${stats.totalMembers}</span>
            <span class="stat-label">Membros</span>
          </div>
          <div class="team-stat">
            <span class="stat-value">${stats.activeMembers}</span>
            <span class="stat-label">Disponíveis</span>
          </div>
          <div class="team-stat">
            <span class="stat-value">${stats.totalChatsAssigned}</span>
            <span class="stat-label">Chats Ativos</span>
          </div>
        </div>

        <div class="team-members">
          ${state.members.map(member => {
            const statusInfo = STATUSES[member.status.toUpperCase()] || STATUSES.OFFLINE;
            const roleInfo = ROLES[member.role.toUpperCase()] || ROLES.AGENT;
            const userChats = getUserChats(member.id).length;

            return `
              <div class="team-member" data-user-id="${member.id}">
                <div class="member-avatar">${member.avatar}</div>
                <div class="member-info">
                  <div class="member-name">${member.name}</div>
                  <div class="member-meta">
                    <span class="member-role" style="color: ${roleInfo.color}">${roleInfo.name}</span>
                    <span class="member-chats">${userChats} chats</span>
                  </div>
                </div>
                <div class="member-status" style="color: ${statusInfo.color}">
                  ${statusInfo.icon}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#team-add-member-btn')?.addEventListener('click', () => {
      showAddMemberDialog(container);
    });

    // Adicionar estilos
    if (!document.getElementById('team-system-styles')) {
      const styles = document.createElement('style');
      styles.id = 'team-system-styles';
      styles.textContent = `
        .team-panel {
          background: rgba(26, 26, 46, 0.95);
          border-radius: 12px;
          padding: 16px;
          color: white;
        }

        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .team-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .team-stat {
          flex: 1;
          background: rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .stat-label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.6);
        }

        .team-members {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .team-member {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .team-member:hover {
          background: rgba(255,255,255,0.1);
        }

        .member-avatar {
          font-size: 32px;
        }

        .member-info {
          flex: 1;
        }

        .member-name {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .member-meta {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: rgba(255,255,255,0.6);
        }

        .member-role {
          font-weight: 600;
        }

        .member-status {
          font-size: 20px;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  function showAddMemberDialog(container) {
    const dialog = document.createElement('div');
    dialog.className = 'team-dialog-overlay';
    dialog.innerHTML = `
      <div class="team-dialog">
        <h3>Adicionar Membro</h3>
        <input type="text" id="team-new-name" placeholder="Nome" class="mod-input">
        <input type="email" id="team-new-email" placeholder="Email" class="mod-input">
        <select id="team-new-role" class="mod-input mod-select">
          <option value="agent">Agente</option>
          <option value="manager">Gerente</option>
          <option value="admin">Administrador</option>
        </select>
        <div class="team-dialog-actions">
          <button id="team-cancel-btn" class="mod-btn">Cancelar</button>
          <button id="team-save-btn" class="mod-btn mod-btn-primary">Adicionar</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#team-cancel-btn').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#team-save-btn').addEventListener('click', () => {
      const name = dialog.querySelector('#team-new-name').value.trim();
      const email = dialog.querySelector('#team-new-email').value.trim();
      const role = dialog.querySelector('#team-new-role').value;

      if (name) {
        addMember(name, email, role);
        renderTeamPanel(container);
        if (window.NotificationsModule) {
          window.NotificationsModule.success('Membro adicionado!');
        }
      }
      dialog.remove();
    });
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================

  window.TeamSystem = {
    init,
    setCurrentUser,
    getCurrentUser: () => state.currentUser,
    getMembers: () => [...state.members],
    addMember,
    removeMember,
    updateMemberStatus,
    updateMemberRole,
    assignChat,
    unassignChat,
    getAssignedUser,
    getUserChats,
    transferChat,
    addNote,
    getNotes,
    deleteNote,
    getTeamStats,
    getMemberStats,
    renderTeamPanel,
    ROLES,
    STATUSES
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }

})();
