// Mostra o resultado da última ação (salvo / erro) vindo do endereço da página
export default function Mensagens({ erro, ok }: { erro?: string; ok?: string }) {
  if (!erro && !ok) return null;
  return (
    <div role={erro ? "alert" : "status"} className={`erro${erro ? "" : " aviso-ok"}`}>
      {erro ?? ok}
    </div>
  );
}
