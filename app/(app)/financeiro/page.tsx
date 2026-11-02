import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirDono } from "@/lib/perfil";
import { FORMAS, reais } from "@/lib/pedidos";

function mesAtual() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

function Barras({ linhas }: { linhas: [string, number][] }) {
  const max = Math.max(1, ...linhas.map((l) => l[1]));
  if (linhas.length === 0) return <p className="muted">Sem dados neste mês.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {linhas.map(([nome, v]) => (
        <div key={nome} style={{ display: "grid", gridTemplateColumns: "minmax(90px,140px) 1fr auto", gap: 10, alignItems: "center", fontSize: 14 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
          <span className="barra"><span style={{ width: `${(v / max) * 100}%` }} /></span>
          <b>{reais(v)}</b>
        </div>
      ))}
    </div>
  );
}

export default async function Financeiro({ searchParams }: { searchParams: { mes?: string } }) {
  await exigirDono();
  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : mesAtual();
  const [a, m] = mes.split("-").map(Number);
  const inicio = new Date(`${mes}-01T00:00:00-03:00`).toISOString();
  const fimMes = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7);
  const fim = new Date(`${fimMes}-01T00:00:00-03:00`).toISOString();
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();

  const supabase = createClient();
  const [{ data: pedidos }, { data: gastos }] = await Promise.all([
    supabase.from("pedidos").select("total, troco, canal, vendedor_nome, criado_em, pedido_pagamentos(forma, valor)")
      .eq("cancelado", false).gte("criado_em", inicio).lt("criado_em", fim).limit(10000),
    supabase.from("gastos").select("valor, categoria, pago").gte("data", `${mes}-01`).lte("data", `${mes}-${String(ultimoDia).padStart(2, "0")}`),
  ]);

  const vendas = pedidos ?? [];
  const faturamento = vendas.reduce((t, p) => t + Number(p.total), 0);
  const totalGastos = (gastos ?? []).reduce((t, g) => t + Number(g.valor), 0);
  const lucro = faturamento - totalGastos;
  const ticket = vendas.length ? faturamento / vendas.length : 0;

  const somar = (mapa: Map<string, number>, k: string, v: number) => mapa.set(k, (mapa.get(k) ?? 0) + v);
  const porForma = new Map<string, number>();
  const porVendedor = new Map<string, number>();
  const porCanal = new Map<string, number>();
  const porDia = new Array(ultimoDia).fill(0);
  for (const p of vendas) {
    const pgs = (p.pedido_pagamentos ?? []) as { forma: string; valor: number }[];
    let troco = Number(p.troco);
    for (const pg of pgs) {
      let v = Number(pg.valor);
      if (pg.forma === "dinheiro" && troco > 0) { const tira = Math.min(troco, v); v -= tira; troco -= tira; }
      somar(porForma, FORMAS[pg.forma] ?? pg.forma, v);
    }
    somar(porVendedor, p.vendedor_nome ?? "Sem vendedor", Number(p.total));
    somar(porCanal, p.canal, Number(p.total));
    const dia = Number(new Date(p.criado_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(8, 10));
    porDia[dia - 1] += Number(p.total);
  }
  const porCategoria = new Map<string, number>();
  for (const g of gastos ?? []) somar(porCategoria, g.categoria, Number(g.valor));
  const ordenar = (mp: Map<string, number>) => [...mp].sort((x, y) => y[1] - x[1]);
  const maxDia = Math.max(1, ...porDia);

  const anterior = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
  const nomeMes = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1>Financeiro</h1>
          <p className="muted">Quanto entrou, quanto saiu e o que sobrou no mês.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link className="icon-btn" href={`/financeiro?mes=${anterior}`} aria-label="Mês anterior">‹</Link>
          <b style={{ textTransform: "capitalize", minWidth: 140, textAlign: "center" }}>{nomeMes}</b>
          <Link className="icon-btn" href={`/financeiro?mes=${fimMes}`} aria-label="Próximo mês">›</Link>
        </div>
      </div>

      <section className="stats">
        <div className="stat"><span className="muted">Faturamento</span><b>{reais(faturamento)}</b><span className="muted">{vendas.length} venda(s)</span></div>
        <div className="stat"><span className="muted">Gastos</span><b>{reais(totalGastos)}</b></div>
        <div className="stat"><span className="muted">Lucro do mês</span><b style={{ color: lucro >= 0 ? "var(--ok-ink)" : "var(--danger)" }}>{reais(lucro)}</b></div>
        <div className="stat"><span className="muted">Ticket médio</span><b>{reais(ticket)}</b></div>
      </section>

      <section className="card">
        <h2 className="titulo-card">Vendas por dia</h2>
        <div className="colunas" role="img" aria-label="Gráfico de vendas por dia do mês">
          {porDia.map((v, i) => (
            <div key={i} className="coluna" title={`Dia ${i + 1}: ${reais(v)}`}>
              <span style={{ height: `${(v / maxDia) * 100}%` }} />
              <small>{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="duas-colunas">
        <section className="card"><h2 className="titulo-card">Por forma de pagamento</h2><Barras linhas={ordenar(porForma)} /></section>
        <section className="card"><h2 className="titulo-card">Por vendedor</h2><Barras linhas={ordenar(porVendedor)} /></section>
        <section className="card"><h2 className="titulo-card">Por canal</h2><Barras linhas={ordenar(porCanal)} /></section>
        <section className="card"><h2 className="titulo-card">Gastos por categoria</h2><Barras linhas={ordenar(porCategoria)} /></section>
      </div>
    </>
  );
}
