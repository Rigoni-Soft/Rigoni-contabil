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

export type ConversaVista = {
  atendimentoId: string;
  encerrado: boolean;
  telefone: string;
  contato: DadosDoContato;
  // Sem Cliente vinculado (ex.: número não identificado) não há CNPJ para disparar serviços.
  clienteVinculado: boolean;
  mensagens: MensagemVista[];
  // Serviços que o Funcionário pode disparar agora; vazio se encerrado ou sem Cliente.
  documentos: DocumentoOferecido[];
};

export interface ObterConversaPort {
  execute(input: { atendimentoId: string }): Promise<Result<ConversaVista, AppError>>;
}
