"use client";
import { useRef, useTransition } from "react";

export default function ChatEnvio({ acao, lojaId, textoInicial }: { acao: (f: FormData) => Promise<void>; lojaId?: string; textoInicial?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [enviando, iniciar] = useTransition();
  function enviar(f: FormData) {
    iniciar(async () => {
      await acao(f);
      ref.current?.reset();
      const t = ref.current?.querySelector("textarea");
      if (t) t.value = "";
    });
  }
  return (
    <form ref={ref} action={enviar} className="chat-envio">
      {lojaId && <input type="hidden" name="loja" value={lojaId} />}
      <textarea
        className="input" name="texto" required rows={2} maxLength={4000} defaultValue={textoInicial}
        placeholder="Escreva sua mensagem" aria-label="Mensagem"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ref.current?.requestSubmit(); } }}
      />
      <button className="btn" type="submit" disabled={enviando}>{enviando ? "..." : "Enviar"}</button>
    </form>
  );
}
