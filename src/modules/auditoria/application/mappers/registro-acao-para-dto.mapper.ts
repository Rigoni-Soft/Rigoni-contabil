import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";

export function registroAcaoParaDto(registro: RegistroAcao): RegistroAcaoDto {
  return {
    id: registro.id,
    ator: registro.ator,
    setor: registro.setor,
    acao: registro.acao,
    alvo: registro.alvo,
    resultado: registro.resultado.valor,
    dataHora: registro.dataHora.toISOString(),
  };
}
