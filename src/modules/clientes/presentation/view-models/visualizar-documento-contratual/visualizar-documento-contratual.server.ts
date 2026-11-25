import "server-only";

import { makeListarDocumentosContratuaisCliente } from "@/main/clientes.factory";

export async function carregarDocumentosContratuais(clienteId: string) {
  const listar = await makeListarDocumentosContratuaisCliente();
  return listar.execute(clienteId);
}
