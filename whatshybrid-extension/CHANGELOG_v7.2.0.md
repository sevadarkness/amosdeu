# WhatsHybrid v7.2.0 - SmartBot IA Edition

## 🚀 Release Notes - Janeiro 2026

### ✨ Novas Funcionalidades

#### 🧠 SmartBot IA Core (4 sistemas)

##### 1. Advanced Context Analyzer
- **Perfil de Cliente**: Rastreia histórico de interações, preferências de tom, score de satisfação
- **Detecção de Fluxo**: Identifica estágios da conversa (saudação, pergunta, reclamação, resolução)
- **Análise de Sentimento**: Avalia tom emocional das mensagens com tendência e volatilidade
- **Detecção de Urgência**: Calcula nível de urgência baseado em múltiplos fatores
- **Clusters de Tópicos**: Identifica automaticamente temas das conversas

##### 2. Intelligent Priority Queue
- **Priorização Automática**: Mensagens são priorizadas de 0-100
- **Retry com Backoff**: Tentativas automáticas com redução de prioridade
- **Processamento Sequencial**: Delay configurável entre processamentos

##### 3. Continuous Learning System
- **Coleta de Feedback**: Registra respostas e avaliações
- **Extração de Padrões**: Analisa n-grams (uni, bi, tri-grams)
- **Base de Conhecimento**: Armazena respostas bem avaliadas
- **Otimização Automática**: Remove padrões de baixa confiança

##### 4. Smart Metrics System
- **Métricas em Tempo Real**: Messages, responses, sentiment, responseTime
- **Detecção de Anomalias**: escalationRate > 30%, negativeRate > 40%
- **Alertas Automáticos**: Eventos disparados quando anomalias são detectadas

---

#### 🧠 SmartBot IA Extended (9 sistemas adicionais)

##### 5. Dialog Manager - Máquina de Estados
- **Fluxos de Diálogo**: Registra diálogos com estados e transições
- **Triggers Múltiplos**: String, Regex, Intent, Entity, Sentiment, Keyword
- **Condições**: Avaliação de condições para transições
- **Hooks**: onEnter, onExit, onTransition
- **Timeout**: Timeout configurável por diálogo
- **Ações**: set, increment, emit

##### 6. Entity Manager - Extração de Entidades
- **Extractors Padrão**: email, phone, cpf, cnpj, cep, date, time, money, url, order_number
- **Validação**: CPF com dígitos verificadores
- **Normalização**: Formatos padronizados
- **Fuzzy Matching**: Similaridade Levenshtein
- **Custom Entities**: Registra listas customizadas
- **Sinônimos**: Mapeia sinônimos para canônico

##### 7. Intent Manager - Classificação de Intenções
- **12 Intenções Padrão**: greeting, farewell, question, complaint, urgent, purchase_interest, technical_support, information, cancellation, thanks, confirmation, negation
- **Pattern Matching**: Regex + Keywords
- **Scoring**: Prioridade + Contexto + Sentimento
- **Training**: Adiciona exemplos de treinamento
- **Confidence Threshold**: Configurável

##### 8. Human Assistance System - Escalação
- **Fila de Prioridade**: Ordenada por urgência, sentimento, VIP, wait time
- **Gestão de Agentes**: Register, status (online/offline/busy/away), skills
- **Auto-Assignment**: Atribuição automática baseada em skills e carga
- **Transferência**: Transfere chat entre agentes
- **Métricas**: totalEscalations, resolved, avgWaitTime, avgHandleTime

##### 9. Cache Manager - LRU com TTL
- **LRU Eviction**: Remove menos usados quando cheio
- **TTL**: Time-to-live configurável por entrada
- **getOrSet**: Factory function para cache miss
- **Stats**: hits, misses, evictions, hitRate
- **Cleanup**: Limpeza periódica de expirados

##### 10. Rate Limit Manager - Token Bucket
- **Token Bucket Algorithm**: Tokens + refill rate + interval
- **Block Duration**: Bloqueio temporário ao exceder
- **Per-Key Limits**: Configuração por chave/recurso
- **Status**: tokens, remaining, resetAt
- **Manual Block/Unblock**: Controle manual

