"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { label: string; href: string; icon: string; donoSo?: boolean; atendenteSo?: boolean };

const ITENS: Item[] = [
  { label: "Painel", href: "/painel", icon: "M3 11l9-8 9 8M5 10v10h14V10", donoSo: true },
  { label: "Frente de caixa", href: "/caixa", icon: "M9 20h.01M18 20h.01M2 3h3l2.5 12h11L21 7H6" },
  { label: "Pedidos", href: "/pedidos", icon: "M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h4" },
  { label: "Clientes", href: "/clientes", icon: "M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 17c.5-2 2-3 3-3s2.5 1 3 3M14 9h5M14 13h5" },
  { label: "Estoque", href: "/estoque", icon: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", donoSo: true },
  { label: "Gastos", href: "/gastos", icon: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3", donoSo: true },
  { label: "Financeiro", href: "/financeiro", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2", donoSo: true },
  { label: "Tarefas", href: "/tarefas", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { label: "Equipe", href: "/equipe", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", donoSo: true },
  { label: "Perfil da loja", href: "/perfil-da-loja", icon: "M3 9l1-5h16l1 5M3 9v11h18V9M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3", donoSo: true },
  { label: "Conta e plano", href: "/conta-e-plano", icon: "M2 6h20v12H2zM2 10h20", donoSo: true },
  { label: "Suporte", href: "/suporte", icon: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" },
  { label: "Atendimento", href: "/atendimento", icon: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z", atendenteSo: true },
];

const PAPEL: Record<string, string> = { dono: "Dono", vendedor: "Vendedor / Afiliado", caixa: "Caixa" };

export default function Sidebar({ loja, logo, papel, nome, atendente }: { loja: string; logo: string | null; papel: string; nome: string; atendente: boolean }) {
  const caminho = usePathname();
  const [aberta, setAberta] = useState(true);
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    try {
      const n = window.localStorage.getItem("synvora-nav");
      if (n === "open" || n === "closed") setAberta(n === "open");
    } catch {}
  }, []);

  function alternar() {
    const nova = !aberta;
    setAberta(nova);
    setGiro((g) => g + 180);
    try { window.localStorage.setItem("synvora-nav", nova ? "open" : "closed"); } catch {}
  }

  const itens = ITENS.filter((i) => (!i.donoSo || papel === "dono") && (!i.atendenteSo || atendente));

  return (
    <aside className="side" style={{ width: aberta ? 232 : 76 }}>
      <div className="side-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" role="img" aria-label="Synvora" style={{ flex: "none" }}>
            <rect width="34" height="34" rx="9" fill="#6E5F8C" />
            <path d="M21.5 11c-1.1-1.5-2.8-2.3-4.8-2.3-3 0-5.2 1.6-5.2 3.9 0 4.8 11.5 2.2 11.5 8 0 2.5-2.3 4.4-5.5 4.4-2.4 0-4.4-1-5.6-2.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="25.5" cy="9" r="2.4" fill="#D9CFF0" />
          </svg>
          {aberta && <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.03em" }}>Synvora</span>}
        </div>
        <button type="button" className="icon-btn" onClick={alternar} aria-label={aberta ? "Recolher menu" : "Abrir menu"} aria-expanded={aberta}>
          <span style={{ display: "inline-flex", transition: "transform .45s cubic-bezier(.2,.7,.2,1)", transform: `rotate(${giro}deg)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5h.01M12 12h.01M12 19h.01" /></svg>
          </span>
        </button>
      </div>

      <nav aria-label="Principal">
        {itens.map((i, idx) => {
          const ativo = caminho === i.href || caminho.startsWith(i.href + "/");
          return (
            <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} aria-current={ativo ? "page" : undefined}
              className={`nav-item${ativo ? " ativo" : ""}`} style={{ animationDelay: `${idx * 28}ms` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}><path d={i.icon} /></svg>
              {aberta && <span style={{ flex: 1 }}>{i.label}</span>}
            </Link>
          );
        })}
      </nav>

      {aberta && (
        <div className="side-foot" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {logo && <img src={logo} alt="" width={36} height={36} style={{ borderRadius: 10, objectFit: "cover", flex: "none" }} />}
          <div>
          Loja: {loja}<br />
          Acesso: {PAPEL[papel] ?? papel}<br />
          <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{nome}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
