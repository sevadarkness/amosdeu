/**
 * WhatsHybrid Audio & File Handler v7.5.1
 * 
 * SOLUÇÃO TÉCNICA:
 * - window.Store do WhatsApp NÃO está acessível (isolated world)
 * - Botões nativos do WA não existem no DOM da extensão
 * - SOLUÇÃO: Gravar áudio → converter para base64 → enviar via API própria
 */
(function() {
  'use strict';

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let recordingStart = null;
  let recordedAudioBlob = null;

  // ============================================
  // GRAVAÇÃO DE ÁUDIO
  // ============================================
  async function startRecording() {
    if (isRecording) return false;

    try {
      console.log('[AudioHandler] 🎤 Solicitando microfone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      console.log('[AudioHandler] ✅ Microfone obtido!');
      
      // Usar formato OGG/Opus (melhor compatibilidade com WhatsApp)
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') 
        ? 'audio/ogg;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      
      console.log('[AudioHandler] 📼 Usando formato:', mimeType);
      
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];
      recordingStart = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const duration = Math.round((Date.now() - recordingStart) / 1000);
        recordedAudioBlob = new Blob(audioChunks, { type: mimeType });

        // Converter para Data URL e disponibilizar para disparo em massa
        let dataUrl = '';
        try {
          dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => reject(new Error('Falha ao converter áudio.'));
            r.readAsDataURL(recordedAudioBlob);
          });
        } catch (e) {
          console.warn('[AudioHandler] ⚠️ Não foi possível converter áudio para DataURL:', e);
        }

        // Notifica o SidePanel Router para salvar no estado da campanha
        try {
          window.dispatchEvent(new CustomEvent('WHL_AUDIO_READY', {
            detail: {
              dataUrl,
              filename: `voice_${Date.now()}.ogg`,
              mimeType: recordedAudioBlob.type || mimeType,
              duration,
              size: recordedAudioBlob.size
            }
          }));
          console.log('[AudioHandler] 📌 WHL_AUDIO_READY emitido para uso na campanha');
        } catch (e) {
          // ignore
        }
        
        console.log('[AudioHandler] 📼 Gravado:', duration + 's, ' + (recordedAudioBlob.size / 1024).toFixed(1) + 'KB');
        stream.getTracks().forEach(t => t.stop());
        
        // Calculate file size display
        const sizeKB = (recordedAudioBlob.size / 1024).toFixed(1);
        
        // Mostrar opções no hint
        const hint = document.getElementById('sp_image_hint');
        if (hint) {
          hint.innerHTML = `
            <span style="color:#4caf50">✅ Áudio gravado (${duration}s, ${sizeKB} KB) — anexado na campanha</span><br>
            <button id="whl_send_audio_btn" class="sp-btn sp-btn-primary" style="margin-top:6px;padding:6px 12px">
              📤 Enviar para chat ativo
            </button>
            <button id="whl_download_audio_btn" class="sp-btn sp-btn-secondary" style="margin-top:6px;padding:6px 12px;margin-left:6px">
              💾 Baixar
            </button>
          `;
          
          // Handler para enviar
          document.getElementById('whl_send_audio_btn')?.addEventListener('click', () => {
            sendAudioToActiveChat();
          });
          
          // Handler para baixar
          document.getElementById('whl_download_audio_btn')?.addEventListener('click', () => {
            downloadBlob(recordedAudioBlob, `audio_${Date.now()}.ogg`);
          });
        }
      };

      mediaRecorder.start(100);
      isRecording = true;
      updateRecordingUI(true);
      
      console.log('[AudioHandler] 🔴 Gravando...');
      return true;

    } catch (error) {
      console.error('[AudioHandler] ❌ Erro:', error);
      const hint = document.getElementById('sp_image_hint');
      if (hint) {
        hint.textContent = '❌ Erro ao acessar microfone: ' + error.message;
        hint.style.color = '#f44336';
      }
      return false;
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return false;
    console.log('[AudioHandler] ⏹️ Parando...');
    mediaRecorder.stop();
    isRecording = false;
    updateRecordingUI(false);
    return true;
  }

  function toggleRecording() {
    console.log('[AudioHandler] Toggle chamado, isRecording:', isRecording);
    return isRecording ? stopRecording() : startRecording();
  }

  // ============================================
  // ENVIAR ÁUDIO VIA API PRÓPRIA
  // ============================================
  async function sendAudioToActiveChat() {
    if (!recordedAudioBlob) {
      alert('Nenhum áudio gravado!');
      return;
    }

    const hint = document.getElementById('sp_image_hint');
    if (hint) {
      hint.innerHTML = '<span style="color:#2196f3">📤 Enviando áudio...</span>';
    }

    try {
      // Converter blob para base64
      const base64 = await blobToBase64(recordedAudioBlob);
      
      // Enviar via content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        throw new Error('Nenhuma aba ativa encontrada');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'WHL_SEND_AUDIO_MESSAGE',
        audioData: base64,
        mimeType: recordedAudioBlob.type,
        duration: Math.round((Date.now() - recordingStart) / 1000)
      });

      if (response?.success) {
        if (hint) {
          hint.innerHTML = '<span style="color:#4caf50">✅ Áudio enviado!</span>';
        }
        recordedAudioBlob = null;
      } else {
        throw new Error(response?.error || 'Falha ao enviar');
      }

    } catch (error) {
      console.error('[AudioHandler] ❌ Erro ao enviar:', error);
      if (hint) {
        hint.innerHTML = `<span style="color:#f44336">❌ ${error.message}</span>`;
      }
    }
  }

  // ============================================
  // SELEÇÃO DE ARQUIVOS
  // ============================================
  function selectAndSendFile() {
    console.log('[FileHandler] 📁 Abrindo seletor de arquivos...');
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      
      if (!file) return;
      
      console.log('[FileHandler] 📎 Arquivo selecionado:', file.name, file.type, (file.size/1024).toFixed(1) + 'KB');
      
      const hint = document.getElementById('sp_image_hint');
      if (hint) {
        const sizeKB = (file.size / 1024).toFixed(1);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeDisplay = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        
        hint.innerHTML = `
          <span style="color:#2196f3">📎 ${file.name}</span>
          <span style="color:rgba(255,255,255,0.6);font-size:11px;margin-left:8px">(${sizeDisplay})</span><br>
          <button id="whl_send_file_btn" class="sp-btn sp-btn-primary" style="margin-top:6px;padding:6px 12px">
            📤 Enviar para chat ativo
          </button>`;
        
        document.getElementById('whl_send_file_btn')?.addEventListener('click', async () => {
          await sendFileToActiveChat(file);
        });
      }
    };
    
    input.click();
  }

  async function sendFileToActiveChat(file) {
    const hint = document.getElementById('sp_image_hint');
    if (hint) {
      hint.innerHTML = '<span style="color:#2196f3">📤 Enviando arquivo...</span>';
    }

    try {
      const base64 = await fileToBase64(file);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        throw new Error('Nenhuma aba ativa encontrada');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'WHL_SEND_FILE_MESSAGE',
        fileData: base64,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size
      });

      if (response?.success) {
        if (hint) {
          hint.innerHTML = '<span style="color:#4caf50">✅ Arquivo enviado!</span>';
        }
      } else {
        throw new Error(response?.error || 'Falha ao enviar');
      }

    } catch (error) {
      console.error('[FileHandler] ❌ Erro ao enviar:', error);
      if (hint) {
        hint.innerHTML = `<span style="color:#f44336">❌ ${error.message}</span>`;
      }
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function updateRecordingUI(recording) {
    const btn = document.getElementById('sp_record_audio');
    if (!btn) return;
    
    if (recording) {
      btn.innerHTML = '⏹️ Parar Gravação';
      btn.style.background = 'linear-gradient(135deg, #ea4335, #c62828)';
      btn.style.color = '#fff';
    } else {
      btn.innerHTML = '🎤 Gravar Áudio';
      btn.style.background = '';
      btn.style.color = '';
    }
  }

  // ============================================
  // API PÚBLICA
  // ============================================
  window.AudioFileHandler = {
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording: () => isRecording,
    selectAndSendFile,
    sendAudioToActiveChat,
    getRecordedAudio: () => recordedAudioBlob
  };

  console.log('[AudioFileHandler] ✅ Módulo v7.5.1 carregado (API própria, sem Store)');
})();
