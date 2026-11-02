import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailInterno } from "@/lib/usuario";

async function entrar(formData: FormData) {
  "use server";
  const usuario = String(formData.get("usuario") ?? "").trim().toLowerCase();
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
        <details className="muted" style={{ fontSize: 13 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Esqueci minha senha</summary>
          <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            Funcionário: peça ao dono da loja para criar uma senha nova em <b>Perfil da loja</b>.<br />
            Dono: fale com o suporte Synvora informando seu nome de usuário e o e-mail de recuperação cadastrado.
          </p>
        </details>
      </form>
    </main>
  );
}
