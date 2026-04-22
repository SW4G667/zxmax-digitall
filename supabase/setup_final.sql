-- 1. FUNÇÃO DE SEGURANÇA PARA VERIFICAR FUNÇÕES (ROLES)
-- Esta função permite verificar se o usuário atual tem uma função específica (admin, seller, etc.)
CREATE OR REPLACE FUNCTION public.tem_funcao(funcao_requerida text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = funcao_requerida 
    FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CONFIGURAÇÃO DE STORAGE (BUCKETS E RLS)
-- Criar buckets se não existirem
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Limpar políticas antigas para evitar conflitos (opcional, mas recomendado)
DROP POLICY IF EXISTS "Dono pode ver seus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem ver todos os documentos" ON storage.objects;
DROP POLICY IF EXISTS "Dono pode subir seus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode ver anexos de chat" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados podem subir anexos" ON storage.objects;

-- RLS para bucket 'documentos' (Privado)
CREATE POLICY "Dono pode ver seus documentos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documentos' AND auth.uid() = owner );

CREATE POLICY "Admins podem ver todos os documentos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documentos' AND public.tem_funcao('admin') );

CREATE POLICY "Dono pode subir seus documentos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'documentos' AND auth.uid() = owner );

-- RLS para bucket 'chat-attachments' (Público para leitura)
CREATE POLICY "Qualquer um pode ver anexos de chat"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-attachments' );

CREATE POLICY "Usuarios autenticados podem subir anexos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'chat-attachments' AND auth.role() = 'authenticated' );

-- 3. GARANTIR QUE O ADMIN@KEYBOT.COM SEJA ADMIN NO BANCO
-- Execute isso para garantir que o perfil de admin já existente seja promovido
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@keybot.com';
