"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recarrega os dados da tela de tempos em tempos (para o chat chegar sozinho)
export default function AtualizarSozinho({ segundos = 8 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  useEffect(() => {
    const lista = document.getElementById("fim-chat")?.parentElement;
    if (lista) lista.scrollTop = lista.scrollHeight;
  });
  return null;
}
