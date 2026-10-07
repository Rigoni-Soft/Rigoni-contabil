import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AutorMensagem = "contato" | "ura" | "funcionario";
export type NovaMensagem = { autor: AutorMensagem; texto: string };

// `telefone` como chegou (resposta); `chave` só dígitos nacionais (identifica o Atendimento).
export type AberturaAtendimento = {
  telefone: string;
  chave: string;
  clienteId: string | null;
  setor: SetorSlug;
  mensagens: NovaMensagem[];
  // Só a URA preenche: o que a recepção lê ao assumir e o CNPJ (normalizado) que o número informou.
  // O banco liga o CNPJ ao Cliente se existir; sem Cliente é um provável cliente novo.
  resumo?: string;
  cnpjInformado?: string;
};

// `funcionarioId` null = nenhum Funcionário livre no Setor: o Atendimento entrou na Fila e
// `posicao` (1 = próximo) diz onde.
export type AtendimentoAberto = { id: string; funcionarioId: string | null; posicao?: number };

export interface AbrirAtendimentoPort {
  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
}
