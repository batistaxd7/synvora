import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="auth">
      <div className="card">
        <h1 style={{ fontSize: 24 }}>Página não encontrada</h1>
        <p className="muted">O endereço digitado não existe no Synvora.</p>
        <Link className="btn" href="/">Ir para o início</Link>
      </div>
    </main>
  );
}
