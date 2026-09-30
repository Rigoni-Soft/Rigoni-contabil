import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcaoRowDto } from "@/modules/auditoria/infra/dtos/registro-acao-row.dto";

// Read model (arquitetura.md, seção 3.6): Row -> DTO de leitura direto, sem reconstruir entidade.
export function registroAcaoRowParaDto(row: RegistroAcaoRowDto): RegistroAcaoDto {
  return {
    id: row.id,
    ator: row.ator,
    setor: row.setor,
    acao: row.acao,
    alvo: row.alvo,
    resultado: row.resultado,
    dataHora: row.criado_em,
  };
}
