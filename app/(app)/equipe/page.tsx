import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/sessao";
import { emailInterno, usuarioValido } from "@/lib/usuario";

const PAPEIS: Record<string, string> = { dono: "Dono", vendedor: "Vendedor / Afiliado", caixa: "Caixa" };

async function souDono() {
  const perfil = await perfilAtual();
  return perfil && perfil.papel === "dono" ? perfil : null;
}

async function criarMembro(formData: FormData) {
  "use server";
  const dono = await souDono();
  if (!dono) redirect("/painel");

  const nome = String(formData.get("nome") ?? "").trim();
  const usuario = String(formData.get("usuario") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel") ?? "");
  if (!nome) redirect("/equipe?erro=dados");
  if (!usuarioValido(usuario)) redirect("/equipe?erro=usuario");
  if (senha.length < 8) redirect("/equipe?erro=senha");
  if (papel !== "vendedor" && papel !== "caixa") redirect("/equipe?erro=dados");

  const admin = createAdmin();
  const { error } = await admin.auth.admin.createUser({
    email: emailInterno(usuario),
    password: senha,
    email_confirm: true,
    user_metadata: { nome, usuario },
    app_metadata: { loja_id: dono.loja_id, papel },
  });
  if (error) {
    const existe = /already|registered|exists/i.test(error.message);
    redirect(`/equipe?erro=${existe ? "existe" : "geral"}&detalhe=${encodeURIComponent(error.message.slice(0, 160))}`);
  }
  revalidatePath("/equipe");
  redirect("/equipe?ok=1");
}

async function removerMembro(formData: FormData) {
  "use server";
  const dono = await souDono();
  if (!dono) redirect("/painel");
  const id = String(formData.get("id") ?? "");
  if (!id || id === dono.id) return;
  const supabase = createClient();
  const { data: alvo } = await supabase.from("perfis").select("id, papel").eq("id", id).single();
  if (!alvo || alvo.papel === "dono") return;
  await createAdmin().auth.admin.deleteUser(id);
  revalidatePath("/equipe");
}

const MENSAGENS: Record<string, string> = {
  dados: "Preencha todos os campos.",
  usuario: "O usuário deve ter de 3 a 30 caracteres, sem espaços, acentos nem @. Exemplo: ana.vendas",
  senha: "A senha precisa ter pelo menos 8 caracteres.",
  existe: "Esse nome de usuário já está em uso. Escolha outro.",
  geral: "Não foi possível criar o acesso.",
};

export default async function Equipe({ searchParams }: { searchParams: { erro?: string; ok?: string; detalhe?: string } }) {
  const dono = await souDono();
  if (!dono) redirect("/painel");
  const supabase = createClient();
  const { data: pessoas } = await supabase.from("perfis").select("id, nome, usuario, papel").order("criado_em");
  const erro = searchParams.erro ? MENSAGENS[searchParams.erro] ?? MENSAGENS.geral : null;

  return (
    <>
      <div>
        <h1>Equipe</h1>
        <p className="muted">Crie o acesso de funcionários e afiliados. Cada um entra com o próprio usuário e senha, na sua loja.</p>
      </div>

      <form action={criarMembro} className="card" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", alignItems: "end" }}>
        {erro && <div className="erro" style={{ gridColumn: "1 / -1" }}>{erro}{searchParams.detalhe && <><br /><small>Detalhe técnico: {searchParams.detalhe}</small></>}</div>}
        {searchParams.ok && <div className="erro" style={{ gridColumn: "1 / -1", background: "var(--ok-bg)", color: "var(--ok-ink)" }}>Acesso criado. Passe o usuário e a senha para a pessoa.</div>}
        <label className="field">Nome<input className="input" name="nome" required /></label>
        <label className="field">Usuário (para entrar)<input className="input" name="usuario" placeholder="ex: ana.vendas" required autoComplete="off" /></label>
        <label className="field">Senha (mínimo 8)<input className="input" name="senha" type="text" required autoComplete="off" /></label>
        <label className="field">Tipo de acesso
          <select className="input" name="papel" defaultValue="vendedor">
            <option value="vendedor">Vendedor / Afiliado</option>
            <option value="caixa">Caixa</option>
          </select>
        </label>
        <button className="btn" type="submit">Criar acesso</button>
      </form>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(pessoas ?? []).map((p) => (
          <div className="row" key={p.id}>
            <div style={{ flex: 3, minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>
              <div className="muted" style={{ fontSize: 12 }}>usuário: {p.usuario}</div>
            </div>
            <span className={`badge ${p.papel === "dono" ? "badge-ok" : "badge-warn"}`}>{PAPEIS[p.papel] ?? p.papel}</span>
            {p.papel !== "dono" && (
              <form action={removerMembro}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn-ghost" style={{ minHeight: 36, padding: "0 14px" }} type="submit">Remover acesso</button>
              </form>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
