import { createClient } from "@supabase/supabase-js";

// Cliente de administrador. SÓ pode ser usado no servidor (Server Actions).
// A chave vem da variável SUPABASE_SERVICE_ROLE_KEY, configurada apenas na Vercel.
export function createAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
