import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
      <h1 style={{ fontSize: 22 }}>Não encontrado</h1>
      <p className="muted" style={{ margin: 0 }}>Este item não existe ou é de outra loja.</p>
      <Link className="btn" href="/pedidos" style={{ alignSelf: "flex-start" }}>Voltar para os pedidos</Link>
    </div>
  );
}
