# WhatsHybrid Pro

WhatsHybrid Pro v7.5 - Sistema completo de automação e CRM para WhatsApp com IA avançada.

## 📁 Estrutura do Projeto

```
amosdeu/
├── whatshybrid-backend/     # Backend API Node.js
├── whatshybrid-extension/   # Extensão Chrome
├── .github/                 # Workflows CI/CD e Dependabot
├── LICENSE                  # Licença MIT
└── .env.example            # Exemplo de variáveis de ambiente
```

## 🚀 Componentes

### Backend API (`whatshybrid-backend/`)

Backend Enterprise para WhatsHybrid Pro com suporte a múltiplos provedores de IA.

**Tecnologias:**
- Node.js 18+
- Express.js
- SQLite/PostgreSQL
- Socket.IO
- JWT Authentication

**Início rápido:**
```bash
cd whatshybrid-backend
npm install
cp .env.example .env
# Edite o .env com suas configurações
npm run dev
```

[Ver documentação completa →](./whatshybrid-backend/README.md)

### Extensão Chrome (`whatshybrid-extension/`)

Extensão Chrome para integração com WhatsApp Web com recursos avançados de IA.

**Recursos:**
- SmartBot IA com múltiplos modelos
- CRM integrado
- Automação de mensagens
- Análise de contexto
- Backup de conversas

**Instalação:**
1. Abra Chrome e acesse `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `whatshybrid-extension`

[Ver documentação completa →](./whatshybrid-extension/README.md)

## 🔧 Configuração

### Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` no diretório do backend e configure:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/whatshybrid.db
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# AI Providers (opcional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
```

## 🧪 CI/CD

O projeto utiliza GitHub Actions para:

- **CI** (`ci.yml`): Lint, testes e validação de código
- **Security** (`security.yml`): CodeQL analysis e audit de dependências
- **Dependabot**: Atualizações automáticas de segurança

## 📝 Licença

MIT License - veja [LICENSE](./LICENSE) para detalhes.

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas e suporte, abra uma issue no GitHub.
