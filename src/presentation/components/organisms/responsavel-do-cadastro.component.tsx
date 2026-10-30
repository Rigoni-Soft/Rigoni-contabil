import type { UseFormRegisterReturn } from "react-hook-form";

import { CampoResponsavel } from "@/presentation/components/molecules/campo-responsavel.component";
import { SEM_RESPONSAVEL_LABEL } from "@/shared/kernel/papeis";

// Responsável: só o Líder do SN edita (Select); os demais veem o nome.
export type ResponsavelCampo = {
  editavel: boolean;
  nomeAtual: string;
  opcoes: { id: string; nome: string }[];
  // Lista carrega só quando o Select é aberto; enquanto isso (ou se falhar)
  // aparece como opção desabilitada.
  onAbrir: () => void;
  // "erro": aviso próprio com saída (tentar de novo), nunca só uma opção.
  estadoLista: "ok" | "carregando" | "erro";
  onTentarNovamente: () => void;
};

type ResponsavelDoCadastroProps = {
  responsavel: ResponsavelCampo;
  select: UseFormRegisterReturn;
  desabilitado: boolean;
};

export function ResponsavelDoCadastro({
  responsavel,
  select,
  desabilitado,
}: ResponsavelDoCadastroProps) {
  return (
    <CampoResponsavel
      editavel={responsavel.editavel}
      nomeAtual={responsavel.nomeAtual}
      opcoes={responsavel.opcoes}
      semResponsavel={SEM_RESPONSAVEL_LABEL}
      estadoLista={responsavel.estadoLista}
      onAbrir={responsavel.onAbrir}
      onTentarNovamente={responsavel.onTentarNovamente}
      select={select}
      desabilitado={desabilitado}
    />
  );
}
