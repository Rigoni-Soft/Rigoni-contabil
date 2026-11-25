import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { ehSetor, SETOR_SN } from "@/shared/kernel/setores";

export function ondeAtribuirResponsavel(papel: string, setor: string) {
  const noCadastro = setor === SETOR_SN;
  const noSetor = !noCadastro && ehSetor(setor) && podeAtribuirResponsavel(papel, setor);
  return { noCadastro, noSetor };
}
