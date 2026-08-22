#!/usr/bin/env bash
#
# ZXMAX — Deploy do backend no Supabase (Edge Functions + Migrações)
# ==================================================================
# Execute ESTE script com seu token de acesso do Supabase:
#
#   1) Gere um token em:  https://supabase.com/dashboard/account/tokens
#      (Personal Access Token — começa com "sbp_")
#
#   2) Rode:
#        export SUPABASE_ACCESS_TOKEN="sbp_xxx"
#        export SUPABASE_PROJECT_REF="dbekdedzgkfgtlytrnyw"
#        ./scripts/deploy-supabase.sh
#
# Ou passe como argumento:  ./scripts/deploy-supabase.sh sbp_xxx
#
# Requisitos: Node.js 18+ e o CLI do Supabase instalado.
#   brew install supabase/tap/supabase   (Mac)
#   npm install -g supabase              (Linux/Windows com Node)
#   ou: npx supabase@latest ...          (sem instalar)
#
set -euo pipefail

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-${1:-}}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-dbekdedzgkfgtlytrnyw}"
USE_NPX="0"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Informe seu token: SUPABASE_ACCESS_TOKEN=sbp_xxx ou passe como 1º argumento."
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "⚠️  supabase CLI não encontrado. Vou usar \`npx supabase@latest\`."
  USE_NPX="1"
fi

sb() {
  if [ "$USE_NPX" = "1" ]; then
    npx --yes supabase@latest "$@"
  else
    supabase "$@"
  fi
}

export SUPABASE_ACCESS_TOKEN

echo "📦 Projeto: $PROJECT_REF"
echo "🔑 Token: presente (não exibido)"

echo ""
echo "==> 1/3 Vinculando ao projeto..."
sb link --project-ref "$PROJECT_REF"

echo ""
echo "==> 2/3 Aplicando migrações do banco (cria tabelas, RLS, view products_public)..."
sb db push

echo ""
echo "==> 3/3 Deploy das Edge Functions..."
FUNCTIONS=(
  admin-login
  admin-verify
  create-purchase
  create-evopay-pix
  check-evopay-status
  evopay-webhook
  evopay-withdraw
  mark-order-delivered
  order-action
  integrations-config
  discord-callback
  create-stripe-checkout
  create-vexopay-crypto
  send-email
)
for fn in "${FUNCTIONS[@]}"; do
  echo "   - deploy ${fn} ..."
  if ! sb functions deploy "$fn" 2>&1; then
    echo "   ⚠️  Falha em $fn (seguindo com as próximas). Verifique as secrets dela."
  fi
done

echo ""
echo "✅ Backend atualizado. Agora configure as SECRETS no dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
echo ""
echo "   Rode com as secrets (uma por vez, sem expor em log):"
for s in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY EVOPAY_API_KEY; do
  echo "   - sb secrets set $s=<valor>"
done
echo ""
echo "   Obrigatórias para o login admin e a verificação funcionarem:"
echo "   - SUPABASE_SERVICE_ROLE_KEY  (aprovação de verificação/produtos)"
echo "   - EVOPAY_API_KEY             (Pagamento Pix)"
echo "   - RESEND_API_KEY             OPCIONAL — o login admin usa OTP do Supabase Auth"
echo ""
echo "   No painel: Authentication -> Providers -> Email -> ligue 'Enable Email provider'."
echo ""
echo "Depois de tudo, FAÇA REDEPLOY do frontend na Vercel (as envs VITE_* já devem estar lá)."
