import { request } from "node:https";

import { z } from "zod";

import type {
  AutorizacaoDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ObrigacoesFiscaisPort,
  PedidoGuiaParcelamento,
  RegimeParcelamento,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import {
  GuiaParcelamentoIndisponivelError,
  type MotivoGuiaIndisponivel,
} from "@/shared/errors/guia-parcelamento-indisponivel.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

// Adapter do Integra Contador (docs/pesquisa/serpro-api.md) para o contrato neutro. Só este
// arquivo conhece o Serpro; falha de rede, status ou formato vira ServicoExternoError.

const TIMEOUT_MS = 15_000;
const CNPJ = 2; // tipo de identificador do Serpro

// [idSistema, idServico] de "Emitir Documento de Arrecadação" do parcelamento ordinário (PARC),
// o único contínuo; PERT e RELP estão fechados a novas adesões.
const PARCELAMENTO_POR_REGIME: Record<RegimeParcelamento, readonly [string, string]> = {
  simples_nacional: ["PARCSN", "GERARDAS161"],
  mei: ["PARCMEI", "GERARDAS201"],
};

// Mensagens de negócio do Integra-Parcelamento (docs/pesquisa/serpro-guia-parcelamento.md) que
// dizem por que não há guia. Qualquer outra falha é indisponibilidade (ou falta de autorização).
const MOTIVO_POR_MENSAGEM: Record<string, MotivoGuiaIndisponivel> = {
  ER_E001: "codigo_desconhecido", // não há parcelamento ativo
  ER_N003: "quitado", // sem saldo devedor
  ER_N005: "fora_do_periodo", // parcela do mês só emitível a partir de certo dia
  ER_N006: "fora_do_periodo", // parcela inexistente, já paga ou de mês futuro
  ER_N008: "fora_do_periodo", // sem parcelas para emissão
};

export type RespostaHttp = { status: number; corpo: string };
export type RequisicaoHttp = {
  url: string;
  headers: Record<string, string>;
  corpo: string;
  pfx?: Buffer;
  passphrase?: string;
};
export type TransporteHttp = (req: RequisicaoHttp) => Promise<RespostaHttp>;

// Trial (demonstração): token fixo, sem autenticar, sem certificado. Produção: OAuth2 com
// Consumer Key/Secret e o e-CNPJ do escritório. As URLs vêm do ambiente (src/main).
export type CredenciaisSerpro = {
  urlAutenticacao: string;
  urlBase: string;
  cnpjEscritorio: string;
  acesso:
    | { tipo: "trial"; token: string }
    | {
        tipo: "producao";
        consumerKey: string;
        consumerSecret: string;
        certificadoP12: Buffer;
        certificadoSenha: string;
      };
};

export const transporteNode: TransporteHttp = (req) =>
  new Promise((resolve, reject) => {
    const chamada = request(
      req.url,
      {
        method: "POST",
        headers: { ...req.headers, "Content-Length": Buffer.byteLength(req.corpo) },
        pfx: req.pfx,
        passphrase: req.passphrase,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on("data", (p: Buffer) => partes.push(p));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes).toString("utf8") }),
        );
      },
    );
    chamada.on("timeout", () => chamada.destroy(new Error("timeout")));
    chamada.on("error", reject);
    chamada.end(req.corpo);
  });

const tokenSchema = z.object({
  access_token: z.string(),
  jwt_token: z.string(),
  expires_in: z.number(),
});

// `dados` chega como JSON em string; aceita um objeto ou uma lista de um objeto.
const umOuLista = <S extends z.ZodType>(s: S) =>
  z.union([s, z.array(s).min(1)]).transform((v) => (Array.isArray(v) ? v[0] : v));

const dasSchema = umOuLista(
  z.object({
    pdf: z.string(),
    detalhamento: z.object({
      periodoApuracao: z.string().regex(/^\d{6}$/),
      numeroDocumento: z.string(),
      dataVencimento: z.string().regex(/^\d{8}$/),
      valores: z.object({ total: z.number() }),
    }),
  }),
);
const parcelamentoSchema = umOuLista(z.object({ docArrecadacaoPdfB64: z.string() }));
const procuracoesSchema = z.array(z.object({ dtexpiracao: z.string().regex(/^\d{8}$/) }));

