"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { finalizarVenda } from "@/app/(app)/caixa/actions";
import { FORMAS, reais } from "@/lib/pedidos";

type Produto = { id: string; sku: string; nome: string; categoria: string | null; preco: number; saldo: number; foto_url: string | null };
type ItemCarrinho = { produto: Produto; quantidade: number };
type Pagamento = { forma: string; valor: string };

function numero(txt: string) {
  const limpo = txt.replace(/\s|R\$/g, "");
  const v = limpo.includes(",") ? parseFloat(limpo.replace(/\./g, "").replace(",", ".")) : parseFloat(limpo);
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
function campo(v: number) {
  return v.toFixed(2).replace(".", ",");
}

const CANAIS = ["Loja física", "WhatsApp", "Instagram", "Site", "Shopee", "Mercado Livre"];

export default function Caixa({ produtos, clientes = [] }: { produtos: Produto[]; clientes?: string[] }) {
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ forma: "pix", valor: "" }]);
  const [cliente, setCliente] = useState("");
  const [canal, setCanal] = useState(CANAIS[0]);
  const [desconto, setDesconto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ id: string; numero: number; total: number; troco: number } | null>(null);
  const [enviando, iniciar] = useTransition();

  const encontrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = t ? produtos.filter((p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)) : produtos;
    return lista.slice(0, 30);
  }, [busca, produtos]);

  const subtotal = carrinho.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
  const desc = Math.min(numero(desconto), subtotal);
  const total = Math.round((subtotal - desc) * 100) / 100;
  const recebido = pagamentos.reduce((s, p) => s + numero(p.valor), 0);
  const emDinheiro = pagamentos.filter((p) => p.forma === "dinheiro").reduce((s, p) => s + numero(p.valor), 0);
  const falta = Math.max(0, Math.round((total - recebido) * 100) / 100);
  const troco = Math.max(0, Math.round((recebido - total) * 100) / 100);
  const trocoInvalido = troco > 0 && troco > emDinheiro;

  function adicionar(p: Produto) {
    const ja = carrinho.find((i) => i.produto.id === p.id);
    if ((ja?.quantidade ?? 0) + 1 > p.saldo) {
      setErro(`Só há ${p.saldo} un de "${p.nome}" em estoque.`);
      return;
    }
    setErro(null);
    setCarrinho((c) => (c.some((i) => i.produto.id === p.id)
      ? c.map((i) => (i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i))
      : [...c, { produto: p, quantidade: 1 }]));
  }

  function mudarQtd(id: string, q: number) {
    setCarrinho((c) => c.flatMap((i) => {
      if (i.produto.id !== id) return [i];
      if (q <= 0) return [];
      return [{ ...i, quantidade: Math.min(q, i.produto.saldo) }];
    }));
  }

  function preencherRestante(idx: number) {
    setPagamentos((ps) => {
      const outros = ps.reduce((s, p, i) => (i === idx ? s : s + numero(p.valor)), 0);
      const resto = Math.max(0, total - outros);
      return ps.map((p, i) => (i === idx ? { ...p, valor: campo(resto) } : p));
    });
  }

  function finalizar() {
    setErro(null);
    if (carrinho.length === 0) return setErro("Adicione pelo menos um produto.");
    if (falta > 0) return setErro(`Ainda falta receber ${reais(falta)}.`);
    if (trocoInvalido) return setErro("O valor recebido passou do total. Só dá para dar troco quando parte é paga em dinheiro.");
    iniciar(async () => {
      const r = await finalizarVenda({
        itens: carrinho.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: numero(p.valor) })).filter((p) => p.valor > 0),
        cliente, canal, desconto: desc,
      });
      if (!r.ok) return setErro(r.erro);
      setFeito(r);
    });
  }

  function novaVenda() {
    setCarrinho([]); setPagamentos([{ forma: "pix", valor: "" }]); setCliente(""); setDesconto(""); setCanal(CANAIS[0]);
    setErro(null); setFeito(null); setBusca("");
  }

  if (feito) {
    return (
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520, animation: "sv-pop .35s ease both" }}>
        <span className="badge badge-ok" style={{ alignSelf: "flex-start" }}>Venda registrada</span>
        <h2 style={{ margin: 0, fontSize: 22 }}>Pedido #{feito.numero}</h2>
        <div className="row" style={{ padding: "8px 0" }}><span style={{ flex: 1 }}>Total</span><b>{reais(feito.total)}</b></div>
        {feito.troco > 0 && (
          <div className="row" style={{ padding: "8px 0" }}><span style={{ flex: 1 }}>Troco</span><b style={{ fontSize: 24, color: "var(--accent-ink)" }}>{reais(feito.troco)}</b></div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn" href={`/recibo/${feito.id}`} target="_blank" rel="noopener">Imprimir recibo</a>
          <button className="btn btn-ghost" type="button" onClick={novaVenda}>Nova venda</button>
          <Link className="btn btn-ghost" href={`/pedidos/${feito.id}`}>Ver pedido</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="caixa-grid">
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input className="input" placeholder="Buscar produto por nome ou SKU" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus aria-label="Buscar produto" />
        {produtos.length === 0 && <p className="muted">Nenhum produto cadastrado. <Link href="/estoque" style={{ color: "var(--accent-ink)", fontWeight: 600 }}>Cadastre no Estoque</Link>.</p>}
        <div className="prod-grid">
          {encontrados.map((p) => (
            <button key={p.id} type="button" className="prod-tile" onClick={() => adicionar(p)} disabled={p.saldo <= 0}>
              {p.foto_url && <img src={p.foto_url} alt="" className="prod-foto" loading="lazy" />}
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</span>
              <span className="muted" style={{ fontSize: 12 }}>{p.sku}</span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                <b>{reais(p.preco)}</b>
                <span className={`badge ${p.saldo <= 0 ? "badge-danger" : p.saldo <= 5 ? "badge-warn" : "badge-ok"}`}>{p.saldo <= 0 ? "Sem estoque" : `${p.saldo} un`}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Venda atual</h2>
        {carrinho.length === 0 && <p className="muted">Toque nos produtos para adicionar.</p>}
        {carrinho.map((i) => (
          <div key={i.produto.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.produto.nome}</div>
              <div className="muted" style={{ fontSize: 12 }}>{reais(i.produto.preco)} cada</div>
            </div>
            <button type="button" className="icon-btn qtd" onClick={() => mudarQtd(i.produto.id, i.quantidade - 1)} aria-label="Diminuir">−</button>
            <b style={{ minWidth: 24, textAlign: "center" }}>{i.quantidade}</b>
            <button type="button" className="icon-btn qtd" onClick={() => mudarQtd(i.produto.id, i.quantidade + 1)} aria-label="Aumentar" disabled={i.quantidade >= i.produto.saldo}>+</button>
            <b style={{ minWidth: 86, textAlign: "right", fontSize: 14 }}>{reais(i.produto.preco * i.quantidade)}</b>
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field">Cliente (opcional)<input className="input" list="lista-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} /><datalist id="lista-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="field">Canal
            <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
              {CANAIS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">Desconto (R$)<input className="input" inputMode="decimal" placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></label>
          <div className="field">Total<div className="total-box">{reais(total)}</div></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="field">Pagamento</span>
          {pagamentos.map((p, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8 }}>
              <select className="input" style={{ flex: 1.2 }} value={p.forma} aria-label="Forma de pagamento"
                onChange={(e) => setPagamentos((ps) => ps.map((x, i) => (i === idx ? { ...x, forma: e.target.value } : x)))}>
                {Object.entries(FORMAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <input className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="0,00" aria-label="Valor" value={p.valor}
                onChange={(e) => setPagamentos((ps) => ps.map((x, i) => (i === idx ? { ...x, valor: e.target.value } : x)))} />
              <button type="button" className="btn btn-ghost" style={{ padding: "0 12px" }} onClick={() => preencherRestante(idx)} title="Preencher com o que falta">Restante</button>
              {pagamentos.length > 1 && (
                <button type="button" className="icon-btn" aria-label="Remover pagamento" onClick={() => setPagamentos((ps) => ps.filter((_, i) => i !== idx))}>×</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setPagamentos((ps) => [...ps, { forma: "dinheiro", valor: "" }])}>+ Dividir em outra forma</button>
        </div>

        <div className="resumo">
          <span>Recebido</span><b>{reais(recebido)}</b>
          {falta > 0 && <><span>Falta</span><b style={{ color: "var(--warn-ink)" }}>{reais(falta)}</b></>}
          {troco > 0 && <><span>Troco</span><b style={{ color: trocoInvalido ? "var(--danger)" : "var(--ok-ink)", fontSize: 20 }}>{reais(troco)}</b></>}
        </div>

        {erro && <div className="erro">{erro}</div>}
        <button className="btn" type="button" onClick={finalizar} disabled={enviando || carrinho.length === 0} style={{ minHeight: 54, fontSize: 16 }}>
          {enviando ? "Registrando..." : `Finalizar venda · ${reais(total)}`}
        </button>
      </section>
    </div>
  );
}
