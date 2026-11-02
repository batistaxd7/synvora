import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirDono, texto, valor } from "@/lib/perfil";
import { falha, sucesso, traduzir } from "@/lib/acoes";
import { reais } from "@/lib/pedidos";
import { campoValor } from "@/lib/dinheiro";
import EnviarFoto from "@/components/EnviarFoto";
import Mensagens from "@/components/Mensagens";
import BotaoConfirmar from "@/components/BotaoConfirmar";

function inteiro(v: FormDataEntryValue | null) {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return isFinite(n) ? n : 0;
}

async function criarProduto(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const nome = texto(f, "nome");
  const sku = texto(f, "sku")?.toUpperCase() ?? null;
  if (!nome) falha("/estoque", "Informe o nome do produto.");
  if (!sku) falha("/estoque", "Informe o SKU (código) do produto.");
  const supabase = createClient();
  const { error } = await supabase.from("produtos").insert({
    loja_id: eu.loja_id, sku, nome, categoria: texto(f, "categoria"),
    preco: valor(f.get("preco")), saldo: inteiro(f.get("saldo")),
  });
  if (error) falha("/estoque", traduzir(error));
  revalidatePath("/caixa");
  revalidatePath("/painel");
  sucesso("/estoque", `Produto "${nome}" adicionado.`);
}

async function editarProduto(f: FormData) {
  "use server";
  await exigirDono();
  const id = String(f.get("id") ?? "");
  const nome = texto(f, "nome");
  const sku = texto(f, "sku")?.toUpperCase() ?? null;
  if (!nome || !sku) falha("/estoque", "Nome e SKU são obrigatórios.");
  const supabase = createClient();
  const { error } = await supabase.from("produtos").update({
    nome, sku, categoria: texto(f, "categoria"), preco: valor(f.get("preco")), saldo: inteiro(f.get("saldo")),
  }).eq("id", id);
  if (error) falha("/estoque", traduzir(error));
  revalidatePath("/caixa");
  revalidatePath("/painel");
  sucesso("/estoque", `Produto "${nome}" atualizado.`);
}

async function ajustarSaldo(f: FormData) {
  "use server";
  await exigirDono();
  const id = String(f.get("id") ?? "");
  const delta = parseInt(String(f.get("delta") ?? "0"), 10) || 0;
  const supabase = createClient();
  const { data: p } = await supabase.from("produtos").select("saldo").eq("id", id).single();
  if (!p) falha("/estoque", "Produto não encontrado.");
  const novo = Math.max(0, p.saldo + delta);
  const { error } = await supabase.from("produtos").update({ saldo: novo }).eq("id", id);
  if (error) falha("/estoque", traduzir(error));
  revalidatePath("/estoque");
  revalidatePath("/caixa");
}

async function excluirProduto(f: FormData) {
  "use server";
  await exigirDono();
  const supabase = createClient();
  const { error } = await supabase.from("produtos").delete().eq("id", String(f.get("id") ?? ""));
  if (error) falha("/estoque", traduzir(error));
  revalidatePath("/caixa");
  sucesso("/estoque", "Produto excluído. As vendas antigas continuam no histórico.");
}

