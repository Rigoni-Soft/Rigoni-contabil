import "server-only";

import { makeListarDocumentosContratuaisCliente } from "@/main/clientes.factory";

// Carga inicial da tela (arquitetura.md §4.9, regra 1): o botão chega pronto, sem action no mount.
// Sem tipo de retorno explícito, pelo mesmo motivo de editar-cadastro-operacional.server.ts.
export async function carregarDocumentosContratuais(clienteId: string) {
  const listar = await makeListarDocumentosContratuaisCliente();
  return listar.execute(clienteId);
}
