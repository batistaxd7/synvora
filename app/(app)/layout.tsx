import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import Avisos from "@/components/Avisos";

async function sair() {
  "use server";
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function marcarLidos() {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("avisos").update({ lido: true }).eq("para_id", user.id).eq("lido", false);
  revalidatePath("/", "layout");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfis")
    .select("nome, papel, loja_id")
    .eq("id", user.id)
    .single();
  const dono = perfil?.papel === "dono";

  // Estas consultas não travam a tela se o banco ainda não tiver as tabelas novas
  const [avisos, atendente, baixos, lojaRes] = await Promise.all([
    supabase.from("avisos").select("id, texto, link, lido, criado_em").eq("para_id", user.id).order("criado_em", { ascending: false }).limit(15),
    supabase.rpc("sou_atendente"),
    dono ? supabase.from("produtos").select("id", { count: "exact", head: true }).lte("saldo", 5) : Promise.resolve({ count: 0 }),
    supabase.from("lojas").select("*").eq("id", perfil?.loja_id ?? "").maybeSingle(),
  ]);

  const loja = (lojaRes.data as { nome: string; logo_url?: string | null } | null) ?? null;

  return (
    <div className="shell">
      <Sidebar loja={loja?.nome ?? "Minha loja"} logo={loja?.logo_url ?? null} papel={perfil?.papel ?? "vendedor"} nome={perfil?.nome ?? "Usuário"} atendente={atendente.data === true} />
      <div className="content">
        <div className="topbar">
          <Avisos avisos={avisos.data ?? []} estoqueBaixo={baixos.count ?? 0} marcarLidos={marcarLidos} />
          <ThemeToggle />
          <form action={sair}>
            <button className="btn btn-ghost" style={{ minHeight: 44 }} type="submit">Sair</button>
          </form>
        </div>
        {erroPerfil && <div className="erro">Não foi possível carregar o perfil: {erroPerfil.message}</div>}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
