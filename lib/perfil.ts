import { redirect } from "next/navigation";
import { perfilAtual } from "@/lib/sessao";
import { lerValor } from "@/lib/dinheiro";

export type Perfil = { id: string; loja_id: string; nome: string; usuario: string; papel: string; email_recuperacao: string | null };

export async function meuPerfil(): Promise<Perfil> {
  const data = await perfilAtual();
  if (!data) redirect("/login");
  return data;
}

// Telas só do dono (gastos, financeiro, planos...). Funcionário volta para o caixa.
export async function exigirDono(): Promise<Perfil> {
  const p = await meuPerfil();
  if (p.papel !== "dono") redirect("/caixa");
  return p;
}

export function valor(txt: FormDataEntryValue | null) {
  return lerValor(txt);
}

export function texto(f: FormData, nome: string) {
  const v = String(f.get(nome) ?? "").trim();
  return v || null;
}
