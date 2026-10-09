import type {
  AberturaAtendimento,
  NovaMensagem,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemOutput } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { UltimaTransferencia } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { Inativo } from "@/modules/atendimento/domain/services/inatividade.service";
import type { AppError } from "@/shared/errors/app.error";
import type { RegimeValor } from "@/shared/kernel/regimes";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type FuncionarioDoSetor = { id: string; atendimentosNoMes: number; livre: boolean };

// "aberto": `funcionarioId` é quem ficou com o Atendimento (null = Fila). Pode não ser o escolhido
// por quem chamou: sem escolhido e sem ninguém na frente, um Funcionário liberado no meio é assumido.
// "conflito": o Funcionário escolhido foi ocupado por outro Atendimento no meio (concorrência) ou
// deixou de ser elegível (outro Setor, desativado); nada é gravado e quem chama escolhe de novo.
// "aberto" traz também `promovido`: o cliente mais antigo da Fila que assumiu o Funcionário escolhido
// antes do recém-chegado (que, nesse caso, entrou na Fila: `funcionarioId` null).
export type ResultadoAbertura =
  | {
      status: "aberto";
      id: string;
      funcionarioId: string | null;
      promovido: AtendimentoAssumido | null;
    }
  | { status: "conflito" };

// `atribuirLivreSeVazia`: sem Funcionário escolhido e sem Fila, o banco entrega o Atendimento a um
// Funcionário livre do Setor (liberado depois da listagem de quem chama) em vez de enfileirar.
export type NovoAtendimento = AberturaAtendimento & {
  funcionarioId: string | null;
  atribuirLivreSeVazia?: boolean;
};

export type AtendimentoEmAndamento = {
  id: string;
  clienteId: string | null;
  setor: SetorSlug;
  funcionarioId: string | null;
  telefone: string;
  chave: string;
  // O aviso de encerramento por inatividade foi enviado e ainda vale: não se transfere.
  emAvisoDeInatividade: boolean;
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
  // Como em `NovoAtendimento`: vale só sem destino escolhido.
  atribuirLivreSeVazia?: boolean;
  resumo: string;
  ator: { id: string; setor: SetorSlug };
};

// "conflito": o Funcionário de destino foi ocupado no meio (como em ResultadoAbertura).
// "inexistente": o Atendimento não está mais em andamento com o dono lido.
export type ResultadoTransferencia =
  | {
      status: "transferido";
      naFila: boolean;
      // O Funcionário de origem ficou livre e assumiu o próximo da Fila do Setor dele.
      proximoDaOrigem: AtendimentoAssumido | null;
      // O mais antigo da Fila do destino, que assumiu o destino antes do transferido.
      promovidoNoDestino: AtendimentoAssumido | null;
      destinatarioNome: string | null;
      origemNome: string | null;
      contato: DadosDoContato;
    }
  | { status: "conflito" }
  | { status: "inexistente" };

// "inexistente": não está em andamento com esse dono. "encerrado": `proximo` é o Atendimento que o
// Funcionário liberado assumiu da Fila.
export type ResultadoEncerramento =
  { status: "encerrado"; proximo: AtendimentoAssumido | null } | { status: "inexistente" };

// Regime e Responsável do Cliente, para decidir a Transferência ao Simples Nacional.
export type RoteamentoDoCliente = { regime: RegimeValor; responsavelId: string | null };

// Atendimento sem Funcionário: fila do Setor (`filaFuncionarioId` null) ou de um usuário (destino
// fixo ocupado). `filaDesde` ordena a saída (mais antigo primeiro).
export type ItemDaFila = {
  id: string;
  // 1 = próximo da Fila em que está (a do Setor ou a de um usuário).
  posicao: number;
  filaFuncionarioId: string | null;
  filaDesde: Date;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
};

// O Atendimento que um Funcionário liberado assumiu da Fila.
export type AtendimentoAssumido = {
  id: string;
  telefone: string;
  chave: string;
  funcionarioNome: string | null;
};

// Atendimento em andamento com Funcionário, com o que a verificação de inatividade precisa:
// quando cada lado escreveu pela última vez e o aviso de encerramento já enviado (se houver).
export type AtendimentoParaInatividade = {
  id: string;
  setor: SetorSlug;
  funcionarioId: string;
  telefone: string;
  chave: string;
  ultimaDoContato: Date | null;
  ultimaDoFuncionario: Date | null;
  aviso: { em: Date; de: Inativo } | null;
  // O aviso chegou a quem estava inativo (o do cliente só depois de enviado).
  avisoEntregue: boolean;
};

