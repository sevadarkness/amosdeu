#!/bin/bash
echo "🚀 WhatsHybrid Backend v7.5.0"
echo "=============================="
echo "👤 Admin: sevaland10@gmail.com"
echo "🔑 OpenAI: Configurado ✅"
echo "🔑 Groq (fallback): Configurado ✅"
echo ""

mkdir -p data

if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

echo ""
echo "🟢 Iniciando servidor..."
echo "   http://localhost:4000"
echo ""
npm start
