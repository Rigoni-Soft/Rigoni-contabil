import type { Papel } from "@/shared/kernel/papeis";
import { SETORES, type SetorSlug } from "@/shared/kernel/setores";

// Quem transfere: o Funcionário dono do Atendimento, o Líder do Setor onde ele está, ou o Admin.
// ponytail: o nome ficou estreito, a regra também decide quem vê, responde e envia documento no
// Atendimento. Renomear para `podeAgirNoAtendimento`.
export function podeTransferir(
  ator: { id: string; papel: Papel; setor: SetorSlug },
  atendimento: { setor: SetorSlug; funcionarioId: string | null },
): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
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