const dataIso = (aaaammdd: string) =>
  `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6)}`;

// Mês anterior ao corrente (fuso de negócio): o DAS vence no mês seguinte à apuração.
function mesAnterior(agora: Date): string {
  const [ano, mes] = mesAtual(agora).split("-").map(Number);
  return mes === 1 ? `${ano - 1}12` : `${ano}${String(mes - 1).padStart(2, "0")}`;
}

export class ObrigacoesFiscaisSerproGateway implements ObrigacoesFiscaisPort {
  private token: { access: string; jwt: string; expiraEm: number } | null = null;

  constructor(
    private readonly cred: CredenciaisSerpro,
    private readonly http: TransporteHttp = transporteNode,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>> {
    const periodo = mesAnterior(this.agora());
    return this.executar(async () => {
      const das = dasSchema.parse(
        await this.chamar("Emitir", cnpj, "PGDASD", "GERARDAS12", "1.0", {
          periodoApuracao: periodo,
        }),
      );
      return {
        nomeArquivo: `das-${cnpj}-${periodo}.pdf`,
        pdfBase64: das.pdf,
        competencia: `${periodo.slice(0, 4)}-${periodo.slice(4)}`,
        valorCentavos: Math.round(das.detalhamento.valores.total * 100),
        vencimento: dataIso(das.detalhamento.dataVencimento),
      };
    });
  }

  // Parcelamento ordinário do regime do Cliente, parcela do mês corrente. A API devolve só o
  // PDF (valor e vencimento ficam de fora, opcionais no contrato) e não escolhe o parcelamento:
  // o `codigo` é nosso, não vai ao Serpro. Com mais de um da Receita em aberto a guia não se
  // atribui a um só, então falha fechado sem gastar a chamada. A guia vai direto, sem
  // pré-consulta de autorização: ela só é consultada se a guia falhar, para classificar a falha.
  async buscarGuiaParcelamento(
    cnpj: string,
    { regime, emAbertoDaReceita }: PedidoGuiaParcelamento,
  ): Promise<Result<GuiaParcelamentoDto, AppError>> {
    if (emAbertoDaReceita > 1) {
      return err(new GuiaParcelamentoIndisponivelError("ambiguo"));
    }
    const parcela = mesAtual(this.agora()).replace("-", "");
    const [idSistema, idServico] = PARCELAMENTO_POR_REGIME[regime];
    const guia = await this.executar(async () => {
      const dados = await this.chamar("Emitir", cnpj, idSistema, idServico, "1.0", {
        parcelaParaEmitir: Number(parcela),
      });
      if (dados === null)
        throw new ErroSerpro("Cliente sem parcelamento ativo.", "codigo_desconhecido");
      return {
        nomeArquivo: `parcelamento-${cnpj}-${parcela}.pdf`,
        pdfBase64: parcelamentoSchema.parse(dados).docArrecadacaoPdfB64,
        parcela,
      };
    });
    return guia.ok ? guia : this.classificarFalhaDaGuia(cnpj, guia.error);
  }

  private async classificarFalhaDaGuia(
    cnpj: string,
    falha: AppError,
  ): Promise<Result<never, AppError>> {
    if (falha instanceof GuiaParcelamentoIndisponivelError) return err(falha);
    const autorizacao = await this.consultarAutorizacao(cnpj);
    if (autorizacao.ok && !autorizacao.value.vigente) {
      return err(new ForbiddenError("Cliente sem autorização vigente para consulta fiscal."));
    }
    return err(falha);
  }

  // Integra-Procurações: há procuração do Cliente ao escritório com validade a vencer?
  async consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>> {
    return this.executar(async () => {
      const dados = await this.chamar("Consultar", cnpj, "PROCURACOES", "OBTERPROCURACAO41", "1", {
        outorgante: cnpj,
        tipoOutorgante: String(CNPJ),
        outorgado: this.cred.cnpjEscritorio,
        tipoOutorgado: String(CNPJ),
      });
      const hoje = hojeIso(this.agora()).replaceAll("-", "");
      const vigentes = procuracoesSchema
        .parse(dados ?? [])
        .map((p) => p.dtexpiracao)
        .filter((d) => d >= hoje)
        .sort();
      return vigentes.length
        ? { vigente: true as const, dataExpiracao: dataIso(vigentes[vigentes.length - 1]) }
        : { vigente: false as const };
    });
  }

  private async executar<T>(fn: () => Promise<T>): Promise<Result<T, AppError>> {
    try {
      return ok(await fn());
    } catch (e) {
      const motivo = e instanceof ErroSerpro ? e.motivo : undefined;
      if (motivo) {
        return err(new GuiaParcelamentoIndisponivelError(motivo));
      }
      return err(
        new ServicoExternoError(
          e instanceof ErroSerpro ? e.message : "Serviço fiscal indisponível ou fora do contrato.",
        ),
      );
    }
  }

  private async autenticar(): Promise<{ access: string; jwt: string }> {
    const { acesso } = this.cred;
    if (acesso.tipo === "trial") return { access: acesso.token, jwt: "" };
    if (this.token && this.token.expiraEm > Date.now()) return this.token;
    const basico = Buffer.from(`${acesso.consumerKey}:${acesso.consumerSecret}`).toString("base64");
    const r = await this.http({
      url: this.cred.urlAutenticacao,
      headers: {
        Authorization: `Basic ${basico}`,
        "Role-Type": "TERCEIROS",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      corpo: "grant_type=client_credentials",
      pfx: acesso.certificadoP12,
      passphrase: acesso.certificadoSenha,
    });
    if (r.status !== 200) throw new ErroSerpro(`Autenticação no Serpro respondeu ${r.status}.`);
    const t = tokenSchema.parse(JSON.parse(r.corpo));
    // Margem de 60 s para o token não vencer no meio da chamada.
    this.token = {
      access: t.access_token,
      jwt: t.jwt_token,
      expiraEm: Date.now() + (t.expires_in - 60) * 1000,
    };
    return this.token;
  }

  // Devolve o `dados` já parseado; `null` quando o Serpro responde sem dados (204/404).
  private async chamar(
    operacao: "Emitir" | "Consultar",
    contribuinte: string,
    idSistema: string,
    idServico: string,
    versaoSistema: string,
    dados: Record<string, unknown>,
    repetirSe401 = true,
  ): Promise<unknown> {
    const { access, jwt } = await this.autenticar();
    const escritorio = { numero: this.cred.cnpjEscritorio, tipo: CNPJ };
    const r = await this.http({
      url: `${this.cred.urlBase}/${operacao}`,
      headers: {
        Authorization: `Bearer ${access}`,
        ...(jwt && { jwt_token: jwt }),
        "Content-Type": "application/json",
      },
      corpo: JSON.stringify({
        contratante: escritorio,
        autorPedidoDados: escritorio,
        contribuinte: { numero: contribuinte, tipo: CNPJ },
        pedidoDados: { idSistema, idServico, versaoSistema, dados: JSON.stringify(dados) },
      }),
    });
    if (r.status === 401 && repetirSe401) {
      this.token = null;
      return this.chamar(operacao, contribuinte, idSistema, idServico, versaoSistema, dados, false);
    }
    if (r.status === 204 || r.status === 404) return null;
    if (r.status !== 200) {
      throw new ErroSerpro(`Serviço fiscal respondeu ${r.status}.`, motivoDaRecusa(r.corpo));
    }
    const envelope = z.object({ dados: z.string() }).parse(JSON.parse(r.corpo));
    return JSON.parse(envelope.dados);
  }
}

function motivoDaRecusa(corpo: string): MotivoGuiaIndisponivel | undefined {
  const er = /ER_[EN]\d{3}/.exec(corpo)?.[0];
  return er ? MOTIVO_POR_MENSAGEM[er] : undefined;
}

class ErroSerpro extends Error {
  constructor(
    message: string,
    readonly motivo?: MotivoGuiaIndisponivel,
  ) {
    super(message);
  }
}
