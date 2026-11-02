import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdmin, SEM_CHAVE_ADMIN } from "@/lib/supabase/admin";
import { exigirDono, texto } from "@/lib/perfil";
import { headers } from "next/headers";
import EnviarFoto from "@/components/EnviarFoto";
import Copiar from "@/components/Copiar";
import { lerConfig, salvarConfigFiscal } from "@/lib/fiscal";

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


  const { error } = await supabase.from("lojas").update(dados).eq("id", eu.loja_id);
  if (error) redirect(`/perfil-da-loja?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/", "layout");
  redirect("/perfil-da-loja?ok=loja");
}

async function salvarLogo(url: string) {
  "use server";
  const eu = await exigirDono();
  const origem = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if (!url.startsWith(`${origem}/storage/v1/object/public/logos/${eu.loja_id}/`)) return { erro: "Endereço da foto inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("lojas").update({ logo_url: url }).eq("id", eu.loja_id);
  if (error) return { erro: /logo_url/.test(error.message) ? "Rode o arquivo supabase/modulos.sql no Supabase." : error.message };
  revalidatePath("/", "layout");
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
  if (!admin) redirect(`/perfil-da-loja?erro=${encodeURIComponent(SEM_CHAVE_ADMIN)}`);
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

async function salvarFiscal(f: FormData) {
  "use server";
  const eu = await exigirDono();
  const so = (n: string) => (texto(f, n) ?? "").replace(/\D/g, "") || null;
  const amb = f.get("ambiente") === "producao" ? "producao" : "homologacao";
  const token = texto(f, "token");
  const r = await salvarConfigFiscal(eu.loja_id, {
    ambiente: amb, cnpj: so("cnpj"), uf: (texto(f, "uf") ?? "").toUpperCase().slice(0, 2) || null,
    ncm_padrao: so("ncm_padrao"), cfop_padrao: so("cfop_padrao") ?? "5102", icms_padrao: so("icms_padrao") ?? "102",
    origem_padrao: so("origem_padrao") ?? "0", pis_cofins_padrao: so("pis_cofins_padrao") ?? "49",
    ...(token ? { token } : {}),
  });
  if (r.erro) redirect(`/perfil-da-loja?erro=${encodeURIComponent(r.erro)}#fiscal`);
  revalidatePath("/perfil-da-loja");
  redirect("/perfil-da-loja?ok=fiscal#fiscal");
}

async function novoLinkCatalogo() {
  "use server";
  await exigirDono();
  const supabase = createClient();
  const { error } = await supabase.rpc("novo_catalogo_token");
  if (error) redirect(`/perfil-da-loja?erro=${encodeURIComponent(error.message.slice(0, 160))}`);
  revalidatePath("/perfil-da-loja");
  redirect("/perfil-da-loja?ok=catalogo");
}

const OK: Record<string, string> = { fiscal: "Configuração da nota fiscal salva.", catalogo: "Link novo do catálogo criado. Troque também no Gerenciador de Comércio.", loja: "Dados da loja salvos.", login: "Seu login foi atualizado.", membro: "Acesso atualizado." };

