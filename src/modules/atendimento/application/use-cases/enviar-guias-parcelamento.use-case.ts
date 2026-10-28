import {
  falha,
  paraAndamento,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import {
  atribuirGuiasParcelamento,
  identidadeDaGuia,
  type GuiaAtribuida,
} from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import {
  guiaPgfn,
  guiasPgfnAEntregar,
  reservarELerGuiaPgfn,
} from "@/modules/atendimento/application/jobs/guias-pgfn-a-entregar";
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
import type { GuiasParcelamentoPort } from "@/modules/atendimento/application/ports/out/guias-parcelamento.provider";
import type { GuiasPgfnPort } from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";
import type {
  ParcelamentoDoCliente,
  ParcelamentosDoClientePort,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import { chaveDoParcelamento } from "@/modules/atendimento/domain/services/guia-guardada.service";
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

// A guia atribuída com as parcelas que restam depois de entregá-la.
type GuiaAEntregar = GuiaAtribuida & { restantesDepois: number };
// `descontou`: o banco descontou uma parcela restante nesta entrega.
// `completa`: entregue e registrada; qualquer outro desfecho trava o resto do acordo PGFN.
type EntregaDeGuia = { andamento: Andamento; descontou: boolean; completa: boolean };

// Entrega as guias de parcelamento do Cliente (job): o banco manda no que está pendente e cada
// entrega aceita grava o registro de envio da parcela. O Parcelamento da Receita vem do provedor
// fiscal; o da PGFN, das guias confirmadas à mão (#186), com o PDF do banco, até a competência do
// mês corrente e da mais antiga para a mais nova. Sem guia confirmada o job apenas pula (o lembrete
// da PGFN avisa o setor). O comum vai ao Cliente pela forma de envio
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
    private readonly pgfn: GuiasPgfnPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(entrada: EnviarGuiasParcelamentoInput): Promise<Andamento> {
    const receita = await this.enviarReceita(entrada);
    const pgfn = await this.enviarPgfn(entrada);
    return {
      enviado: receita.enviado || pgfn.enviado,
      ocorrencias: [...receita.ocorrencias, ...pgfn.ocorrencias],
    };
  }

  // Sem para quem enviar (Cliente sem contato, financeiro sem telefone) o parcelamento segue
  // pendente e o setor é avisado; o outro destino não depende deste.
  private entregavel(cliente: ClienteParaParcelamento, p: ParcelamentoDoCliente): boolean {
    return p.interno ? this.financeiro.telefone !== null : temDestinatario(cliente);
  }

  private ocorrenciasSemDestino(
    cliente: ClienteParaParcelamento,
    semDestino: ParcelamentoDoCliente[],
  ): OcorrenciaDeEntrega[] {
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
    return ocorrencias;
  }

  private async enviarPgfn({ cliente, agora }: EnviarGuiasParcelamentoInput): Promise<Andamento> {
    const descricao = `Parcelamento PGFN de ${cliente.empresa}`;
    const emAberto = await this.pgfn.listarEmAberto(cliente.clienteId);
    if (!emAberto.ok) return falha(`${descricao}: ${emAberto.error.message}`);

    const mes = mesAtual(agora).replace("-", "");
    const pendentes = guiasPgfnAEntregar(emAberto.value, mes);
    const semDestino = emAberto.value.filter(
      (p) => !this.entregavel(cliente, p) && pendentes.some((g) => g.parcelamento.id === p.id),
    );
    // A mais antiga que não puder ser lida trava as seguintes do mesmo parcelamento: a ordem se mantém.
    const travados = new Set<string>();
    const andamentos: Andamento[] = [];
    const atribuidas: GuiaAtribuida[] = [];
    const reservas: { id: string; competencia: string }[] = [];
    for (const { parcelamento, competencia, caminho } of pendentes) {
      if (!this.entregavel(cliente, parcelamento) || travados.has(parcelamento.id)) continue;
      // A versão lida fica reservada até o fim da rodada.
      reservas.push({ id: parcelamento.id, competencia });
      const pdf = await this.repetir(() =>
        reservarELerGuiaPgfn(this.pgfn, cliente.clienteId, parcelamento.id, {
          competencia,
          caminho,
        }),
      );
      if (!pdf.ok) {
        travados.add(parcelamento.id);
        andamentos.push(
          falha(`Parcelamento ${parcelamento.codigo} de ${cliente.empresa}: ${pdf.error.message}`),
        );
        continue;
      }
      atribuidas.push({
        parcelamento,
        parcela: competencia,
        guia: guiaPgfn(parcelamento.codigo, competencia, pdf.value),
      });
    }
    try {
      andamentos.push(...(await this.entregarGuias(cliente, agora, atribuidas, true)));
    } finally {
      // Registrada, a competência já trava sozinha; as demais voltam a ser editáveis.
      await Promise.all(reservas.map((r) => this.pgfn.liberar(r.id, r.competencia)));
    }
    return {
      enviado: andamentos.some((a) => a.enviado),
      ocorrencias: [
        ...this.ocorrenciasSemDestino(cliente, semDestino),
        ...andamentos.flatMap((a) => a.ocorrencias),
      ],
    };
  }

  private async enviarReceita({
    cliente,
    agora,
  }: EnviarGuiasParcelamentoInput): Promise<Andamento> {
    const descricao = `Parcelamento de ${cliente.empresa}`;
    const emAberto = await this.parcelamentos.listarEmAberto(cliente.clienteId);
    if (!emAberto.ok) return falha(`${descricao}: ${emAberto.error.message}`);

    const mes = mesAtual(agora).replace("-", "");
    const entregavel = (p: ParcelamentoDoCliente) => this.entregavel(cliente, p);
    const pendente = (p: ParcelamentoDoCliente) => !p.parcelasEnviadas.includes(mes);
    const alvos = emAberto.value.filter(entregavel);
    const idsDosAlvos = new Set(alvos.map((p) => p.id));
    const aEntregar = alvos.filter(pendente);
    const semDestino = emAberto.value.filter((p) => pendente(p) && !idsDosAlvos.has(p.id));
    const ocorrencias = this.ocorrenciasSemDestino(cliente, semDestino);
    if (aEntregar.length === 0) return { enviado: false, ocorrencias };

    // Parcelas que todos os alvos já receberam: o provedor cobra cada emissão.
    const parcelasQueTodosRecebem = alvos[0].parcelasEnviadas.filter((parcela) =>
      alvos.every((p) => p.parcelasEnviadas.includes(parcela)),
    );
    const buscadas = await this.repetir(() =>
      this.guias.buscarGuiasParcelamento(cliente.clienteId, parcelasQueTodosRecebem),
    );
    if (!buscadas.ok) return falha(`${descricao}: ${buscadas.error.message}`);

    const entregues = await this.parcelamentos.guiasEntregues(cliente.clienteId);
    if (!entregues.ok) return falha(`${descricao}: ${entregues.error.message}`);

    // A atribuição vê todos os em aberto: a guia de quem não tem destino não cai em outro.
    const atribuidas = atribuirGuiasParcelamento(buscadas.value, emAberto.value, entregues.value);
    const andamentos = await this.entregarGuias(
      cliente,
      agora,
      atribuidas.filter((a) => idsDosAlvos.has(a.parcelamento.id)),
    );

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

  // Entrega uma guia por vez. Cada uma que o banco desconta tira uma parcela restante, então o
  // financeiro vê quantas restam depois dela, contando as da própria rodada. Sem saldo para a guia
  // (o acordo quitou nesta rodada) nada é entregue e o excesso vira ocorrência. O CNPJ só é lido se
  // houver interno a entregar, e uma vez por Cliente.
  private async entregarGuias(
    cliente: ClienteParaParcelamento,
    agora: Date,
    atribuidas: GuiaAtribuida[],
    pararNoAcordo = false,
  ): Promise<Andamento[]> {
    let cadastro: Promise<Result<CadastroFiscalCliente, AppError>> | undefined;
    const cnpjDoCliente = () =>
      (cadastro ??= this.financeiro.cnpjs.cadastroFiscalDoCliente(cliente.clienteId));
    const descontadas = new Map<string, number>();
    const andamentos: Andamento[] = [];
    // PGFN: guia sem entrega registrada trava as seguintes do mesmo acordo, para não pular a ordem
    // nem quitar por uma guia posterior; ela segue pendente para a próxima rodada.
    const travados = new Set<string>();
    for (const atribuida of atribuidas) {
      const { id, parcelasRestantes } = atribuida.parcelamento;
      if (travados.has(id)) continue;
      const restantesDepois = parcelasRestantes - (descontadas.get(id) ?? 0) - 1;
      if (restantesDepois < 0) {
        const { codigo } = atribuida.parcelamento;
        andamentos.push(
          falha(
            `Parcelamento ${codigo} de ${cliente.empresa}: guia ${formatarParcela(atribuida.parcela)} de sobra, o parcelamento já quitou; nada foi enviado. Conferir com o provedor.`,
          ),
        );
        continue;
      }
      const entrega = await this.entregarGuia(
        cliente,
        agora,
        { ...atribuida, restantesDepois },
        cnpjDoCliente,
      );
      if (pararNoAcordo && !entrega.completa) travados.add(id);
      if (entrega.descontou) descontadas.set(id, (descontadas.get(id) ?? 0) + 1);
      andamentos.push(entrega.andamento);
    }
    return andamentos;
  }

  private async entregarGuia(
    cliente: ClienteParaParcelamento,
    agora: Date,
    atribuida: GuiaAEntregar,
    cnpjDoCliente: () => Promise<Result<CadastroFiscalCliente, AppError>>,
  ): Promise<EntregaDeGuia> {
    const { parcelamento, guia, parcela } = atribuida;
    const descricao = `Parcelamento ${parcelamento.codigo} de ${cliente.empresa}`;
    const publicada = await this.repetir(() =>
      this.publicadas.publicar(
        cliente.clienteId,
        guia,
        chaveDoParcelamento(parcelamento.id, parcela),
      ),
    );
    if (!publicada.ok) {
      return {
        andamento: falha(`${descricao}: ${publicada.error.message}`),
        descontou: false,
        completa: false,
      };
    }

    const documento = { url: publicada.value.url, nomeArquivo: guia.nomeArquivo };
    const andamento = parcelamento.interno
      ? await this.entregarAoFinanceiro(cliente, atribuida, documento, cnpjDoCliente, descricao)
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
    // O PDF publicado fica no Storage mesmo se a entrega for recusada: só o registro do envio
    // aceito o aponta (ver o gateway).
    if (!andamento.enviado) return { andamento, descontou: false, completa: false };

    const registro = await this.parcelamentos.registrarEnvio(
      parcelamento.id,
      parcela,
      identidadeDaGuia(guia),
      publicada.value.caminho,
    );
    // `ja_registrado`: a parcela já tinha registro e nada foi descontado agora.
    if (registro.ok && registro.value !== "nao_elegivel") {
      return { andamento, descontou: registro.value === "registrado", completa: true };
    }
    const aviso = registro.ok
      ? `${descricao}: entregue, mas o parcelamento deixou de estar em aberto e o envio não foi registrado.`
      : `${descricao}: entregue, mas o envio não foi registrado (${registro.error.message}).`;
    return {
      andamento: {
        enviado: true,
        ocorrencias: [...andamento.ocorrencias, ...falha(aviso).ocorrencias],
      },
      descontou: false,
      completa: false,
    };
  }

  // Sempre template, direto ao financeiro: sem janela, sem forma de envio do Cliente, sem e-mail.
  private async entregarAoFinanceiro(
    cliente: ClienteParaParcelamento,
    { parcelamento, parcela, restantesDepois }: GuiaAEntregar,
    documento: { url: string; nomeArquivo: string },
    cnpjDoCliente: () => Promise<Result<CadastroFiscalCliente, AppError>>,
    descricao: string,
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
