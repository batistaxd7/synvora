import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { meuPerfil, texto } from "@/lib/perfil";
import ConcluirTarefa from "@/components/ConcluirTarefa";

function hojeSP() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function dataCurta(d: string) {
  return d.split("-").reverse().slice(0, 2).join("/");
}

async function criarTarefa(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  if (eu.papel !== "dono") return;
  const titulo = texto(f, "titulo");
  if (!titulo) return;
  const supabase = createClient();
  const responsavel = texto(f, "responsavel_id");
  const { data: pessoa } = responsavel
    ? await supabase.from("perfis").select("id, nome").eq("id", responsavel).single()
    : { data: null };
  const { error } = await supabase.from("tarefas").insert({
    loja_id: eu.loja_id, titulo, descricao: texto(f, "descricao"),
    responsavel_id: pessoa?.id ?? null, responsavel_nome: pessoa?.nome ?? null,
    prazo: texto(f, "prazo"), prioridade: f.get("prioridade") === "urgente" ? "urgente" : "normal",
  });
  if (error) redirect(`/tarefas?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/tarefas");
}

async function concluir(f: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.rpc("concluir_tarefa", { tarefa: String(f.get("id")) });
  if (error) redirect(`/tarefas?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/tarefas");
  revalidatePath("/painel");
}

async function excluir(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  if (eu.papel !== "dono") return;
  const supabase = createClient();
  await supabase.from("tarefas").delete().eq("id", String(f.get("id")));
  revalidatePath("/tarefas");
}

export default async function Tarefas({ searchParams }: { searchParams: { erro?: string } }) {
  const eu = await meuPerfil();
  const dono = eu.papel === "dono";
  const supabase = createClient();
  const [{ data: tarefas, error }, { data: equipe }] = await Promise.all([
    supabase.from("tarefas").select("id, titulo, descricao, responsavel_nome, prazo, prioridade, concluida, concluida_em")
      .order("concluida").order("prioridade", { ascending: false }).order("prazo", { ascending: true, nullsFirst: false }).limit(300),
    dono ? supabase.from("perfis").select("id, nome, papel").order("nome") : Promise.resolve({ data: [] as { id: string; nome: string; papel: string }[] }),
  ]);
  const hoje = hojeSP();
  const abertas = (tarefas ?? []).filter((t) => !t.concluida);
  const feitas = (tarefas ?? []).filter((t) => t.concluida);

  return (
    <>
      <div>
        <h1>Tarefas</h1>
        <p className="muted">{dono ? "Crie tarefas para a equipe, escolha quem faz e o prazo. Você recebe um aviso quando concluírem." : "Suas tarefas. Toque em concluir quando terminar."}</p>
      </div>

      {(searchParams.erro || error) && <div className="erro">{searchParams.erro ?? `Rode o arquivo supabase/modulos.sql no Supabase para liberar esta tela. (${error?.message})`}</div>}

      {dono && (
        <form action={criarTarefa} className="card form-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>Tarefa<input className="input" name="titulo" required placeholder="ex: Organizar a vitrine" /></label>
          <label className="field">Para quem
            <select className="input" name="responsavel_id" defaultValue="">
              <option value="">Escolha...</option>
              {(equipe ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.id === eu.id ? " (eu)" : ""}</option>)}
            </select>
          </label>
          <label className="field">Prazo<input className="input" name="prazo" type="date" min={hoje} /></label>
          <label className="field">Prioridade
            <select className="input" name="prioridade" defaultValue="normal"><option value="normal">Normal</option><option value="urgente">Urgente</option></select>
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>Detalhes (opcional)<input className="input" name="descricao" /></label>
          <button className="btn" type="submit">Criar tarefa</button>
        </form>
      )}

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <h2 className="titulo-card" style={{ padding: "16px 18px 4px" }}>A fazer ({abertas.length})</h2>
        {abertas.length === 0 && <p className="muted" style={{ padding: "4px 18px 18px" }}>Nenhuma tarefa pendente. 🎉</p>}
        {abertas.map((t) => {
          const atrasada = t.prazo && t.prazo < hoje;
          return (
            <div className="row" key={t.id}>
              <div style={{ flex: 3, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{t.titulo}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[dono && (t.responsavel_nome ?? "Sem responsável"), t.prazo && `prazo ${dataCurta(t.prazo)}`, t.descricao].filter(Boolean).join(" · ")}
                </div>
              </div>
              {t.prioridade === "urgente" && <span className="badge badge-danger">Urgente</span>}
              {atrasada && <span className="badge badge-warn">Atrasada</span>}
              <ConcluirTarefa id={t.id} acao={concluir} />
              {dono && (
                <form action={excluir}><input type="hidden" name="id" value={t.id} /><button className="btn btn-ghost btn-sm" type="submit">Excluir</button></form>
              )}
            </div>
          );
        })}
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <h2 className="titulo-card" style={{ padding: "16px 18px 4px" }}>Concluídas ({feitas.length})</h2>
        {feitas.length === 0 && <p className="muted" style={{ padding: "4px 18px 18px" }}>Nada concluído ainda.</p>}
        {feitas.map((t) => (
          <div className="row" key={t.id} style={{ opacity: 0.75 }}>
            <span className="badge badge-ok">✓</span>
            <div style={{ flex: 3, minWidth: 180 }}>
              <div style={{ fontWeight: 600, textDecoration: "line-through" }}>{t.titulo}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {[dono && t.responsavel_nome, t.concluida_em && `concluída em ${new Date(t.concluida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
