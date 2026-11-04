import "server-only";

import {
  makeConsultarCadastroOperacionalCliente,
  makeConsultarDadosBasicosCliente,
} from "@/main/clientes.factory";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts): nomear o Result/DTO
// do módulo aqui violaria "presentation não importa domain/infra". O shape flui por inferência.
export async function carregarCadastroOperacionalCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroOperacionalCliente();
  return consultar.execute(clienteId);
}

export async function carregarDadosBasicosCliente(clienteId: string) {
  const consultar = await makeConsultarDadosBasicosCliente();
  return consultar.execute(clienteId);
}
