import "server-only";

import {
  makeConsultarCadastroOperacionalCliente,
  makeConsultarDadosBasicosCliente,
} from "@/main/clientes.factory";
import { soLeDadosBasicosDoCliente } from "@/shared/kernel/papeis";
import { ok } from "@/shared/kernel/result";

import { carregarDocumentosContratuais } from "../visualizar-documento-contratual/visualizar-documento-contratual.server";
import { dadosBasicosParaTela } from "./editar-cadastro-operacional.presenter";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts): nomear o Result/DTO
// do módulo aqui violaria "presentation não importa domain/infra". O shape flui por inferência.
export async function carregarCadastroOperacionalCliente(clienteId: string) {
  const consultar = await makeConsultarCadastroOperacionalCliente();
  return consultar.execute(clienteId);
}

export async function carregarDadosBasicosCliente(clienteId: string) {
  const consultar = await makeConsultarDadosBasicosCliente();
  const lidos = await consultar.execute(clienteId);
  return lidos.ok ? ok(lidos.value && dadosBasicosParaTela(lidos.value)) : lidos;
}

// O que a página do Cliente lê por perfil: o RH só lê os dados básicos, então nem o cadastro
// operacional nem os documentos chegam ao servidor da página.
export async function carregarClienteParaPagina(clienteId: string, papel: string, setor: string) {
  if (soLeDadosBasicosDoCliente(papel, setor)) {
    const basicos = await carregarDadosBasicosCliente(clienteId);
    return { basicos, operacional: null, documentos: null } as const;
  }
  const [operacional, documentos] = await Promise.all([
    carregarCadastroOperacionalCliente(clienteId),
    carregarDocumentosContratuais(clienteId),
  ]);
  return { basicos: null, operacional, documentos } as const;
}
