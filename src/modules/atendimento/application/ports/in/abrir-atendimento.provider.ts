import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AutorMensagem = "contato" | "ura" | "funcionario";
// `idExterno`: id da Mensagem no provedor (só a do contato), para reagir a ela depois.
export type NovaMensagem = { autor: AutorMensagem; texto: string; idExterno?: string };

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

// O Atendimento nasce na espera do Setor, sem Funcionário.
export type AtendimentoAberto = { id: string };

export interface AbrirAtendimentoPort {
  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
}
