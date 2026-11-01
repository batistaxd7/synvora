import { createClient } from "@/lib/supabase/server";

export default async function Painel() {
  const supabase = createClient();
  const { data: produtos } = await supabase.from("produtos").select("nome, saldo");
  const total = produtos?.length ?? 0;
  const baixos = (produtos ?? []).filter((p) => p.saldo <= 5);

  return (
    <>
      <div>
        <h1>Painel</h1>
        <p className="muted">Resumo da sua loja.</p>
      </div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <div className="card"><div className="muted">Produtos cadastrados</div><div style={{ fontSize: 26, fontWeight: 700 }}>{total}</div></div>
        <div className="card"><div className="muted">Com estoque baixo</div><div style={{ fontSize: 26, fontWeight: 700 }}>{baixos.length}</div></div>
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
