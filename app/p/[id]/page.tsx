import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublico } from "@/lib/supabase/publico";
import { reais } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type Produto = {
  id: string; nome: string; categoria: string | null; preco: number; saldo: number; foto_url: string | null;
  loja_nome: string; loja_logo: string | null; telefone: string | null; instagram: string | null; endereco: string | null;
};

async function buscar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createPublico().rpc("produto_publico", { pid: id });
  return ((data ?? []) as Produto[])[0] ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await buscar(params.id);
  if (!p) return { title: "Produto não encontrado" };
  return {
    title: `${p.nome} · ${p.loja_nome}`,
    description: `${p.nome} por ${reais(p.preco)} na ${p.loja_nome}`,
    openGraph: { title: p.nome, description: `${reais(p.preco)} · ${p.loja_nome}`, images: p.foto_url ? [p.foto_url] : [] },
  };
}

function whatsapp(tel: string | null, texto: string) {
  let d = (tel ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

// Página pública do produto: é para cá que o Facebook e o Instagram levam o cliente
export default async function ProdutoPublico({ params }: { params: { id: string } }) {
  const p = await buscar(params.id);
  if (!p) notFound();
  const zap = whatsapp(p.telefone, `Olá! Tenho interesse no produto: ${p.nome} (${reais(p.preco)})`);
  const insta = p.instagram ? `https://instagram.com/${p.instagram.replace(/^@/, "").trim()}` : null;
  const disponivel = p.saldo > 0;

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "32px 16px" }}>
      <article className="card" style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 18, padding: 24, alignSelf: "flex-start", animation: "sv-sobe .5s cubic-bezier(.2,.7,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="logo-loja" style={{ width: 44, height: 44, fontSize: 18, borderRadius: 12 }}>
            {p.loja_logo ? <img src={p.loja_logo} alt="" /> : p.loja_nome.slice(0, 1).toUpperCase()}
          </div>
          <b style={{ fontSize: 17 }}>{p.loja_nome}</b>
        </div>
        {p.foto_url && <img src={p.foto_url} alt={p.nome} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 16, background: "var(--chip)" }} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {p.categoria && <span className="muted">{p.categoria}</span>}
          <h1 style={{ fontSize: 26 }}>{p.nome}</h1>
          <b style={{ fontSize: 30, fontFamily: "Sora, sans-serif", letterSpacing: "-0.03em" }}>{reais(p.preco)}</b>
          <span className={`badge ${disponivel ? "badge-ok" : "badge-warn"}`} style={{ alignSelf: "flex-start" }}>{disponivel ? "Disponível" : "Esgotado no momento"}</span>
        </div>
        {zap && <a className="btn" href={zap} target="_blank" rel="noopener">Comprar pelo WhatsApp</a>}
        {insta && <a className="btn btn-ghost" href={insta} target="_blank" rel="noopener">Ver no Instagram</a>}
        {!zap && !insta && <p className="muted">Fale com a loja para comprar este produto.</p>}
        {p.endereco && <p className="muted" style={{ margin: 0 }}>Retirada: {p.endereco}</p>}
      </article>
    </main>
  );
}
