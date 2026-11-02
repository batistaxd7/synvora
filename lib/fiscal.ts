// Emissão de NFC-e e NF-e pela Focus NFe. SÓ roda no servidor.
import { createAdmin, SEM_CHAVE_ADMIN } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FiscalConfig = {
  loja_id: string; ambiente: "homologacao" | "producao"; token: string | null; cnpj: string | null; uf: string | null;
  ncm_padrao: string | null; cfop_padrao: string; icms_padrao: string; origem_padrao: string; pis_cofins_padrao: string;
};

export type Destinatario = {
  nome?: string | null; documento?: string | null; logradouro?: string | null; numero?: string | null; bairro?: string | null;
  municipio?: string | null; uf?: string | null; cep?: string | null; telefone?: string | null; email?: string | null;
};

export const STATUS_NOTA: Record<string, { texto: string; classe: string }> = {
  enviando: { texto: "Enviando", classe: "badge-info" },
  processando_autorizacao: { texto: "Processando na Sefaz", classe: "badge-info" },
  autorizado: { texto: "Autorizada", classe: "badge-ok" },
  cancelado: { texto: "Cancelada", classe: "badge-danger" },
  erro_autorizacao: { texto: "Recusada", classe: "badge-danger" },
  denegado: { texto: "Denegada", classe: "badge-danger" },
  erro: { texto: "Erro", classe: "badge-danger" },
};

