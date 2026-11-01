import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <aside className="side">
        <div style={{ fontWeight: 700, fontSize: 19, padding: "0 8px" }}>Synvora</div>
        <nav>
          <Link className="nav-item" href="/painel">Painel</Link>
          <Link className="nav-item" href="/estoque">Estoque</Link>
          {perfil?.papel === "dono" && <Link className="nav-item" href="/equipe">Equipe</Link>}
          {["Caixa", "Pedidos", "Clientes", "Gastos", "Financeiro", "Tarefas", "Suporte"].map((n) => (
            <Link key={n} className="nav-item" href={`/em-breve/${n.toLowerCase()}`} style={{ opacity: 0.6 }}>{n}<span className="badge badge-warn" style={{ marginLeft: "auto", fontSize: 10 }}>em breve</span></Link>
          ))}
        </nav>
        <div className="muted" style={{ padding: "0 8px", lineHeight: 1.5 }}>
          Loja: {loja}<br />
          {perfil ? `${perfil.nome} (${perfil.papel})` : "Perfil não carregado"}
          {erroPerfil && <><br /><small>Erro: {erroPerfil.message}</small></>}
        </div>
        <form action={sair}>
          <button className="btn btn-ghost" style={{ width: "100%" }} type="submit">Sair</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
