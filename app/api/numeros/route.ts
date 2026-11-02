import { createPublico } from "@/lib/supabase/publico";

export const revalidate = 600;

// Totais do Synvora mostrados no site de apresentação
export async function GET() {
  const { data, error } = await createPublico().rpc("numeros_publicos");
  const n = ((data ?? []) as { vendas: number; produtos: number; lojas: number }[])[0];
  if (error || !n) return Response.json({ ok: false });
  return Response.json({ ok: true, vendas: Number(n.vendas), produtos: Number(n.produtos), lojas: Number(n.lojas) });
}
