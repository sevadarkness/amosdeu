/**
 * WhatsHybrid Backend - Recover Routes v7.5.0
 * Endpoints para suporte ao módulo Recover Advanced
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Diretório para armazenar dados de recover
const RECOVER_DIR = path.join(__dirname, '../../data/recover');

// Garantir que diretório existe
if (!fs.existsSync(RECOVER_DIR)) {
  fs.mkdirSync(RECOVER_DIR, { recursive: true });
}

/**
 * POST /api/recover/sync
 * Sincronizar mensagens recuperadas com o backend
 */
router.post('/sync', async (req, res) => {
  try {
    const { messages, timestamp, userId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    
    // Salvar no arquivo por usuário/sessão
    const filename = `recover_${userId || 'default'}_${Date.now()}.json`;
    const filepath = path.join(RECOVER_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({
      timestamp,
      count: messages.length,
      messages
    }, null, 2));
    
    console.log(`[Recover] Synced ${messages.length} messages to ${filename}`);
    
    res.json({
      success: true,
      synced: messages.length,
      filename
    });
  } catch (error) {
    console.error('[Recover] Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recover/history
 * Obter histórico de mensagens recuperadas
 */
router.get('/history', async (req, res) => {
  try {
    const { userId, limit = 100 } = req.query;
    
    // Listar arquivos de recover
    const files = fs.readdirSync(RECOVER_DIR)
      .filter(f => f.startsWith(`recover_${userId || 'default'}`))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      return res.json({ messages: [], total: 0 });
    }
    
    // Carregar último arquivo
    const latest = path.join(RECOVER_DIR, files[0]);
    const data = JSON.parse(fs.readFileSync(latest, 'utf8'));
    
    res.json({
      messages: data.messages?.slice(0, limit) || [],
      total: data.count || 0,
      timestamp: data.timestamp
    });
  } catch (error) {
    console.error('[Recover] History error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/transcribe
 * Transcrever áudio para texto (8.2)
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { audio } = req.body;
    
    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }
    
    // Por enquanto, retornar placeholder
    // Em produção, integrar com OpenAI Whisper ou Google Speech-to-Text
    console.log('[Recover] Transcription requested');
    
    // Se tiver OpenAI configurado, usar Whisper
    if (process.env.OPENAI_API_KEY) {
      // TODO: Implementar integração com Whisper API
      // const transcription = await openai.audio.transcriptions.create(...)
    }
    
    res.json({
      success: true,
      text: '[Transcrição não disponível - configure OPENAI_API_KEY para usar Whisper]'
    });
  } catch (error) {
    console.error('[Recover] Transcription error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ocr
 * Extrair texto de imagem (8.3)
 */
router.post('/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }
    
    // Por enquanto, retornar placeholder
    // Em produção, integrar com Tesseract ou Google Vision
    console.log('[Recover] OCR requested');
    
    res.json({
      success: true,
      text: '[OCR não disponível - instale Tesseract para extrair texto]'
    });
  } catch (error) {
    console.error('[Recover] OCR error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media/download
 * Download ativo de mídia do WhatsApp (8.1)
 */
router.post('/media/download', async (req, res) => {
  try {
    const { mediaKey, directPath, mimetype } = req.body;
    
    if (!mediaKey) {
      return res.status(400).json({ error: 'Media key required' });
    }
    
    // Placeholder - em produção, implementar download real
    console.log('[Recover] Media download requested:', mediaKey?.substring(0, 20));
    
    res.json({
      success: false,
      message: 'Media download não implementado no backend - use cache local'
    });
  } catch (error) {
    console.error('[Recover] Media download error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
