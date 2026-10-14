import type { ClienteDto } from "@/modules/clientes/application/dtos/cliente.dto";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";

export function clienteParaDto(cliente: Cliente): ClienteDto {
  return {
    id: cliente.id,
    empresa: cliente.empresa,
    cnpj: cliente.cnpj.valor,
    regime: cliente.regime.valor,
    contratoSocialCaminho: cliente.contratoSocialCaminho,
    email: cliente.email,
    alteracoesContratuais: cliente.alteracoesContratuais.map((alteracao) => ({
      data: alteracao.data.toISOString().slice(0, 10),
      arquivoCaminho: alteracao.arquivoCaminho,
    })),
  };
}
