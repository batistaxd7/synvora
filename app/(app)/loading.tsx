// Aparece na hora em que você clica no menu, enquanto a página carrega
export default function Carregando() {
  return (
    <div className="carregando" aria-busy="true" aria-label="Carregando">
      <div className="esq" style={{ width: 220, height: 30 }} />
      <div className="esq" style={{ width: 320, height: 14 }} />
      <div className="stats">
        <div className="esq" style={{ height: 96 }} />
        <div className="esq" style={{ height: 96 }} />
        <div className="esq" style={{ height: 96 }} />
      </div>
      <div className="esq" style={{ height: 260 }} />
    </div>
  );
}
