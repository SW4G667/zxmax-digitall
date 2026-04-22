# Project Memory

## Core
- Stack: React SPA, Supabase (DB, Auth, Edge Functions, Storage).
- Visual: Glass-card, light/dark themes, purple/blue gradients, Poppins/Inter fonts.
- UI: GGMAX-style product pages. Header has Discord link. No sticky top banners.
- Auth: Real Supabase Auth (signUp/signIn). Discord OAuth via edge function. Email verification required.
- Admin: user_roles table with has_role() security definer function. admin@keybot.com is admin.
- Payments: AbacatePay (PIX). Stripe removed. Min R$0.50.
- Bans: bans table. BannedScreen blocks access. Admin can ban/unban by UUID.
- Storage: documents + chat-attachments buckets with RLS.

## Memories
- [Visual Identity](mem://style/identidade-visual) — Glass-card aesthetic, colors, fonts, GGMAX product page style
- [Auth & Access](mem://features/autenticacao-e-acesso) — Real Supabase auth, Discord OAuth edge function, ban system
- [Marketplace Features](mem://features/marketplace-funcionalidades) — Digital products, delivery, transaction chats, mobile layout
- [Payments & Financials](mem://features/financeiro-e-pagamentos) — AbacatePay edge function, checkout flow, withdrawal rules via Pix
- [Admin Panel](mem://features/painel-admin) — Fees, moderation flow, team chat, disputes, global announcements
- [Tech Stack](mem://tech/arquitetura-e-dados) — React SPA, Supabase backend, AuthProvider + StoreProvider architecture
- [Notifications](mem://features/comunicacao-e-notificacoes) — Bell tabs, UI constraints, badge logic, header layout
