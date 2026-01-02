# WhatsHybrid Backend API

Backend Enterprise para WhatsHybrid Pro.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Copiar configuração
cp .env.example .env

# Editar .env com suas configurações
nano .env

# Iniciar em desenvolvimento
npm run dev

# Iniciar em produção
npm start
```

## 📋 API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/register` | Registrar novo usuário |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Renovar token |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Usuário atual |
| PUT | `/api/v1/auth/password` | Alterar senha |

### Contatos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/contacts` | Listar contatos |
| GET | `/api/v1/contacts/:id` | Obter contato |
| POST | `/api/v1/contacts` | Criar contato |
| PUT | `/api/v1/contacts/:id` | Atualizar contato |
| DELETE | `/api/v1/contacts/:id` | Excluir contato |
| POST | `/api/v1/contacts/import` | Importar contatos |

### Conversas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/conversations` | Listar conversas |
| GET | `/api/v1/conversations/:id` | Obter conversa com mensagens |
| POST | `/api/v1/conversations/:id/messages` | Adicionar mensagem |
| PUT | `/api/v1/conversations/:id` | Atualizar conversa |

### Campanhas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/campaigns` | Listar campanhas |
| GET | `/api/v1/campaigns/:id` | Obter campanha |
| POST | `/api/v1/campaigns` | Criar campanha |
| PUT | `/api/v1/campaigns/:id` | Atualizar campanha |
| DELETE | `/api/v1/campaigns/:id` | Excluir campanha |

### CRM (Deals & Pipeline)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/crm/deals` | Listar negócios |
| POST | `/api/v1/crm/deals` | Criar negócio |
| GET | `/api/v1/crm/pipeline` | Obter estágios do pipeline |
| POST | `/api/v1/crm/pipeline/stages` | Criar estágio |
| GET | `/api/v1/crm/labels` | Listar labels |
| POST | `/api/v1/crm/labels` | Criar label |

### Tasks
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/tasks` | Listar tarefas |
| GET | `/api/v1/tasks/overdue` | Tarefas atrasadas |
| POST | `/api/v1/tasks` | Criar tarefa |
| POST | `/api/v1/tasks/:id/complete` | Concluir tarefa |

### Templates
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/templates` | Listar templates |
| POST | `/api/v1/templates` | Criar template |
| POST | `/api/v1/templates/:id/use` | Registrar uso |

### Analytics
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/analytics/dashboard` | Dashboard completo |
| POST | `/api/v1/analytics/events` | Registrar evento |
| GET | `/api/v1/analytics/events` | Listar eventos |

### AI
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/ai/complete` | Completar com IA |
| GET | `/api/v1/ai/credits` | Créditos disponíveis |
| GET | `/api/v1/ai/usage` | Histórico de uso |
| GET | `/api/v1/ai/knowledge` | Knowledge base |
| POST | `/api/v1/ai/knowledge` | Adicionar conhecimento |

### Webhooks
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/webhooks` | Listar webhooks |
| POST | `/api/v1/webhooks` | Criar webhook |
| POST | `/api/v1/webhooks/:id/test` | Testar webhook |
| POST | `/api/v1/webhooks/incoming/:workspaceId` | Receber webhook |

### Settings
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/settings/workspace` | Config do workspace |
| PUT | `/api/v1/settings/workspace` | Atualizar workspace |
| PUT | `/api/v1/settings/ai-keys` | Configurar chaves AI |
| GET | `/api/v1/settings/export` | Exportar dados |

## 🔐 Autenticação

Todas as rotas (exceto auth) requerem JWT:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.example.com/api/v1/contacts
```

## 🔌 WebSocket Events

Conecte via Socket.IO para eventos em tempo real:

```javascript
const socket = io('http://localhost:3000');

socket.emit('join:workspace', workspaceId);

socket.on('contact:created', (contact) => { ... });
socket.on('message:created', (message) => { ... });
socket.on('campaign:updated', (campaign) => { ... });
socket.on('task:completed', (task) => { ... });
socket.on('deal:created', (deal) => { ... });
```

## 🗄️ Banco de Dados

SQLite por padrão. Tabelas:
- users
- workspaces
- contacts
- conversations
- messages
- campaigns
- templates
- deals
- pipeline_stages
- tasks
- labels
- analytics_events
- webhooks
- webhook_logs
- ai_conversations
- knowledge_base
- refresh_tokens

## 📁 Estrutura

```
backend/
├── config/
│   └── index.js
├── src/
│   ├── controllers/
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── contacts.js
│   │   ├── conversations.js
│   │   ├── campaigns.js
│   │   ├── analytics.js
│   │   ├── crm.js
│   │   ├── tasks.js
│   │   ├── templates.js
│   │   ├── webhooks.js
│   │   ├── ai.js
│   │   └── settings.js
│   ├── services/
│   ├── utils/
│   │   ├── database.js
│   │   └── logger.js
│   └── server.js
├── .env.example
└── package.json
```

## 🚀 Deploy

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### Environment Variables

```env
PORT=3000
NODE_ENV=production
DATABASE_PATH=./data/whatshybrid.db
JWT_SECRET=your-production-secret
```

## 📊 Rate Limits

| Endpoint | Limite |
|----------|--------|
| Geral | 100 req/15min |
| Auth | 5 req/15min |
| AI | 20 req/min |
| Webhooks | 100 req/min |

## 📝 License

MIT
