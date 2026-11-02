import { dataHora } from "@/lib/pedidos";
import AtualizarSozinho from "@/components/AtualizarSozinho";
import ChatEnvio from "@/components/ChatEnvio";

export type Mensagem = { id: string; autor_nome: string; da_equipe: boolean; texto: string; criado_em: string };

// Conversa do suporte: lojista (quem manda) fica à esquerda, suporte Synvora (quem responde) à direita.
export default function Chat({ mensagens, ladoEquipe, acao, lojaId, textoInicial }: {
  mensagens: Mensagem[]; ladoEquipe: boolean; acao: (f: FormData) => Promise<void>; lojaId?: string; textoInicial?: string;
}) {
  return (
    <section className="card chat">
      <AtualizarSozinho />
      <div className="chat-lista" aria-live="polite">
        {mensagens.length === 0 && <p className="muted" style={{ textAlign: "center", margin: "auto" }}>Nenhuma mensagem ainda. Escreva abaixo e a equipe Synvora responde por aqui.</p>}
        {mensagens.map((m) => {
          return (
            <div key={m.id} className={`bolha${m.da_equipe ? " minha" : ""}`}>
              <div className="bolha-autor">{m.autor_nome} · {dataHora(m.criado_em)}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>
            </div>
          );
        })}
        <div id="fim-chat" />
      </div>
      <ChatEnvio acao={acao} lojaId={lojaId} textoInicial={textoInicial} />
    </section>
  );
}
