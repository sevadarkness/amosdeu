/**
 * Team System v1.0.0
 * Broadcast para múltiplos contatos da equipe
 */

class TeamSystem {
  constructor() {
    this.STORAGE_KEY = 'whl_team_members';
    this.members = [];
    this.senderName = '';
    this.init();
  }

  async init() {
    await this.loadData();
    console.log('[TeamSystem] ✅ Inicializado com', this.members.length, 'membros');
  }

  // Carregar dados
  async loadData() {
    const data = await chrome.storage.local.get([this.STORAGE_KEY, 'whl_sender_name']);
    this.members = data[this.STORAGE_KEY] || [];
    this.senderName = data.whl_sender_name || '';
  }

  // Salvar dados
  async saveData() {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: this.members,
      'whl_sender_name': this.senderName
    });
  }

  // CRUD de membros
  async addMember(name, phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validação
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Número deve ter entre 10 e 15 dígitos');
    }
    
    // Verifica duplicata
    if (this.members.some(m => m.phone === cleanPhone)) {
      throw new Error('Número já cadastrado');
    }

    const member = {
      id: `tm_${Date.now()}`,
      name: name || '',
      phone: cleanPhone,
      selected: false,
      messagesSent: 0,
      lastMessageAt: null,
      createdAt: new Date().toISOString()
    };

    this.members.push(member);
    await this.saveData();
    
    return member;
  }

  async removeMember(id) {
    this.members = this.members.filter(m => m.id !== id);
    await this.saveData();
  }

  async updateMember(id, updates) {
    const member = this.members.find(m => m.id === id);
    if (member) {
      Object.assign(member, updates);
      await this.saveData();
    }
    return member;
  }

  // Seleção
  toggleSelection(id) {
    const member = this.members.find(m => m.id === id);
    if (member) {
      member.selected = !member.selected;
    }
    return member;
  }

  selectAll() {
    this.members.forEach(m => m.selected = true);
  }

  clearSelection() {
    this.members.forEach(m => m.selected = false);
  }

  getSelected() {
    return this.members.filter(m => m.selected);
  }

  // Nome do remetente
  async setSenderName(name) {
    this.senderName = name;
    await this.saveData();
  }

  // Enviar mensagem para equipe
  async sendToTeam(message, options = {}) {
    const selected = this.getSelected();
    
    if (selected.length === 0) {
      throw new Error('Nenhum membro selecionado');
    }
    
    if (!message || !message.trim()) {
      throw new Error('Mensagem vazia');
    }

    // Formatar mensagem com nome do remetente
    const fullMessage = this.senderName 
      ? `*${this.senderName}:* ${message}` 
      : message;

    const results = {
      total: selected.length,
      success: 0,
      failed: 0,
      details: []
    };

    const delayMin = options.delayMin || 3000;
    const delayMax = options.delayMax || 7000;

    for (let i = 0; i < selected.length; i++) {
      const member = selected[i];
      
      try {
        // Abrir chat
        const chatOpened = await this.openChat(member.phone);
        if (!chatOpened) {
          throw new Error('Não foi possível abrir o chat');
        }

        // Aguardar chat carregar
        await this.sleep(2000);

        // Enviar mensagem
        const sent = await this.sendMessage(fullMessage);
        
        if (sent) {
          results.success++;
          member.messagesSent = (member.messagesSent || 0) + 1;
          member.lastMessageAt = new Date().toISOString();
          
          results.details.push({
            member: member.name || member.phone,
            status: 'success'
          });
        } else {
          throw new Error('Falha ao enviar');
        }

        // Delay entre envios
        if (i < selected.length - 1) {
          const delay = Math.random() * (delayMax - delayMin) + delayMin;
          await this.sleep(delay);
        }

      } catch (error) {
        results.failed++;
        results.details.push({
          member: member.name || member.phone,
          status: 'failed',
          error: error.message
        });
        console.error('[TeamSystem] Erro ao enviar para', member.phone, error);
      }
    }

    // Salvar estatísticas
    await this.saveData();

    // Limpar seleção após envio
    if (options.clearAfterSend !== false) {
      this.clearSelection();
    }

    console.log('[TeamSystem] Envio concluído:', results);
    return results;
  }

  // Abrir chat por número
  async openChat(phone) {
    const cleanPhone = phone.replace(/\D/g, '');

    // Método 1: Via Store.Cmd
    if (window.Store?.Cmd?.openChatAt) {
      try {
        await window.Store.Cmd.openChatAt(cleanPhone + '@c.us');
        return true;
      } catch (e) {}
    }

    // Método 2: Via URL
    try {
      window.location.href = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
      await this.sleep(3000);
      return true;
    } catch (e) {}

    return false;
  }

  // Enviar mensagem no chat atual
  async sendMessage(text) {
    // Aguardar composer
    let composer = null;
    for (let i = 0; i < 10; i++) {
      composer = document.querySelector('footer div[contenteditable="true"][role="textbox"]') ||
                 document.querySelector('[data-testid="conversation-compose-box-input"]');
      if (composer) break;
      await this.sleep(500);
    }

    if (!composer) {
      console.error('[TeamSystem] Composer não encontrado');
      return false;
    }

    // Digitar mensagem
    composer.focus();
    await this.sleep(200);

    if (window.HumanTyping?.typeInWhatsApp) {
      await window.HumanTyping.typeInWhatsApp(text);
    } else {
      composer.textContent = text;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await this.sleep(300);

    // Clicar em enviar
    const sendBtn = document.querySelector('[data-testid="send"]') ||
                    document.querySelector('button[aria-label*="Enviar"]') ||
                    document.querySelector('span[data-icon="send"]')?.parentElement;

    if (sendBtn) {
      sendBtn.click();
      await this.sleep(500);
      return true;
    }

    // Fallback: Enter
    composer.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'Enter', 
      keyCode: 13, 
      bubbles: true 
    }));
    
    return true;
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Formatar número para exibição
  formatPhone(phone) {
    if (phone.length === 13) {
      return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    } else if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  }

  // API pública
  getAll() { return [...this.members]; }
  getSenderName() { return this.senderName; }
  
  getStats() {
    return {
      totalMembers: this.members.length,
      selectedCount: this.getSelected().length,
      totalMessagesSent: this.members.reduce((sum, m) => sum + (m.messagesSent || 0), 0)
    };
  }
}

// Exportar
window.TeamSystem = TeamSystem;
window.teamSystem = new TeamSystem();

console.log('[TeamSystem] ✅ Módulo carregado');
