import { createBrowserClient } from "@supabase/ssr";

// Cliente do navegador: usa o login do usuário (cookie) e só a chave pública.
export function createBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
