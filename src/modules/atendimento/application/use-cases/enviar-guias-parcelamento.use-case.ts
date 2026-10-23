import {
  falha,
  paraAndamento,
  SEM_ANDAMENTO,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import { atribuirGuiasParcelamento } from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import type { EntregarComunicacaoPorCanaisPort } from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  EnviarGuiasParcelamentoInput,
  EnviarGuiasParcelamentoPort,
} from "@/modules/atendimento/application/ports/in/enviar-guias-parcelamento.provider";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
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
import { mesAtual } from "@/shared/kernel/mes-atual";
import type { Result } from "@/shared/kernel/result";

// Entrega as guias de parcelamento comum do Cliente (job e URA): o banco manda no que está pendente
// e cada entrega aceita grava o registro de envio da parcela. Falha fechado: parcelamento pendente
// sem guia vira `parcelamento_sem_guia`, nunca se adivinha. Regra completa em
// docs/deploy/parcelamento-cron.md.
export class EnviarGuiasParcelamento implements EnviarGuiasParcelamentoPort {
  constructor(
    private readonly parcelamentos: ParcelamentosDoClientePort,
    private readonly guias: GuiasParcelamentoPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly entrega: EntregarComunicacaoPorCanaisPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute({ cliente, agora }: EnviarGuiasParcelamentoInput): Promise<Andamento> {
    const descricao = `Parcelamento de ${cliente.empresa}`;
    const emAberto = await this.parcelamentos.listarEmAberto(cliente.clienteId);
    if (!emAberto.ok) return falha(`${descricao}: ${emAberto.error.message}`);

    const mes = mesAtual(agora).replace("-", "");
    const comuns = emAberto.value.filter((p) => !p.interno);
    const pendentes = comuns.filter((p) => !p.parcelasEnviadas.includes(mes));
    if (pendentes.length === 0) return SEM_ANDAMENTO;

    // Parcelas que todos os comuns já receberam: o provedor cobra cada emissão.
    const jaEntregues = comuns[0].parcelasEnviadas.filter((parcela) =>
      comuns.every((p) => p.parcelasEnviadas.includes(parcela)),
    );
    const buscadas = await this.repetir(() =>
      this.guias.buscarGuiasParcelamento(cliente.clienteId, jaEntregues),
    );
    if (!buscadas.ok) return falha(`${descricao}: ${buscadas.error.message}`);

    const atribuidas = atribuirGuiasParcelamento(buscadas.value, emAberto.value);
    const andamentos: Andamento[] = [];
    for (const { parcelamento, guia, parcela } of atribuidas) {
      // A guia de um parcelamento interno não vai ao Cliente.
      if (!parcelamento.interno) {
        andamentos.push(await this.entregarGuia(cliente, agora, parcelamento, guia, parcela));
      }
    }

    const comGuia = new Set(atribuidas.map((a) => a.parcelamento.id));
    const semGuia = pendentes.filter((p) => !comGuia.has(p.id));
    const ocorrencias = andamentos.flatMap((a) => a.ocorrencias);
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
    parcelamento: ParcelamentoDoCliente,
    guia: GuiaFiscal,
    parcela: string,
  ): Promise<Andamento> {
    const descricao = `Parcelamento ${parcelamento.codigo} de ${cliente.empresa}`;
    const url = await this.repetir(() =>
      this.publicadas.publicar(cliente.clienteId, guia, { id: parcelamento.id, parcela }),
    );
    if (!url.ok) return falha(`${descricao}: ${url.error.message}`);

    const andamento = paraAndamento(
      await this.entrega.execute({
        cliente,
        comunicacao: {
          tipo: "envio_guia_parcelamento",
          contato: cliente.contato?.nome ?? cliente.empresa,
          empresa: cliente.empresa,
          parcela: formatarParcela(parcela),
          guia: { url: url.value, nomeArquivo: guia.nomeArquivo },
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
}
