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
import { SETOR_LABEL, SETOR_SN, type SetorSlug } from "@/shared/kernel/setores";
import type { TipoDeEnvio } from "@/shared/kernel/tipo-de-envio";

const ROTULO_DO_ENVIO: Record<TipoDeEnvio, string> = {
  lembrete_documento: "o lembrete de documento",
  das: "o DAS",
  guia_parcelamento: "a guia de parcelamento",
};

const FOLGA_RELOGIO_MS = 60_000;

export type Andamento = {
  enviado: boolean;
  ocorrencias: OcorrenciaDeEntrega[];
  naoReavaliado?: true;
};

export const SEM_ANDAMENTO: Andamento = { enviado: false, ocorrencias: [] };

const RESERVA_OCUPADA: Andamento = {
  enviado: false,
  ocorrencias: [],
  naoReavaliado: true,
};

export const comOcorrencia = (tipo: TipoAlertaSetor, mensagem: string): Andamento => ({
  enviado: false,
  ocorrencias: [{ tipo, mensagem }],
});

export const noSetor = (andamento: Andamento, setor: SetorSlug): Andamento => ({
  ...andamento,
  ocorrencias: andamento.ocorrencias.map((o) => ({ ...o, setor: o.setor ?? setor })),
});

export const falha = (mensagem: string) => comOcorrencia("falha_envio", mensagem);

export const semDestinatario = (empresa: string, setor: SetorSlug, tipo: TipoDeEnvio) =>
  noSetor(
    comOcorrencia(
      "contato_ausente",
      `${empresa}: sem meio de envio para ${ROTULO_DO_ENVIO[tipo]} (${SETOR_LABEL[setor]})`,
    ),
    setor,
  );

type Etapas = {
  descricao: string;
  reservar: () => Promise<Result<string | null, AppError>>;
  entregar: () => Promise<Andamento>;
  concluir: (token: string) => Promise<Result<boolean, AppError>>;
  liberar: (token: string) => Promise<Result<void, AppError>>;
};

export async function entregarComReserva({
  descricao,
  reservar,
  entregar,
  concluir,
  liberar,
}: Etapas): Promise<Andamento> {
  const reserva = await reservar();
  if (!reserva.ok) return falha(`${descricao}: ${reserva.error.message}`);
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
  const avaliados = clientes
    .filter((_, i) => !andamentos[i].some((andamento) => andamento.naoReavaliado))
    .map((cliente) => cliente.clienteId);
  falhas +=
    naoGravadosTotal + (await resolverNaoRenovados(alertas, agora, avaliados, naoGravadosTotal));
  return { andamentos, alertas: gravadosTotal, falhas };
}

export function paraAndamento(
  entrega: Result<ComunicacaoEntregue, AppError>,
  empresa: string,
): Andamento {
  if (!entrega.ok) return falha(`${empresa}: ${entrega.error.message}`);
  return { enviado: entrega.value.entregues > 0, ocorrencias: entrega.value.ocorrencias };
}
