"use client";

// Botão que pergunta antes de apagar algo
export default function BotaoConfirmar({ pergunta, children, className = "btn btn-ghost btn-sm" }: { pergunta: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(pergunta)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
