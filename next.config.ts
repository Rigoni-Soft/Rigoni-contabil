import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default de 1MB estoura fácil com o contrato social + alterações contratuais
    // do cadastro de Cliente (#33). 10MB cobre PDFs digitalizados razoáveis.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
