/**
 * RECOVER SYNC ROUTES v7.5.0
 * Endpoints para sincronização do Recover
 */

const express = require('express');
const router = express.Router();

// Armazenamento temporário (em produção usar MongoDB/PostgreSQL)
const recoverStorage = new Map();

/**
 * POST /api/recover/sync
 * Recebe mensagens do cliente para sincronizar
 */
router.post('/sync', async (req, res) => {
    try {
        const { userId, messages } = req.body;
        
        if (!userId || !Array.isArray(messages)) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId e messages são obrigatórios' 
            });
        }
        
        // Obter mensagens existentes do usuário
        let userMessages = recoverStorage.get(userId) || [];
        
        // Mesclar novas mensagens (evitar duplicatas)
        const existingIds = new Set(userMessages.map(m => m.id));
        const newMessages = messages.filter(m => !existingIds.has(m.id));
        
        userMessages = [...userMessages, ...newMessages];
        
        // Limitar a 10000 mensagens por usuário
        if (userMessages.length > 10000) {
            userMessages = userMessages.slice(-10000);
        }
        
        recoverStorage.set(userId, userMessages);
        
        res.json({
            success: true,
            synced: newMessages.length,
            total: userMessages.length
        });
        
    } catch (error) {
        console.error('[Recover Sync] Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/recover/messages
 * Retorna mensagens do usuário
 */
router.get('/messages', async (req, res) => {
    try {
        const { userId, since = 0, limit = 100 } = req.query;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId é obrigatório' 
            });
        }
        
        const userMessages = recoverStorage.get(userId) || [];
        
        // Filtrar por timestamp
        let messages = userMessages.filter(m => m.timestamp > parseInt(since));
        
        // Ordenar por timestamp (mais recentes primeiro)
        messages.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limitar
        messages = messages.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            messages,
            total: userMessages.length
        });
        
    } catch (error) {
        console.error('[Recover Sync] Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * DELETE /api/recover/clear
 * Limpa mensagens do usuário
 */
router.delete('/clear', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId é obrigatório' 
            });
        }
        
        recoverStorage.delete(userId);
        
        res.json({
            success: true,
            message: 'Histórico limpo'
        });
        
    } catch (error) {
        console.error('[Recover Sync] Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /api/recover/ai/transcribe
 * Transcreve áudio para texto (usa serviço externo)
 */
router.post('/ai/transcribe', async (req, res) => {
    try {
        const { audioData } = req.body;
        
        if (!audioData) {
            return res.status(400).json({ 
                success: false, 
                error: 'audioData é obrigatório' 
            });
        }
        
        // TODO: Integrar com Whisper API ou similar
        // Por enquanto, retorna erro informativo
        res.json({
            success: false,
            error: 'Serviço de transcrição não configurado. Configure a API do Whisper nas configurações do backend.'
        });
        
    } catch (error) {
        console.error('[Recover AI] Erro transcrição:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /api/recover/ai/ocr
 * Extrai texto de imagem
 */
router.post('/ai/ocr', async (req, res) => {
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false, 
                error: 'imageData é obrigatório' 
            });
        }
        
        // TODO: Integrar com Tesseract ou API de OCR
        res.json({
            success: false,
            error: 'Serviço de OCR não configurado. Configure a API nas configurações do backend.'
        });
        
    } catch (error) {
        console.error('[Recover AI] Erro OCR:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /api/recover/ai/sentiment
 * Analisa sentimento do texto
 */
router.post('/ai/sentiment', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ 
                success: false, 
                error: 'text é obrigatório' 
            });
        }
        
        // Análise simples de sentimento (sem API externa)
        const positiveWords = ['bom', 'ótimo', 'excelente', 'feliz', 'obrigado', 'parabéns', 'amor', 'adorei', 'top', 'show', 'maravilhoso', 'incrível'];
        const negativeWords = ['ruim', 'péssimo', 'horrível', 'triste', 'chato', 'raiva', 'ódio', 'problema', 'erro', 'nunca', 'não'];
        
        const textLower = text.toLowerCase();
        let score = 0;
        
        positiveWords.forEach(word => {
            if (textLower.includes(word)) score += 0.2;
        });
        
        negativeWords.forEach(word => {
            if (textLower.includes(word)) score -= 0.2;
        });
        
        // Normalizar score entre -1 e 1
        score = Math.max(-1, Math.min(1, score));
        
        let label = 'neutro';
        if (score > 0.1) label = 'positivo';
        else if (score < -0.1) label = 'negativo';
        
        res.json({
            success: true,
            score,
            label,
            confidence: Math.abs(score)
        });
        
    } catch (error) {
        console.error('[Recover AI] Erro sentimento:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
