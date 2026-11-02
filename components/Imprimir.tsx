"use client";
import { useEffect } from "react";

export default function Imprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="nao-imprimir" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
      <button className="btn" type="button" onClick={() => window.print()}>Imprimir</button>
      <button className="btn btn-ghost" type="button" onClick={() => window.close()}>Fechar</button>
    </div>
  );
}
