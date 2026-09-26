# 🚀 ZXMAX Digital

> **Marketplace moderno de produtos digitais com notificações em tempo real**

[![Live Demo](https://img.shields.io/badge/Demo-zxmax.vercel.app-blue?style=for-the-badge&logo=vercel)](https://zxmax.vercel.app)
[![Built with React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20&%20Realtime-3fcf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Stripe Integration](https://img.shields.io/badge/Stripe-Payments-635bff?style=for-the-badge&logo=stripe)](https://stripe.com)

---

## ✨ Sobre o Projeto

**ZXMAX** é uma plataforma digital de marketplace construída para facilitar a compra e venda de produtos digitais com uma experiência visual moderna, intuitiva e segura.

### 🎯 Características Principais

- 📦 **Catálogo de Produtos Digitais** - Browse, busca e filtros avançados
- 🛒 **Carrinho de Compras** - Checkout rápido e seguro com Stripe
- 💳 **Pagamentos Seguros** - Integração completa com Stripe e validação de servidor
- 🔐 **Autenticação** - Login/Registro com Supabase Auth
- 💬 **Perguntas e Respostas** - Sistema de Q&A entre comprador e vendedor
- ⭐ **Avaliações** - Reviews com estrelas de clientes verificados
- 🔔 **Notificações Discord** - Avisos em tempo real para eventos importantes
- 👤 **Gestão de Conta** - Segurança, dados pessoais e integrações
- 💰 **Sistema de Saque** - Processamento seguro de pagamentos aos vendedores

---

## 🏗️ Arquitetura Técnica

### Frontend
- **React 18** com TypeScript
- **TanStack Router** para navegação
- **Tailwind CSS** + **Lucide Icons** para UI moderna
- **Sonner** para notificações toast
- **React Context API** para gerenciamento de estado

### Backend
- **Supabase** - Database PostgreSQL + Auth + Real-time
- **Edge Functions (Deno)** - Lógica serverless
- **Stripe Webhooks** - Processamento de pagamentos
- **Vault Secrets** - Armazenamento seguro de URLs de webhook Discord

### Segurança
- ✅ JWT authentication em todas as Edge Functions
- ✅ Row Level Security (RLS) no banco de dados
- ✅ Secrets no Vault - URLs de webhook nunca expostas
- ✅ Server-side validation de eventos
- ✅ Proteção contra CORS em endpoints
- ✅ Rate limiting automático do Discord

---

## 🎨 Features Recentes

### 🔔 Integração Segura com Discord (v1.0)

Vendedores podem receber notificações automáticas no Discord para:

- **Venda Confirmada** - Aviso imediato após confirmação de pagamento
- **Nova Pergunta** - Alerta quando um cliente questiona o produto
- **Nova Avaliação** - Notificação de reviews válidos

**Segurança:**
- URLs de webhook armazenadas no Vault (nunca em banco expostos)
- Sem acesso ao conteúdo da pergunta/comentário via Discord
- Redireciona para a plataforma para ver detalhes completos
- Idempotência garantida (sem duplicação de envios)
- Respeita rate limits do Discord automaticamente

---

## 🚀 Getting Started

### Pré-requisitos
- **Node.js** 18+ (recomendado usar [nvm](https://github.com/nvm-sh/nvm))
- **npm** ou **yarn**
- Conta **Supabase** (free tier funciona)
- Chave **Stripe** (para pagamentos)

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/SW4G667/zxmax-digitall.git
cd zxmax-digitall

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase e Stripe

# Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

---

## 📁 Estrutura do Projeto

```
zxmax-digitall/
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   │   ├── DiscordWebhookSettings.tsx    # Configuração de notificações
│   │   ├── AppShell.tsx
│   │   └── ...
│   ├── pages/              # Páginas da aplicação
│   │   ├── Configuracoes.tsx            # Configurações de conta
│   │   ├── Produto.tsx
│   │   ├── Checkout.tsx
│   │   └── ...
│   ├── store/              # Contexto e lógica de estado
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilitários e helpers
│   └── integrations/       # Integrações (Supabase, Stripe)
├── supabase/
│   ├── functions/          # Edge Functions serverless
│   │   ├── manage-discord-webhooks/     # Gerenciar integrações
│   │   ├── deliver-discord-webhook/     # Entregar notificações
│   │   ├── notify-product-event/        # Disparar eventos
│   │   ├── stripe-webhook/              # Processar pagamentos
│   │   └── ...
│   └── migrations/         # Migrações do banco de dados
└── src/test/               # Testes unitários e integração
```

---

## 🔗 Fluxo de Notificações Discord

```
┌─────────────────┐
│  Evento Real    │  (Venda, Pergunta, Avaliação)
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  notify-product-event        │  (Edge Function)
│  - Valida permissões         │
│  - Valida evento             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  deliver-discord-webhook     │  (Edge Function)
│  - Busca webhook no Vault    │
│  - Claim idempotência        │
│  - Envia embed ao Discord    │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Discord                     │  (Notificação entregue)
│  - Embed formatado           │
│  - Sem URL de webhook        │
│  - Redireciona para ZXMAX    │
└──────────────────────────────┘
```

---

## 🧪 Testes

```bash
# Rodar testes unitários
npm run test

# Testes específicos
npm run test -- discordWebhookBoundary.test.ts
npm run test -- questionsAndCheckout.test.tsx

# Coverage
npm run test:coverage
```

Cobertura de testes para:
- ✅ Segurança de webhook Discord
- ✅ Validação de eventos
- ✅ Fluxo de perguntas e checkout
- ✅ Integração com Stripe

---

## 📚 Documentação

### Endpoints Edge Functions

#### `manage-discord-webhooks` (Autenticado)
Gerenciar integrações de Discord do usuário.

```typescript
POST /functions/v1/manage-discord-webhooks
Authorization: Bearer <JWT>

// Listar
{ action: "list" }

// Adicionar/atualizar
{ action: "set", eventType: "sale_confirmed", webhookUrl: "https://discord.com/api/webhooks/..." }

// Ativar/pausar
{ action: "toggle", eventType: "product_question", active: true }

// Remover
{ action: "remove", eventType: "product_review" }
```

#### `deliver-discord-webhook` (Service Role Only)
Entregar notificação ao Discord.

```typescript
POST /functions/v1/deliver-discord-webhook
Authorization: Bearer <SERVICE_ROLE_KEY>

{
  userId: "uuid",
  eventType: "sale_confirmed" | "product_question" | "product_review",
  eventId: 123
}
```

---

## 🔐 Variáveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key

# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_live_seu_stripe_key

# URLs
VITE_APP_URL=https://zxmax.vercel.app
```

---

## 🎯 Roadmap

- [ ] Sistema de afiliados
- [ ] Certificados digitais para produtos
- [ ] Análise de vendas (dashboard do vendedor)
- [ ] Suporte a múltiplas moedas
- [ ] Integração com mais plataformas (Telegram, WhatsApp)
- [ ] Marketplace de temas/templates
- [ ] API pública para integrações

---

## 🤝 Contribuições

Contribuições são bem-vindas! Por favor:

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📝 Licença

Este projeto é propriedade de **SW4G667**. Todos os direitos reservados.

---

## 💬 Suporte

Dúvidas? Abra uma [issue](https://github.com/SW4G667/zxmax-digitall/issues) ou entre em contato através da plataforma.

---

## 🙌 Agradecimentos

- [Lovable](https://lovable.dev) - Plataforma de desenvolvimento
- [Supabase](https://supabase.com) - Backend open-source
- [Stripe](https://stripe.com) - Processamento de pagamentos
- [React](https://react.dev) - Biblioteca JavaScript
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS

---

<div align="center">

**Made with ❤️ by [SW4G667](https://github.com/SW4G667)**

*Transformando ideias digitais em realidade* 🚀

</div>
