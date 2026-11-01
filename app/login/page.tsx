import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailInterno } from "@/lib/usuario";

async function entrar(formData: FormData) {
  "use server";
  const usuario = String(formData.get("usuario") ?? "");
  const senha = String(formData.get("senha") ?? "");
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInterno(usuario),
    password: senha,
  });
  if (error) redirect("/login?erro=1");
  redirect("/painel");
}

export default function Login({ searchParams }: { searchParams: { erro?: string } }) {
  return (
    <main className="auth">
      <form action={entrar} className="card">
        <div>
          <h1 style={{ fontSize: 24 }}>Entrar no Synvora</h1>
          <p className="muted">Use seu nome de usuário e sua senha.</p>
        </div>
        {searchParams.erro && <div className="erro">Usuário ou senha incorretos.</div>}
        <label className="field">
          Nome de usuário
          <input className="input" name="usuario" autoComplete="username" required />
        </label>
        <label className="field">
          Senha
          <input className="input" name="senha" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn" type="submit">Entrar</button>
        <Link href="/cadastro" className="btn btn-ghost">Criar conta da loja</Link>
      </form>
    </main>
  );
}