// Encerramento por inatividade cuja mensagem final ainda não foi entregue ao cliente.
// `reivindicacao` é o token de posse: só quem o detém libera ou confirma.
export type EncerramentoPendente = {
  atendimentoId: string;
  telefone: string;
  texto: string;
  reivindicacao: string;
};

// Encerrado por inatividade: já nasce com a reivindicação da própria mensagem final.
export type ResultadoEncerramentoPorInatividade =
  | { status: "encerrado"; proximo: AtendimentoAssumido | null; reivindicacao: string }
  | { status: "inexistente" };
// Atendimento em andamento de um Funcionário, para a lista dele (painel do Funcionário, #49).
export type AtendimentoDoFuncionario = {
  id: string;
  telefone: string;
  criadoEm: string;
  contato: DadosDoContato;
  // A mensagem mais recente da conversa (null se ainda não há), para o dock avisar de novidade.
  ultimaMensagem: {
    autor: "contato" | "ura" | "funcionario";
    texto: string;
    criadoEm: string;
  } | null;
};

// Quem escreveu uma Mensagem do Funcionário (nome e Setor atuais do perfil); null nas do contato
// e da URA.
export type MensagemLida = {
  id: string;
  autor: "contato" | "ura" | "funcionario";
  texto: string;
  criadoEm: string;
  atendente: { nome: string; setor: SetorSlug } | null;
};

// O Atendimento inteiro, em qualquer status, com as Mensagens da mais antiga à mais nova.
export type ConversaLida = {
  id: string;
  status: "em_andamento" | "encerrado";
  setor: SetorSlug;
  funcionarioId: string | null;
  clienteId: string | null;
  telefone: string;
  contato: DadosDoContato;
  mensagens: MensagemLida[];
  ultimaTransferencia: UltimaTransferencia | null;
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
  // `funcionarioId` null = Atendimento da Fila. Libera o Funcionário pro mais antigo da Fila dele,
  // na mesma operação (nada fura a Fila entre uma coisa e outra).
  encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>>;
  // Como `encerrar`, mas só se o aviso de inatividade foi entregue e continua marcado, e quem
  // estava inativo não escreveu depois dele (a Mensagem que chega e o encerramento se serializam).
  // A mensagem final da URA (`textoFinal`) entra no histórico na mesma transação que fecha.
  encerrarPorInatividade(
    atendimentoId: string,
    funcionarioId: string,
    ator: { id: string; setor: SetorSlug },
    textoFinal: string,
  ): Promise<Result<ResultadoEncerramentoPorInatividade, AppError>>;
  paraInatividade(): Promise<Result<AtendimentoParaInatividade[], AppError>>;
  // Reserva o aviso: true só se este chamador marcou. false se já estava marcado ou se entrou
  // Mensagem depois de `vistoAte` (a decisão é de uma leitura velha; a próxima rodada reavalia).
  marcarAvisoInatividade(
    atendimentoId: string,
    de: Inativo,
    vistoAte: Date,
  ): Promise<Result<boolean, AppError>>;
  // O aviso ao cliente saiu. false se o aviso já não existe.
  confirmarAvisoEntregue(atendimentoId: string): Promise<Result<boolean, AppError>>;
  limparAvisoInatividade(atendimentoId: string): Promise<Result<void, AppError>>;
  // Reivindica até `limite` mensagens finais não entregues: um job por vez (lease no banco; vencido,
  // volta a ser elegível). Nunca tentadas primeiro, depois a tentativa mais antiga; quem falha espera
  // um backoff crescente. Quem reivindica entrega e confirma, ou libera se o envio falhou, sempre
  // com o token da reivindicação (um job cujo lease venceu não altera a posse de outro).
  reivindicarEncerramentosPendentes(
    limite: number,
  ): Promise<Result<EncerramentoPendente[], AppError>>;
  liberarEncerramentoPendente(
    atendimentoId: string,
    reivindicacao: string,
  ): Promise<Result<void, AppError>>;
  // false se a posse já não é de quem confirma.
  confirmarEncerramentoEntregue(
    atendimentoId: string,
    reivindicacao: string,
  ): Promise<Result<boolean, AppError>>;
  emAndamentoDoFuncionario(
    funcionarioId: string,
  ): Promise<Result<AtendimentoDoFuncionario[], AppError>>;
  conversa(atendimentoId: string): Promise<Result<ConversaLida | null, AppError>>;
  // Mensagem escrita por um Funcionário (autor "funcionario") no Atendimento, com quem a escreveu.
  registrarMensagemDoFuncionario(
    atendimentoId: string,
    funcionarioId: string,
    texto: string,
  ): Promise<Result<void, AppError>>;
}
