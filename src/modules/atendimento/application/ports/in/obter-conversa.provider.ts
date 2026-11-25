import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { TipoAnexoMensagem } from "@/shared/kernel/anexo";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type DocumentoDisponivel = { tipo: "contrato" | "alteracao"; numero: number | null };

export type DocumentoOferecido = DocumentoDisponivel & { descricao: string };

type AnexoVisto = {
  tipo: TipoAnexoMensagem;
  nome: string;
  tamanho: number;
  url: string;
  urlVisualizacao: string;
  miniaturaUrl: string | null;
  expiraEm: string;
};

export type MensagemVista = {
  id: string;
  autor: "contato" | "ura" | "funcionario";
  texto: string;
  criadoEm: string;
  reacao: string | null;
  reagivel: boolean;
  entrega: "pendente" | "entregue" | "falha";
  anexo: AnexoVisto | null;
  atendente: { nome: string; setor: SetorSlug } | null;
};

export type UltimaTransferencia = {
  setorOrigem: SetorSlug;
  origemNome: string | null;
  resumo: string;
};

export type OrigemUra = { resumo: string | null; cnpjInformado: string | null };

export type ConversaVista = {
  atendimentoId: string;
  encerrado: boolean;
  podeAtender: boolean;
  podeCadastrarContato: boolean;
  telefone: string;
  contato: DadosDoContato;
  clienteVinculado: boolean;
  mensagens: MensagemVista[];
  temMaisAnteriores: boolean;
  ultimaTransferencia: UltimaTransferencia | null;
  ura: OrigemUra | null;
  documentos: DocumentoOferecido[];
  setoresDestino: SetorSlug[];
};

export type MensagensAnterioresVista = {
  mensagens: MensagemVista[];
  temMaisAnteriores: boolean;
};

export interface ObterConversaPort {
  execute(input: { atendimentoId: string }): Promise<Result<ConversaVista, AppError>>;
  mensagensAnteriores(input: {
    atendimentoId: string;
    antes: { criadoEm: string; id: string };
  }): Promise<Result<MensagensAnterioresVista, AppError>>;
  renovarLinks(input: {
    atendimentoId: string;
    mensagemIds: string[];
  }): Promise<Result<MensagemVista[], AppError>>;
}
