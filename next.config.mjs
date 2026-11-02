/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite enviar a logo da loja (até 2 MB) pelos formulários
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  images: { unoptimized: true },
};
export default nextConfig;
