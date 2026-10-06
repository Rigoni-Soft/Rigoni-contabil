import type {
  AberturaAtendimento,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemOutput } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { RegimeValor } from "@/shared/kernel/regimes";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type FuncionarioDoSetor = { id: string; atendimentosNoMes: number; livre: boolean };

// "conflito": o Funcionário escolhido foi ocupado por outro Atendimento no meio (concorrência);
// nada é gravado e quem chama escolhe de novo.
export type ResultadoAbertura = { status: "aberto"; id: string } | { status: "conflito" };

export type NovoAtendimento = AberturaAtendimento & { funcionarioId: string | null };

export type AtendimentoEmAndamento = {
  id: string;
  clienteId: string | null;
  setor: SetorSlug;
  funcionarioId: string | null;
  telefone: string;
  chave: string;
};

export type NovaTransferencia = {
  atendimentoId: string;
  // Dono do Atendimento quando foi lido: se mudou até a gravação, a Transferência é recusada.
  origemFuncionarioId: string | null;
  // Setor em que o Atendimento estava quando foi lido: se mudou até a gravação, é recusada.
  setorOrigem: SetorSlug;
  setorDestino: SetorSlug;
  funcionarioDestinoId: string | null;
  // Destino fixo (não escolhido pelo Balanceamento): ocupado, o Atendimento entra na fila dele
  // em vez de ser recusado ("conflito").
  enfileirarSeOcupado: boolean;
  resumo: string;
  ator: { id: string; setor: SetorSlug };
};

// "conflito": o Funcionário de destino foi ocupado no meio (como em ResultadoAbertura).
// "inexistente": o Atendimento não está mais em andamento com o dono lido.
export type ResultadoTransferencia =
  | {
      status: "transferido";
      naFila: boolean;
      destinatarioNome: string | null;
      origemNome: string | null;
      contato: DadosDoContato;
    }
  | { status: "conflito" }
  | { status: "inexistente" };

// Regime e Responsável do Cliente, para decidir a Transferência ao Simples Nacional.
export type RoteamentoDoCliente = { regime: RegimeValor; responsavelId: string | null };

// Atendimento sem Funcionário: fila do Setor (`filaFuncionarioId` null) ou de um usuário (destino
// fixo ocupado). `filaDesde` ordena a saída (mais antigo primeiro).
export type ItemDaFila = {
  id: string;
  filaFuncionarioId: string | null;
  filaDesde: Date;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
};

// O Atendimento que o Funcionário liberado assumiu da Fila.
export type AtendimentoAssumido = {
  id: string;
  telefone: string;
  chave: string;
  funcionarioNome: string | null;
};

export interface AtendimentoRepositoryPort {
  funcionariosDoSetor(setor: SetorSlug): Promise<Result<FuncionarioDoSetor[], AppError>>;
  abrir(atendimento: NovoAtendimento): Promise<Result<ResultadoAbertura, AppError>>;
  anexarMensagem(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<AnexarMensagemOutput, AppError>>;
  buscarEmAndamento(id: string): Promise<Result<AtendimentoEmAndamento | null, AppError>>;
  roteamentoDoCliente(clienteId: string): Promise<Result<RoteamentoDoCliente | null, AppError>>;
  liderDoSetor(setor: SetorSlug): Promise<Result<string | null, AppError>>;
  transferir(transferencia: NovaTransferencia): Promise<Result<ResultadoTransferencia, AppError>>;
  // 1 = próximo da Fila em que está; null se não está em Fila.
  posicaoNaFila(atendimentoId: string): Promise<Result<number | null, AppError>>;
  filaDoSetor(setor: SetorSlug): Promise<Result<ItemDaFila[], AppError>>;
  // false = não está em andamento com esse dono (`funcionarioId` null = Atendimento da Fila).
  encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<boolean, AppError>>;
  // Funcionário livre assume o mais antigo da Fila (do Setor ou a sua); null = ocupado ou Fila vazia.
  liberarFuncionario(
    funcionarioId: string,
    setor: SetorSlug,
  ): Promise<Result<AtendimentoAssumido | null, AppError>>;
}
