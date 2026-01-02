# 🎨 UI Integration Quick-Start Guide

This guide provides ready-to-use code snippets for integrating the 7 bug fixes into the UI.

---

## 📍 Where to Make Changes

1. **Buttons**: `whatshybrid-extension/sidepanel-handlers.js` or `whatshybrid-extension/sidepanel.js`
2. **Rendering**: `whatshybrid-extension/sidepanel-router.js`
3. **Styles**: `whatshybrid-extension/sidepanel.css`

---

## 🔘 Button Handlers

### 1. Refresh Button (BUG 5)

```javascript
// Add to sidepanel-handlers.js or sidepanel.js
async function handleRecoverRefresh() {
  const refreshBtn = document.getElementById('recover-refresh-btn');
  const listContainer = document.getElementById('recover-list');
  
  // Visual feedback
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '🔄 Atualizando...';
  listContainer.style.opacity = '0.5';
  
  try {
    // Call the API
    const result = await window.RecoverAdvanced.refreshMessages();
    
    if (result.success) {
      // Re-render list
      renderRecoverTimeline();
      
      // Show result
      const message = result.newCount > 0 
        ? `✅ ${result.newCount} novas mensagens!` 
        : '✅ Nenhuma nova mensagem';
      
      refreshBtn.innerHTML = message;
      showToast(message, 'success');
    } else {
      throw new Error(result.error || 'Falha ao atualizar');
    }
  } catch (error) {
    console.error('[Recover] Refresh error:', error);
    refreshBtn.innerHTML = '❌ Erro';
    showToast('Erro ao atualizar', 'error');
  } finally {
    listContainer.style.opacity = '1';
    setTimeout(() => {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '🔄 Atualizar';
    }, 2000);
  }
}

// Wire up the button
document.getElementById('recover-refresh-btn')?.addEventListener('click', handleRecoverRefresh);
```

### 2. SYNC Button (BUG 6)

```javascript
// Add to sidepanel-handlers.js or sidepanel.js
async function updateRecoverSyncButton() {
  const syncBtn = document.getElementById('recover-sync-btn');
  if (!syncBtn) return;
  
  try {
    const status = await window.RecoverAdvanced.checkBackendConnection();
    
    if (status.connected) {
      syncBtn.innerHTML = '☁️ Sincronizar';
      syncBtn.disabled = false;
      syncBtn.title = `Conectado${status.user ? ' como ' + status.user.name : ''}`;
      syncBtn.style.opacity = '1';
      syncBtn.style.cursor = 'pointer';
      
      // Set up click handler
      syncBtn.onclick = async () => {
        syncBtn.innerHTML = '⏳ Sincronizando...';
        syncBtn.disabled = true;
        
        try {
          const result = await window.RecoverAdvanced.syncWithBackend();
          if (result) {
            showToast('✅ Sincronização completa!', 'success');
            renderRecoverTimeline();
          }
        } catch (e) {
          showToast('❌ Erro na sincronização', 'error');
        } finally {
          setTimeout(() => updateRecoverSyncButton(), 1000);
        }
      };
    } else {
      syncBtn.innerHTML = '⚠️ Backend Offline';
      syncBtn.disabled = true;
      syncBtn.title = getReasonText(status.reason);
      syncBtn.style.opacity = '0.6';
      syncBtn.style.cursor = 'not-allowed';
      syncBtn.onclick = null;
    }
  } catch (e) {
    console.error('[Recover] SYNC check failed:', e);
    syncBtn.innerHTML = '❌ Erro';
    syncBtn.disabled = true;
  }
}

function getReasonText(reason) {
  const texts = {
    'no_token': 'Não autenticado - faça login',
    'connection_failed': 'Não foi possível conectar',
    'error': 'Erro de conexão'
  };
  return texts[reason] || 'Desconectado';
}

// Update on load and periodically
updateRecoverSyncButton();
setInterval(updateRecoverSyncButton, 30000); // Every 30 seconds
```

### 3. DeepScan Button (BUG 7)

