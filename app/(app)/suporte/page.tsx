import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import Chat, { type Mensagem } from "@/components/Chat";
import { meuPerfil } from "@/lib/perfil";

async function enviar(f: FormData) {
  "use server";
  const texto = String(f.get("texto") ?? "").trim();
  if (!texto) return;
  const supabase = createClient();
  await supabase.rpc("enviar_suporte", { texto_msg: texto });
  revalidatePath("/suporte");
}

const PLANOS: Record<string, string> = { mensal: "mensal", anual: "anual", vitalicio: "vitalício" };

export default async function Suporte({ searchParams }: { searchParams: { plano?: string } }) {
  const eu = await meuPerfil();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suporte_mensagens")
    .select("id, autor_nome, da_equipe, texto, criado_em")
    .eq("loja_id", eu.loja_id)
    .order("criado_em", { ascending: true })
    .limit(500);
  const plano = searchParams.plano ? PLANOS[searchParams.plano] : undefined;

  return (
    <>
      <div>
        <h1>Suporte</h1>
        <p className="muted">Fale com a equipe Synvora. Atendimento 24 horas por este chat.</p>
      </div>
      {error && <div className="erro">Rode o arquivo supabase/modulos.sql no Supabase para liberar o chat. ({error.message})</div>}
      <Chat mensagens={(data ?? []) as Mensagem[]} ladoEquipe={false} acao={enviar}
        textoInicial={plano ? `Olá! Quero contratar o plano ${plano} do Synvora.` : undefined} />
    </>
  );
}
