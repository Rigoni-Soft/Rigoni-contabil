import { ROTA_POR_SETOR, SETOR_LABEL } from "./setores";

// Logo do escritório (arquivo estático em `public/logos/`, provisório até a logo real): a de quem
// não tem Setor (Admin) e a de todo Setor, enquanto nenhum tiver logo própria. A tabela por Setor
// entra com a primeira logo de Setor (#287), não antes.
export const LOGO_DO_ESCRITORIO = "/logos/escritorio.svg";

export type EscopoDoUsuario = {
  // "Todos os setores" ou o rótulo do Setor (Meu perfil).
  rotulo: string;
  // O mesmo escopo em frase, para o cabeçalho ("acesso a todos os setores", "Setor: RH").
  descricao: string;
  // Home do Papel: o dashboard do Setor ou "/" (busca geral) para o Admin e Setores sem tela.
  home: string;
  logo: string;
};

// Única casa da regra "o Admin não tem Setor": o Setor que a sessão carregar é ignorado para ele.
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
    logo: LOGO_DO_ESCRITORIO,
  };
}
