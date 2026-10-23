import { request } from "node:https";

import { z } from "zod";

import type {
  AutorizacaoDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ObrigacoesFiscaisPort,
  PedidoGuiasParcelamento,
  RegimeParcelamento,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

// Adapter do Integra Contador (docs/pesquisa/serpro-api.md) para o contrato neutro. Só este
// arquivo conhece o Serpro; falha de rede, status ou formato vira ServicoExternoError.

const TIMEOUT_MS = 15_000;
const CNPJ = 2; // tipo de identificador do Serpro

// [idSistema, consultar parcelas, emitir guia] do parcelamento ordinário (PARC), o único
// contínuo; PERT e RELP estão fechados a novas adesões.
const PARCELAMENTO_POR_REGIME: Record<RegimeParcelamento, readonly [string, string, string]> = {
  simples_nacional: ["PARCSN", "PARCELASPARAGERAR162", "GERARDAS161"],
  mei: ["PARCMEI", "PARCELASPARAGERAR202", "GERARDAS201"],
};

// Mensagens de negócio do Integra-Parcelamento (docs/pesquisa/serpro-guia-parcelamento.md).
// `sem_guias`: não há o que emitir para o CNPJ; `parcela_indisponivel`: só aquela parcela não sai
// agora. Qualquer outra falha é indisponibilidade (ou falta de autorização).
type Recusa = "sem_guias" | "parcela_indisponivel";
const RECUSA_POR_MENSAGEM: Record<string, Recusa> = {
  ER_E001: "sem_guias", // não há parcelamento ativo
  ER_N003: "sem_guias", // sem saldo devedor
  ER_N008: "sem_guias", // sem parcelas para emissão
  ER_N005: "parcela_indisponivel", // parcela do mês só emitível a partir de certo dia
  ER_N006: "parcela_indisponivel", // parcela inexistente, já paga ou de mês futuro
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
const parcelasSchema = z.object({
  listaParcela: z.array(
    z.object({ parcela: z.coerce.string().regex(/^\d{6}$/), valor: z.number() }),
  ),
});
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

  // Parcelamento ordinário do regime do Cliente: lista as parcelas emitíveis (1 consulta) e emite
  // uma guia por parcela, menos as de `ignorar`. A emissão só aceita a parcela (não escolhe o
  // parcelamento), então a atribuição ao parcelamento do Cliente é de quem chama. Direto, sem
  // pré-consulta de autorização: ela só é consultada se nada vier, para classificar a falha. Queda
  // no meio devolve as guias já baixadas (pagas); as outras vêm na rodada seguinte.
  async buscarGuiasParcelamento(
    cnpj: string,
    { regime, ignorar }: PedidoGuiasParcelamento,
  ): Promise<Result<GuiaParcelamentoDto[], AppError>> {
    const [idSistema, idConsulta, idEmissao] = PARCELAMENTO_POR_REGIME[regime];
    const guias: GuiaParcelamentoDto[] = [];
    try {
      const parcelas = await this.comRecusa("sem_guias", [], async () => {
        const dados = await this.chamar("Consultar", cnpj, idSistema, idConsulta, "1.0", {});
        return dados === null ? [] : parcelasSchema.parse(dados).listaParcela;
      });
      for (const { parcela, valor } of parcelas.filter((p) => !ignorar.includes(p.parcela))) {
        const pdf = await this.comRecusa("parcela_indisponivel", null, async () => {
          const dados = await this.chamar("Emitir", cnpj, idSistema, idEmissao, "1.0", {
            parcelaParaEmitir: Number(parcela),
          });
          return dados === null ? null : parcelamentoSchema.parse(dados).docArrecadacaoPdfB64;
        });
        if (pdf === null) continue;
        guias.push({
          nomeArquivo: `parcelamento-${cnpj}-${parcela}.pdf`,
          pdfBase64: pdf,
          parcela,
          valorCentavos: Math.round(valor * 100),
        });
      }
      return ok(guias);
    } catch (e) {
      if (guias.length > 0) return ok(guias);
      const autorizacao = await this.consultarAutorizacao(cnpj);
      if (autorizacao.ok && !autorizacao.value.vigente) {
        return err(new ForbiddenError("Cliente sem autorização vigente para consulta fiscal."));
      }
      return err(falhaDeServico(e));
    }
  }

  // A recusa de negócio indicada vira `quandoRecusa`; qualquer outra falha segue lançando.
  private async comRecusa<T>(recusa: Recusa, quandoRecusa: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ErroSerpro && e.recusa === recusa) return quandoRecusa;
      throw e;
    }
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
      return err(falhaDeServico(e));
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
      throw new ErroSerpro(`Serviço fiscal respondeu ${r.status}.`, recusaDaResposta(r.corpo));
    }
    const envelope = z.object({ dados: z.string() }).parse(JSON.parse(r.corpo));
    return JSON.parse(envelope.dados);
  }
}

function recusaDaResposta(corpo: string): Recusa | undefined {
  const er = /ER_[EN]\d{3}/.exec(corpo)?.[0];
  return er ? RECUSA_POR_MENSAGEM[er] : undefined;
}

function falhaDeServico(e: unknown): ServicoExternoError {
  return new ServicoExternoError(
    e instanceof ErroSerpro ? e.message : "Serviço fiscal indisponível ou fora do contrato.",
  );
}

class ErroSerpro extends Error {
  constructor(
    message: string,
    readonly recusa?: Recusa,
  ) {
    super(message);
  }
}
