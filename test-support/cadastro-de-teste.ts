import type {
  CadastroOperacionalClienteDto,
  CadastroRhClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";

export const CLIENTE_DE_TESTE_ID = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";

export function cadastroOperacionalDeTeste(
  parcial: Partial<CadastroOperacionalClienteDto> = {},
): CadastroOperacionalClienteDto {
  return {
    id: CLIENTE_DE_TESTE_ID,
    empresa: "Padaria Pão Quente Ltda",
    cnpj: "11444777000161",
    regime: "simples_nacional",
    formaEnvio: "whatsapp",
    destinos: [],
    tiposDeEnvio: [],
    contatos: [],
    documentoObrigatorio: null,
    dasStatus: null,
    dataEnvioDas: null,
    parcelamentos: [],
    observacoesGerais: "",
    atividadeMes: { industria: false, comercio: false, servico: false },
    responsavelId: null,
    responsavelNome: null,
    ...parcial,
  };
}

export function cadastroRhDeTeste(
  parcial: Partial<CadastroRhClienteDto> = {},
): CadastroRhClienteDto {
  return {
    id: CLIENTE_DE_TESTE_ID,
    empresa: "Padaria Pão Quente Ltda",
    cnpj: "11444777000161",
    contatos: [],
    observacoes: "",
    destinos: [],
    tiposDeEnvio: [],
    parcelamentos: [],
    ...parcial,
  };
}