async function salvarFotoProduto(id: string, url: string) {
  "use server";
  const eu = await exigirDono();
  const origem = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if (!url.startsWith(`${origem}/storage/v1/object/public/produtos/${eu.loja_id}/`)) return { erro: "Endereço da foto inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("produtos").update({ foto_url: url }).eq("id", id);
  if (error) return { erro: traduzir(error) };
  revalidatePath("/estoque");
  revalidatePath("/caixa");
}

export default async function Estoque({ searchParams }: { searchParams: { q?: string; cat?: string; baixo?: string; erro?: string; ok?: string } }) {
  const eu = await exigirDono();
  const q = (searchParams.q ?? "").trim().replace(/[%_,()]/g, "");
  const supabase = createClient();
  let consulta = supabase.from("produtos").select("id, sku, nome, categoria, preco, saldo, foto_url").order("nome").limit(1000);
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,sku.ilike.%${q}%`);
  if (searchParams.cat) consulta = consulta.eq("categoria", searchParams.cat);
  if (searchParams.baixo) consulta = consulta.lte("saldo", 5);
  const [{ data: produtos, error }, { data: todas }] = await Promise.all([
    consulta,
    supabase.from("produtos").select("categoria").not("categoria", "is", null).limit(5000),
  ]);
  const categorias = [...new Set((todas ?? []).map((c) => c.categoria as string))].sort();
  const filtrando = Boolean(q || searchParams.cat || searchParams.baixo);

  return (
    <>
      <div>
        <h1>Estoque</h1>
        <p className="muted">Um só saldo para a loja física e os canais online. Toque no produto para editar, ajustar a quantidade ou colocar foto.</p>
      </div>
      <Mensagens erro={searchParams.erro ?? (error ? traduzir(error) : undefined)} ok={searchParams.ok} />

      <details className="card" open={!produtos?.length && !filtrando}>
        <summary className="resumo-abrir">+ Adicionar produto</summary>
        <form action={criarProduto} className="form-grid" style={{ marginTop: 14 }}>
          <label className="field">Nome<input className="input" name="nome" required /></label>
          <label className="field">SKU (código)<input className="input" name="sku" required placeholder="ex: CAM-001" /></label>
          <label className="field">Categoria<input className="input" name="categoria" list="categorias" /></label>
          <label className="field">Preço (R$)<input className="input" name="preco" inputMode="decimal" placeholder="0,00" /></label>
          <label className="field">Quantidade<input className="input" name="saldo" type="number" min="0" defaultValue="0" /></label>
          <button className="btn" type="submit">Adicionar produto</button>
        </form>
      </details>
      <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>

      <form className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: 14 }}>
        <input className="input" name="q" defaultValue={q} placeholder="Buscar por nome ou SKU" style={{ flex: 2, minWidth: 180 }} />
        <select className="input" name="cat" defaultValue={searchParams.cat ?? ""} style={{ flex: 1, minWidth: 150 }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check" style={{ minHeight: 48 }}><input type="checkbox" name="baixo" value="1" defaultChecked={Boolean(searchParams.baixo)} /> Só estoque baixo</label>
        <button className="btn btn-ghost" type="submit">Filtrar</button>
        {filtrando && <Link className="btn btn-ghost" href="/estoque">Limpar</Link>}
      </form>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(produtos ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>{filtrando ? "Nenhum produto encontrado com esse filtro." : "Nenhum produto ainda. Use “Adicionar produto” acima."}</p>}
        {(produtos ?? []).map((p) => (
          <details key={p.id} className="item-estoque">
            <summary className="row">
              <span className="miniatura">
                {p.foto_url ? <img src={p.foto_url} alt="" loading="lazy" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h3l2-3h8l2 3h3v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>}
              </span>
              <div style={{ flex: 3, minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{p.nome}</div>
                <div className="muted" style={{ fontSize: 12 }}>{p.sku}{p.categoria ? ` · ${p.categoria}` : ""}</div>
              </div>
              <span style={{ flex: 1, minWidth: 90 }}>{reais(p.preco)}</span>
              <span style={{ fontWeight: 600, minWidth: 60 }}>{p.saldo} un</span>
              <span className={`badge ${p.saldo <= 0 ? "badge-danger" : p.saldo <= 5 ? "badge-warn" : "badge-ok"}`}>{p.saldo <= 0 ? "Sem estoque" : p.saldo <= 5 ? "Estoque baixo" : "Em dia"}</span>
              <span className="muted" style={{ fontSize: 12 }}>Editar ▾</span>
            </summary>
            <div className="editar-produto">
              <div className="field">Foto do produto
                <EnviarFoto bucket="produtos" pasta={eu.loja_id} nome={p.id} atual={p.foto_url} salvar={salvarFotoProduto.bind(null, p.id)}
                  rotulo={p.foto_url ? "Trocar foto" : "Colocar foto"} lado={900} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="field" style={{ margin: 0 }}>Entrada / saída rápida:</span>
                {[-5, -1, 1, 5, 10].map((d) => (
                  <form key={d} action={ajustarSaldo}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="delta" value={d} />
                    <button className="btn btn-ghost btn-sm" type="submit">{d > 0 ? `+${d}` : d}</button>
                  </form>
                ))}
              </div>
              <form action={editarProduto} className="form-grid">
                <input type="hidden" name="id" value={p.id} />
                <label className="field">Nome<input className="input" name="nome" defaultValue={p.nome} required /></label>
                <label className="field">SKU<input className="input" name="sku" defaultValue={p.sku} required /></label>
                <label className="field">Categoria<input className="input" name="categoria" defaultValue={p.categoria ?? ""} list="categorias" /></label>
                <label className="field">Preço (R$)<input className="input" name="preco" inputMode="decimal" defaultValue={campoValor(Number(p.preco))} /></label>
                <label className="field">Quantidade<input className="input" name="saldo" type="number" min="0" defaultValue={p.saldo} /></label>
                <button className="btn" type="submit">Salvar alterações</button>
              </form>
              <form action={excluirProduto}>
                <input type="hidden" name="id" value={p.id} />
                <BotaoConfirmar pergunta={`Excluir "${p.nome}" do estoque? As vendas antigas continuam no histórico.`} className="btn btn-ghost btn-sm perigo">Excluir produto</BotaoConfirmar>
              </form>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
