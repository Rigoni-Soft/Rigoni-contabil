import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import {
  operacionalUnico,
  type CadastroOperacionalRow,
} from "@/modules/clientes/infra/mappers/cadastro-operacional-row.mapper";

type AlteracaoRow = { data: string; arquivo_caminho: string };
type ContatoRow = { id: string; nome: string; telefone: string; padrao: boolean };
type AtividadeMensalRow = {
  ano_mes: string;
  industria: boolean;
  comercio: boolean;
  servico: boolean;
};

export type ClienteRow = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  contrato_social_caminho?: string | null;
  cliente_alteracoes_contratuais?: AlteracaoRow[] | null;
  cliente_cadastro_operacional_sn?: CadastroOperacionalRow | CadastroOperacionalRow[] | null;
  cliente_contatos?: ContatoRow[] | null;
  cliente_atividades_mensais?: AtividadeMensalRow[] | null;
};

export function clienteDoRow(row: ClienteRow): Cliente {
  const operacional = operacionalUnico(row.cliente_cadastro_operacional_sn);
  const atividade = (row.cliente_atividades_mensais ?? [])[0] ?? null;

  const construido = Cliente.builder().restaurar({
    id: row.id,
    empresa: row.empresa,
    cnpj: row.cnpj,
    regime: row.regime,
    contratoSocialCaminho: row.contrato_social_caminho ?? null,
    alteracoesContratuais: (row.cliente_alteracoes_contratuais ?? []).map((alteracao) => ({
      data: alteracao.data,
      arquivoCaminho: alteracao.arquivo_caminho,
    })),
    formaEnvio: operacional?.forma_envio,
    contatos: (row.cliente_contatos ?? []).map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      padrao: contato.padrao,
    })),
    documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
    dasStatus: operacional?.das_status ?? null,
    dataEnvioDas: operacional?.data_envio_das ?? null,
    temParcelamento: operacional?.tem_parcelamento ?? false,
    parcelamentoStatus: operacional?.parcelamento_status ?? null,
    observacoesGerais: operacional?.observacoes_gerais ?? "",
    atividadeMesAtual: atividade
      ? {
          anoMes: atividade.ano_mes,
          industria: atividade.industria,
          comercio: atividade.comercio,
          servico: atividade.servico,
        }
      : null,
  });

  const resultado = construido.build();
  if (!resultado.ok) {
    throw new Error(`Falha ao reconstituir Cliente ${row.id}: ${resultado.error.message}`);
  }
  return resultado.value;
}
