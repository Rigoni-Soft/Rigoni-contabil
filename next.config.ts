import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Binário do ffmpeg que converte o áudio gravado (docs/adr/0006): fica fora do bundle e entra no
  // trace só da rota que o executa (a página da conversa, onde mora a action de envio).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/atendimento/\\[id\\]": ["./node_modules/ffmpeg-static/ffmpeg*"],
  },
  experimental: {
    // Default de 1MB estoura fácil com o contrato social + alterações contratuais
    // do cadastro de Cliente (#33). 10MB cobre PDFs digitalizados razoáveis. 11mb porque o limite
    // vale para o corpo inteiro: um anexo de 10 MB (#79) mais o multipart não pode ser cortado
    // antes de o caso de uso devolver a mensagem de tamanho.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
