import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { exigirDono, texto } from "@/lib/perfil";

const PAPEIS: Record<string, string> = { dono: "Dono", vendedor: "Vendedor / Afiliado", caixa: "Caixa" };

async function salvarLoja(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const nome = texto(f, "nome");
  if (!nome) redirect("/perfil-da-loja?erro=Informe o nome da loja.");
  const supabase = createClient();
  const dados: Record<string, string | null> = {
    nome, telefone: texto(f, "telefone"), email: texto(f, "email"),
    endereco: texto(f, "endereco"), documento: texto(f, "documento"), instagram: texto(f, "instagram"),
  };

  const logo = f.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) redirect("/perfil-da-loja?erro=A logo precisa ser uma imagem (PNG, JPG ou WEBP).");
    if (logo.size > 2 * 1024 * 1024) redirect("/perfil-da-loja?erro=A logo pode ter no máximo 2 MB.");
    const ext = (logo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const caminho = `${eu.loja_id}/logo-${Date.now()}.${ext}`;
    const { error: erroUp } = await supabase.storage.from("logos").upload(caminho, logo, { contentType: logo.type, upsert: true });
    if (erroUp) redirect(`/perfil-da-loja?erro=${encodeURIComponent("Não foi possível enviar a logo: " + erroUp.message)}`);
    dados.logo_url = supabase.storage.from("logos").getPublicUrl(caminho).data.publicUrl;
  }

  const { error } = await supabase.from("lojas").update(dados).eq("id", eu.loja_id);
  if (error) redirect(`/perfil-da-loja?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/", "layout");
  redirect("/perfil-da-loja?ok=loja");
}

async function salvarMeuLogin(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const supabase = createClient();
  const nome = texto(f, "nome") ?? eu.nome;
  await supabase.from("perfis").update({ nome, email_recuperacao: texto(f, "email_recuperacao") }).eq("id", eu.id);
  const senha = String(f.get("senha") ?? "");
  if (senha) {
    if (senha.length < 8) redirect("/perfil-da-loja?erro=A nova senha precisa ter pelo menos 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) redirect(`/perfil-da-loja?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  }
  revalidatePath("/", "layout");
  redirect("/perfil-da-loja?ok=login");
}

async function alterarMembro(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const id = String(f.get("id") ?? "");
  const papel = String(f.get("papel") ?? "");
  const senha = String(f.get("senha") ?? "");
  if (!id || id === eu.id) return;
  const supabase = createClient();
  const { data: alvo } = await supabase.from("perfis").select("id, papel, loja_id").eq("id", id).single();
  if (!alvo || alvo.papel === "dono" || alvo.loja_id !== eu.loja_id) return;

  const admin = createAdmin();
  if (papel === "vendedor" || papel === "caixa") {
    await admin.auth.admin.updateUserById(id, { app_metadata: { loja_id: eu.loja_id, papel } });
    await admin.from("perfis").update({ papel }).eq("id", id);
  }
  if (senha) {
    if (senha.length < 8) redirect("/perfil-da-loja?erro=A senha precisa ter pelo menos 8 caracteres.");
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (error) redirect(`/perfil-da-loja?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  }
  revalidatePath("/perfil-da-loja");
  redirect("/perfil-da-loja?ok=membro");
}

const OK: Record<string, string> = { loja: "Dados da loja salvos.", login: "Seu login foi atualizado.", membro: "Acesso atualizado." };

export default async function PerfilDaLoja({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const eu = await exigirDono();
  const supabase = createClient();
  const [{ data: loja }, { data: pessoas }] = await Promise.all([
    supabase.from("lojas").select("*").eq("id", eu.loja_id).single(),
    supabase.from("perfis").select("id, nome, usuario, papel").order("criado_em"),
  ]);
  const l = (loja ?? {}) as Record<string, string | null>;

  return (
    <>
      <div>
        <h1>Perfil da loja</h1>
        <p className="muted">Logo, dados da loja, seu login e as permissões de cada pessoa da equipe.</p>
      </div>
      {searchParams.erro && <div className="erro">{searchParams.erro}</div>}
      {searchParams.ok && <div className="erro aviso-ok">{OK[searchParams.ok] ?? "Salvo."}</div>}

      <form action={salvarLoja} className="card form-grid">
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16 }}>
          <div className="logo-loja">
            {l.logo_url ? <img src={l.logo_url} alt={`Logo de ${l.nome}`} /> : <span>{(l.nome ?? "L").slice(0, 1).toUpperCase()}</span>}
          </div>
          <label className="field" style={{ flex: 1 }}>Foto ou logo da loja (até 2 MB)
            <input className="input" name="logo" type="file" accept="image/png,image/jpeg,image/webp" style={{ paddingTop: 12 }} />
          </label>
        </div>
        <label className="field">Nome da loja<input className="input" name="nome" defaultValue={l.nome ?? ""} required /></label>
        <label className="field">Telefone / WhatsApp<input className="input" name="telefone" defaultValue={l.telefone ?? ""} /></label>
        <label className="field">E-mail da loja<input className="input" name="email" type="email" defaultValue={l.email ?? ""} /></label>
        <label className="field">CNPJ ou CPF<input className="input" name="documento" defaultValue={l.documento ?? ""} /></label>
        <label className="field">Instagram<input className="input" name="instagram" defaultValue={l.instagram ?? ""} placeholder="@sualoja" /></label>
        <label className="field">Endereço<input className="input" name="endereco" defaultValue={l.endereco ?? ""} /></label>
        <button className="btn" type="submit">Salvar dados da loja</button>
      </form>

      <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>Meu login</h2>
      <form action={salvarMeuLogin} className="card form-grid">
        <label className="field">Seu nome<input className="input" name="nome" defaultValue={eu.nome} required /></label>
        <label className="field">Usuário<input className="input" value={eu.usuario} disabled /></label>
        <label className="field">E-mail para recuperar a senha<input className="input" name="email_recuperacao" type="email" defaultValue={eu.email_recuperacao ?? ""} /></label>
        <label className="field">Nova senha (deixe vazio para manter)<input className="input" name="senha" type="password" autoComplete="new-password" /></label>
        <button className="btn" type="submit">Salvar meu login</button>
      </form>

      <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>Permissões da equipe</h2>
          <p className="muted" style={{ margin: 0 }}>Vendedor/Afiliado e Caixa veem só caixa, pedidos, clientes, tarefas e suporte. Gastos, financeiro e planos ficam só com o dono.</p>
        </div>
        <Link className="btn btn-ghost" href="/equipe">+ Criar novo acesso</Link>
      </div>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(pessoas ?? []).map((p) => (
          <div className="row" key={p.id}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>
              <div className="muted" style={{ fontSize: 12 }}>usuário: {p.usuario}</div>
            </div>
            {p.papel === "dono" ? (
              <span className="badge badge-ok">Dono</span>
            ) : (
              <form action={alterarMembro} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="hidden" name="id" value={p.id} />
                <select className="input" name="papel" defaultValue={p.papel} style={{ width: 190, minHeight: 40 }} aria-label={`Permissão de ${p.nome}`}>
                  <option value="vendedor">{PAPEIS.vendedor}</option>
                  <option value="caixa">{PAPEIS.caixa}</option>
                </select>
                <input className="input" name="senha" type="text" placeholder="nova senha (opcional)" autoComplete="off" style={{ width: 190, minHeight: 40 }} aria-label={`Nova senha de ${p.nome}`} />
                <button className="btn btn-sm" type="submit">Salvar</button>
              </form>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
