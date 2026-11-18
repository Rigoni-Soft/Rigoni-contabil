import { linhasNumeradas, paginar } from "@/modules/atendimento/domain/services/paginacao.service";
import { setoresDoCliente } from "@/modules/atendimento/domain/services/transferencia.service";
import { SETOR_LABEL, SETOR_RECEPCAO, type SetorSlug } from "@/shared/kernel/setores";

export const SETORES_POR_PAGINA = 5;

// Os setores que o cliente escolhe na URA ao pedir um atendente. A Recepção fica de fora: é a saída de
// quem não sabe o setor (opção 0) ou escreve que quer falar com uma pessoa. O Simples Nacional só
// aparece para Cliente do Simples Nacional ou MEI (a mesma trava da Transferência).
export function setoresDaUra(regimeDoCliente: string | null): SetorSlug[] {
  return setoresDoCliente(regimeDoCliente).filter((setor) => setor !== SETOR_RECEPCAO);
}

// A numeração recomeça em 1 a cada página, como na lista de alterações.
export function listaDeSetores(setores: SetorSlug[], pagina: number): string {
  const exibida = paginar(setores, pagina, SETORES_POR_PAGINA);
  const linhas = linhasNumeradas(exibida, (setor) => SETOR_LABEL[setor]);
  return (
    `Com qual setor você quer falar? (página ${exibida.pagina} de ${exibida.total})\n${linhas}\n` +
    "Digite *0* se não souber o setor, para falar com a recepção.\nDigite *menu* para voltar."
  );
}
