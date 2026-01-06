/**
 * audio-sender.js - Módulo de Envio de Áudio PTT
 *
 * Módulo testado e validado para envio de mensagens de voz (PTT) no WhatsApp Web
 * Utiliza os módulos internos do WhatsApp: MediaPrep, OpaqueData, ChatCollection
 *
 * @version 1.0.0
 * @author User (tested and working)
 */

(function() {
  'use strict';

  const AudioSender = {
    /**
     * Envia um áudio PTT (voice message) para um chat do WhatsApp
     * @param {Blob|string} audio - Blob de áudio ou Data URL (base64)
     * @param {string} chatJid - JID do chat (ex: "5511999999999@c.us") ou null para chat ativo
     * @param {number} duration - Duração em segundos (opcional, default: 5)
     * @returns {Promise<{success: boolean, result?: any, error?: string}>}
     */
    async send(audio, chatJid = null, duration = 5) {
      console.log('[AudioSender] 🎤 Iniciando envio de áudio PTT...');
      console.log('[AudioSender] 🎤 ChatJID:', chatJid);
      console.log('[AudioSender] 🎤 Duration:', duration, 'segundos');

      try {
        // Módulos necessários do WhatsApp Web
        console.log('[AudioSender] 🎤 Carregando módulos WhatsApp...');
        const ChatCollection = window.require('WAWebChatCollection');
        const MediaPrep = window.require('WAWebMediaPrep');
        const OpaqueData = window.require('WAWebMediaOpaqueData');
        console.log('[AudioSender] ✅ Módulos carregados');

        // 1. Obter chat
        console.log('[AudioSender] 🎤 Obtendo chat...');
        const chats = ChatCollection.ChatCollection?.getModelsArray?.() || [];
        let chat = chatJid
          ? chats.find(c => c.id?._serialized === chatJid || c.id?.user === chatJid.split('@')[0])
          : chats.find(c => c.active) || chats[0];

        if (!chat) {
          console.error('[AudioSender] ❌ Chat não encontrado');
          return { success: false, error: 'Chat não encontrado' };
        }
        console.log('[AudioSender] ✅ Chat encontrado:', chat.id?._serialized);

        // 2. Converter para Blob se necessário
        console.log('[AudioSender] 🎤 Convertendo áudio para Blob...');
        let blob;
        if (audio instanceof Blob) {
          blob = audio;
          console.log('[AudioSender] ✅ Áudio já é Blob');
        } else if (typeof audio === 'string') {
          console.log('[AudioSender] 🎤 Convertendo DataURL para Blob...');
          const response = await fetch(audio);
          blob = await response.blob();
          console.log('[AudioSender] ✅ DataURL convertido para Blob');
        } else {
          console.error('[AudioSender] ❌ Formato de áudio inválido:', typeof audio);
          return { success: false, error: 'Formato de áudio inválido' };
        }

        console.log('[AudioSender] 🎤 Blob Size:', blob.size, 'bytes');
        console.log('[AudioSender] 🎤 Blob Type:', blob.type);

        if (blob.size === 0) {
          console.error('[AudioSender] ❌ Arquivo de áudio vazio');
          return { success: false, error: 'Arquivo de áudio vazio' };
        }

        // 3. Criar OpaqueData (formato interno do WhatsApp)
        console.log('[AudioSender] 🎤 Criando OpaqueData...');
        const mediaBlob = await OpaqueData.createFromData(blob, blob.type);
        console.log('[AudioSender] ✅ OpaqueData criado');

        // 4. Criar MediaPrep com Promise
        console.log('[AudioSender] 🎤 Criando MediaPrep...');
        const mediaPropsPromise = Promise.resolve({
          mediaBlob: mediaBlob,
          mimetype: 'audio/ogg; codecs=opus',
          type: 'ptt',
          duration: duration,
          seconds: duration,
          isPtt: true,
          ptt: true
        });

        const mediaPrep = new MediaPrep.MediaPrep('ptt', mediaPropsPromise);
        console.log('[AudioSender] ✅ MediaPrep criado');

        // 5. Aguardar preparação
        console.log('[AudioSender] 🎤 Aguardando preparação de mídia...');
        await mediaPrep.waitForPrep();
        console.log('[AudioSender] ✅ Mídia preparada');

        // 6. Enviar
        console.log('[AudioSender] 🎤 Enviando mensagem de voz...');
        const result = await MediaPrep.sendMediaMsgToChat(mediaPrep, chat, {});
        console.log('[AudioSender] 🎤 Resultado do envio:', result.messageSendResult);

        const success = result.messageSendResult === 'OK';
        if (success) {
          console.log('[AudioSender] ✅ Áudio PTT enviado com sucesso!');
        } else {
          console.warn('[AudioSender] ⚠️ Envio não confirmado:', result.messageSendResult);
        }

        return {
          success: success,
          result: result,
          chatJid: chat.id?._serialized
        };

      } catch (error) {
        console.error('[AudioSender] ❌ Erro ao enviar áudio:', error);
        console.error('[AudioSender] ❌ Stack:', error.stack);
        return { success: false, error: error.message };
      }
    },

    /**
     * Envia áudio a partir de base64
     * @param {string} base64 - Áudio em base64 (sem prefixo data:)
     * @param {string} mimeType - Tipo MIME (ex: 'audio/ogg', 'audio/wav')
     * @param {string} chatJid - JID do chat
     * @param {number} duration - Duração em segundos
     */
    async sendBase64(base64, mimeType, chatJid, duration = 5) {
      console.log('[AudioSender] 📝 Enviando áudio via base64...');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return this.send(dataUrl, chatJid, duration);
    },

    /**
     * Envia áudio a partir de ArrayBuffer
     * @param {ArrayBuffer} arrayBuffer - Buffer do áudio
     * @param {string} mimeType - Tipo MIME
     * @param {string} chatJid - JID do chat
     * @param {number} duration - Duração em segundos
     */
    async sendArrayBuffer(arrayBuffer, mimeType, chatJid, duration = 5) {
      console.log('[AudioSender] 📦 Enviando áudio via ArrayBuffer...');
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return this.send(blob, chatJid, duration);
    },

    /**
     * Verifica se os módulos necessários estão disponíveis
     */
    isAvailable() {
      try {
        window.require('WAWebChatCollection');
        window.require('WAWebMediaPrep');
        window.require('WAWebMediaOpaqueData');
        return true;
      } catch (e) {
        console.warn('[AudioSender] ⚠️ Módulos WhatsApp não disponíveis:', e.message);
        return false;
      }
    }
  };

  // Exportar globalmente
  window.AudioSender = AudioSender;

  console.log('[AudioSender] ✅ Módulo carregado');
  console.log('[AudioSender] Disponível:', AudioSender.isAvailable());

})();
