"use client";
import { useTransition } from "react";

// Musiquinha curta de conquista, gerada no próprio navegador (sem arquivo de áudio)
function tocar() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i === notas.length - 1 ? 0.6 : 0.2));
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export default function ConcluirTarefa({ id, acao }: { id: string; acao: (f: FormData) => Promise<void> }) {
  const [enviando, iniciar] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={enviando}
      onClick={() => {
        tocar();
        const f = new FormData();
        f.set("id", id);
        iniciar(() => acao(f));
      }}
    >
      {enviando ? "Concluindo..." : "✓ Concluir"}
    </button>
  );
}
