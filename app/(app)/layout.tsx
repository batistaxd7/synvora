import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";

async function sair() {
  "use server";
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfis")
    .select("nome, papel, lojas(nome)")
    .eq("id", user.id)
    .single();

  const loja = (perfil?.lojas as unknown as { nome: string } | null)?.nome ?? "Minha loja";

  return (
    <div className="shell">
      <Sidebar loja={loja} papel={perfil?.papel ?? "vendedor"} nome={perfil?.nome ?? "Usuário"} />
      <div className="content">
        <div className="topbar">
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
