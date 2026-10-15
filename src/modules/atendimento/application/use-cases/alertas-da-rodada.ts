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

// Diferença tolerada entre o relógio do servidor e o do banco ao resolver alertas.
const FOLGA_RELOGIO_MS = 60_000;

// O que aconteceu com uma tarefa do Cliente numa rodada de job: se saiu e o que o setor precisa
// saber.
export type Andamento = { enviado: boolean; ocorrencias: OcorrenciaDeEntrega[] };

export const SEM_ANDAMENTO: Andamento = { enviado: false, ocorrencias: [] };

export const falha = (mensagem: string): Andamento => ({
  enviado: false,
  ocorrencias: [{ tipo: "falha_envio", mensagem }],
});

// Sem para quem enviar não vale buscar a guia nem reivindicar a tarefa.
export const semDestinatario = (empresa: string): Andamento => ({
  enviado: false,
  ocorrencias: [
    {
      tipo: "contato_ausente",
      mensagem: `${empresa} não tem contato nem e-mail para a forma de envio.`,
    },
  ],
});

type Etapas = {
  reivindicar: () => Promise<Result<boolean, AppError>>;
  entregar: () => Promise<Andamento>;
  desfazer: () => Promise<Result<void, AppError>>;
};

// Reivindica a tarefa (atômico), entrega e, se a entrega falhar, devolve a tarefa ao estado
// original: quem não reivindicou não entrega, e a falha não deixa a tarefa como feita.
export async function entregarReivindicando(
  { reivindicar, entregar, desfazer }: Etapas,
  tarefa: string,
  empresa: string,
  estadoOriginal: string,
): Promise<Andamento> {
  const reivindicado = await reivindicar();
  if (!reivindicado.ok) return falha(`${tarefa} de ${empresa}: ${reivindicado.error.message}`);
  // Outro job ou o Funcionário já tratou a tarefa.
  if (!reivindicado.value) return SEM_ANDAMENTO;

  const entrega = await entregar();
  if (entrega.enviado) return entrega;

  const desfeito = await desfazer();
  if (desfeito.ok) return entrega;
  const naoVoltou = `${tarefa} de ${empresa} não voltou a ${estadoOriginal} após a falha: ${desfeito.error.message}`;
  return { enviado: false, ocorrencias: [...entrega.ocorrencias, ...falha(naoVoltou).ocorrencias] };
}

// Um alerta por tipo e Cliente: as mensagens do mesmo tipo (ex.: falha do lembrete e da guia) se
// juntam, em vez de a segunda ser descartada.
function agruparPorTipo(ocorrencias: OcorrenciaDeEntrega[]): Map<TipoAlertaSetor, string[]> {
  const porTipo = new Map<TipoAlertaSetor, string[]>();
  for (const { tipo, mensagem } of ocorrencias) {
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), mensagem]);
  }
  return porTipo;
}

// Grava as ocorrências do Cliente como alertas do setor Simples Nacional.
async function levantarAlertas(
  alertas: AlertaSetorPort,
  clienteId: string,
  ocorrencias: OcorrenciaDeEntrega[],
): Promise<{ gravados: number; naoGravados: number }> {
  let gravados = 0;
  let naoGravados = 0;
  for (const [tipo, mensagens] of agruparPorTipo(ocorrencias)) {
    const gravado = await alertas.alertar({
      setor: "simples_nacional",
      tipo,
      clienteId,
      mensagem: mensagens.join(" | "),
    });
    if (gravado.ok) gravados += 1;
    else naoGravados += 1;
  }
  return { gravados, naoGravados };
}

// Alerta que o job não renovou nesta rodada deixou de valer. Com alerta que não pôde ser gravado a
// rodada não sabe o que renovou, então não resolve nada.
async function resolverNaoRenovados(
  alertas: AlertaSetorPort,
  agora: Date,
  alertasNaoGravados: number,
): Promise<number> {
  if (alertasNaoGravados > 0) return 0;
  const resolvidos = await alertas.resolverNaoRenovados(
    new Date(agora.getTime() - FOLGA_RELOGIO_MS),
  );
  return resolvidos.ok ? 0 : 1;
}

// Processa cada Cliente em sequência (um que falha não impede os demais), grava os alertas das
// ocorrências dele e, ao fim, resolve os que a rodada não renovou. `falhas` soma os envios que
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
    const feito = await processar(cliente);
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
  falhas += naoGravadosTotal + (await resolverNaoRenovados(alertas, agora, naoGravadosTotal));
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
