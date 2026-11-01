import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function criarProduto(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: perfil } = await supabase.from("perfis").select("loja_id").eq("id", user.id).single();
  if (!perfil) return;

  const preco = parseFloat(String(formData.get("preco") ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
  await supabase.from("produtos").insert({
    loja_id: perfil.loja_id,
    sku: String(formData.get("sku") ?? "").trim(),
    nome: String(formData.get("nome") ?? "").trim(),
    categoria: String(formData.get("categoria") ?? "").trim() || null,
    preco,
    saldo: parseInt(String(formData.get("saldo") ?? "0"), 10) || 0,
  });
  revalidatePath("/estoque");
}

export default async function Estoque() {
  const supabase = createClient();
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, sku, nome, categoria, preco, saldo")
    .order("criado_em", { ascending: false });

  return (
    <>
      <div>
        <h1>Estoque</h1>
        <p className="muted">Um só saldo para a loja física e os canais online.</p>
      </div>

      <form action={criarProduto} className="card" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", alignItems: "end" }}>
        <label className="field">Nome<input className="input" name="nome" required /></label>
        <label className="field">SKU<input className="input" name="sku" required /></label>
        <label className="field">Categoria<input className="input" name="categoria" /></label>
        <label className="field">Preço (R$)<input className="input" name="preco" placeholder="0,00" /></label>
        <label className="field">Quantidade<input className="input" name="saldo" type="number" min="0" defaultValue="0" /></label>
        <button className="btn" type="submit">Adicionar produto</button>
      </form>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(produtos ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhum produto ainda.</p>}
        {(produtos ?? []).map((p) => (
          <div className="row" key={p.id}>
            <div style={{ flex: 3, minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>
              <div className="muted" style={{ fontSize: 12 }}>{p.sku}{p.categoria ? ` · ${p.categoria}` : ""}</div>
            </div>
            <span style={{ flex: 1 }}>R$ {Number(p.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{p.saldo} un</span>
            <span className={`badge ${p.saldo <= 5 ? "badge-warn" : "badge-ok"}`}>{p.saldo <= 5 ? "Estoque baixo" : "Em dia"}</span>
          </div>
        ))}
      </section>
    </>
  );
}
