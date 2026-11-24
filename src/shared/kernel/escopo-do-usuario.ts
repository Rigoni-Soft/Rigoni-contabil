import { ROTA_POR_SETOR, SETOR_LABEL } from "./setores";

export const LOGO_DO_ESCRITORIO = "/logos/logo-rigoni.jpeg";

export const LOGO_POR_SETOR: Record<string, string> = {
  simples_nacional: "/logos/logo-simples-nacional.jpeg",
  contabil: "/logos/logo-contabil.jpeg",
};

export type EscopoDoUsuario = {
  rotulo: string;
  descricao: string;
  home: string;
  logo: string;
};

export function escopoDoUsuario({
  papel,
  setor,
}: {
  papel: string;
  setor: string;
}): EscopoDoUsuario {
  if (papel === "admin") {
    return {
      rotulo: "Todos os setores",
      descricao: "acesso a todos os setores",
      home: "/",
      logo: LOGO_DO_ESCRITORIO,
    };
  }
  const rotulo = SETOR_LABEL[setor] ?? setor;
  return {
    rotulo,
    descricao: `Setor: ${rotulo}`,
    home: ROTA_POR_SETOR[setor] ?? "/",
    logo: Object.hasOwn(LOGO_POR_SETOR, setor) ? LOGO_POR_SETOR[setor] : LOGO_DO_ESCRITORIO,
  };
}
