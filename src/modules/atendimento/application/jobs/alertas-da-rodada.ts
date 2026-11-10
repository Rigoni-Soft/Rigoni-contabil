import type {
  ComunicacaoEntregue,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  AlertaSetorPort,
  TipoAlertaSetor,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import { SETOR_SN, type SetorSlug } from "@/shared/kernel/setores";

// Diferença tolerada entre o relógio do servidor e o do banco ao resolver alertas.
const FOLGA_RELOGIO_MS = 60_000;

// O que aconteceu com uma tarefa do Cliente numa rodada de job: se saiu e o que o setor precisa
// saber.
// `naoReavaliado`: a tarefa não pôde ser reavaliada nesta rodada (outra tentativa vigente a tem
// reservada, resultado ainda incerto). Quem tem isso não entra na resolução de alertas: um alerta
// anterior só se resolve depois de a condição ser de fato reavaliada.
export type Andamento = {
  enviado: boolean;
  ocorrencias: OcorrenciaDeEntrega[];
  naoReavaliado?: true;
};

export const SEM_ANDAMENTO: Andamento = { enviado: false, ocorrencias: [] };

// Reserva ocupada: a tarefa existe e segue com a tentativa de antes, sem ocorrência nova.
export const RESERVA_OCUPADA: Andamento = {
  enviado: false,
  ocorrencias: [],
  naoReavaliado: true,
};

export const comOcorrencia = (tipo: TipoAlertaSetor, mensagem: string): Andamento => ({
  enviado: false,
  ocorrencias: [{ tipo, mensagem }],
});

// A ocorrência sem setor passa a ser do `setor` dado (a que já tem setor o mantém).
export const noSetor = (andamento: Andamento, setor: SetorSlug): Andamento => ({
  ...andamento,
  ocorrencias: andamento.ocorrencias.map((o) => ({ ...o, setor: o.setor ?? setor })),
});

export const falha = (mensagem: string) => comOcorrencia("falha_envio", mensagem);

// Sem para quem enviar não vale buscar a guia nem reivindicar a tarefa.
export const semDestinatario = (empresa: string) =>
  comOcorrencia("contato_ausente", `${empresa} não tem contato nem e-mail para a forma de envio.`);

type Etapas = {
  // "DAS de 3A": a tarefa do Cliente, para as mensagens.
  descricao: string;
  // Reserva a entrega e devolve o token da tentativa; null se outra tentativa vigente já a tem ou o
  // cadastro deixou de estar elegível (outro job ou o Funcionário tratou a tarefa).
  reservar: () => Promise<Result<string | null, AppError>>;
  entregar: () => Promise<Andamento>;
  // Registra o aceite no cadastro, só com a posse da reserva. false: a posse se perdeu ou o
  // Funcionário já havia mexido.
  concluir: (token: string) => Promise<Result<boolean, AppError>>;
  // A entrega falhou sem aceite: devolve a reserva para a próxima rodada.
  liberar: (token: string) => Promise<Result<void, AppError>>;
};

// Reserva, entrega e só então conclui. O cadastro nunca afirma uma entrega que não ocorreu: queda ou
// exceção entre a reserva e a conclusão deixam o cadastro como estava e a reserva expira (retomada
// na rodada seguinte). Conclusão e liberação provam a posse pelo token: uma tentativa antiga não
// sobrescreve a mais recente. Resultado incerto (a entrega pode ter saído) não é liberado.
export async function entregarComReserva({
  descricao,
  reservar,
  entregar,
  concluir,
  liberar,
}: Etapas): Promise<Andamento> {
  const reserva = await reservar();
  if (!reserva.ok) return falha(`${descricao}: ${reserva.error.message}`);
  // Outra tentativa vigente (resultado ainda incerto) ou o cadastro deixou de estar elegível entre a
  // leitura e agora. Em nenhum dos dois casos a condição foi reavaliada aqui: não conta como
  // "regularizado" para os alertas; a rodada seguinte relê o Cliente e decide.
  if (reserva.value === null) return RESERVA_OCUPADA;
  const token = reserva.value;

  let entrega: Andamento;
  try {
    entrega = await entregar();
  } catch {
    return falha(
      `${descricao}: entrega interrompida com resultado incerto; a reserva expira e a próxima rodada retoma.`,
    );
  }

  if (!entrega.enviado) {
    const liberada = await liberar(token);
    if (liberada.ok) return entrega;
    const aviso = `${descricao}: a reserva não foi liberada (${liberada.error.message}); expira sozinha.`;
    return { enviado: false, ocorrencias: [...entrega.ocorrencias, ...falha(aviso).ocorrencias] };
  }

  const concluida = await concluir(token);
  if (concluida.ok && concluida.value) return entrega;
  const motivo = concluida.ok
    ? "a reserva foi substituída ou o cadastro já havia sido alterado"
    : concluida.error.message;
  const aviso = `${descricao}: entregue, mas o cadastro não foi atualizado (${motivo}).`;
  return { enviado: true, ocorrencias: [...entrega.ocorrencias, ...falha(aviso).ocorrencias] };
}

type ChaveDoAlerta = { setor: SetorSlug; tipo: TipoAlertaSetor };

// Um alerta por Setor e tipo do Cliente: as mensagens do mesmo setor e tipo (ex.: falha do lembrete
// e da guia) se juntam, em vez de a segunda ser descartada. Sem setor, o alerta é do Simples Nacional.
function agruparPorSetorETipo(
  ocorrencias: OcorrenciaDeEntrega[],
): { chave: ChaveDoAlerta; mensagens: string[] }[] {
  const grupos = new Map<string, { chave: ChaveDoAlerta; mensagens: string[] }>();
  for (const { tipo, mensagem, setor = SETOR_SN } of ocorrencias) {
    const id = `${setor}:${tipo}`;
    const grupo = grupos.get(id) ?? { chave: { setor, tipo }, mensagens: [] };
    grupo.mensagens.push(mensagem);
    grupos.set(id, grupo);
  }
  return [...grupos.values()];
}

// Grava as ocorrências do Cliente como alertas do Setor dono de cada uma.
async function levantarAlertas(
  alertas: AlertaSetorPort,
  clienteId: string,
  ocorrencias: OcorrenciaDeEntrega[],
): Promise<{ gravados: number; naoGravados: number }> {
  const grupos = agruparPorSetorETipo(ocorrencias);
  let gravados = 0;
  for (const { chave, mensagens } of grupos) {
    const gravado = await alertas.alertar({
      ...chave,
      clienteId,
      mensagem: mensagens.join(" | "),
    });
    gravados += Number(gravado.ok);
  }
  return { gravados, naoGravados: grupos.length - gravados };
}

// Alerta que o job não renovou nesta rodada deixou de valer, mas só para os Clientes que ela
// reavaliou: um Cliente não lido, ou com a tarefa reservada por outra tentativa, não teve a
// condição reavaliada. Com alerta que não pôde ser gravado a rodada não sabe o que renovou, então
// não resolve nada.
async function resolverNaoRenovados(
  alertas: AlertaSetorPort,
  agora: Date,
  clienteIds: string[],
  alertasNaoGravados: number,
): Promise<number> {
  if (alertasNaoGravados > 0 || clienteIds.length === 0) return 0;
  const resolvidos = await alertas.resolverNaoRenovados(
    new Date(agora.getTime() - FOLGA_RELOGIO_MS),
    clienteIds,
  );
  return resolvidos.ok ? 0 : 1;
}

// Processa cada Cliente em sequência (um que falha não impede os demais), grava os alertas das
// ocorrências dele e, ao fim, resolve os que a rodada não renovou entre os Clientes avaliados. `falhas` soma os envios que
// falharam e as gravações/resoluções de alerta que não foram feitas.
export async function executarRodada<C extends { clienteId: string }>(
  alertas: AlertaSetorPort,
  agora: Date,
  clientes: C[],
  processar: (cliente: C) => Promise<Andamento[]>,
): Promise<{ andamentos: Andamento[][]; alertas: number; falhas: number }> {
  const andamentos: Andamento[][] = [];
  let gravadosTotal = 0;
  let naoGravadosTotal = 0;
  let falhas = 0;
  for (const cliente of clientes) {
    // Um Cliente que lança não derruba os seguintes.
    const feito = await processar(cliente).catch(() => [
      falha(`Cliente ${cliente.clienteId}: erro inesperado ao processar a rodada.`),
    ]);
    andamentos.push(feito);
    const ocorrencias = feito.flatMap((a) => a.ocorrencias);
    falhas += ocorrencias.filter((o) => o.tipo === "falha_envio").length;
    const { gravados, naoGravados } = await levantarAlertas(
      alertas,
      cliente.clienteId,
      ocorrencias,
    );
    gravadosTotal += gravados;
    naoGravadosTotal += naoGravados;
  }
  // Só os Clientes cujas tarefas foram todas reavaliadas: um Cliente com reserva ocupada mantém os
  // alertas dele até a condição ser reavaliada (inclusive os da tarefa vizinha, que dividem o tipo).
  const avaliados = clientes
    .filter((_, i) => !andamentos[i].some((andamento) => andamento.naoReavaliado))
    .map((cliente) => cliente.clienteId);
  falhas +=
    naoGravadosTotal + (await resolverNaoRenovados(alertas, agora, avaliados, naoGravadosTotal));
  return { andamentos, alertas: gravadosTotal, falhas };
}

// O resultado da entrega por canais como andamento do Cliente.
export function paraAndamento(
  entrega: Result<ComunicacaoEntregue, AppError>,
  empresa: string,
): Andamento {
  if (!entrega.ok) return falha(`${empresa}: ${entrega.error.message}`);
  return { enviado: entrega.value.entregues > 0, ocorrencias: entrega.value.ocorrencias };
}