```javascript
// Add to sidepanel-handlers.js or sidepanel.js
async function handleRecoverDeepScan() {
  const deepScanBtn = document.getElementById('recover-deepscan-btn');
  const container = document.getElementById('recover-deep-scan-container');
  
  // Create progress UI
  const progressDiv = document.createElement('div');
  progressDiv.id = 'recover-progress';
  progressDiv.innerHTML = `
    <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:16px;margin:12px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span id="deepscan-status" style="font-weight:500;">Iniciando...</span>
        <span id="deepscan-percent" style="font-weight:600;">0%</span>
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden;">
        <div id="deepscan-bar" style="background:linear-gradient(90deg,#8b5cf6,#3b82f6);height:100%;width:0%;transition:width 0.3s;"></div>
      </div>
      <div id="deepscan-details" style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;">
        Preparando...
      </div>
    </div>
  `;
  container.appendChild(progressDiv);
  
  deepScanBtn.disabled = true;
  deepScanBtn.innerHTML = '🔍 Escaneando...';
  
  try {
    const result = await window.RecoverAdvanced.executeDeepScan((progress) => {
      // Update progress UI
      document.getElementById('deepscan-bar').style.width = `${progress.progress}%`;
      document.getElementById('deepscan-percent').textContent = `${progress.progress}%`;
      document.getElementById('deepscan-status').textContent = progress.status;
      document.getElementById('deepscan-details').textContent = progress.detail || '';
    });
    
    if (result.success) {
      showToast(`✅ DeepScan completo! ${result.found} mensagens`, 'success');
      renderRecoverTimeline();
    } else {
      showToast('❌ Erro no DeepScan', 'error');
    }
  } catch (error) {
    console.error('[Recover] DeepScan error:', error);
    showToast('❌ Erro: ' + error.message, 'error');
  } finally {
    deepScanBtn.disabled = false;
    deepScanBtn.innerHTML = '🔍 DeepScan';
    setTimeout(() => progressDiv.remove(), 3000);
  }
}

// Wire up the button
document.getElementById('recover-deepscan-btn')?.addEventListener('click', handleRecoverDeepScan);
```

---

## 🎨 Rendering Functions

### Render Persistent Notification (BUG 2)

```javascript
// Add to sidepanel-router.js in renderRecoverTimeline()

function renderPersistentNotification(notification) {
  if (!notification || !notification.persistent) return '';
  
  const icons = {
    'revoked': '🚫',
    'deleted': '🗑️',
    'edited': '✏️'
  };
  
  const colors = {
    'revoked': 'rgba(239,68,68,0.15)',
    'deleted': 'rgba(107,114,128,0.15)',
    'edited': 'rgba(59,130,246,0.15)'
  };
  
  const borders = {
    'revoked': '#ef4444',
    'deleted': '#6b7280',
    'edited': '#3b82f6'
  };
  
  const type = notification.type || 'deleted';
  
  return `
    <div class="recover-notification" style="
      background: ${colors[type]};
      border-left: 3px solid ${borders[type]};
      padding: 8px 12px;
      border-radius: 6px;
      margin-top: 8px;
      font-size: 12px;
    ">
      ${icons[type]} ${notification.text}
      <span style="opacity: 0.6; margin-left: 8px; font-size: 10px;">
        ${formatTime(notification.timestamp)}
      </span>
    </div>
  `;
}

// Use in message rendering:
html += renderPersistentNotification(entry.notification);
```

### Render Deletion Type Badge (BUG 3)

