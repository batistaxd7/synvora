import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailInterno, usuarioValido } from "@/lib/usuario";

async function criarConta(formData: FormData) {
  "use server";
  const loja = String(formData.get("loja") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const usuario = String(formData.get("usuario") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!loja || !nome || !email) redirect("/cadastro?erro=dados");
  if (!usuarioValido(usuario)) redirect("/cadastro?erro=usuario");
  if (senha.length < 8) redirect("/cadastro?erro=senha");

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: emailInterno(usuario),
    password: senha,
    options: { data: { loja_nome: loja, nome, usuario, email_recuperacao: email } },
  });
  if (error) {
    const tipo = error.message.toLowerCase().includes("already") ? "existe" : "geral";
    redirect(`/cadastro?erro=${tipo}&detalhe=${encodeURIComponent(error.message.slice(0, 200))}`);
  }
  if (!data.session) redirect("/cadastro?erro=confirmacao");
  redirect("/painel");
}

const MENSAGENS: Record<string, string> = {
  dados: "Preencha todos os campos.",
  usuario: "O usuário deve ter de 3 a 30 caracteres, sem espaços, acentos nem @. Use só letras, números, ponto, traço ou sublinhado. Exemplo: maria.loja",
  senha: "A senha precisa ter pelo menos 8 caracteres.",
  existe: "Esse nome de usuário já está em uso. Escolha outro.",
  confirmacao: "A confirmação de e-mail do Supabase precisa estar desligada (veja o README).",
  geral: "Não foi possível criar a conta. Tente de novo.",
};

export default function Cadastro({ searchParams }: { searchParams: { erro?: string; detalhe?: string } }) {
  const erro = searchParams.erro ? MENSAGENS[searchParams.erro] ?? MENSAGENS.geral : null;
  return (
    <main className="auth">
      <form action={criarConta} className="card">
        <div>
          <h1 style={{ fontSize: 24 }}>Criar conta da loja</h1>
          <p className="muted">Você será o dono da loja e poderá criar usuários para a equipe depois.</p>
        </div>
        {erro && <div className="erro">{erro}{searchParams.detalhe && <><br /><small>Detalhe técnico: {searchParams.detalhe}</small></>}</div>}
        <label className="field">Nome da loja<input className="input" name="loja" required /></label>
        <label className="field">Seu nome<input className="input" name="nome" required /></label>
        <label className="field">Nome de usuário (para entrar)<input className="input" name="usuario" autoComplete="username" placeholder="ex: maria.loja" required /></label>
        <label className="field">
          E-mail (só para recuperar a senha)
          <input className="input" name="email" type="email" required />
        </label>
        <label className="field">Senha (mínimo 8 caracteres)<input className="input" name="senha" type="password" autoComplete="new-password" required /></label>
        <button className="btn" type="submit">Criar conta</button>
        <Link href="/login" className="btn btn-ghost">Já tenho conta</Link>
      </form>
    </main>
  );
}
