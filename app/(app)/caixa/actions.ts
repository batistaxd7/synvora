"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResultadoVenda =
  | { ok: true; id: string; numero: number; total: number; troco: number }
  | { ok: false; erro: string };

export async function finalizarVenda(dados: {
  itens: { produto_id: string; quantidade: number }[];
  pagamentos: { forma: string; valor: number }[];
  cliente: string;
  canal: string;
  desconto: number;
}): Promise<ResultadoVenda> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("registrar_venda", {
    itens: dados.itens,
    pagamentos: dados.pagamentos,
    cliente: dados.cliente || null,
    canal_venda: dados.canal || "Loja física",
    desconto_venda: dados.desconto || 0,
  });
  if (error) {
    const falta = /registrar_venda|function/i.test(error.message) && /not find|does not exist|schema cache/i.test(error.message);
    return { ok: false, erro: falta ? "O banco ainda não tem a parte de vendas. Rode o arquivo supabase/vendas.sql no Supabase (veja o README)." : error.message };
  }
  revalidatePath("/estoque");
  revalidatePath("/pedidos");
  revalidatePath("/painel");
  const r = data as { id: string; numero: number; total: number; troco: number };
  return { ok: true, id: r.id, numero: r.numero, total: Number(r.total), troco: Number(r.troco) };
}
