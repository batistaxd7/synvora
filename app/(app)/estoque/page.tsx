import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirDono } from "@/lib/perfil";
import EnviarFoto from "@/components/EnviarFoto";

async function criarProduto(formData: FormData) {
  "use server";
  await exigirDono();
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

async function salvarFotoProduto(id: string, url: string) {
  "use server";
  const eu = await exigirDono();
  const origem = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if (!url.startsWith(`${origem}/storage/v1/object/public/produtos/${eu.loja_id}/`)) return { erro: "Endereço da foto inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("produtos").update({ foto_url: url }).eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/estoque");
  revalidatePath("/caixa");
}

export default async function Estoque() {
  const eu = await exigirDono();
  const supabase = createClient();
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, sku, nome, categoria, preco, saldo, foto_url")
    .order("criado_em", { ascending: false });

  return (
    <>
      <div>
        <h1>Estoque</h1>
        <p className="muted">Um só saldo para a loja física e os canais online. Toque no quadradinho da câmera para colocar a foto do produto.</p>
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
            <EnviarFoto bucket="produtos" pasta={eu.loja_id} nome={p.id} atual={p.foto_url} salvar={salvarFotoProduto.bind(null, p.id)}
              rotulo={p.foto_url ? `Trocar foto de ${p.nome}` : `Colocar foto em ${p.nome}`} lado={900} pequeno />
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
