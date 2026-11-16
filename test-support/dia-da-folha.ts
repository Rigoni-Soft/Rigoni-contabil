import type { DiaDaFolhaDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";

export const APURACAO_ZERADA: DiaDaFolhaDto["apuracao"] = {
  normaisMin: 0,
  extras: [],
  bancoDeHorasMin: 0,
  acimaDoLimiteMin: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 0,
  abonoDias: 0,
  abonoMin: 0,
  feriadosTrabalhados: 0,
  sabadosTrabalhados: 0,
  diasComLanche: 0,
};

// Um dia da Folha de ponto para os testes: segunda-feira útil e vazia (16/11/2026), sobrescrevível. O
// `temApontamento` acompanha batida, Extra e Abono sobrescritos, a menos que o teste o fixe. Campo novo do DTO do
// dia entra aqui, num lugar só, em vez de em cada fixture.
export function diaDaFolha(sobrescritas: Partial<DiaDaFolhaDto> = {}): DiaDaFolhaDto {
  const dia = {
    data: "2026-11-16",
    diaDaSemana: 1,
    batidas: [],
    extra: null,
    abono: false,
    feriado: false,
    cargaMin: 525,
    diaDeTrabalho: true,
    trabalhadoMin: 0,
    apuracao: APURACAO_ZERADA,
    ...sobrescritas,
  };
  return {
    ...dia,
    temApontamento:
      sobrescritas.temApontamento ?? (dia.batidas.length > 0 || dia.extra !== null || dia.abono),
  };
}
