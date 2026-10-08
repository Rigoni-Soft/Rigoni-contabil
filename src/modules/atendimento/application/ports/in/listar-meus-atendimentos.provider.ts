import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AtendimentoVisto = {
  atendimentoId: string;
  telefone: string;
  criadoEm: string;
  contato: DadosDoContato;
  ultimaMensagem: {
    autor: "contato" | "ura" | "funcionario";
    texto: string;
    criadoEm: string;
  } | null;
};

// Os Atendimentos em andamento do usuário logado: o que o painel mantém visível enquanto ele
// troca de tela.
export interface ListarMeusAtendimentosPort {
  execute(): Promise<Result<AtendimentoVisto[], AppError>>;
}
