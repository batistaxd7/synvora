import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dataHora, reais, selo } from "@/lib/pedidos";

const FILTROS: Record<string, string> = { todos: "Todos", abertos: "Em andamento", concluidos: "Concluídos", cancelados: "Cancelados" };

export default async function Pedidos({ searchParams }: { searchParams: { f?: string; q?: string } }) {
  const f = searchParams.f && FILTROS[searchParams.f] ? searchParams.f : "todos";
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();

  let consulta = supabase
    .from("pedidos")
    .select("id, numero, cliente_nome, canal, etapa, cancelado, total, criado_em, vendedor_nome")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (f === "abertos") consulta = consulta.eq("cancelado", false).lt("etapa", 4);
  if (f === "concluidos") consulta = consulta.eq("cancelado", false).eq("etapa", 4);
  if (f === "cancelados") consulta = consulta.eq("cancelado", true);
  if (q) {
    const n = parseInt(q.replace("#", ""), 10);
    consulta = isFinite(n) ? consulta.eq("numero", n) : consulta.ilike("cliente_nome", `%${q.replace(/[%_,()]/g, "")}%`);
  }
  const { data: pedidos, error } = await consulta;

  return (
    <>
      <div>
        <h1>Pedidos</h1>
        <p className="muted">Todas as vendas ficam guardadas para sempre. Toque em um pedido para ver e avançar o status.</p>
      </div>

      <form className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: 14 }}>
        <input type="hidden" name="f" value={f} />
        <input className="input" name="q" defaultValue={q} placeholder="Buscar por número ou cliente" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-ghost" type="submit">Buscar</button>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
          {Object.entries(FILTROS).map(([k, t]) => (
            <Link key={k} href={`/pedidos?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip${f === k ? " ativo" : ""}`}>{t}</Link>
          ))}
        </div>
      </form>

      {error && <div className="erro">Não foi possível carregar os pedidos: {error.message}</div>}

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(pedidos ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhum pedido aqui ainda. As vendas feitas na Frente de caixa aparecem nesta lista.</p>}
        {(pedidos ?? []).map((p) => {
          const s = selo(p);
          return (
            <Link href={`/pedidos/${p.id}`} className="row" key={p.id}>
              <b style={{ minWidth: 64 }}>#{p.numero}</b>
              <div style={{ flex: 3, minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{p.cliente_nome || "Cliente não informado"}</div>
                <div className="muted" style={{ fontSize: 12 }}>{dataHora(p.criado_em)} · {p.canal}{p.vendedor_nome ? ` · ${p.vendedor_nome}` : ""}</div>
              </div>
              <b style={{ flex: 1, minWidth: 100 }}>{reais(p.total)}</b>
              <span className={`badge ${s.classe}`}>{s.texto}</span>
            </Link>
          );
        })}
      </section>
    </>
  );
}
