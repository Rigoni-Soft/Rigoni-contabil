import type {
  AberturaAtendimento,
  AtendimentoAberto,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemOutput } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type {
  OrigemUra,
  UltimaTransferencia,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { CursorDaConversa } from "@/modules/atendimento/domain/services/janela-da-conversa.service";
import type { AppError } from "@/shared/errors/app.error";
import type { TipoAnexoMensagem } from "@/shared/kernel/anexo";
import type { RegimeValor } from "@/shared/kernel/regimes";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

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
  origemFuncionarioId: string | null;
  setorOrigem: SetorSlug;
  setorDestino: SetorSlug;
  dirigidoA: string | null;
  resumo: string;
  ator: { id: string; setor: SetorSlug };
};

export type ResultadoTransferencia =
  | {
      status: "transferido";
      destinatarioNome: string | null;
      origemNome: string | null;
      contato: DadosDoContato;
    }
  | { status: "conflito" }
  | { status: "inexistente" };

export type ResultadoEncerramento = { status: "encerrado" } | { status: "inexistente" };

export type ResultadoAssuncao =
  | { status: "assumido" }
  | { status: "inelegivel" }
  | { status: "ja_assumido" }
  | { status: "inexistente" };

export type RoteamentoDoCliente = { regime: RegimeValor; responsavelId: string | null };

export type ItemDaFila = {
  id: string;
  filaFuncionarioId: string | null;
  filaDesde: Date;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
  origem: { setor: SetorSlug; nome: string | null } | null;
};

export type AtendimentoDoFuncionario = {
  id: string;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  telefone: string;
  criadoEm: string;
  contato: DadosDoContato;
  ultimaMensagem: {
    autor: "contato" | "ura" | "funcionario";
    texto: string;
    criadoEm: string;
    anexoTipo: TipoAnexoMensagem | null;
  } | null;
};

export type AnexoDaMensagem = {
  tipo: TipoAnexoMensagem;
  nome: string;
  tamanho: number;
  caminho: string;
  miniaturaCaminho: string | null;
};

export type EntregaDaMensagem = "pendente" | "entregue" | "falha";

export type ResultadoRegistroRecebido = "registrada" | "duplicada" | "encerrada";

export type ResultadoRegistroDoFuncionario =
  { status: "registrada"; id: string } | { status: "encerrada" } | { status: "sem_autoridade" };

export type MensagemLida = {
  id: string;
  autor: "contato" | "ura" | "funcionario";
  texto: string;
  criadoEm: string;
  atendente: { nome: string; setor: SetorSlug } | null;
  idExterno: string | null;
  reacao: string | null;
  anexo: AnexoDaMensagem | null;
  entrega: EntregaDaMensagem;
};

export type MensagemParaReacao = {
  autor: "contato" | "ura" | "funcionario";
  idExterno: string | null;
  reacao: string | null;
};

export type ConversaLida = {
  id: string;
  status: "em_andamento" | "encerrado";
  setor: SetorSlug;
  funcionarioId: string | null;
  clienteId: string | null;
  telefone: string;
  contato: DadosDoContato;
  mensagens: MensagemLida[];
  temMaisAntigas: boolean;
  ultimaTransferencia: UltimaTransferencia | null;
  ura: OrigemUra | null;
};

export type MensagensAnteriores = {
  setor: SetorSlug;
  funcionarioId: string | null;
  mensagens: MensagemLida[];
  temMaisAntigas: boolean;
};

export type MensagensPorId = Omit<MensagensAnteriores, "temMaisAntigas">;

export interface AtendimentoRepositoryPort {
  abrir(atendimento: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
  anexarMensagem(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<AnexarMensagemOutput, AppError>>;
  buscarEmAndamento(id: string): Promise<Result<AtendimentoEmAndamento | null, AppError>>;
  atendimentoParaMidia(
    chave: string,
    idExterno: string | undefined,
  ): Promise<Result<{ atendimentoId: string; jaRegistrada: boolean } | null, AppError>>;
  registrarMensagemRecebida(
    atendimentoId: string,
    mensagem: {
      autor: "contato" | "ura";
      texto: string;
      idExterno?: string;
      anexo?: AnexoDaMensagem;
    },
  ): Promise<Result<ResultadoRegistroRecebido, AppError>>;
  roteamentoDoCliente(
    clienteId: string,
    setorDestino?: SetorSlug,
  ): Promise<Result<RoteamentoDoCliente | null, AppError>>;
  liderDoSetor(setor: SetorSlug): Promise<Result<string | null, AppError>>;
  transferir(transferencia: NovaTransferencia): Promise<Result<ResultadoTransferencia, AppError>>;
  assumir(atendimentoId: string, atorId: string): Promise<Result<ResultadoAssuncao, AppError>>;
  filaDoSetor(setor: SetorSlug): Promise<Result<ItemDaFila[], AppError>>;
  encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>>;
  encerrarSemRespostaDoCliente(corte: Date, ator: string): Promise<Result<number, AppError>>;
  emAndamentoDoFuncionario(
    funcionarioId: string,
  ): Promise<Result<AtendimentoDoFuncionario[], AppError>>;
  emAndamentoDoSetor(setor: SetorSlug): Promise<Result<AtendimentoDoFuncionario[], AppError>>;
  conversa(atendimentoId: string): Promise<Result<ConversaLida | null, AppError>>;
  mensagensAnteriores(
    atendimentoId: string,
    antes: CursorDaConversa,
    limite: number,
  ): Promise<Result<MensagensAnteriores | null, AppError>>;
  mensagensPorId(
    atendimentoId: string,
    ids: string[],
  ): Promise<Result<MensagensPorId | null, AppError>>;
  registrarMensagemDoFuncionario(
    atendimentoId: string,
    ator: { id: string },
    texto: string,
    anexo?: AnexoDaMensagem,
  ): Promise<Result<ResultadoRegistroDoFuncionario, AppError>>;
  finalizarEntregaDoFuncionario(
    mensagemId: string,
    entregue: boolean,
  ): Promise<Result<void, AppError>>;
  mensagemParaReacao(
    atendimentoId: string,
    mensagemId: string,
  ): Promise<Result<MensagemParaReacao | null, AppError>>;
  registrarReacao(
    atendimentoId: string,
    mensagemId: string,
    reacao: string | null,
  ): Promise<Result<void, AppError>>;
}
