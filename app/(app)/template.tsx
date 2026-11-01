// Re-monta a cada troca de página, disparando a animação de entrada.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
