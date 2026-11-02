export const ETAPAS = ["Novo", "Separando", "Pronto pra enviar", "Enviado", "Entregue"];

export const FORMAS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  outro: "Outro",
};

export function reais(v: number | string | null | undefined) {
  return "R$ " + Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dataHora(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Selo de status mostrado ao lado de cada venda
export function selo(p: { cancelado: boolean; etapa: number }) {
  if (p.cancelado) return { texto: "Cancelada", classe: "badge-danger" };
  if (p.etapa >= 4) return { texto: "Concluída", classe: "badge-ok" };
  if (p.etapa >= 1) return { texto: "Atendido", classe: "badge-info" };
  return { texto: "Não atendido", classe: "badge-warn" };
}
