import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// `data` (AAAA-MM-DD) só existe nas alterações contratuais; o contrato social não tem.
export type DocumentoDisponivel = { tipo: "contrato" | "alteracao"; data: string | null };

// `descricao` é como o cliente vê o documento (ex.: "Alteração de 01/03/2026").
export type DocumentoOferecido = DocumentoDisponivel & { descricao: string };

export type MensagemVista = {
  id: string;
  autor: "contato" | "ura" | "funcionario";
  texto: string;
  criadoEm: string;
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
export type OrigemUra = { resumo: string; cnpjInformado: string | null };

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
  // Null se o Atendimento não nasceu da URA (ou nasceu sem resumo).
  ura: OrigemUra | null;
  // Serviços que o Funcionário pode disparar agora; vazio se encerrado ou sem Cliente.
  documentos: DocumentoOferecido[];
  // Setores para onde o Funcionário pode transferir agora; vazio se encerrado.
  setoresDestino: SetorSlug[];
};

export interface ObterConversaPort {
  execute(input: { atendimentoId: string }): Promise<Result<ConversaVista, AppError>>;
}
