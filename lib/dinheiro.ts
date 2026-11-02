// Lê valores em reais digitados de qualquer jeito: "50", "50,90", "50.90", "1.234,56", "1.234", "R$ 10"
export function lerValor(txt: unknown): number {
  let s = String(txt ?? "").replace(/\s|R\$/gi, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  const v = parseFloat(s);
  return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

export function campoValor(v: number) {
  return v.toFixed(2).replace(".", ",");
}
