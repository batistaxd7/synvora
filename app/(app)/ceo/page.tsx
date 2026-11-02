import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reais, dataHora } from "@/lib/pedidos";

type Loja = {
  id: string; nome: string; criado_em: string; plano: string; situacao: string; plano_desde: string;
  dono_nome: string | null; dono_usuario: string | null; usuarios: number; pedidos: number;
  ultimo_pedido: string | null; chamados_abertos: number; atendente: string | null;
};

const NOME_PLANO: Record<string, string> = { mensal: "Mensal", anual: "Anual", vitalicio: "Vitalício" };
const VAGAS_VITALICIO = 10;
const DIA = 24 * 60 * 60 * 1000;

async function alterar(f: FormData) {
  "use server";
  const loja = String(f.get("loja") ?? "");
  const plano = String(f.get("plano") ?? "");
  const situacao = String(f.get("situacao") ?? "");
  const supabase = createClient();
  const { error } = await supabase.rpc("ceo_alterar_loja", { loja, novo_plano: plano, nova_situacao: situacao });
  if (error) redirect(`/ceo?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/ceo");
  redirect("/ceo?ok=1");
}

// Quanto cada loja ativa paga por mês (estimativa pelo plano marcado)
function porMes(l: Loja, agora: number) {
  if (l.situacao !== "ativa") return 0;
  if (l.plano === "anual") return 1199 / 12;
  if (l.plano === "vitalicio") return 0;
  return agora - new Date(l.criado_em).getTime() < 30 * DIA ? 59.9 : 119.9;
}

export default async function Ceo({ searchParams }: { searchParams: { q?: string; erro?: string; ok?: string } }) {
  const supabase = createClient();
  const { data: ceo } = await supabase.rpc("sou_ceo");
  if (!ceo) redirect("/painel");

  const { data, error } = await supabase.rpc("ceo_lojas");
  const lojas = ((data ?? []) as Loja[]).map((l) => ({ ...l, usuarios: Number(l.usuarios), pedidos: Number(l.pedidos), chamados_abertos: Number(l.chamados_abertos) }));
  const agora = Date.now();
  const inicioMes = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

  const ativas = lojas.filter((l) => l.situacao === "ativa");
  const novasMes = lojas.filter((l) => new Date(l.criado_em) >= inicioMes).length;
  const canceladas = lojas.filter((l) => l.situacao === "cancelada").length;
  const receitaMes = ativas.reduce((s, l) => s + porMes(l, agora), 0);
  const vitalicios = lojas.filter((l) => l.plano === "vitalicio").length;
  const porPlano = ["mensal", "anual", "vitalicio"].map((p) => ({ p, n: ativas.filter((l) => l.plano === p).length }));
  const chamados = lojas.filter((l) => l.chamados_abertos > 0);

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const lista = q ? lojas.filter((l) => [l.nome, l.dono_nome, l.dono_usuario].some((v) => (v ?? "").toLowerCase().includes(q))) : lojas;

  return (
    <>
      <div>
        <h1>Painel do CEO</h1>
        <p className="muted">Todas as lojas que usam o Synvora. Só você vê esta tela.</p>
      </div>

      {error && <div className="erro">Rode o tudo.sql no Supabase para liberar esta tela. ({error.message.slice(0, 120)})</div>}
      {searchParams.erro && <div className="erro">{searchParams.erro}</div>}
      {searchParams.ok && <div className="erro aviso-ok">Loja atualizada.</div>}

      <div className="stats">
        <div className="stat"><span className="muted">Lojas ativas</span><b>{ativas.length}</b><span className="muted">de {lojas.length} no total</span></div>
        <div className="stat"><span className="muted">Entraram este mês</span><b>{novasMes}</b><span className="muted">{canceladas} canceladas no total</span></div>
        <div className="stat"><span className="muted">Entra por mês</span><b>{reais(receitaMes)}</b><span className="muted">estimativa pelos planos</span></div>
        <div className="stat"><span className="muted">Vitalício</span><b>{vitalicios}/{VAGAS_VITALICIO}</b><span className="muted">{VAGAS_VITALICIO - vitalicios} vagas · {reais(vitalicios * 3500)} vendidos</span></div>
      </div>

      <div className="duas-colunas">
        <section className="card">
          <h3 className="titulo-card">Lojas por plano</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {porPlano.map(({ p, n }) => (
              <div key={p} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{NOME_PLANO[p]}</span><b>{n}</b></div>
                <div className="barra"><span style={{ width: `${ativas.length ? (n / ativas.length) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <h3 className="titulo-card" style={{ padding: "20px 20px 0" }}>Suporte aberto</h3>
          {chamados.length === 0 && <p className="muted" style={{ padding: "0 20px 20px" }}>Nenhuma mensagem esperando resposta.</p>}
          {chamados.map((l) => (
            <Link key={l.id} href={`/atendimento?loja=${l.id}`} className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{l.nome}</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.atendente ? `Último atendimento: ${l.atendente}` : "Ninguém da equipe respondeu ainda"}</div>
              </div>
              <span className="badge badge-danger">{l.chamados_abertos}</span>
            </Link>
          ))}
        </section>
      </div>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <form method="get" style={{ display: "flex", gap: 10, padding: 16, flexWrap: "wrap", alignItems: "center" }}>
          <h3 className="titulo-card" style={{ margin: 0, flex: "1 1 160px" }}>Lojas</h3>
          <input className="input" style={{ flex: "2 1 220px", width: "auto" }} name="q" aria-label="Buscar loja" defaultValue={searchParams.q ?? ""} placeholder="Buscar por loja, dono ou usuário" />
          <button className="btn btn-ghost" type="submit">Buscar</button>
        </form>
        {lista.length === 0 && <p className="muted" style={{ padding: "0 20px 20px" }}>Nenhuma loja encontrada.</p>}
        {lista.map((l) => (
          <details key={l.id} className="item-estoque">
            <summary className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{l.nome}</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.dono_nome ?? "Sem dono"}{l.dono_usuario ? ` · @${l.dono_usuario}` : ""} · desde {dataHora(l.criado_em).slice(0, 10)}</div>
              </div>
              <span className="badge badge-info">{NOME_PLANO[l.plano] ?? l.plano}</span>
              <span className={`badge ${l.situacao === "ativa" ? "badge-ok" : "badge-danger"}`}>{l.situacao === "ativa" ? "Ativa" : "Cancelada"}</span>
            </summary>
            <div className="editar-produto">
              <div className="resumo">
                <span>Usuários na loja</span><b>{l.usuarios}</b>
                <span>Vendas registradas</span><b>{l.pedidos}</b>
                <span>Última venda</span><b>{l.ultimo_pedido ? dataHora(l.ultimo_pedido) : "Nenhuma"}</b>
                <span>Paga por mês (estimado)</span><b>{reais(porMes(l, agora))}</b>
                <span>Plano desde</span><b>{dataHora(l.plano_desde).slice(0, 10)}</b>
              </div>
              <form action={alterar} className="form-grid">
                <input type="hidden" name="loja" value={l.id} />
                <label className="field">Plano
                  <select className="input" name="plano" defaultValue={l.plano}>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                    <option value="vitalicio">Vitalício</option>
                  </select>
                </label>
                <label className="field">Situação
                  <select className="input" name="situacao" defaultValue={l.situacao}>
                    <option value="ativa">Ativa</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
                <button className="btn" type="submit">Salvar</button>
              </form>
              <Link href={`/atendimento?loja=${l.id}`} className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>Abrir conversa de suporte</Link>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
