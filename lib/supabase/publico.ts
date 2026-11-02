import { createClient } from "@supabase/supabase-js";

// Cliente sem login, para páginas públicas (catálogo da Meta e página do produto)
export function createPublico() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
