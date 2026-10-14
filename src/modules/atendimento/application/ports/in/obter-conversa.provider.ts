import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { TipoAnexoMensagem } from "@/shared/kernel/anexo";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// `data` (AAAA-MM-DD) só existe nas alterações contratuais; o contrato social não tem.
export type DocumentoDisponivel = { tipo: "contrato" | "alteracao"; data: string | null };

// `descricao` é como o cliente vê o documento (ex.: "Alteração de 01/03/2026").
export type DocumentoOferecido = DocumentoDisponivel & { descricao: string };

// O anexo de uma Mensagem do Funcionário, com o link temporário já pedido (`expiraEm` em ISO).
export type AnexoVisto = {
  tipo: TipoAnexoMensagem;
  nome: string;
  tamanho: number;
  // Baixa o arquivo; `urlVisualizacao` o abre no navegador.
  url: string;
  urlVisualizacao: string;
  // Só imagem com miniatura: a conversa mostra esta e amplia o original (`url`).
  miniaturaUrl: string | null;
  expiraEm: string;
};

export type MensagemVista = {
  id: string;
  autor: "contato" | "ura" | "funcionario";
  texto: string;
  criadoEm: string;
  // Reação do escritório (emoji) à Mensagem do cliente; `reagivel`: dá para reagir a ela.
  reacao: string | null;
  reagivel: boolean;
  anexo: AnexoVisto | null;
  // Só nas Mensagens de Funcionário.
  atendente: { nome: string; setor: SetorSlug } | null;
};

// A Transferência mais recente do Atendimento: de onde veio e o resumo que o destino recebe.
// `origemNome` é null quando o Atendimento saiu da Fila (sem Funcionário de origem).
export type UltimaTransferencia = {
  setorOrigem: SetorSlug;
  origemNome: string | null;
  resumo: string;
};

// O que a URA já sabia ao encaminhar o contato; `cnpjInformado` só existe se o número digitou um.
export type OrigemUra = { resumo: string | null; cnpjInformado: string | null };

export type ConversaVista = {
  atendimentoId: string;
  encerrado: boolean;
  telefone: string;
  contato: DadosDoContato;
  // Sem Cliente vinculado (ex.: número não identificado) não há CNPJ para disparar serviços.
  clienteVinculado: boolean;
  mensagens: MensagemVista[];
  // Null se o Atendimento nunca foi transferido.
  ultimaTransferencia: UltimaTransferencia | null;
  // Null se o Atendimento não nasceu da URA (sem resumo nem CNPJ informado).
  ura: OrigemUra | null;
  // A URA avisou que o Atendimento será encerrado por falta de resposta do Funcionário (#73) e ele
  // ainda não escreveu depois do aviso.
  avisoInatividade: boolean;
  // Serviços que o Funcionário pode disparar agora; vazio se encerrado ou sem Cliente.
  documentos: DocumentoOferecido[];
  // Setores para onde o Funcionário pode transferir agora; vazio se encerrado.
  setoresDestino: SetorSlug[];
};

export interface ObterConversaPort {
  execute(input: { atendimentoId: string }): Promise<Result<ConversaVista, AppError>>;
}
