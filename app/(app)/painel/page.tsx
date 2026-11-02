import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { reais } from "@/lib/pedidos";

function inicioDoDiaSP() {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${hoje}T00:00:00-03:00`).toISOString();
}

export default async function Painel() {
  const supabase = createClient();
  const [{ data: produtos }, { data: vendasHoje }, { count: abertos }] = await Promise.all([
    supabase.from("produtos").select("nome, saldo, preco"),
    supabase.from("pedidos").select("total").eq("cancelado", false).gte("criado_em", inicioDoDiaSP()),
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("cancelado", false).lt("etapa", 4),
  ]);
  const valor = (produtos ?? []).reduce((t, p) => t + Number(p.preco) * p.saldo, 0);
  const baixos = (produtos ?? []).filter((p) => p.saldo <= 5);
  const faturadoHoje = (vendasHoje ?? []).reduce((t, v) => t + Number(v.total ?? 0), 0);

  return (
    <>
      <div>
        <h1>Painel</h1>
        <p className="muted">Resumo da sua loja.</p>
      </div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
        <div className="stat"><span className="muted">Vendido hoje</span><b>{reais(faturadoHoje)}</b><span className="muted">{vendasHoje?.length ?? 0} venda(s)</span></div>
        <Link href="/pedidos?f=abertos" className="stat"><span className="muted">Pedidos em andamento</span><b>{abertos ?? 0}</b></Link>
        <div className="stat"><span className="muted">Com estoque baixo</span><b>{baixos.length}</b></div>
        <div className="stat"><span className="muted">Valor em estoque</span><b>{reais(valor)}</b></div>
      </section>
      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Precisa repor</h2>
        {baixos.length === 0 && <p className="muted">Nenhum produto com estoque baixo.</p>}
        {baixos.map((p) => (
          <div className="row" key={p.nome} style={{ padding: "8px 0" }}>
            <span style={{ flex: 1 }}>{p.nome}</span>
            <span className="badge badge-warn">{p.saldo} un</span>
          </div>
        ))}
      </section>
    </>
  );
}
