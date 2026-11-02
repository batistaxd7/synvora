import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dataHora } from "@/lib/pedidos";
import Chat, { type Mensagem } from "@/components/Chat";
import AtualizarSozinho from "@/components/AtualizarSozinho";

async function responder(f: FormData) {
  "use server";
  const texto = String(f.get("texto") ?? "").trim();
  const loja = String(f.get("loja") ?? "");
  if (!texto || !loja) return;
  const supabase = createClient();
  await supabase.rpc("enviar_suporte", { texto_msg: texto, para_loja: loja });
  revalidatePath("/atendimento");
}

// Tela só da equipe Synvora: responde os lojistas de todas as lojas
export default async function Atendimento({ searchParams }: { searchParams: { loja?: string } }) {
  const supabase = createClient();
  const { data: atendente } = await supabase.rpc("sou_atendente");
  if (!atendente) redirect("/painel");

  const { data: conversas } = await supabase.rpc("conversas_suporte");
  const lista = (conversas ?? []) as { loja_id: string; loja_nome: string; ultima: string; ultima_em: string; nao_lidas: number }[];
  const aberta = searchParams.loja ?? lista[0]?.loja_id;
  const { data: mensagens } = aberta
    ? await supabase.from("suporte_mensagens").select("id, autor_nome, da_equipe, texto, criado_em").eq("loja_id", aberta).order("criado_em").limit(500)
    : { data: [] };
  const nomeLoja = lista.find((c) => c.loja_id === aberta)?.loja_nome;

  return (
    <>
      <div>
        <h1>Atendimento</h1>
        <p className="muted">Conversas de todos os lojistas. Só a equipe Synvora vê esta tela.</p>
      </div>
      <div className="atendimento">
        <section className="card" style={{ padding: 0, overflow: "hidden", alignSelf: "start" }}>
          {!aberta && <AtualizarSozinho segundos={10} />}
          {lista.length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhuma conversa ainda.</p>}
          {lista.map((c) => (
            <Link key={c.loja_id} href={`/atendimento?loja=${c.loja_id}`} className={`row${c.loja_id === aberta ? " ativo-lista" : ""}`} style={{ flexWrap: "nowrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.loja_nome}</div>
                <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultima}</div>
                <div className="muted" style={{ fontSize: 11 }}>{dataHora(c.ultima_em)}</div>
              </div>
              {Number(c.nao_lidas) > 0 && <span className="badge badge-danger">{c.nao_lidas}</span>}
            </Link>
          ))}
        </section>
        {aberta ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <b>{nomeLoja}</b>
            <Chat mensagens={(mensagens ?? []) as Mensagem[]} ladoEquipe acao={responder} lojaId={aberta} />
          </div>
        ) : <div />}
      </div>
    </>
  );
}
