import {
  entregarComReserva,
  executarRodada,
  falha,
  paraAndamento,
  SEM_ANDAMENTO,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
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
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { temDestinatario } from "@/shared/kernel/forma-envio";
import { diaDoMes, hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];

const nomeDoContato = (cliente: ClienteParaLembrete) => cliente.contato?.nome ?? cliente.empresa;

// Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório,
// envia o DAS pronto pela forma de envio do Cliente e alerta o setor Simples Nacional do DAS que
// segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os
// demais. A entrega é reservada (token, com validade) antes de sair e o DAS só vira enviado ao
// concluir, depois do aceite: execuções simultâneas ou o Funcionário não geram envio em dobro, e
// uma queda no meio deixa o DAS como estava (a reserva expira e a rodada seguinte retoma). Se o
// aceite ocorreu e a queda veio antes da conclusão, a guia pode ser reenviada (pelo menos uma vez).
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
      dasEnviados: rodada.andamentos.filter(([, das]) => das?.enviado).length,
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
    // O PDF publicado fica no Storage mesmo se a entrega falhar: só o envio aceito guarda o caminho.
    const publicado: { caminho?: string } = {};
    return entregarComReserva({
      descricao: `DAS de ${cliente.empresa}`,
      reservar: () => this.clientes.reservarDas(cliente.clienteId),
      entregar: () => this.entregarGuia(cliente, agora, publicado),
      concluir: async (token) =>
        publicado.caminho
          ? this.clientes.concluirDas(cliente.clienteId, token, hojeIso(agora), publicado.caminho)
          : err(new ServicoExternoError("Caminho da guia do DAS entregue desconhecido.")),
      liberar: (token) => this.clientes.liberarDas(cliente.clienteId, token),
    });
  }

  private async entregarGuia(
    cliente: ClienteParaLembrete,
    agora: Date,
    publicado: { caminho?: string },
  ): Promise<Andamento> {
    const guia = await this.guiaDas.execute(cliente.clienteId, mesAtual(agora));
    if (!guia.ok) return falha(`DAS de ${cliente.empresa}: ${guia.error.message}`);
    const { caminho, ...conteudo } = guia.value;
    publicado.caminho = caminho;
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_das",
      contato: nomeDoContato(cliente),
      empresa: cliente.empresa,
      ...conteudo,
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