const so = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const base = (amb: string) => (amb === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br");

export async function lerConfig(lojaId: string): Promise<{ cfg: FiscalConfig | null; erro?: string }> {
  const admin = createAdmin();
  if (!admin) return { cfg: null, erro: SEM_CHAVE_ADMIN };
  const { data, error } = await admin.from("fiscal_config").select("*").eq("loja_id", lojaId).maybeSingle();
  if (error) return { cfg: null, erro: /does not exist|schema cache/i.test(error.message) ? "Rode o tudo.sql no Supabase para liberar a nota fiscal." : error.message };
  return { cfg: (data as FiscalConfig) ?? null };
}

async function focus(cfg: FiscalConfig, metodo: string, caminho: string, corpo?: unknown) {
  const auth = Buffer.from(`${cfg.token}:`).toString("base64");
  try {
    const r = await fetch(base(cfg.ambiente) + caminho, {
      method: metodo,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
    });
    let json: any = null;
    try { json = await r.json(); } catch { json = null; }
    return { ok: r.ok, status: r.status, json };
  } catch {
    return { ok: false, status: 0, json: { mensagem: "Não foi possível falar com a Focus NFe agora. Tente de novo em instantes." } };
  }
}

function mensagemErro(j: any): string {
  if (!j) return "A Focus NFe não respondeu.";
  const partes: string[] = [];
  if (j.mensagem_sefaz) partes.push(String(j.mensagem_sefaz));
  if (j.mensagem) partes.push(String(j.mensagem));
  if (Array.isArray(j.erros)) for (const e of j.erros) partes.push([e.campo, e.mensagem].filter(Boolean).join(": "));
  return partes.filter(Boolean).join(" · ").slice(0, 600) || "Erro na emissão.";
}

function urls(cfg: FiscalConfig, j: any) {
  const b = base(cfg.ambiente);
  const abs = (c?: string) => (c ? (c.startsWith("http") ? c : b + c) : null);
  return { danfe_url: abs(j?.caminho_danfe), xml_url: abs(j?.caminho_xml_nota_fiscal) };
}

const FORMA_SEFAZ: Record<string, string> = { dinheiro: "01", credito: "03", debito: "04", pix: "17", outro: "99" };

// Monta e envia a nota de um pedido
export async function emitirNota(opts: { tipo: "nfce" | "nfe"; pedidoId: string; lojaId: string; quem: string; dest?: Destinatario; cpfNaNota?: string | null; presencial?: boolean }) {
  const { cfg, erro } = await lerConfig(opts.lojaId);
  if (erro) return { erro };
  if (!cfg?.token || !cfg.cnpj) return { erro: "Configure a nota fiscal em Perfil da loja (token da Focus NFe e CNPJ)." };

  const supabase = createClient();
  const { data: p } = await supabase.from("pedidos").select("id, numero, total, desconto, troco, cancelado, loja_id").eq("id", opts.pedidoId).maybeSingle();
  if (!p || p.loja_id !== opts.lojaId) return { erro: "Pedido não encontrado." };
  if (p.cancelado) return { erro: "Pedido cancelado não pode ter nota." };

  const [{ data: itens }, { data: pags }] = await Promise.all([
    supabase.from("pedido_itens").select("produto_id, nome, quantidade, preco").eq("pedido_id", p.id),
    supabase.from("pedido_pagamentos").select("forma, valor").eq("pedido_id", p.id),
  ]);
  if (!itens?.length) return { erro: "O pedido não tem itens." };
  const ids = itens.map((i) => i.produto_id).filter(Boolean) as string[];
  const { data: prods } = ids.length
    ? await supabase.from("produtos").select("*").in("id", ids)
    : { data: [] as any[] };
  const porId = new Map<string, any>((prods ?? []).map((x: any) => [x.id, x] as [string, any]));

  const ufDest = (opts.dest?.uf ?? "").toUpperCase().trim();
  const interestadual = opts.tipo === "nfe" && !!ufDest && !!cfg.uf && ufDest !== cfg.uf.toUpperCase();

  // desconto do pedido dividido entre os itens
  const brutos = itens.map((i) => Math.round(Number(i.preco) * i.quantidade * 100) / 100);
  const somaBruta = brutos.reduce((a, b) => a + b, 0);
  const desc = Math.min(Number(p.desconto ?? 0), somaBruta);
  let resto = Math.round(desc * 100);
  const descontos = brutos.map((b, k) => {
    if (k === brutos.length - 1) return resto / 100;
    const d = Math.round((somaBruta ? (b / somaBruta) * desc : 0) * 100);
    resto -= d; return d / 100;
  });

  const faltaNcm: string[] = [];
  const items = itens.map((i, k) => {
    const pr: any = (i.produto_id && porId.get(i.produto_id)) || {};
    const ncm = so(pr.ncm || cfg.ncm_padrao);
    if (ncm.length !== 8) faltaNcm.push(i.nome);
    let cfop = so(pr.cfop || cfg.cfop_padrao) || "5102";
    if (interestadual && cfop.startsWith("5")) cfop = "6" + cfop.slice(1);
    const un = (pr.unidade || "UN").toUpperCase().slice(0, 6);
    const item: Record<string, unknown> = {
      numero_item: k + 1,
      codigo_produto: pr.sku || String(k + 1),
      descricao: i.nome.slice(0, 120),
      codigo_ncm: ncm,
      cfop,
      unidade_comercial: un,
      unidade_tributavel: un,
      quantidade_comercial: i.quantidade,
      quantidade_tributavel: i.quantidade,
      valor_unitario_comercial: Number(Number(i.preco).toFixed(2)),
      valor_unitario_tributavel: Number(Number(i.preco).toFixed(2)),
      valor_bruto: brutos[k],
      icms_origem: pr.origem || cfg.origem_padrao || "0",
      icms_situacao_tributaria: pr.icms_situacao || cfg.icms_padrao || "102",
      pis_situacao_tributaria: cfg.pis_cofins_padrao || "49",
      cofins_situacao_tributaria: cfg.pis_cofins_padrao || "49",
    };
    if (descontos[k] > 0) item.valor_desconto = descontos[k];
    if (opts.tipo === "nfe") item.inclui_no_total = 1;
    return item;
  });
  if (faltaNcm.length) return { erro: `Falta o NCM (8 números) em: ${faltaNcm.join(", ")}. Coloque no Estoque ou um NCM padrão em Perfil da loja.` };

  const total = Number(p.total);
  let formas = (pags ?? []).map((g) => {
    const f: Record<string, unknown> = { forma_pagamento: FORMA_SEFAZ[g.forma] ?? "99", valor_pagamento: Number(Number(g.valor).toFixed(2)) };
    if (g.forma === "credito" || g.forma === "debito") f.tipo_integracao = 2;
    return f;
  });
  if (!formas.length) formas = [{ forma_pagamento: "99", valor_pagamento: total }];
  const troco = Number(p.troco ?? 0);
  if (troco > 0) (formas.find((f) => f.forma_pagamento === "01") ?? formas[0]).troco = troco;

  const agora = new Date().toISOString();
  const corpo: Record<string, unknown> = {
    cnpj_emitente: so(cfg.cnpj),
    data_emissao: agora,
    modalidade_frete: 9,
    local_destino: interestadual ? 2 : 1,
    items,
    formas_pagamento: formas,
  };

  if (opts.tipo === "nfce") {
    corpo.presenca_comprador = 1;
    corpo.natureza_operacao = "VENDA AO CONSUMIDOR";
    const doc = so(opts.cpfNaNota);
    if (doc.length === 11) corpo.cpf_destinatario = doc;
    else if (doc.length === 14) corpo.cnpj_destinatario = doc;
    else if (doc) return { erro: "CPF/CNPJ na nota inválido." };
  } else {
    const d = opts.dest ?? {};
    const doc = so(d.documento);
    const falta = [!d.nome && "nome", ![11, 14].includes(doc.length) && "CPF ou CNPJ", !d.logradouro && "rua", !d.numero && "número",
      !d.bairro && "bairro", !d.municipio && "cidade", ufDest.length !== 2 && "UF", so(d.cep).length !== 8 && "CEP"].filter(Boolean);
    if (falta.length) return { erro: `Para a NF-e, preencha: ${falta.join(", ")}.` };
    Object.assign(corpo, {
      natureza_operacao: "Venda de mercadoria",
      data_entrada_saida: agora,
      tipo_documento: 1,
      finalidade_emissao: 1,
      consumidor_final: 1,
      presenca_comprador: opts.presencial ? 1 : 2,
      nome_destinatario: String(d.nome).slice(0, 60),
      [doc.length === 11 ? "cpf_destinatario" : "cnpj_destinatario"]: doc,
      indicador_inscricao_estadual_destinatario: 9,
      logradouro_destinatario: d.logradouro,
      numero_destinatario: d.numero,
      bairro_destinatario: d.bairro,
      municipio_destinatario: d.municipio,
      uf_destinatario: ufDest,
      cep_destinatario: so(d.cep),
      pais_destinatario: "Brasil",
    });
    if (so(d.telefone)) corpo.telefone_destinatario = so(d.telefone);
    if (d.email) corpo.email_destinatario = d.email;
  }

  const admin = createAdmin()!;
  const { count } = await admin.from("notas_fiscais").select("id", { count: "exact", head: true }).eq("pedido_id", p.id).eq("tipo", opts.tipo);
  const ref = `syn${p.id.replace(/-/g, "").slice(0, 16)}${opts.tipo}${(count ?? 0) + 1}`;
  const { data: nota, error: e1 } = await admin.from("notas_fiscais")
    .insert({ loja_id: opts.lojaId, pedido_id: p.id, tipo: opts.tipo, ref, ambiente: cfg.ambiente, status: "enviando", emitida_por: opts.quem })
    .select("id").single();
  if (e1 || !nota) return { erro: "Não consegui registrar a nota. Rode o tudo.sql no Supabase." };

  const r = await focus(cfg, "POST", `/v2/${opts.tipo}?ref=${encodeURIComponent(ref)}`, corpo);
  const j = r.json ?? {};
  const status = r.ok ? String(j.status ?? (opts.tipo === "nfe" ? "processando_autorizacao" : "erro")) : "erro";
  await admin.from("notas_fiscais").update({
    status, numero: j.numero ?? null, serie: j.serie ?? null, chave: j.chave_nfe ?? null, ...urls(cfg, j),
    mensagem: status === "autorizado" ? null : mensagemErro(j), atualizado_em: new Date().toISOString(),
  }).eq("id", nota.id);
  if (status === "erro" || status === "erro_autorizacao" || status === "denegado") return { erro: `Nota não autorizada: ${mensagemErro(j)}` };
  return { ok: true };
}

async function notaDaLoja(notaId: string, lojaId: string) {
  const admin = createAdmin();
  if (!admin) return { erro: SEM_CHAVE_ADMIN };
  const { data } = await admin.from("notas_fiscais").select("*").eq("id", notaId).eq("loja_id", lojaId).maybeSingle();
  if (!data) return { erro: "Nota não encontrada." };
  const { cfg, erro } = await lerConfig(lojaId);
  if (erro || !cfg?.token) return { erro: erro ?? "Configure a nota fiscal em Perfil da loja." };
  if (cfg.ambiente !== data.ambiente) return { erro: "Esta nota foi emitida em outro ambiente (teste/produção). Troque o ambiente para consultá-la." };
  return { admin, nota: data, cfg };
}

export async function consultarNota(notaId: string, lojaId: string) {
  const x = await notaDaLoja(notaId, lojaId);
  if ("erro" in x && x.erro) return { erro: x.erro };
  const { admin, nota, cfg } = x as any;
  const r = await focus(cfg, "GET", `/v2/${nota.tipo}/${encodeURIComponent(nota.ref)}`);
  const j = r.json ?? {};
  if (!r.ok) return { erro: mensagemErro(j) };
  await admin.from("notas_fiscais").update({
    status: j.status ?? nota.status, numero: j.numero ?? nota.numero, serie: j.serie ?? nota.serie, chave: j.chave_nfe ?? nota.chave,
    ...urls(cfg, j), mensagem: j.status === "autorizado" ? null : mensagemErro(j), atualizado_em: new Date().toISOString(),
  }).eq("id", nota.id);
  return { ok: true };
}

export async function cancelarNota(notaId: string, lojaId: string, justificativa: string) {
  const just = justificativa.trim();
  if (just.length < 15 || just.length > 255) return { erro: "O motivo do cancelamento precisa ter entre 15 e 255 letras." };
  const x = await notaDaLoja(notaId, lojaId);
  if ("erro" in x && x.erro) return { erro: x.erro };
  const { admin, nota, cfg } = x as any;
  const r = await focus(cfg, "DELETE", `/v2/${nota.tipo}/${encodeURIComponent(nota.ref)}`, { justificativa: just });
  const j = r.json ?? {};
  if (!r.ok || (j.status && j.status !== "cancelado")) return { erro: mensagemErro(j) };
  await admin.from("notas_fiscais").update({ status: "cancelado", mensagem: `Cancelada: ${just}`, atualizado_em: new Date().toISOString() }).eq("id", nota.id);
  return { ok: true };
}

export async function salvarConfigFiscal(lojaId: string, dados: Partial<FiscalConfig> & { token?: string | null }) {
  const admin = createAdmin();
  if (!admin) return { erro: SEM_CHAVE_ADMIN };
  const linha: Record<string, unknown> = { loja_id: lojaId, atualizado_em: new Date().toISOString() };
  for (const [k, v] of Object.entries(dados)) if (v !== undefined) linha[k] = v;
  const { error } = await admin.from("fiscal_config").upsert(linha, { onConflict: "loja_id" });
  if (error) return { erro: /does not exist|schema cache/i.test(error.message) ? "Rode o tudo.sql no Supabase para liberar a nota fiscal." : error.message };
  return { ok: true };
}
