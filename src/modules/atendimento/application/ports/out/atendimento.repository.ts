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
  // Dono do Atendimento quando foi lido: se mudou até a gravação, a Transferência é recusada.
  origemFuncionarioId: string | null;
  // Setor em que o Atendimento estava quando foi lido: se mudou até a gravação, é recusada.
  setorOrigem: SetorSlug;
  setorDestino: SetorSlug;
  // Espera dirigida (Simples Nacional: Responsável ou Líder); null = espera do Setor.
  dirigidoA: string | null;
  resumo: string;
  ator: { id: string; setor: SetorSlug };
};

// "conflito": o destinatário dirigido deixou de ser elegível (outro Setor, desativado).
// "inexistente": o Atendimento não está mais em andamento com o dono lido.
export type ResultadoTransferencia =
  | {
      status: "transferido";
      destinatarioNome: string | null;
      origemNome: string | null;
      contato: DadosDoContato;
    }
  | { status: "conflito" }
  | { status: "inexistente" };

// "inexistente": não está em andamento com esse dono.
export type ResultadoEncerramento = { status: "encerrado" } | { status: "inexistente" };

// "inelegivel": o ator está desativado ou é de outro Setor. "ja_assumido": outro clique venceu.
// "inexistente": o Atendimento não existe ou já terminou.
export type ResultadoAssuncao =
  | { status: "assumido" }
  | { status: "inelegivel" }
  | { status: "ja_assumido" }
  | { status: "inexistente" };

// Regime do Cliente e Responsável dele no Setor de destino, para decidir a Transferência.
export type RoteamentoDoCliente = { regime: RegimeValor; responsavelId: string | null };

// Atendimento sem Funcionário: espera do Setor (`filaFuncionarioId` null) ou dirigida a um usuário.
// `filaDesde` ordena a espera (mais antigo primeiro).
export type ItemDaFila = {
  id: string;
  filaFuncionarioId: string | null;
  filaDesde: Date;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
  // De onde veio, se foi transferido; `nome` null quando o Funcionário de origem não existe mais.
  origem: { setor: SetorSlug; nome: string | null } | null;
};

// Atendimento em andamento de um Funcionário, para a lista dele (painel do Funcionário).
export type AtendimentoDoFuncionario = {
  id: string;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  telefone: string;
  criadoEm: string;
  contato: DadosDoContato;
  // A mensagem mais recente da conversa (null se ainda não há), para o dock avisar de novidade.
  ultimaMensagem: {
    autor: "contato" | "ura" | "funcionario";
    texto: string;
    criadoEm: string;
    anexoTipo: TipoAnexoMensagem | null;
  } | null;
};

// Quem escreveu uma Mensagem do Funcionário (nome e Setor atuais do perfil); null nas do contato
// e da URA.
export type AnexoDaMensagem = {
  tipo: TipoAnexoMensagem;
  nome: string;
  tamanho: number;
  caminho: string;
  // Só imagem: versão reduzida que a conversa mostra.
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
  // Só a Mensagem de Funcionário nasce `pendente`; do contato e da URA é sempre `entregue`.
  entrega: EntregaDaMensagem;
};

// A Mensagem sobre a qual o Funcionário quer reagir.
export type MensagemParaReacao = {
  autor: "contato" | "ura" | "funcionario";
  idExterno: string | null;
  reacao: string | null;
};

// O Atendimento em qualquer status, com as Mensagens mais recentes (a janela) da mais antiga à mais
// nova. `temMaisAntigas`: há histórico antes da primeira.
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

// Uma página do histórico anterior ao cursor, com o que decide quem pode vê-la.
export type MensagensAnteriores = {
  setor: SetorSlug;
  funcionarioId: string | null;
  mensagens: MensagemLida[];
  temMaisAntigas: boolean;
};

// Mensagens pedidas por id (renovação de links), com o que decide quem pode vê-las.
export type MensagensPorId = Omit<MensagensAnteriores, "temMaisAntigas">;

