"use client";
import { useRef } from "react";

// Ao cancelar, pergunta na tela se os produtos voltam para o estoque.
export default function CancelarPedido({ id, numero, acao }: { id: string; numero: number; acao: (f: FormData) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => ref.current?.showModal()}>
        Cancelar venda
      </button>
      <dialog ref={ref} className="dialogo" aria-labelledby={`cancelar-${id}`}>
        <form action={acao} onSubmit={() => ref.current?.close()} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="hidden" name="id" value={id} />
          <h2 id={`cancelar-${id}`} style={{ margin: 0, fontSize: 18 }}>Cancelar o pedido #{numero}?</h2>
          <p className="muted" style={{ margin: 0 }}>Os produtos desta venda devem voltar para o estoque?</p>
          <button className="btn" type="submit" name="devolver" value="sim">Sim, devolver ao estoque</button>
          <button className="btn btn-ghost" type="submit" name="devolver" value="nao">Não devolver (produto saiu ou perdeu)</button>
          <button className="btn btn-ghost" type="button" onClick={() => ref.current?.close()} style={{ border: "none" }}>Voltar sem cancelar</button>
        </form>
      </dialog>
    </>
  );
}
