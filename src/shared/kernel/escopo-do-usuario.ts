import { ROTA_POR_SETOR, SETOR_LABEL } from "./setores";

// Logos em arquivos estáticos de `public/logos/` (256×256, `<img>` simples). A do escritório é a de quem não
// tem Setor (Admin) e a de todo Setor sem logo própria. Setor novo com logo entra neste mapa, e o spec
// confere que cada arquivo existe e que nenhum sobra fora dele.
export const LOGO_DO_ESCRITORIO = "/logos/logo-rigoni.jpeg";

// Tipagem solta (`string`) como em ROTA_POR_SETOR/SETOR_LABEL: o Setor chega da sessão como texto do enum
// do banco, e o que não está no mapa cai na logo do escritório.
export const LOGO_POR_SETOR: Record<string, string> = {
  simples_nacional: "/logos/logo-simples-nacional.jpeg",
  contabil: "/logos/logo-contabil.jpeg",
};

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
    logo: Object.hasOwn(LOGO_POR_SETOR, setor) ? LOGO_POR_SETOR[setor] : LOGO_DO_ESCRITORIO,
  };
}
