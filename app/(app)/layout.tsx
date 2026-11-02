import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual, usuarioAtual } from "@/lib/sessao";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import Avisos from "@/components/Avisos";

// Suba este número junto com supabase/versao.sql quando o banco mudar
const VERSAO_BANCO = 6;

async function sair() {
  "use server";
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function marcarLidos() {
  "use server";
  const user = await usuarioAtual();
  if (!user) return;
  const supabase = createClient();
  await supabase.from("avisos").update({ lido: true }).eq("para_id", user.id).eq("lido", false);
  revalidatePath("/", "layout");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = createClient();

  // Tudo de uma vez, em paralelo (antes era uma consulta depois da outra)
  const [perfil, avisos, atendente, baixos, lojaRes, versao, ceo] = await Promise.all([
    perfilAtual(),
    supabase.from("avisos").select("id, texto, link, lido, criado_em").eq("para_id", user.id).order("criado_em", { ascending: false }).limit(15),
    supabase.rpc("sou_atendente"),
    supabase.from("produtos").select("id", { count: "exact", head: true }).lte("saldo", 5),
    supabase.from("lojas").select("*").limit(1).maybeSingle(),
    supabase.rpc("versao_banco"),
    supabase.rpc("sou_ceo"),
  ]);
  const bancoDesatualizado = typeof versao.data !== "number" || versao.data < VERSAO_BANCO;
  const dono = perfil?.papel === "dono";
  const loja = (lojaRes.data as { nome: string; logo_url?: string | null } | null) ?? null;

  return (
    <div className="shell">
      <Sidebar loja={loja?.nome ?? "Minha loja"} logo={loja?.logo_url ?? null} papel={perfil?.papel ?? "vendedor"} nome={perfil?.nome ?? "Usuário"} atendente={atendente.data === true} ceo={ceo.data === true} />
      <div className="content">
        <div className="topbar">
          <Avisos avisos={avisos.data ?? []} estoqueBaixo={dono ? baixos.count ?? 0 : 0} marcarLidos={marcarLidos} />
          <ThemeToggle />
          <form action={sair}>
            <button className="btn btn-ghost" style={{ minHeight: 44 }} type="submit">Sair</button>
          </form>
        </div>
        {!perfil && <div className="erro" style={{ margin: "0 16px" }}>Não foi possível carregar o perfil. Saia e entre de novo.</div>}
        {dono && bancoDesatualizado && (
          <div className="erro" role="alert" style={{ margin: "0 16px", lineHeight: 1.6 }}>
            <b>Falta atualizar o banco de dados.</b> Algumas telas não vão funcionar até isso ser feito (leva 1 minuto):<br />
            1. Abra o arquivo <a href="https://github.com/batistaxd7/synvora/blob/main/supabase/tudo.sql" target="_blank" rel="noopener" style={{ textDecoration: "underline", fontWeight: 600 }}>supabase/tudo.sql</a> e copie todo o conteúdo (botão “Copy raw file”).<br />
            2. No Supabase, vá em <b>SQL Editor &gt; New query</b>, cole e clique em <b>Run</b>.<br />
            3. Volte aqui e atualize a página. Este aviso some sozinho.<br />
            <small style={{ opacity: .8 }}>
              Se o Supabase perguntar sobre “destructive operations”, clique em <b>Run this query</b> (nenhum dado é apagado).
              {versao.error ? ` Situação atual: ${versao.error.code ?? ""} ${versao.error.message.slice(0, 120)}` : versao.data != null ? ` Versão atual do banco: ${versao.data}, precisa ser ${VERSAO_BANCO}.` : ""}
            </small>
          </div>
        )}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
