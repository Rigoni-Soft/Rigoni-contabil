import { SETOR_RECEPCAO, SETOR_RH, SETOR_SN } from "@/shared/kernel/setores";

const RESPONSAVEL_OUTRO_SETOR_LABEL = "Responsável de outro setor";

export const PAPEIS = ["admin", "lider_setor", "funcionario"] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  lider_setor: "Líder de setor",
  funcionario: "Funcionário",
};

export type PapelCadastravel = "lider_setor" | "funcionario";

export const SEM_RESPONSAVEL_LABEL = "Sem responsável";
export const SEM_RESPONSAVEL_ID = "sem_responsavel";

export function rotuloResponsavel(id: string | null, nome: string | null): string {
  return id ? (nome ?? RESPONSAVEL_OUTRO_SETOR_LABEL) : SEM_RESPONSAVEL_LABEL;
}

export function podeEditarCadastroOperacional(papel: string, setor: string): boolean {
  return (
    papel === "admin" ||
    ((papel === "lider_setor" || papel === "funcionario") && setor === SETOR_SN)
  );
}

export function podeGerirParcelamento(papel: string, setorDoAtor: string, setor: string): boolean {
  return (
    papel === "admin" ||
    ((papel === "lider_setor" || papel === "funcionario") && setorDoAtor === setor)
  );
}

export function podeOperarParcelamento(papel: string, setor: string): boolean {
  return (
    podeGerirParcelamento(papel, setor, SETOR_SN) || podeGerirParcelamento(papel, setor, SETOR_RH)
  );
}

export function podeVerDashboardDoSetor(
  papel: string,
  setorDoAtor: string,
  setor: string,
): boolean {
  return papel === "admin" || setorDoAtor === setor;
}

export function usaCadastroDoRh(papel: string, setor: string): boolean {
  return papel !== "admin" && setor === SETOR_RH;
}

export function podeEditarCadastroRh(papel: string, setor: string): boolean {
  return (
    papel === "admin" ||
    ((papel === "lider_setor" || papel === "funcionario") && setor === SETOR_RH)
  );
}

function ehLiderDeSetorComResponsavel(papel: string, setor: string): boolean {
  return papel === "lider_setor" && setor !== SETOR_RECEPCAO;
}

export function podeAtribuirResponsavel(papel: string, setor: string): boolean {
  return ehLiderDeSetorComResponsavel(papel, setor);
}

export function veCarteiraInteira(papel: string): boolean {
  return papel === "admin" || papel === "lider_setor";
}

export function podeVerComparativoDoSetor(papel: string, setor: string): boolean {
  return ehLiderDeSetorComResponsavel(papel, setor);
}

export function podeAnexarAlteracaoContratual(papel: string): boolean {
  return papel === "admin";
}

export function podeVerAcompanhamentoRh(papel: string, setor: string): boolean {
  return papel === "admin" || setor === SETOR_RH;
}

export function podeMarcarAcompanhamentoRh(papel: string, setor: string): boolean {
  return papel === "funcionario" && setor === SETOR_RH;
}

export function ehResponsavelRhDoCliente(
  ator: { id: string; papel: string; setor: string },
  responsavelId: string | null | undefined,
): boolean {
  return podeMarcarAcompanhamentoRh(ator.papel, ator.setor) && responsavelId === ator.id;
}

export function podeGerirServicosRh(papel: string, setor: string): boolean {
  return papel === "lider_setor" && setor === SETOR_RH;
}

export function podeVerAcompanhamentoDosFuncionariosRh(papel: string, setor: string): boolean {
  return papel === "admin" || (papel === "lider_setor" && setor === SETOR_RH);
}

export function podeGerirConvencaoRh(papel: string, setor: string): boolean {
  return papel === "admin" || (papel === "lider_setor" && setor === SETOR_RH);
}
