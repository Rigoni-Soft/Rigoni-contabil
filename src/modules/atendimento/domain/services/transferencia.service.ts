import type { Papel } from "@/shared/kernel/papeis";
import { SETORES, type SetorSlug } from "@/shared/kernel/setores";

type Ator = { id: string; papel: Papel; setor: SetorSlug };
type AtendimentoDoSetor = { setor: SetorSlug; funcionarioId: string | null };

// Quem vê e encerra: o dono, o Líder do Setor onde o Atendimento está, ou o Admin. Líder e Admin
// enxergam o Atendimento dos outros em leitura de supervisão (inclusive a espera dirigida).
export function podeSupervisionar(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
}

// Quem responde, envia arquivo/documento, reage e transfere: só o dono. Sem dono (espera), ninguém.
export function podeAtender(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return ator.id === atendimento.funcionarioId;
}

// Só Cliente do Simples Nacional ou MEI é atendido (e transferido) pelo setor Simples Nacional.
export function atendidoPeloSimplesNacional(regime: string): boolean {
  return regime === "simples_nacional" || regime === "mei";
}

// Para onde o Atendimento pode ir: qualquer Setor menos o atual; o Simples Nacional só para
// Cliente do Simples Nacional/MEI (a mesma trava que a Transferência faz no backend).
export function setoresDeDestino(origem: SetorSlug, regimeDoCliente: string | null): SetorSlug[] {
  const simplesNacionalPermitido =
    regimeDoCliente !== null && atendidoPeloSimplesNacional(regimeDoCliente);
  return SETORES.filter(
    (setor) => setor !== origem && (setor !== "simples_nacional" || simplesNacionalPermitido),
  );
}