##### 11. Context Manager - Contexto Aninhado
- **Nested Keys**: Suporta "user.profile.name"
- **TTL por Chave**: Expiração individual
- **Merge**: Mescla dados
- **Push**: Adiciona a arrays com limite
- **Increment**: Incrementa numéricos
- **Cleanup**: Remove contextos inativos

##### 12. Session Manager - Lifecycle
- **Create/Get/Update**: CRUD de sessões
- **Touch**: Renova atividade
- **Auto-Expire**: Timeout configurável
- **Eviction**: Remove mais antigas quando cheio
- **Callbacks**: onExpire hook

##### 13. Feedback Analyzer - Análise Avançada
- **Sentiment Analysis**: Baseado em rating + keywords
- **NPS Calculation**: Net Promoter Score
- **Top Issues/Praises**: Ranking de problemas e elogios
- **Trends**: Tendências por dia
- **Search**: Busca por critérios
- **Reports**: Relatórios completos

---

### 📊 API de Integração (Extensão)

```javascript
// Core
window.smartBot.analyzeMessage(chatId, message, history)
window.SmartBotIntegration.analyze(chatId, messages, currentMessage)

// Extended
window.smartBotExtended.processMessage(chatId, message, options)
window.smartBotExtended.dialogManager.startDialog(chatId, dialogId, data)
window.smartBotExtended.entityManager.extractAll(text)
window.smartBotExtended.intentManager.classify(text, context)
window.smartBotExtended.humanAssistance.requestEscalation(chatId, context)
window.smartBotExtended.feedbackAnalyzer.addFeedback(feedback)
```

---

### 📡 API REST (Backend)

#### SmartBot Core (/api/v1/smartbot)
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/analyze` | POST | Análise de mensagem |
| `/feedback` | POST | Registrar feedback |
| `/metrics` | GET | Métricas |

#### SmartBot Extended (/api/v1/smartbot-extended)
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/process` | POST | Processa com todos sistemas |
| `/dialog/register` | POST | Registra diálogo |
| `/dialog/start` | POST | Inicia diálogo |
| `/dialog/process` | POST | Processa input |
| `/dialog/end` | POST | Finaliza diálogo |
| `/dialog/active` | GET | Lista ativos |
| `/entity/extract` | POST | Extrai entidades |
| `/entity/register` | POST | Registra custom |
| `/intent/classify` | POST | Classifica intenção |
| `/intent/register` | POST | Registra intenção |
| `/intent/train` | POST | Adiciona exemplo |
| `/escalation/request` | POST | Solicita escalação |
| `/escalation/queue` | GET | Status da fila |
| `/agent/register` | POST | Registra agente |
| `/agent/status` | POST | Define status |
| `/agents` | GET | Lista agentes |
| `/chat/end` | POST | Finaliza chat |
| `/chat/transfer` | POST | Transfere chat |
| `/session/:id` | GET | Obtém sessão |
| `/sessions` | GET | Lista sessões |
| `/context/:id` | GET | Obtém contexto |
| `/context/set` | POST | Define contexto |
| `/feedback` | POST | Adiciona feedback |
| `/feedback/report` | GET | Relatório |
| `/feedback/trends` | GET | Tendências |
| `/ratelimit/configure` | POST | Configura limite |
| `/stats` | GET | Estatísticas gerais |
| `/export` | GET | Exporta dados |

---

### 📦 Arquivos Adicionados

**Extension:**
- `modules/smartbot-ia.js` (42KB) - Core 4 sistemas
- `modules/smartbot-integration.js` (15KB) - Integração
- `modules/smartbot-extended.js` (55KB) - 9 sistemas adicionais

**Backend:**
- `src/ai/services/SmartBotIAService.js` - Core service
- `src/ai/services/SmartBotExtendedService.js` - Extended service
- `src/routes/smartbot.js` - Core routes
- `src/routes/smartbot-extended.js` - Extended routes

---

## Versões Anteriores

### v7.1.0
- Correção de API key masking
- Correção de escopo de funções
- Bridge Chrome messaging para DOM
- Guards de undefined em providers
- Handler insertSuggestion

### v7.0.0
- Backend API completa
- AIService + CopilotEngine
- Multi-provider AI
- Intent detection
- WebSocket real-time sync
