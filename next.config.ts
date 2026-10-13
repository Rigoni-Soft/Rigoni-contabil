import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default de 1MB estoura fácil com o contrato social + alterações contratuais
    // do cadastro de Cliente (#33). 10MB cobre PDFs digitalizados razoáveis. 11mb porque o limite
    // vale para o corpo inteiro: um anexo de 10 MB (#79) mais o multipart não pode ser cortado
    // antes de o caso de uso devolver a mensagem de tamanho.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
