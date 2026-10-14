import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  EntregarComunicacaoPorCanaisPort,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  ExecutarLembretesDocumentoEDasPort,
  LembretesExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type { ObterGuiaDasParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type {
  AlertaSetorPort,
  TipoAlertaSetor,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { diaDoMes, hojeIso } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];

// Diferença tolerada entre o relógio do servidor e o do banco ao resolver alertas.
const FOLGA_RELOGIO_MS = 60_000;

// O que aconteceu com uma das duas tarefas do Cliente (lembrete ou guia).
type Andamento = { enviado: boolean; ocorrencias: OcorrenciaDeEntrega[] };

const SEM_ANDAMENTO: Andamento = { enviado: false, ocorrencias: [] };

const falha = (mensagem: string): Andamento => ({
  enviado: false,
  ocorrencias: [{ tipo: "falha_envio", mensagem }],
});

const nomeDoContato = (cliente: ClienteParaLembrete) => cliente.contato?.nome ?? cliente.empresa;

const temDestinatario = (cliente: ClienteParaLembrete) =>
  (formaEnvioUsaWhatsapp(cliente.formaEnvio) && cliente.contato !== null) ||
  (formaEnvioUsaEmail(cliente.formaEnvio) && cliente.email !== null);

// Um alerta por tipo e Cliente: as mensagens do mesmo tipo (ex.: falha do lembrete e da guia) se
// juntam, em vez de a segunda ser descartada.
function agruparPorTipo(ocorrencias: OcorrenciaDeEntrega[]): Map<TipoAlertaSetor, string[]> {
  const porTipo = new Map<TipoAlertaSetor, string[]>();
  for (const { tipo, mensagem } of ocorrencias) {
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), mensagem]);
  }
  return porTipo;
}

// Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório,
// envia o DAS pronto pela forma de envio do Cliente e alerta o setor Simples Nacional do DAS que
// segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os
// demais. A guia é reivindicada (pronto → enviado, atômico) antes da entrega e devolvida se ela
// falhar: execuções simultâneas ou o Funcionário não geram envio em dobro.
// ponytail: processo que cai entre reivindicar e entregar deixa o DAS como enviado sem a guia ter
// saído; a auditoria da URA mostra o que houve. Lease com retomada se isso doer.
export class ExecutarLembretesDocumentoEDas implements ExecutarLembretesDocumentoEDasPort {
  constructor(
    private readonly clientes: ClientesParaLembretePort,
    private readonly guiaDas: ObterGuiaDasParaEnvioPort,
    private readonly entrega: EntregarComunicacaoPorCanaisPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<LembretesExecutados, AppError>> {
    const agora = this.relogio.agora();
    const resumo: LembretesExecutados = {
      executado: DIAS_DO_JOB.includes(diaDoMes(agora)),
      lembretes: 0,
      dasEnviados: 0,
      alertas: 0,
      falhas: 0,
    };
    if (!resumo.executado) return ok(resumo);

    const clientes = await this.clientes.listar();
    if (!clientes.ok) return clientes;

    let alertasNaoGravados = 0;
    for (const cliente of clientes.value) {
      const feito = await this.processar(cliente, agora);
      resumo.lembretes += Number(feito.lembrete.enviado);
      resumo.dasEnviados += Number(feito.das.enviado);
      const ocorrencias = [...feito.lembrete.ocorrencias, ...feito.das.ocorrencias];
      resumo.falhas += ocorrencias.filter((o) => o.tipo === "falha_envio").length;

      const gravacao = await this.levantarAlertas(cliente, ocorrencias);
      resumo.alertas += gravacao.gravados;
      alertasNaoGravados += gravacao.naoGravados;
    }
    resumo.falhas += alertasNaoGravados;

    // Alerta que o job não renovou nesta rodada deixou de valer. Com alerta que não pôde ser
    // gravado a rodada não sabe o que renovou, então não resolve nada.
    if (alertasNaoGravados === 0) {
      const folga = new Date(agora.getTime() - FOLGA_RELOGIO_MS);
      const resolvidos = await this.alertas.resolverNaoRenovados(folga);
      if (!resolvidos.ok) resumo.falhas += 1;
    }
    return ok(resumo);
  }

  private async processar(cliente: ClienteParaLembrete, agora: Date) {
    const lembrete =
      cliente.documentoObrigatorio === "negativo"
        ? await this.lembrar(cliente, agora)
        : SEM_ANDAMENTO;
    const das =
      cliente.dasStatus === "pronto"
        ? await this.enviarDas(cliente, agora)
        : { enviado: false, ocorrencias: this.dasPendente(cliente) };
    return { lembrete, das };
  }

  private dasPendente(cliente: ClienteParaLembrete): OcorrenciaDeEntrega[] {
    if (cliente.dasStatus !== "pendente" || cliente.documentoObrigatorio !== "positivo") return [];
    return [
      {
        tipo: "das_pendente",
        mensagem: `DAS de ${cliente.empresa} segue pendente com o documento obrigatório em dia.`,
      },
    ];
  }

  private async lembrar(cliente: ClienteParaLembrete, agora: Date): Promise<Andamento> {
    const comunicacao: ComunicacaoProativa = {
      tipo: "lembrete_documento_obrigatorio",
      contato: nomeDoContato(cliente),
      empresa: cliente.empresa,
    };
    return this.entregar(cliente, comunicacao, agora);
  }

  private async enviarDas(cliente: ClienteParaLembrete, agora: Date): Promise<Andamento> {
    // Sem para quem enviar não vale buscar a guia nem reivindicar o DAS.
    if (!temDestinatario(cliente)) {
      return {
        enviado: false,
        ocorrencias: [
          {
            tipo: "contato_ausente",
            mensagem: `${cliente.empresa} não tem contato nem e-mail para a forma de envio.`,
          },
        ],
      };
    }
    const reivindicado = await this.clientes.reivindicarDas(cliente.clienteId, hojeIso(agora));
    if (!reivindicado.ok) {
      return falha(`DAS de ${cliente.empresa}: ${reivindicado.error.message}`);
    }
    // Outro job ou o Funcionário já tratou o DAS: quem não reivindicou não envia.
    if (!reivindicado.value) return SEM_ANDAMENTO;

    const entrega = await this.entregarGuia(cliente, agora);
    if (entrega.enviado) return entrega;

    const desfeito = await this.clientes.desfazerDas(cliente.clienteId, cliente.dataEnvioDas);
    if (desfeito.ok) return entrega;
    const naoVoltou = `DAS de ${cliente.empresa} não voltou a pronto após a falha: ${desfeito.error.message}`;
    return {
      enviado: false,
      ocorrencias: [...entrega.ocorrencias, ...falha(naoVoltou).ocorrencias],
    };
  }

  private async entregarGuia(cliente: ClienteParaLembrete, agora: Date): Promise<Andamento> {
    const guia = await this.guiaDas.execute(cliente.clienteId);
    if (!guia.ok) return falha(`DAS de ${cliente.empresa}: ${guia.error.message}`);
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_das",
      contato: nomeDoContato(cliente),
      empresa: cliente.empresa,
      ...guia.value,
    };
    return this.entregar(cliente, comunicacao, agora);
  }

  private async entregar(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    agora: Date,
  ): Promise<Andamento> {
    const entrega = await this.entrega.execute({ cliente, comunicacao, agora });
    if (!entrega.ok) return falha(`${cliente.empresa}: ${entrega.error.message}`);
    return { enviado: entrega.value.entregues > 0, ocorrencias: entrega.value.ocorrencias };
  }

  private async levantarAlertas(cliente: ClienteParaLembrete, ocorrencias: OcorrenciaDeEntrega[]) {
    let gravados = 0;
    let naoGravados = 0;
    for (const [tipo, mensagens] of agruparPorTipo(ocorrencias)) {
      const gravado = await this.alertas.alertar({
        setor: "simples_nacional",
        tipo,
        clienteId: cliente.clienteId,
        mensagem: mensagens.join(" | "),
      });
      if (gravado.ok) gravados += 1;
      else naoGravados += 1;
    }
    return { gravados, naoGravados };
  }
}
