import "server-only";

import {
  makeConsultarCadastroOperacionalCliente,
  makeConsultarCadastroRhCliente,
} from "@/main/clientes.factory";
import { usaCadastroDoRh } from "@/shared/kernel/papeis";

import { carregarDocumentosContratuais } from "../visualizar-documento-contratual/visualizar-documento-contratual.server";

async function carregarCadastroOperacionalCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroOperacionalCliente();
  return consultar.execute(clienteId);
}

export async function carregarCadastroRhCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroRhCliente();
  return consultar.execute(clienteId);
}

export async function carregarClienteParaPagina(clienteId: string, papel: string, setor: string) {
  if (usaCadastroDoRh(papel, setor)) {
    const [rh, documentos] = await Promise.all([
      carregarCadastroRhCliente(clienteId),
      carregarDocumentosContratuais(clienteId),
    ]);
    return { rh, operacional: null, documentos } as const;
  }
  const [operacional, documentos] = await Promise.all([
    carregarCadastroOperacionalCliente(clienteId),
    carregarDocumentosContratuais(clienteId),
  ]);
  return { rh: null, operacional, documentos } as const;
}
