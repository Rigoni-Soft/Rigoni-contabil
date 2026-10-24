import {
  falha,
  paraAndamento,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import {
  atribuirGuiasParcelamento,
  type GuiaAtribuida,
} from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import type {
  EntregarComunicacaoPorCanaisPort,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  EnviarGuiasParcelamentoInput,
  EnviarGuiasParcelamentoPort,
} from "@/modules/atendimento/application/ports/in/enviar-guias-parcelamento.provider";
import type {
  CadastroFiscalCliente,
  ClienteCnpjPort,
} from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { GuiasParcelamentoPort } from "@/modules/atendimento/application/ports/out/guias-parcelamento.provider";
import type {
  ParcelamentoDoCliente,
  ParcelamentosDoClientePort,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formatarParcela } from "@/shared/kernel/data-iso";
import { temDestinatario } from "@/shared/kernel/forma-envio";
import { mesAtual } from "@/shared/kernel/mes-atual";
import type { Result } from "@/shared/kernel/result";

// WhatsApp do financeiro do escritório, destino das guias de parcelamento interno. `telefone` null:
// não configurado (FINANCEIRO_TELEFONE ausente ou inválido).
type FinanceiroDoEscritorio = {
  envio: EnvioMensagemPort;
  cnpjs: ClienteCnpjPort;
  telefone: string | null;
};

// Entrega as guias de parcelamento do Cliente (job e URA): o banco manda no que está pendente e cada
// entrega aceita grava o registro de envio da parcela. O comum vai ao Cliente pela forma de envio
// dele; o interno só ao financeiro, por template, e nunca ao Cliente. Falha fechado: parcelamento
// pendente sem guia vira `parcelamento_sem_guia`, nunca se adivinha. Regra completa em
// docs/deploy/parcelamento-cron.md.
export class EnviarGuiasParcelamento implements EnviarGuiasParcelamentoPort {
  constructor(
    private readonly parcelamentos: ParcelamentosDoClientePort,
    private readonly guias: GuiasParcelamentoPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly entrega: EntregarComunicacaoPorCanaisPort,
    private readonly financeiro: FinanceiroDoEscritorio,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute({ cliente, agora }: EnviarGuiasParcelamentoInput): Promise<Andamento> {
    const descricao = `Parcelamento de ${cliente.empresa}`;
    const emAberto = await this.parcelamentos.listarEmAberto(cliente.clienteId);
    if (!emAberto.ok) return falha(`${descricao}: ${emAberto.error.message}`);

    const mes = mesAtual(agora).replace("-", "");
    // Sem para quem enviar (Cliente sem contato, financeiro sem telefone) o parcelamento segue
    // pendente e o setor é avisado; o outro destino não depende deste.
    const entregavel = (p: ParcelamentoDoCliente) =>
      p.interno ? this.financeiro.telefone !== null : temDestinatario(cliente);
    const pendente = (p: ParcelamentoDoCliente) => !p.parcelasEnviadas.includes(mes);
    const alvos = emAberto.value.filter(entregavel);
    const aEntregar = alvos.filter(pendente);
    const semDestino = emAberto.value.filter((p) => pendente(p) && !alvos.includes(p));
    const ocorrencias: OcorrenciaDeEntrega[] = [];
    const internos = semDestino.filter((p) => p.interno);
    if (internos.length > 0) {
      ocorrencias.push({
        tipo: "financeiro_ausente",
        mensagem: `Parcelamento ${internos.map((p) => p.codigo).join(", ")} de ${cliente.empresa}: sem telefone do financeiro (FINANCEIRO_TELEFONE).`,
      });
    }
    if (semDestino.some((p) => !p.interno)) {
      ocorrencias.push(...semDestinatario(cliente.empresa).ocorrencias);
    }
    if (aEntregar.length === 0) return { enviado: false, ocorrencias };

    // Parcelas que todos os alvos já receberam: o provedor cobra cada emissão.
    const jaEntregues = alvos[0].parcelasEnviadas.filter((parcela) =>
      alvos.every((p) => p.parcelasEnviadas.includes(parcela)),
    );
    const buscadas = await this.repetir(() =>
      this.guias.buscarGuiasParcelamento(cliente.clienteId, jaEntregues),
    );
    if (!buscadas.ok) return falha(`${descricao}: ${buscadas.error.message}`);

    // A atribuição vê todos os em aberto: a guia de quem não tem destino não cai em outro.
    const atribuidas = atribuirGuiasParcelamento(buscadas.value, emAberto.value);
    // O CNPJ só é lido se houver interno a entregar, e uma vez por Cliente.
    let cadastro: Promise<Result<CadastroFiscalCliente, AppError>> | undefined;
    const cnpjDoCliente = () =>
      (cadastro ??= this.financeiro.cnpjs.cadastroFiscalDoCliente(cliente.clienteId));
    const andamentos: Andamento[] = [];
    // Cada guia entregue desconta uma parcela: o financeiro vê quantas restam depois dela.
    const entregues = new Map<string, number>();
    for (const atribuida of atribuidas) {
      const { id, parcelasRestantes } = atribuida.parcelamento;
      if (!alvos.includes(atribuida.parcelamento)) continue;
      const restantesDepois = parcelasRestantes - (entregues.get(id) ?? 0) - 1;
      const andamento = await this.entregarGuia(
        cliente,
        agora,
        atribuida,
        cnpjDoCliente,
        restantesDepois,
      );
      if (andamento.enviado) entregues.set(id, (entregues.get(id) ?? 0) + 1);
      andamentos.push(andamento);
    }

    // Guia só de parcela atrasada é entregue, mas o mês corrente continua sem guia.
    const comGuia = new Set(
      atribuidas.filter((a) => a.parcela === mes).map((a) => a.parcelamento.id),
    );
    const semGuia = aEntregar.filter((p) => !comGuia.has(p.id));
    ocorrencias.push(...andamentos.flatMap((a) => a.ocorrencias));
    if (semGuia.length > 0) {
      ocorrencias.push({
        tipo: "parcelamento_sem_guia",
        mensagem: `${descricao}: sem guia para o parcelamento ${semGuia.map((p) => p.codigo).join(", ")}.`,
      });
    }
    return { enviado: andamentos.some((a) => a.enviado), ocorrencias };
  }

  // Falha do serviço externo repete antes de devolver o erro.
  private repetir<T>(operacao: () => Promise<Result<T, AppError>>) {
    return comTentativas(operacao, TENTATIVAS, this.esperaEntreTentativasMs);
  }

  private async entregarGuia(
    cliente: ClienteParaParcelamento,
    agora: Date,
    { parcelamento, guia, parcela }: GuiaAtribuida,
    cnpjDoCliente: () => Promise<Result<CadastroFiscalCliente, AppError>>,
    restantesDepois: number,
  ): Promise<Andamento> {
    const descricao = `Parcelamento ${parcelamento.codigo} de ${cliente.empresa}`;
    const url = await this.repetir(() =>
      this.publicadas.publicar(cliente.clienteId, guia, { id: parcelamento.id, parcela }),
    );
    if (!url.ok) return falha(`${descricao}: ${url.error.message}`);

    const documento = { url: url.value, nomeArquivo: guia.nomeArquivo };
    const andamento = parcelamento.interno
      ? await this.entregarAoFinanceiro(
          cliente,
          { parcelamento, parcela },
          documento,
          cnpjDoCliente,
          descricao,
          restantesDepois,
        )
      : paraAndamento(
          await this.entrega.execute({
            cliente,
            comunicacao: {
              tipo: "envio_guia_parcelamento",
              contato: cliente.contato?.nome ?? cliente.empresa,
              empresa: cliente.empresa,
              parcela: formatarParcela(parcela),
              guia: documento,
            },
            agora,
          }),
          descricao,
        );
    if (!andamento.enviado) return andamento;

    const registro = await this.parcelamentos.registrarEnvio(parcelamento.id, parcela);
    if (registro.ok) return andamento;
    const aviso = `${descricao}: entregue, mas o envio não foi registrado (${registro.error.message}).`;
    return { enviado: true, ocorrencias: [...andamento.ocorrencias, ...falha(aviso).ocorrencias] };
  }

  // Sempre template, direto ao financeiro: sem janela, sem forma de envio do Cliente, sem e-mail.
  private async entregarAoFinanceiro(
    cliente: ClienteParaParcelamento,
    { parcelamento, parcela }: Pick<GuiaAtribuida, "parcelamento" | "parcela">,
    documento: { url: string; nomeArquivo: string },
    cnpjDoCliente: () => Promise<Result<CadastroFiscalCliente, AppError>>,
    descricao: string,
    restantesDepois: number,
  ): Promise<Andamento> {
    const { telefone, envio } = this.financeiro;
    if (!telefone) return falha(`${descricao}: sem telefone do financeiro.`);
    const cadastro = await cnpjDoCliente();
    if (!cadastro.ok) return falha(`${descricao}: ${cadastro.error.message}`);

    const template = {
      telefone,
      nome: "envio_guia_parcelamento_interno",
      idioma: "pt_BR",
      variaveis: [
        cliente.empresa,
        cadastro.value.cnpj,
        parcelamento.codigo,
        formatarParcela(parcela),
        String(restantesDepois),
      ],
      documento,
    };
    const enviada = await this.repetir(() => envio.enviarTemplate(template));
    if (!enviada.ok) return falha(`${descricao}: ${enviada.error.message}`);
    return { enviado: true, ocorrencias: [] };
  }
}
