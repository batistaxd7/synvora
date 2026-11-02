import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS, FORMAS, dataHora, reais, selo } from "@/lib/pedidos";
import CancelarPedido from "@/components/CancelarPedido";
import { traduzir } from "@/lib/acoes";

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

export default async function Pedido({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("pedidos")
    .select("id, numero, cliente_nome, canal, etapa, cancelado, devolvido_ao_estoque, cancelado_em, cancelado_por, total, desconto, troco, criado_em, vendedor_nome")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from("pedido_itens").select("id, nome, quantidade, preco").eq("pedido_id", p.id),
    supabase.from("pedido_pagamentos").select("id, forma, valor").eq("pedido_id", p.id),
  ]);
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

      <div>
        <a className="btn btn-ghost" href={`/recibo/${p.id}`} target="_blank" rel="noopener">Imprimir recibo</a>
      </div>
    </>
  );
}
