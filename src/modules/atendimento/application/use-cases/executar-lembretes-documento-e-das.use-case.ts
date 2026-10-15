import {
  temDestinatario,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  EntregarComunicacaoPorCanaisPort,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  ExecutarLembretesDocumentoEDasPort,
  LembretesExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type { ObterGuiaDasParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import {
  entregarReivindicando,
  executarRodada,
  falha,
  paraAndamento,
  SEM_ANDAMENTO,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/use-cases/alertas-da-rodada";
import type { AppError } from "@/shared/errors/app.error";
import { diaDoMes, hojeIso } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];

const nomeDoContato = (cliente: ClienteParaLembrete) => cliente.contato?.nome ?? cliente.empresa;

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

    const rodada = await executarRodada(this.alertas, agora, clientes.value, (cliente) =>
      this.processar(cliente, agora),
    );
    return ok({
      ...resumo,
      lembretes: rodada.andamentos.filter(([lembrete]) => lembrete.enviado).length,
      dasEnviados: rodada.andamentos.filter(([, das]) => das.enviado).length,
      alertas: rodada.alertas,
      falhas: rodada.falhas,
    });
  }

  private async processar(cliente: ClienteParaLembrete, agora: Date): Promise<Andamento[]> {
    const lembrete =
      cliente.documentoObrigatorio === "negativo"
        ? await this.lembrar(cliente, agora)
        : SEM_ANDAMENTO;
    const das =
      cliente.dasStatus === "pronto"
        ? await this.enviarDas(cliente, agora)
        : { enviado: false, ocorrencias: this.dasPendente(cliente) };
    return [lembrete, das];
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
    if (!temDestinatario(cliente)) return semDestinatario(cliente.empresa);
    return entregarReivindicando(
      {
        reivindicar: () => this.clientes.reivindicarDas(cliente.clienteId, hojeIso(agora)),
        entregar: () => this.entregarGuia(cliente, agora),
        desfazer: () => this.clientes.desfazerDas(cliente.clienteId, cliente.dataEnvioDas),
      },
      "DAS",
      cliente.empresa,
      "pronto",
    );
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
    return paraAndamento(
      await this.entrega.execute({ cliente, comunicacao, agora }),
      cliente.empresa,
    );
  }
}