export interface AtendimentoRepositoryPort {
  abrir(atendimento: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
  anexarMensagem(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<AnexarMensagemOutput, AppError>>;
  buscarEmAndamento(id: string): Promise<Result<AtendimentoEmAndamento | null, AppError>>;
  // O Atendimento em andamento do número e se a Mensagem do provedor `idExterno` já está nele
  // (reentrega); null se o número não tem Atendimento em andamento.
  atendimentoParaMidia(
    chave: string,
    idExterno: string | undefined,
  ): Promise<Result<{ atendimentoId: string; jaRegistrada: boolean } | null, AppError>>;
  // Mensagem do contato (ou aviso do sistema, autor "ura") no Atendimento, sob o lock da linha: o
  // fechamento que vence deixa o Atendimento `encerrada` e nada é gravado. `duplicada`: já existia
  // uma com o mesmo `idExterno` (reentrega que correu em paralelo). Quem guardou um objeto antes
  // descarta-o quando a Mensagem não entrou.
  registrarMensagemRecebida(
    atendimentoId: string,
    mensagem: {
      autor: "contato" | "ura";
      texto: string;
      idExterno?: string;
      anexo?: AnexoDaMensagem;
    },
  ): Promise<Result<ResultadoRegistroRecebido, AppError>>;
  // `responsavelId` é o do Setor informado (null sem Setor, sem atribuição ou desativado).
  roteamentoDoCliente(
    clienteId: string,
    setorDestino?: SetorSlug,
  ): Promise<Result<RoteamentoDoCliente | null, AppError>>;
  liderDoSetor(setor: SetorSlug): Promise<Result<string | null, AppError>>;
  transferir(transferencia: NovaTransferencia): Promise<Result<ResultadoTransferencia, AppError>>;
  // Assume o Atendimento da espera do Setor para o ator, atômico: o primeiro vence. Grava o evento
  // de assunção e a auditoria na mesma transação.
  assumir(atendimentoId: string, atorId: string): Promise<Result<ResultadoAssuncao, AppError>>;
  filaDoSetor(setor: SetorSlug): Promise<Result<ItemDaFila[], AppError>>;
  // `funcionarioId` null = Atendimento em espera.
  encerrar(
    atendimentoId: string,
    funcionarioId: string | null,
    ator: { id: string; setor: SetorSlug },
  ): Promise<Result<ResultadoEncerramento, AppError>>;
  // Encerra, com `ator` na auditoria, os Atendimentos com Funcionário cuja última Mensagem do
  // cliente é de `corte` ou anterior (a do Funcionário não conta). Devolve quantos encerrou.
  encerrarSemRespostaDoCliente(corte: Date, ator: string): Promise<Result<number, AppError>>;
  emAndamentoDoFuncionario(
    funcionarioId: string,
  ): Promise<Result<AtendimentoDoFuncionario[], AppError>>;
  // Em atendimento (com dono) no Setor, de qualquer dono: a leitura de supervisão do Líder/Admin.
  emAndamentoDoSetor(setor: SetorSlug): Promise<Result<AtendimentoDoFuncionario[], AppError>>;
  conversa(atendimentoId: string): Promise<Result<ConversaLida | null, AppError>>;
  // Até `limite` Mensagens estritamente anteriores a `antes`, da mais antiga à mais nova; null se o
  // Atendimento não existe.
  mensagensAnteriores(
    atendimentoId: string,
    antes: CursorDaConversa,
    limite: number,
  ): Promise<Result<MensagensAnteriores | null, AppError>>;
  // Só as Mensagens pedidas que pertencem ao Atendimento (qualquer outro id é ignorado); null se o
  // Atendimento não existe.
  mensagensPorId(
    atendimentoId: string,
    ids: string[],
  ): Promise<Result<MensagensPorId | null, AppError>>;
  // Mensagem escrita por um Funcionário (autor "funcionario") no Atendimento, com quem a escreveu.
  // Com `anexo`, `texto` é a legenda (pode ser vazia). Grava sob o lock da linha e revalida a
  // autoridade do ator no perfil REAL, no mesmo instante (ativo; dono, Líder do Setor ou Admin): o
  // fechamento, a transferência, a desativação ou a perda do papel que vencem a corrida viram
  // `encerrada`/`sem_autoridade`. A intenção é gravada `pendente` ANTES da entrega ao provedor
  // (sem transação aberta durante o HTTP) e fechada por `finalizarEntregaDoFuncionario`: ela nunca
  // é apagada.
  registrarMensagemDoFuncionario(
    atendimentoId: string,
    ator: { id: string },
    texto: string,
    anexo?: AnexoDaMensagem,
  ): Promise<Result<ResultadoRegistroDoFuncionario, AppError>>;
  // `entregue`: o adapter aceitou; senão `falha`. Só sai de `pendente` (idempotente).
  finalizarEntregaDoFuncionario(
    mensagemId: string,
    entregue: boolean,
  ): Promise<Result<void, AppError>>;
  // null se a Mensagem não existe neste Atendimento.
  mensagemParaReacao(
    atendimentoId: string,
    mensagemId: string,
  ): Promise<Result<MensagemParaReacao | null, AppError>>;
  // null remove a reação.
  registrarReacao(
    atendimentoId: string,
    mensagemId: string,
    reacao: string | null,
  ): Promise<Result<void, AppError>>;
}
