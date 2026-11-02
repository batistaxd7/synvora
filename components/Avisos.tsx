"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Aviso = { id: string; texto: string; link: string | null; lido: boolean; criado_em: string };

// Sininho de avisos no canto superior (estoque baixo, pedido novo, tarefa concluída, resposta do suporte)
export default function Avisos({ avisos, estoqueBaixo, marcarLidos }: { avisos: Aviso[]; estoqueBaixo: number; marcarLidos: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const naoLidos = avisos.filter((a) => !a.lido).length + (estoqueBaixo > 0 ? 1 : 0);

  useEffect(() => {
    function fora(e: MouseEvent) { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && avisos.some((a) => !a.lido)) marcarLidos();
  }

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <button type="button" className="icon-btn" onClick={alternar} aria-label={`Avisos${naoLidos ? `, ${naoLidos} novo(s)` : ""}`} aria-expanded={aberto} title="Avisos">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {naoLidos > 0 && <span className="contador">{naoLidos > 9 ? "9+" : naoLidos}</span>}
      </button>
      {aberto && (
        <div className="popover">
          <b style={{ fontSize: 14 }}>Avisos</b>
          {estoqueBaixo > 0 && (
            <Link href="/estoque" className="aviso-item" onClick={() => setAberto(false)}>
              <span className="badge badge-warn">Estoque</span> {estoqueBaixo} produto(s) com estoque baixo
            </Link>
          )}
          {avisos.length === 0 && estoqueBaixo === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum aviso por enquanto.</p>}
          {avisos.map((a) => (
            <Link key={a.id} href={a.link ?? "#"} className={`aviso-item${a.lido ? "" : " novo"}`} onClick={() => setAberto(false)}>
              <span style={{ flex: 1 }}>{a.texto}</span>
              <small className="muted">{new Date(a.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
