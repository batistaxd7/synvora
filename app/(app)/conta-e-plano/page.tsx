import Link from "next/link";
import { exigirDono } from "@/lib/perfil";

const PLANOS = [
  {
    id: "mensal", nome: "Mensal", preco: "R$ 119,90", periodo: "/mês",
    destaque: "Primeiro mês por R$ 59,90",
    itens: ["Todas as telas do Synvora", "Usuários da equipe ilimitados", "Suporte 24 horas pelo chat", "Cancele quando quiser"],
  },
  {
    id: "anual", nome: "Anual", preco: "R$ 1.199,00", periodo: "/ano",
    destaque: "Sai por R$ 99,92 por mês · economia de 2 meses",
    itens: ["Tudo do plano mensal", "Preço travado por 12 meses", "Prioridade no suporte"],
    recomendado: true,
  },
  {
    id: "vitalicio", nome: "Vitalício", preco: "R$ 3.500,00", periodo: "pagamento único",
    destaque: "Só para as 10 primeiras lojas · oferta aberta em dezembro",
    itens: ["Acesso ao sistema para sempre, sem mensalidade", "Cobre o sistema atual e suas atualizações", "Não inclui estruturas ou extras futuros vendidos à parte"],
  },
];

export default async function ContaEPlano() {
  await exigirDono();
  const dezembro = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(5, 7) === "12";

  return (
    <>
      <div>
        <h1>Conta e plano</h1>
        <p className="muted">Escolha como quer pagar o Synvora. A contratação é feita com o nosso time pelo Suporte.</p>
      </div>

      <section className="card" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <span className="muted">Seu plano atual</span>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Período de teste</div>
        </div>
        <span className="badge badge-ok">Ativo</span>
      </section>

      <section className="planos">
        {PLANOS.map((p) => {
          const fechado = p.id === "vitalicio" && !dezembro;
          return (
            <div key={p.id} className={`card plano${p.recomendado ? " recomendado" : ""}`}>
              {p.recomendado && <span className="badge badge-info" style={{ alignSelf: "flex-start" }}>Mais escolhido</span>}
              <h2 style={{ margin: 0, fontSize: 18 }}>{p.nome}</h2>
              <div><b style={{ fontSize: 30, letterSpacing: "-0.03em" }}>{p.preco}</b> <span className="muted">{p.periodo}</span></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>{p.destaque}</div>
              <ul>{p.itens.map((i) => <li key={i}>{i}</li>)}</ul>
              {fechado ? (
                <button className="btn btn-ghost" type="button" disabled>Abre em dezembro</button>
              ) : (
                <Link className={`btn${p.recomendado ? "" : " btn-ghost"}`} href={`/suporte?plano=${p.id}`}>Quero o plano {p.nome.toLowerCase()}</Link>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
