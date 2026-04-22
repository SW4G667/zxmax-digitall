# Guia de Restauração ZXMAX

Seus créditos estão acabando, então use este prompt em uma nova conta ou outra IA para finalizar as funcionalidades que foram simplificadas para remover a tela branca.

## Prompt para Copiar e Colar:

> "Olá! Estou desenvolvendo o site ZXMAX (Marketplace Digital). O site já está funcional e sem erros de tela branca, mas algumas abas do Painel Admin e o sistema de notificações foram simplificados para garantir a estabilidade no Render.
>
> **O que eu preciso:**
> 1. **AdminView.tsx:** Restaure as abas de 'Compras', 'Saques', 'Suporte' e 'Avisos'. Certifique-se de que o código use `state.purchases`, `state.withdrawals`, `state.tickets` e `state.globalNotices` corretamente. **Importante:** Não tente acessar `state.users`, pois esse campo não existe no `AppState` atual (o gerenciamento de usuários deve ser feito via Supabase).
> 2. **NotificationBell.tsx:** Melhore o visual das notificações seguindo o estilo original (usando os emojis customizados `BagCheckEmoji`, `StarEmoji`, etc.), mas mantenha a proteção `isBrowser` para não quebrar o `localStorage`.
> 3. **StoreContext.tsx:** Verifique se todas as funções de mutação (como `approvePurchase`, `rejectWithdraw`, etc.) estão completas e atualizando o estado corretamente.
>
> **Regra de Ouro:** Nunca acesse `localStorage`, `window` ou `document` fora de um `useEffect` ou sem a verificação `if (typeof window !== 'undefined')`. Toda a aplicação deve estar envolvida pelo `StoreProvider` e `AuthProvider` no `App.tsx`."

## O que foi salvo para você:
- O site agora **abre** e permite **login**.
- As rotas SPA no Render estão configuradas (não dá erro ao dar F5).
- O cliente Supabase está protegido contra erros de build.