```javascript
// Add to sidepanel-router.js

function renderDeletionTypeBadge(deletionType, deletionInfo) {
  if (!deletionType) return '';
  
  const badges = {
    'revoked_by_sender': {
      icon: '🚫',
      text: 'Apagada pelo remetente',
      bg: 'rgba(239,68,68,0.15)',
      border: '#ef4444',
      color: '#ef4444'
    },
    'deleted_locally': {
      icon: '🗑️',
      text: 'Excluída localmente',
      bg: 'rgba(107,114,128,0.15)',
      border: '#6b7280',
      color: '#6b7280'
    },
    'deleted_by_admin': {
      icon: '👮',
      text: 'Removida por admin',
      bg: 'rgba(245,158,11,0.15)',
      border: '#f59e0b',
      color: '#f59e0b'
    },
    'edited': {
      icon: '✏️',
      text: 'Editada',
      bg: 'rgba(59,130,246,0.15)',
      border: '#3b82f6',
      color: '#3b82f6'
    },
    'unknown': {
      icon: '❓',
      text: 'Deletada',
      bg: 'rgba(156,163,175,0.15)',
      border: '#9ca3af',
      color: '#9ca3af'
    }
  };
  
  const badge = badges[deletionType] || badges['unknown'];
  
  return `
    <div class="deletion-type-badge" style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: ${badge.bg};
      border-left: 3px solid ${badge.border};
      color: ${badge.color};
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      margin-right: 8px;
    ">
      <span>${badge.icon}</span>
      <span>${badge.text}</span>
      ${deletionInfo?.actor ? `<span style="opacity:0.6;margin-left:4px;">por ${deletionInfo.actor.substring(0,8)}...</span>` : ''}
    </div>
  `;
}

// Use in message rendering:
html += renderDeletionTypeBadge(entry.deletionType, entry.deletionInfo);
```

### Download Button (BUG 1)

```javascript
// Add to sidepanel-router.js in message action handlers

async function handleMediaDownload(messageId, mediaType) {
  const downloadBtn = event.target;
  const originalText = downloadBtn.innerHTML;
  
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '⏳ Baixando...';
  
  try {
    const result = await window.RecoverAdvanced.downloadRealMedia(messageId, mediaType);
    
    if (result.success) {
      if (result.data) {
        // If we got base64 data, trigger download
        const link = document.createElement('a');
        link.href = `data:${mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream'};base64,${result.data}`;
        link.download = `recovered_media_${messageId}_${Date.now()}.${getExtension(mediaType)}`;
        link.click();
      }
      
      showToast('✅ Download iniciado!', 'success');
    } else {
      throw new Error(result.error || 'Download failed');
    }
  } catch (error) {
    console.error('[Recover] Download error:', error);
    showToast('❌ Erro no download', 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalText;
  }
}

function getExtension(mediaType) {
  const extensions = {
    'image': 'jpg',
    'video': 'mp4',
    'audio': 'ogg',
    'ptt': 'ogg',
    'document': 'pdf',
    'sticker': 'webp'
  };
  return extensions[mediaType] || 'bin';
}

// Add to download button in HTML:
// onclick="handleMediaDownload('${entry.id}', '${entry.mediaType}')"
```

---

## 🎨 CSS Styles

```css
/* Add to whatshybrid-extension/sidepanel.css */

/* BUG 2 & 3: Notifications and Badges */
.recover-notification {
  animation: slideIn 0.3s ease-out;
}

.deletion-type-badge {
  animation: fadeIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* BUG 7: Progress Bar */
#recover-progress {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 200px;
  }
}

/* Button States */
button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

button:not([disabled]):hover {
  transform: scale(1.02);
  transition: transform 0.2s;
}

/* Toast Notifications (if not already present) */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  animation: slideInRight 0.3s ease-out;
}

.toast.success {
  border-left: 4px solid #10b981;
}

.toast.error {
  border-left: 4px solid #ef4444;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 🧪 Testing Checklist

After implementing UI integration:

- [ ] **BUG 1**: Click download button → should download real media
- [ ] **BUG 2**: Reload page → notifications should still be visible
- [ ] **BUG 3**: Check deletion badges → should show correct type and color
- [ ] **BUG 4**: Delete same message twice → should not duplicate
- [ ] **BUG 5**: Click Refresh → should show new message count
- [ ] **BUG 6**: Check SYNC button → should show correct status
- [ ] **BUG 7**: Click DeepScan → should show progress bar

---

## 📝 Utility Functions

```javascript
// Toast notification helper (if not already present)
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Time formatting helper
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

---

## 🎯 Quick Start Steps

1. **Copy button handlers** to `sidepanel-handlers.js`
2. **Copy rendering functions** to `sidepanel-router.js`
3. **Copy CSS styles** to `sidepanel.css`
4. **Test each feature** individually
5. **Integrate gradually** and verify

---

**Status**: Ready to implement
**Complexity**: Low to Medium
**Estimated Time**: 2-4 hours
