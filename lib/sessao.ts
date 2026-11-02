import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Uma só consulta de login e de perfil por troca de página:
// o layout e a página reaproveitam o mesmo resultado em vez de perguntar de novo ao Supabase.
export const usuarioAtual = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const perfilAtual = cache(async () => {
  const user = await usuarioAtual();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("perfis")
    .select("id, loja_id, nome, usuario, papel, email_recuperacao")
    .eq("id", user.id)
    .single();
  return data as { id: string; loja_id: string; nome: string; usuario: string; papel: string; email_recuperacao: string | null } | null;
});
