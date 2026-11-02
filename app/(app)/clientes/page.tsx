import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { meuPerfil, texto } from "@/lib/perfil";
import { reais } from "@/lib/pedidos";
import { falha, sucesso, traduzir } from "@/lib/acoes";
import Mensagens from "@/components/Mensagens";
import BotaoConfirmar from "@/components/BotaoConfirmar";

async function salvarCliente(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  const nome = texto(f, "nome");
  if (!nome) falha("/clientes", "Informe o nome do cliente.");
  const supabase = createClient();
  const { error } = await supabase.from("clientes").insert({
    loja_id: eu.loja_id, nome,
    telefone: texto(f, "telefone"), email: texto(f, "email"), documento: texto(f, "documento"),
    endereco: texto(f, "endereco"), aniversario: texto(f, "aniversario"), observacao: texto(f, "observacao"),
  });
  if (error) falha("/clientes", traduzir(error));
  revalidatePath("/caixa");
  sucesso("/clientes", `Cliente "${nome}" cadastrado.`);
}

async function removerCliente(f: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", String(f.get("id")));
  if (error) falha("/clientes", traduzir(error));
  revalidatePath("/clientes");
}

export default async function Clientes({ searchParams }: { searchParams: { q?: string; erro?: string; ok?: string } }) {
  const q = (searchParams.q ?? "").trim().replace(/[%_,()]/g, "");
  const supabase = createClient();
  let consulta = supabase.from("clientes").select("id, nome, telefone, email, documento, aniversario, observacao").order("nome").limit(300);
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,documento.ilike.%${q}%`);
  const [{ data: clientes, error }, { data: vendas }] = await Promise.all([
    consulta,
    supabase.from("pedidos").select("cliente_nome, total").eq("cancelado", false).not("cliente_nome", "is", null).limit(5000),
  ]);
  const compras = new Map<string, { n: number; total: number }>();
  for (const v of vendas ?? []) {
    const k = String(v.cliente_nome).toLowerCase();
    const c = compras.get(k) ?? { n: 0, total: 0 };
    compras.set(k, { n: c.n + 1, total: c.total + Number(v.total) });
  }

  return (
    <>
      <div>
        <h1>Clientes</h1>
        <p className="muted">Cadastro dos seus clientes. As compras feitas no caixa com o mesmo nome aparecem aqui.</p>
      </div>
      <Mensagens erro={searchParams.erro ?? (error ? traduzir(error) : undefined)} ok={searchParams.ok} />

      <form action={salvarCliente} className="card form-grid">
        <label className="field">Nome<input className="input" name="nome" required /></label>
        <label className="field">Telefone / WhatsApp<input className="input" name="telefone" inputMode="tel" /></label>
        <label className="field">E-mail<input className="input" name="email" type="email" /></label>
        <label className="field">CPF ou CNPJ<input className="input" name="documento" /></label>
        <label className="field">Endereço<input className="input" name="endereco" /></label>
        <label className="field">Aniversário<input className="input" name="aniversario" type="date" /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Observação<input className="input" name="observacao" /></label>
        <button className="btn" type="submit">Adicionar cliente</button>
      </form>

      <form className="card" style={{ display: "flex", gap: 10, padding: 14 }}>
        <input className="input" name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou documento" />
        <button className="btn btn-ghost" type="submit">Buscar</button>
      </form>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {(clientes ?? []).length === 0 && <p className="muted" style={{ padding: 20 }}>Nenhum cliente encontrado.</p>}
        {(clientes ?? []).map((c) => {
          const h = compras.get(c.nome.toLowerCase());
          return (
            <div className="row" key={c.id}>
              <div style={{ flex: 3, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{c.nome}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[c.telefone, c.email, c.documento, c.aniversario && `aniversário ${c.aniversario.split("-").reverse().slice(0, 2).join("/")}`].filter(Boolean).join(" · ") || "Sem contato"}
                </div>
                {c.observacao && <div className="muted" style={{ fontSize: 12 }}>{c.observacao}</div>}
              </div>
              <span style={{ flex: 1, minWidth: 120 }}>{h ? `${h.n} compra(s) · ${reais(h.total)}` : <span className="muted">Sem compras</span>}</span>
              <form action={removerCliente}>
                <input type="hidden" name="id" value={c.id} />
                <BotaoConfirmar pergunta={`Remover o cliente "${c.nome}"? As compras dele continuam no histórico.`}>Remover</BotaoConfirmar>
              </form>
            </div>
          );
        })}
      </section>
    </>
  );
}
