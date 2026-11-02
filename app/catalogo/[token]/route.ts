import { createPublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

type Item = { id: string; nome: string; categoria: string | null; preco: number; saldo: number; foto_url: string | null; loja_nome: string };

function csv(v: string) {
  return `"${v.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

// Feed de produtos no formato do Gerenciador de Comércio da Meta (Facebook e Instagram)
export async function GET(request: Request, { params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) return new Response("Link inválido", { status: 404 });
  const { data, error } = await createPublico().rpc("catalogo_publico", { token: params.token });
  if (error) return new Response("Catálogo indisponível", { status: 503 });
  const itens = ((data ?? []) as Item[]).filter((p) => p.foto_url && Number(p.preco) > 0);
  if (!itens.length && !(data ?? []).length) return new Response("Catálogo não encontrado", { status: 404 });

  const origem = new URL(request.url).origin;
  const linhas = [["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"].join(",")];
  for (const p of itens) {
    const descricao = [p.nome, p.categoria, `Vendido por ${p.loja_nome}`].filter(Boolean).join(" · ");
    linhas.push([
      csv(p.id), csv(p.nome.slice(0, 150)), csv(descricao.slice(0, 5000)),
      csv(p.saldo > 0 ? "in stock" : "out of stock"), csv("new"),
      csv(`${Number(p.preco).toFixed(2)} BRL`), csv(`${origem}/p/${p.id}`), csv(p.foto_url!), csv(p.loja_nome),
    ].join(","));
  }
  return new Response(linhas.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
