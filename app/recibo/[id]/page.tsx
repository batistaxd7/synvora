import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FORMAS, dataHora, reais } from "@/lib/pedidos";
import Imprimir from "@/components/Imprimir";

export const metadata = { title: "Recibo · Synvora" };

export default async function Recibo({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: p } = await supabase
    .from("pedidos")
    .select("id, numero, cliente_nome, canal, cancelado, total, desconto, troco, criado_em, vendedor_nome, lojas(nome)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();
  const [{ data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from("pedido_itens").select("id, nome, quantidade, preco").eq("pedido_id", p.id),
    supabase.from("pedido_pagamentos").select("id, forma, valor").eq("pedido_id", p.id),
  ]);
  const loja = (p.lojas as unknown as { nome: string } | null)?.nome ?? "Loja";
  const subtotal = (itens ?? []).reduce((t, i) => t + Number(i.preco) * i.quantidade, 0);

  return (
    <main className="recibo">
      <div className="recibo-papel">
        <div style={{ textAlign: "center" }}>
          <b style={{ fontSize: 16 }}>{loja}</b>
          <div>Recibo de venda · Pedido #{p.numero}</div>
          <div>{dataHora(p.criado_em)}</div>
          {p.cancelado && <div style={{ fontWeight: 700, marginTop: 4 }}>*** VENDA CANCELADA ***</div>}
        </div>
        <hr />
        {(itens ?? []).map((i) => (
          <div key={i.id} style={{ marginBottom: 4 }}>
            <div>{i.nome}</div>
            <div className="linha"><span>{i.quantidade} × {reais(i.preco)}</span><span>{reais(Number(i.preco) * i.quantidade)}</span></div>
          </div>
        ))}
        <hr />
        <div className="linha"><span>Subtotal</span><span>{reais(subtotal)}</span></div>
        {Number(p.desconto) > 0 && <div className="linha"><span>Desconto</span><span>− {reais(p.desconto)}</span></div>}
        <div className="linha" style={{ fontWeight: 700, fontSize: 15 }}><span>TOTAL</span><span>{reais(p.total)}</span></div>
        <hr />
        {(pagamentos ?? []).map((pg) => (
          <div className="linha" key={pg.id}><span>{FORMAS[pg.forma] ?? pg.forma}</span><span>{reais(pg.valor)}</span></div>
        ))}
        {Number(p.troco) > 0 && <div className="linha"><span>Troco</span><span>{reais(p.troco)}</span></div>}
        <hr />
        <div>Cliente: {p.cliente_nome || "não informado"}</div>
        <div>Canal: {p.canal}</div>
        {p.vendedor_nome && <div>Atendido por: {p.vendedor_nome}</div>}
        <p style={{ textAlign: "center", marginTop: 12 }}>Obrigado pela preferência!<br /><small>Documento sem valor fiscal</small></p>
      </div>
      <Imprimir />
    </main>
  );
}
