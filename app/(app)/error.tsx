"use client";
import { useEffect } from "react";

// Se algo der errado numa tela, mostra isto em vez de uma página branca
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
      <h1 style={{ fontSize: 22 }}>Algo deu errado nesta tela</h1>
      <p className="muted" style={{ margin: 0 }}>
        Tente de novo. Se continuar, confira se o banco está atualizado (aviso no Painel) ou fale com o Suporte.
      </p>
      {error.digest && <small className="muted">Código do erro: {error.digest}</small>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => reset()}>Tentar de novo</button>
        <a className="btn btn-ghost" href="/caixa">Ir para o caixa</a>
      </div>
    </div>
  );
}