export default async function PerfilDaLoja({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const eu = await exigirDono();
  const supabase = createClient();
  const [{ data: loja }, { data: pessoas }] = await Promise.all([
    supabase.from("lojas").select("*").eq("id", eu.loja_id).single(),
    supabase.from("perfis").select("id, nome, usuario, papel").order("criado_em"),
  ]);
  const { data: prods } = await supabase.from("produtos").select("id, foto_url, preco");
  const { cfg: fiscal, erro: erroFiscal } = await lerConfig(eu.loja_id);
  const totalProd = (prods ?? []).length;
  const noCatalogo = (prods ?? []).filter((p) => p.foto_url && Number(p.preco) > 0).length;
  const h = headers();
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
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
        <div className="field" style={{ gridColumn: "1 / -1" }}>Foto ou logo da loja
          <EnviarFoto bucket="logos" pasta={eu.loja_id} nome="logo" atual={l.logo_url ?? null} salvar={salvarLogo}
            rotulo={l.logo_url ? "Trocar foto" : "Escolher foto"} lado={600} />
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>Pode usar foto do celular de qualquer tamanho: ela é ajustada sozinha e salva na hora.</span>
        </div>
        <label className="field">Nome da loja<input className="input" name="nome" defaultValue={l.nome ?? ""} required /></label>
        <label className="field">Telefone / WhatsApp<input className="input" name="telefone" defaultValue={l.telefone ?? ""} /></label>
        <label className="field">E-mail da loja<input className="input" name="email" type="email" defaultValue={l.email ?? ""} /></label>
        <label className="field">CNPJ ou CPF<input className="input" name="documento" defaultValue={l.documento ?? ""} /></label>
        <label className="field">Instagram<input className="input" name="instagram" defaultValue={l.instagram ?? ""} placeholder="@sualoja" /></label>
        <label className="field">Endereço<input className="input" name="endereco" defaultValue={l.endereco ?? ""} /></label>
        <button className="btn" type="submit">Salvar dados da loja</button>
      </form>

      <h2 id="fiscal" style={{ margin: "8px 0 0", fontSize: 18 }}>Nota fiscal (NFC-e e NF-e)</h2>
      <form action={salvarFiscal} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>O Synvora emite as notas pela <a href="https://focusnfe.com.br" target="_blank" rel="noopener" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Focus NFe</a>. Crie a conta lá, cadastre sua empresa com o certificado digital A1 e o CSC da NFC-e, e cole aqui o token da empresa.</p>
        {erroFiscal && <div className="erro">{erroFiscal}</div>}
        <div className="form-grid">
          <label className="field">Ambiente
            <select className="input" name="ambiente" defaultValue={fiscal?.ambiente ?? "homologacao"}>
              <option value="homologacao">Teste (homologação, sem valor fiscal)</option>
              <option value="producao">Produção (notas valendo)</option>
            </select>
          </label>
          <label className="field">Token da empresa na Focus NFe
            <input className="input" name="token" type="password" autoComplete="off" placeholder={fiscal?.token ? "Token salvo ✓ (deixe vazio para manter)" : "Cole o token aqui"} />
          </label>
          <label className="field">CNPJ da loja<input className="input" name="cnpj" inputMode="numeric" defaultValue={fiscal?.cnpj ?? (l.documento ?? "")} required /></label>
          <label className="field">UF da loja<input className="input" name="uf" maxLength={2} defaultValue={fiscal?.uf ?? ""} placeholder="RS" required style={{ textTransform: "uppercase" }} /></label>
        </div>
        <details>
          <summary className="resumo-abrir">Impostos padrão (peça ao seu contador)</summary>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field">NCM padrão<input className="input" name="ncm_padrao" inputMode="numeric" maxLength={8} defaultValue={fiscal?.ncm_padrao ?? ""} placeholder="Usado em produto sem NCM" /></label>
            <label className="field">CFOP padrão<input className="input" name="cfop_padrao" inputMode="numeric" maxLength={4} defaultValue={fiscal?.cfop_padrao ?? "5102"} /></label>
            <label className="field">CSOSN / CST do ICMS<input className="input" name="icms_padrao" inputMode="numeric" maxLength={3} defaultValue={fiscal?.icms_padrao ?? "102"} /></label>
            <label className="field">Origem da mercadoria<input className="input" name="origem_padrao" inputMode="numeric" maxLength={1} defaultValue={fiscal?.origem_padrao ?? "0"} /></label>
            <label className="field">CST do PIS e COFINS<input className="input" name="pis_cofins_padrao" inputMode="numeric" maxLength={2} defaultValue={fiscal?.pis_cofins_padrao ?? "49"} /></label>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>Os valores iniciais (CFOP 5102, CSOSN 102, origem 0, PIS/COFINS 49) são comuns para revenda no Simples Nacional, mas cada loja tem suas regras. Confirme com o contador. Cada produto pode ter os seus no Estoque.</p>
        </details>
        <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Salvar configuração da nota</button>
      </form>

      <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>Catálogo no Facebook e Instagram</h2>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {l.catalogo_token ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Cole este link no Gerenciador de Comércio da Meta e seus produtos aparecem na loja do Facebook e do Instagram, com preço e estoque atualizando sozinhos.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="input" style={{ flex: "1 1 260px", width: "auto" }} readOnly value={`${origem}/catalogo/${l.catalogo_token}`} aria-label="Link do catálogo" />
              <Copiar texto={`${origem}/catalogo/${l.catalogo_token}`} />
            </div>
            <p className="muted" style={{ margin: 0 }}><b>{noCatalogo}</b> de {totalProd} produtos entram no catálogo. Só entram produtos com foto e preço.</p>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: "var(--ink2)" }}>
              <li>Abra o <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Gerenciador de Comércio</a> e crie um catálogo (tipo: E-commerce)</li>
              <li>Vá em Catálogo → Fontes de dados → Adicionar itens → Feed de dados</li>
              <li>Escolha &quot;Feed programado&quot;, cole o link acima e marque para atualizar todo dia</li>
              <li>Ligue o catálogo à sua página do Facebook e ao Instagram</li>
            </ol>
            <p className="muted" style={{ margin: 0 }}>Quem tocar no produto no Facebook ou Instagram cai numa página do produto com botão de comprar pelo WhatsApp (usa o telefone da loja acima).</p>
            <form action={novoLinkCatalogo}><button className="btn btn-ghost btn-sm" type="submit">Gerar link novo (o antigo para de funcionar)</button></form>
          </>
        ) : (
          <div className="erro">Atualize o banco (tudo.sql no Supabase) para liberar o catálogo.</div>
        )}
      </section>

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
