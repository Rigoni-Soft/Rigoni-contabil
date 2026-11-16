import type {
  ClienteAcompanhamentoDto,
  ServicoAcompanhamentoDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { ClienteLidoDto } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import { situacaoDosServicos } from "@/modules/rh/domain/services/situacao-dos-servicos.service";

// Junta ao que o adapter leu a situação dos Serviços decidida pelo módulo de domínio: os casos de uso
// seguem só o que sai daqui.
export function comSituacao(
  clientes: ClienteLidoDto[],
  servicos: ServicoAcompanhamentoDto[],
): ClienteAcompanhamentoDto[] {
  return clientes.map(
    ({ clienteId, empresa, cnpj, responsavel, holerite, ...fatos }): ClienteAcompanhamentoDto => ({
      clienteId,
      empresa,
      cnpj,
      responsavel,
      holerite,
      situacao: situacaoDosServicos(servicos, { ...fatos, holerite }),
    }),
  );
}
