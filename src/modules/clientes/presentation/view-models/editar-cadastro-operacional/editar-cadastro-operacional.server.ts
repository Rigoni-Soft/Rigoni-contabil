import "server-only";

import {
  makeConsultarCadastroOperacionalCliente,
  makeConsultarCadastroRhCliente,
} from "@/main/clientes.factory";
import { usaCadastroDoRh } from "@/shared/kernel/papeis";

import { carregarDocumentosContratuais } from "../visualizar-documento-contratual/visualizar-documento-contratual.server";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts): nomear o Result/DTO
// do módulo aqui violaria "presentation não importa domain/infra". O shape flui por inferência.
export async function carregarCadastroOperacionalCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroOperacionalCliente();
  return consultar.execute(clienteId);
}

export async function carregarCadastroRhCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroRhCliente();
  return consultar.execute(clienteId);
}

// O que a página do Cliente lê por perfil: o RH tem o cadastro dele, então o cadastro operacional do SN
// nem chega ao servidor da página; os documentos contratuais (só leitura) chegam aos dois.
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
