/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite enviar a logo da loja (até 2 MB) pelos formulários
    serverActions: { bodySizeLimit: "3mb" },
    // Guarda as páginas já abertas por 30s: voltar para uma tela é instantâneo.
    // Salvar algo (venda, gasto...) atualiza na hora mesmo assim.
    staleTimes: { dynamic: 30, static: 180 },
  },
  images: { unoptimized: true },
};
export default nextConfig;
