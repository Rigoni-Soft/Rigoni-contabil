import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { ehSetor } from "@/shared/kernel/setores";

export function ondeAtribuirResponsavel(papel: string, setor: string) {
  const noCadastro = setor === "simples_nacional";
  const noSetor = !noCadastro && ehSetor(setor) && podeAtribuirResponsavel(papel, setor);
  return { noCadastro, noSetor };
}
