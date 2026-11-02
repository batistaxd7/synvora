import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirDono, texto, valor } from "@/lib/perfil";
import { reais } from "@/lib/pedidos";

const CATEGORIAS = ["Aluguel", "Fornecedores / mercadoria", "Funcionários", "Água, luz e internet", "Impostos", "Marketing", "Frete", "Taxas de cartão", "Manutenção", "Outros"];

function mesAtual() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}
function fimDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

async function salvarGasto(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const v = valor(f.get("valor"));
  const descricao = texto(f, "descricao");
  if (!descricao || v <= 0) return;
  const supabase = createClient();
  await supabase.from("gastos").insert({
    loja_id: eu.loja_id, descricao, valor: v,
    categoria: texto(f, "categoria") ?? "Outros",
    data: texto(f, "data") ?? new Date().toISOString().slice(0, 10),
    fornecedor_id: texto(f, "fornecedor_id"),
    pago: f.get("pago") === "on",
  });
  revalidatePath("/gastos");
  revalidatePath("/financeiro");
}

async function alternarPago(f: FormData) {
  "use server";
  await exigirDono();
  const supabase = createClient();
  await supabase.from("gastos").update({ pago: f.get("pago") !== "true" }).eq("id", String(f.get("id")));
  revalidatePath("/gastos");
}

async function removerGasto(f: FormData) {
  "use server";
  await exigirDono();
  const supabase = createClient();
  await supabase.from("gastos").delete().eq("id", String(f.get("id")));
  revalidatePath("/gastos");
  revalidatePath("/financeiro");
}

async function salvarFornecedor(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const nome = texto(f, "nome");
  if (!nome) return;
  const supabase = createClient();
  await supabase.from("fornecedores").insert({ loja_id: eu.loja_id, nome, telefone: texto(f, "telefone"), email: texto(f, "email"), observacao: texto(f, "observacao") });
  revalidatePath("/gastos");
}

async function removerFornecedor(f: FormData) {
  "use server";
  await exigirDono();
  const supabase = createClient();
  await supabase.from("fornecedores").delete().eq("id", String(f.get("id")));
  revalidatePath("/gastos");
}

export default async function Gastos({ searchParams }: { searchParams: { mes?: string } }) {
  await exigirDono();
  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : mesAtual();
  const supabase = createClient();
  const [{ data: gastos, error }, { data: fornecedores }] = await Promise.all([
    supabase.from("gastos").select("id, descricao, categoria, valor, data, pago, fornecedores(nome)")
      .gte("data", `${mes}-01`).lte("data", fimDoMes(mes)).order("data", { ascending: false }),
    supabase.from("fornecedores").select("id, nome, telefone, email, observacao").order("nome"),
  ]);
  const total = (gastos ?? []).reduce((t, g) => t + Number(g.valor), 0);
  const aPagar = (gastos ?? []).filter((g) => !g.pago).reduce((t, g) => t + Number(g.valor), 0);
  const porCategoria = new Map<string, number>();
  for (const g of gastos ?? []) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + Number(g.valor));
  const [a, m] = mes.split("-").map(Number);
  const anterior = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
  const proximo = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7);
  const nomeMes = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1>Gastos da empresa</h1>
          <p className="muted">Aluguel, contas, mercadoria, funcionários. Tudo entra no Financeiro.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link className="icon-btn" href={`/gastos?mes=${anterior}`} aria-label="Mês anterior">‹</Link>
          <b style={{ textTransform: "capitalize", minWidth: 140, textAlign: "center" }}>{nomeMes}</b>
          <Link className="icon-btn" href={`/gastos?mes=${proximo}`} aria-label="Próximo mês">›</Link>
        </div>
      </div>

      {error && <div className="erro">Rode o arquivo supabase/modulos.sql no Supabase para liberar esta tela. ({error.message})</div>}

      <section className="stats">
        <div className="stat"><span className="muted">Gasto no mês</span><b>{reais(total)}</b></div>
        <div className="stat"><span className="muted">Ainda a pagar</span><b style={{ color: aPagar > 0 ? "var(--warn-ink)" : undefined }}>{reais(aPagar)}</b></div>
        <div className="stat"><span className="muted">Maior categoria</span><b style={{ fontSize: 20 }}>{[...porCategoria].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "—"}</b></div>
      </section>

      <form action={salvarGasto} className="card form-grid">
        <label className="field">Descrição<input className="input" name="descricao" required placeholder="ex: Aluguel da loja" /></label>
        <label className="field">Valor (R$)<input className="input" name="valor" required inputMode="decimal" placeholder="0,00" /></label>
        <label className="field">Data<input className="input" name="data" type="date" defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })} /></label>
        <label className="field">Categoria
          <select className="input" name="categoria" defaultValue="Outros">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field">Fornecedor
          <select className="input" name="fornecedor_id" defaultValue="">
            <option value="">Nenhum</option>
            {(fornecedores ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" name="pago" defaultChecked /> Já está pago</label>
        <button className="btn" type="submit">Lançar gasto</button>
      </form>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(gastos ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhum gasto neste mês.</p>}
        {(gastos ?? []).map((g) => (
          <div className="row" key={g.id}>
            <span className="muted" style={{ minWidth: 48 }}>{g.data.slice(8, 10)}/{g.data.slice(5, 7)}</span>
            <div style={{ flex: 3, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{g.descricao}</div>
              <div className="muted" style={{ fontSize: 12 }}>{g.categoria}{(g.fornecedores as unknown as { nome: string } | null)?.nome ? ` · ${(g.fornecedores as unknown as { nome: string }).nome}` : ""}</div>
            </div>
            <b style={{ minWidth: 100 }}>{reais(g.valor)}</b>
            <form action={alternarPago}>
              <input type="hidden" name="id" value={g.id} /><input type="hidden" name="pago" value={String(g.pago)} />
              <button type="submit" className={`badge ${g.pago ? "badge-ok" : "badge-warn"}`} style={{ border: "none", cursor: "pointer" }} title="Clique para alternar">{g.pago ? "Pago" : "A pagar"}</button>
            </form>
            <form action={removerGasto}>
              <input type="hidden" name="id" value={g.id} />
              <button className="btn btn-ghost btn-sm" type="submit">Excluir</button>
            </form>
          </div>
        ))}
      </section>

      <div>
        <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>Fornecedores</h2>
        <p className="muted">Cadastre aqui e escolha o fornecedor ao lançar um gasto.</p>
      </div>
      <form action={salvarFornecedor} className="card form-grid">
        <label className="field">Nome<input className="input" name="nome" required /></label>
        <label className="field">Telefone<input className="input" name="telefone" inputMode="tel" /></label>
        <label className="field">E-mail<input className="input" name="email" type="email" /></label>
        <label className="field">Observação<input className="input" name="observacao" placeholder="ex: entrega às terças" /></label>
        <button className="btn" type="submit">Adicionar fornecedor</button>
      </form>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(fornecedores ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhum fornecedor ainda.</p>}
        {(fornecedores ?? []).map((f) => (
          <div className="row" key={f.id}>
            <div style={{ flex: 3, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{f.nome}</div>
              <div className="muted" style={{ fontSize: 12 }}>{[f.telefone, f.email, f.observacao].filter(Boolean).join(" · ") || "Sem contato"}</div>
            </div>
            <form action={removerFornecedor}>
              <input type="hidden" name="id" value={f.id} />
              <button className="btn btn-ghost btn-sm" type="submit">Remover</button>
            </form>
          </div>
        ))}
      </section>
    </>
  );
}
