import { redirect } from "next/navigation";

// Mensagens de erro do banco em português claro
export function traduzir(error: { message?: string; code?: string } | null | undefined): string {
  const m = error?.message ?? "Erro desconhecido";
  const c = error?.code ?? "";
  if (c === "23505" || /duplicate key/i.test(m)) {
    if (/sku/i.test(m)) return "Já existe um produto com esse SKU. Use outro código.";
    if (/usuario/i.test(m)) return "Esse nome de usuário já está em uso.";
    return "Já existe um cadastro igual a esse.";
  }
  if (c === "42P01" || c === "42703" || c === "PGRST202" || c === "PGRST204" || c === "PGRST205" ||
      /does not exist|could not find|schema cache/i.test(m)) {
    return "O banco de dados está desatualizado. No Supabase, rode o arquivo supabase/tudo.sql (veja o aviso no topo do Painel).";
  }
  if (c === "42501" || /permission denied|row-level security/i.test(m)) return "Você não tem permissão para fazer isso.";
  if (c === "23514" || /check constraint/i.test(m)) {
    if (/saldo/i.test(m)) return "O estoque não pode ficar negativo.";
    if (/preco/i.test(m)) return "O preço não pode ser negativo.";
    return "Algum valor informado não é válido.";
  }
  if (c === "22P02" || /invalid input syntax/i.test(m)) return "Algum valor informado não é válido.";
  if (/fetch failed|network/i.test(m)) return "Sem conexão com o banco. Tente de novo em instantes.";
  return m;
}

export function falha(caminho: string, msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg.slice(0, 300))}`);
}

export function sucesso(caminho: string, msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg.slice(0, 200))}`);
}
