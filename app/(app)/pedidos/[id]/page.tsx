import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS, FORMAS, dataHora, reais, selo } from "@/lib/pedidos";
import CancelarPedido from "@/components/CancelarPedido";
import { traduzir } from "@/lib/acoes";
import { meuPerfil } from "@/lib/perfil";
import { emitirNota, consultarNota, cancelarNota, lerConfig, STATUS_NOTA } from "@/lib/fiscal";
import BotaoEnviar from "@/components/BotaoEnviar";

async function avancar(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const supabase = createClient();
  const { error } = await supabase.rpc("avancar_pedido", { pedido: id });
  if (error) redirect(`/pedidos/${id}?erro=${encodeURIComponent(traduzir(error))}`);
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

async function cancelar(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const devolver = formData.get("devolver") === "sim";
  const supabase = createClient();
  const { error } = await supabase.rpc("cancelar_pedido", { pedido: id, devolver });
  if (error) redirect(`/pedidos/${id}?erro=${encodeURIComponent(traduzir(error))}`);
  revalidatePath("/pedidos");
  revalidatePath("/estoque");
  revalidatePath(`/pedidos/${id}`);
}


function campo(f: FormData, n: string) { const v = String(f.get(n) ?? "").trim(); return v || null; }

async function emitirNFCe(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  const id = String(f.get("id") ?? "");
  const r = await emitirNota({ tipo: "nfce", pedidoId: id, lojaId: eu.loja_id, quem: eu.nome, cpfNaNota: campo(f, "cpf") });
  revalidatePath(`/pedidos/${id}`);
  redirect(r.erro ? `/pedidos/${id}?erro=${encodeURIComponent(r.erro)}#nota` : `/pedidos/${id}?ok=nota#nota`);
}

async function emitirNFe(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  const id = String(f.get("id") ?? "");
  const dest = { nome: campo(f, "nome"), documento: campo(f, "documento"), logradouro: campo(f, "logradouro"), numero: campo(f, "numero"),
    bairro: campo(f, "bairro"), municipio: campo(f, "municipio"), uf: campo(f, "uf"), cep: campo(f, "cep"), telefone: campo(f, "telefone"), email: campo(f, "email") };
  const r = await emitirNota({ tipo: "nfe", pedidoId: id, lojaId: eu.loja_id, quem: eu.nome, dest, presencial: f.get("presencial") === "1" });
  revalidatePath(`/pedidos/${id}`);
  redirect(r.erro ? `/pedidos/${id}?erro=${encodeURIComponent(r.erro)}#nota` : `/pedidos/${id}?ok=nota#nota`);
}

async function atualizarNota(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  const id = String(f.get("id") ?? "");
  const r = await consultarNota(String(f.get("nota") ?? ""), eu.loja_id);
  revalidatePath(`/pedidos/${id}`);
  redirect(r.erro ? `/pedidos/${id}?erro=${encodeURIComponent(r.erro)}#nota` : `/pedidos/${id}#nota`);
}

async function cancelarNF(f: FormData) {
  "use server";
  const eu = await meuPerfil();
  const id = String(f.get("id") ?? "");
  if (eu.papel !== "dono") redirect(`/pedidos/${id}?erro=${encodeURIComponent("Só o dono pode cancelar nota fiscal.")}#nota`);
  const r = await cancelarNota(String(f.get("nota") ?? ""), eu.loja_id, String(f.get("motivo") ?? ""));
  revalidatePath(`/pedidos/${id}`);
  redirect(r.erro ? `/pedidos/${id}?erro=${encodeURIComponent(r.erro)}#nota` : `/pedidos/${id}?ok=cancelada#nota`);
}

export default async function Pedido({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string; ok?: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("pedidos")
    .select("id, numero, cliente_id, cliente_nome, canal, etapa, cancelado, devolvido_ao_estoque, cancelado_em, cancelado_por, total, desconto, troco, criado_em, vendedor_nome")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from("pedido_itens").select("id, nome, quantidade, preco").eq("pedido_id", p.id),
    supabase.from("pedido_pagamentos").select("id, forma, valor").eq("pedido_id", p.id),
  ]);
  const eu = await meuPerfil();
  const [{ data: notasRaw }, { data: cliente }, conf] = await Promise.all([
    supabase.from("notas_fiscais").select("*").eq("pedido_id", p.id).order("criado_em", { ascending: false }),
    p.cliente_id ? supabase.from("clientes").select("nome, documento, telefone, email, endereco").eq("id", p.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    lerConfig(eu.loja_id),
  ]);
  const notas = (notasRaw ?? []) as { id: string; tipo: string; status: string; numero: string | null; serie: string | null; chave: string | null; danfe_url: string | null; xml_url: string | null; mensagem: string | null; ambiente: string; criado_em: string; emitida_por: string | null }[];
  const temAutorizada = notas.some((n) => n.status === "autorizado" || n.status === "processando_autorizacao");
  const configurado = !!conf.cfg?.token && !!conf.cfg?.cnpj;
  const cli = (cliente ?? null) as { nome?: string; documento?: string | null; telefone?: string | null; email?: string | null; endereco?: string | null } | null;
  const s = selo(p);
  const subtotal = (itens ?? []).reduce((t, i) => t + Number(i.preco) * i.quantidade, 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/pedidos" className="btn btn-ghost" style={{ minHeight: 40, padding: "0 14px" }}>← Pedidos</Link>
        <h1 style={{ flex: 1 }}>Pedido #{p.numero}</h1>
        <span className={`badge ${s.classe}`} style={{ fontSize: 14 }}>{s.texto}</span>
      </div>
      <p className="muted" style={{ marginTop: -12 }}>{dataHora(p.criado_em)} · {p.canal}{p.vendedor_nome ? ` · vendido por ${p.vendedor_nome}` : ""}</p>

      {searchParams.erro && <div className="erro">{searchParams.erro}</div>}
      {searchParams.ok === "nota" && <div className="erro aviso-ok">Nota enviada. Veja o status logo abaixo, em Nota fiscal.</div>}
      {searchParams.ok === "cancelada" && <div className="erro aviso-ok">Nota fiscal cancelada.</div>}

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Status do pedido</h2>
        <ol className="etapas">
          {ETAPAS.map((e, i) => (
            <li key={e} className={p.cancelado ? "cancelada" : i < p.etapa ? "feita" : i === p.etapa ? "atual" : ""}>
              <span className="ponto">{i < p.etapa && !p.cancelado ? "✓" : i + 1}</span>
              <span>{e}</span>
            </li>
          ))}
        </ol>
        {p.cancelado ? (
          <div className="erro" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            Cancelado{p.cancelado_por ? ` por ${p.cancelado_por}` : ""}{p.cancelado_em ? ` em ${dataHora(p.cancelado_em)}` : ""}.{" "}
            {p.devolvido_ao_estoque ? "Os produtos voltaram para o estoque." : "Os produtos não voltaram para o estoque."}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {p.etapa < 4 && (
              <form action={avancar}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn" type="submit">Avançar para “{ETAPAS[p.etapa + 1]}”</button>
              </form>
            )}
            <CancelarPedido id={p.id} numero={p.numero} acao={cancelar} />
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <h2 style={{ margin: 0, fontSize: 16, padding: "16px 18px 4px" }}>Itens</h2>
        {(itens ?? []).map((i) => (
          <div className="row" key={i.id}>
            <span style={{ flex: 3, minWidth: 160, fontWeight: 600 }}>{i.nome}</span>
            <span style={{ flex: 1 }}>{i.quantidade} × {reais(i.preco)}</span>
            <b>{reais(Number(i.preco) * i.quantidade)}</b>
          </div>
        ))}
        <div className="resumo" style={{ padding: "14px 18px" }}>
          <span>Subtotal</span><b>{reais(subtotal)}</b>
          {Number(p.desconto) > 0 && <><span>Desconto</span><b>− {reais(p.desconto)}</b></>}
          <span>Total</span><b style={{ fontSize: 20 }}>{reais(p.total)}</b>
          {(pagamentos ?? []).map((pg) => <Fragment key={pg.id}><span>{FORMAS[pg.forma] ?? pg.forma}</span><b>{reais(pg.valor)}</b></Fragment>)}
          {Number(p.troco) > 0 && <><span>Troco</span><b>{reais(p.troco)}</b></>}
        </div>
      </section>


      <section className="card" id="nota" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>Nota fiscal</h2>
          {conf.cfg?.ambiente === "homologacao" && configurado && <span className="badge badge-warn">Modo teste (sem valor fiscal)</span>}
        </div>
        {!configurado && (
          <p className="muted" style={{ margin: 0 }}>
            {eu.papel === "dono" ? <>Para emitir, configure a nota fiscal em <Link href="/perfil-da-loja#fiscal" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Perfil da loja</Link>.</> : "O dono da loja ainda não configurou a nota fiscal."}
          </p>
        )}
        {notas.map((n) => {
          const st = STATUS_NOTA[n.status] ?? { texto: n.status, classe: "badge-info" };
          return (
            <div key={n.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, background: "var(--bg)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <b>{n.tipo === "nfce" ? "NFC-e" : "NF-e"}{n.numero ? ` nº ${n.numero}` : ""}{n.serie ? ` · série ${n.serie}` : ""}</b>
                <span className={`badge ${st.classe}`}>{st.texto}</span>
                <span className="muted" style={{ fontSize: 12 }}>{dataHora(n.criado_em)}{n.emitida_por ? ` · ${n.emitida_por}` : ""}{n.ambiente === "homologacao" ? " · teste" : ""}</span>
              </div>
              {n.chave && <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>Chave: {n.chave}</div>}
              {n.mensagem && <div className="muted" style={{ fontSize: 13 }}>{n.mensagem}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {n.danfe_url && <a className="btn btn-sm" href={n.danfe_url} target="_blank" rel="noopener">{n.tipo === "nfce" ? "Ver / imprimir cupom" : "Ver DANFE"}</a>}
                {n.xml_url && <a className="btn btn-ghost btn-sm" href={n.xml_url} target="_blank" rel="noopener">Baixar XML</a>}
                {(n.status === "processando_autorizacao" || n.status === "enviando") && (
                  <form action={atualizarNota}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="nota" value={n.id} /><BotaoEnviar className="btn btn-ghost btn-sm" enviando="Consultando…">Atualizar status</BotaoEnviar></form>
                )}
              </div>
              {n.status === "autorizado" && eu.papel === "dono" && (
                <details>
                  <summary className="resumo-abrir" style={{ fontSize: 13 }}>Cancelar esta nota</summary>
                  <form action={cancelarNF} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="nota" value={n.id} />
                    <input className="input" name="motivo" required minLength={15} maxLength={255} placeholder="Motivo (mínimo 15 letras)" aria-label="Motivo do cancelamento" style={{ flex: "1 1 240px", width: "auto" }} />
                    <BotaoEnviar className="btn btn-ghost perigo" enviando="Cancelando…">Cancelar nota</BotaoEnviar>
                  </form>
                  <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>NFC-e pode ser cancelada em até 30 minutos e NF-e em até 24 horas depois de autorizada (varia por estado).</p>
                </details>
              )}
            </div>
          );
        })}
        {configurado && !p.cancelado && !temAutorizada && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <form action={emitirNFCe} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <input type="hidden" name="id" value={p.id} />
              <label className="field" style={{ flex: "1 1 220px" }}>CPF/CNPJ na nota (opcional)
                <input className="input" name="cpf" inputMode="numeric" defaultValue={cli?.documento ?? ""} placeholder="Só números" />
              </label>
              <BotaoEnviar className="btn" enviando="Emitindo…">Emitir NFC-e (cupom)</BotaoEnviar>
            </form>
            <details>
              <summary className="resumo-abrir">Emitir NF-e (venda com entrega / e-commerce)</summary>
              <form action={emitirNFe} className="form-grid" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={p.id} />
                <label className="field">Nome do cliente<input className="input" name="nome" required defaultValue={cli?.nome ?? p.cliente_nome ?? ""} /></label>
                <label className="field">CPF ou CNPJ<input className="input" name="documento" required inputMode="numeric" defaultValue={cli?.documento ?? ""} /></label>
                <label className="field">CEP<input className="input" name="cep" required inputMode="numeric" /></label>
                <label className="field">Rua<input className="input" name="logradouro" required /></label>
                <label className="field">Número<input className="input" name="numero" required /></label>
                <label className="field">Bairro<input className="input" name="bairro" required /></label>
                <label className="field">Cidade<input className="input" name="municipio" required /></label>
                <label className="field">UF<input className="input" name="uf" required maxLength={2} placeholder="RS" style={{ textTransform: "uppercase" }} /></label>
                <label className="field">Telefone<input className="input" name="telefone" defaultValue={cli?.telefone ?? ""} /></label>
                <label className="field">E-mail (recebe a nota)<input className="input" name="email" type="email" defaultValue={cli?.email ?? ""} /></label>
                <label className="check"><input type="checkbox" name="presencial" value="1" /> Cliente comprou na loja</label>
                <BotaoEnviar className="btn" enviando="Emitindo…">Emitir NF-e</BotaoEnviar>
              </form>
              {cli?.endereco && <p className="muted" style={{ fontSize: 12 }}>Endereço no cadastro: {cli.endereco}</p>}
            </details>
          </div>
        )}
      </section>
      <div>
        <a className="btn btn-ghost" href={`/recibo/${p.id}`} target="_blank" rel="noopener">Imprimir recibo</a>
      </div>
    </>
  );
}
