export default function EmBreve({ params }: { params: { pagina: string } }) {
  const nome = decodeURIComponent(params.pagina).replace(/-/g, " ");
  return (
    <>
      <h1 style={{ textTransform: "capitalize" }}>{nome}</h1>
      <div className="card"><p className="muted">Esta área está sendo construída e será liberada nas próximas etapas.</p></div>
    </>
  );
}
