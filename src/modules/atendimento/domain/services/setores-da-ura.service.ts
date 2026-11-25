import { linhasNumeradas, paginar } from "@/modules/atendimento/domain/services/paginacao.service";
import { setoresDoCliente } from "@/modules/atendimento/domain/services/transferencia.service";
import { SETOR_LABEL, SETOR_RECEPCAO, type SetorSlug } from "@/shared/kernel/setores";

export const SETORES_POR_PAGINA = 5;

export function setoresDaUra(regimeDoCliente: string | null): SetorSlug[] {
  return setoresDoCliente(regimeDoCliente).filter((setor) => setor !== SETOR_RECEPCAO);
}

export function listaDeSetores(setores: SetorSlug[], pagina: number): string {
  const exibida = paginar(setores, pagina, SETORES_POR_PAGINA);
  const linhas = linhasNumeradas(exibida, (setor) => SETOR_LABEL[setor]);
  return (
    `Com qual setor você quer falar? (página ${exibida.pagina} de ${exibida.total})\n${linhas}\n` +
    "Digite *0* se não souber o setor, para falar com a recepção.\nDigite *menu* para voltar."
  );
}
