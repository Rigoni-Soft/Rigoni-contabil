import type { Papel } from "@/shared/kernel/papeis";
import { SETOR_SN, SETORES, type SetorSlug } from "@/shared/kernel/setores";

type Ator = { id: string; papel: Papel; setor: SetorSlug };
type AtendimentoDoSetor = { setor: SetorSlug; funcionarioId: string | null };

export function podeSupervisionar(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
}

export function podeAtender(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return ator.id === atendimento.funcionarioId;
}

export function atendidoPeloSimplesNacional(regime: string): boolean {
  return regime === "simples_nacional" || regime === "mei";
}

export function setoresDoCliente(regimeDoCliente: string | null): SetorSlug[] {
  const simplesNacionalPermitido =
    regimeDoCliente !== null && atendidoPeloSimplesNacional(regimeDoCliente);
  return SETORES.filter((setor) => setor !== SETOR_SN || simplesNacionalPermitido);
}

export function setoresDeDestino(origem: SetorSlug, regimeDoCliente: string | null): SetorSlug[] {
  return setoresDoCliente(regimeDoCliente).filter((setor) => setor !== origem);
}
