import { createClient } from "@supabase/supabase-js";

export const SEM_CHAVE_ADMIN =
  "Falta configurar a chave de administrador na Vercel: em Settings > Environment Variables, crie SUPABASE_SERVICE_ROLE_KEY com a chave service_role do Supabase (Project Settings > API) e faça um Redeploy.";

// Cliente de administrador. SÓ pode ser usado no servidor (Server Actions).
// A chave vem da variável SUPABASE_SERVICE_ROLE_KEY, configurada apenas na Vercel.
// Devolve null se a chave não estiver configurada (a tela mostra o aviso em vez de quebrar).
export function createAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
