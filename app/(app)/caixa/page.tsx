import { createClient } from "@/lib/supabase/server";
import Caixa from "@/components/Caixa";

export default async function FrenteDeCaixa() {
  const supabase = createClient();
  const [{ data: produtos }, { data: clientes }] = await Promise.all([
    supabase.from("produtos").select("id, sku, nome, categoria, preco, saldo, foto_url").order("nome"),
    supabase.from("clientes").select("nome").order("nome").limit(1000),
  ]);

  return (
    <>
      <div>
        <h1>Frente de caixa</h1>
        <p className="muted">Busque pelo nome ou SKU, monte a venda e receba. O estoque baixa na hora.</p>
      </div>
      <Caixa produtos={(produtos ?? []).map((p) => ({ ...p, preco: Number(p.preco) }))} clientes={(clientes ?? []).map((c) => c.nome)} />
    </>
  );
}
