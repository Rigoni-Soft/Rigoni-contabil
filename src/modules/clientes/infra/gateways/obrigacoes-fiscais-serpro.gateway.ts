import { request } from "node:https";

import { z } from "zod";

import type {
  AutorizacaoDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ObrigacoesFiscaisPort,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

// Adapter do Integra Contador (docs/pesquisa/serpro-api.md) para o contrato neutro. Só este
// arquivo conhece o Serpro; falha de rede, status ou formato vira ServicoExternoError.

const TIMEOUT_MS = 15_000;
const URL_AUTENTICACAO = "https://autenticacao.sapi.serpro.gov.br/authenticate";
const URL_BASE = "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1";
const CNPJ = 2; // tipo de identificador do Serpro

// [idSistema, idServico] de "Emitir Documento de Arrecadação" de cada parcelamento.
const PARCELAMENTOS = [
  ["PARCSN", "GERARDAS161"],
  ["PERTSN", "GERARDAS181"],
  ["RELPSN", "GERARDAS191"],
  ["PARCMEI", "GERARDAS201"],
  ["PERTMEI", "GERARDAS221"],
  ["RELPMEI", "GERARDAS231"],
] as const;

export type RespostaHttp = { status: number; corpo: string };
export type RequisicaoHttp = {
  url: string;
  headers: Record<string, string>;
  corpo: string;
  pfx?: Buffer;
  passphrase?: string;
};
export type TransporteHttp = (req: RequisicaoHttp) => Promise<RespostaHttp>;

export type CredenciaisSerpro = {
  consumerKey: string;
  consumerSecret: string;
  certificadoP12: Buffer;
  certificadoSenha: string;
  cnpjEscritorio: string;
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

  // O Cliente pode estar em qualquer um dos parcelamentos do Integra-Parcelamento e a porta não
  // diz qual: tenta os seis em ordem e fica com o primeiro que emite a parcela do mês corrente.
  // Resposta 4xx (sem parcelamento ali) passa ao próximo; rede, 5xx e formato interrompem.
  // A API devolve só o PDF: valor e vencimento ficam de fora (opcionais no contrato).
  // ponytail: até 6 chamadas pagas por consulta; guardar o sistema do Cliente se o custo pesar.
  async buscarGuiaParcelamento(cnpj: string): Promise<Result<GuiaParcelamentoDto, AppError>> {
    const parcela = mesAtual(this.agora()).replace("-", "");
    return this.executar(async () => {
      for (const [idSistema, idServico] of PARCELAMENTOS) {
        try {
          const dados = await this.chamar("Emitir", cnpj, idSistema, idServico, "1.0", {
            parcelaParaEmitir: Number(parcela),
          });
          if (dados === null) continue; // 204/404: sem parcelamento neste sistema
          const guia = parcelamentoSchema.parse(dados);
          return {
            nomeArquivo: `parcelamento-${cnpj}-${parcela}.pdf`,
            pdfBase64: guia.docArrecadacaoPdfB64,
            parcela,
          };
        } catch (e) {
          if (!(e instanceof ErroSerpro && e.status >= 400 && e.status < 500)) throw e;
        }
      }
      throw new ErroSerpro("Nenhum parcelamento com parcela para emitir neste mês.");
    });
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
      return err(
        new ServicoExternoError(
          e instanceof ErroSerpro ? e.message : "Serviço fiscal indisponível ou fora do contrato.",
        ),
      );
    }
  }

  private async autenticar(): Promise<{ access: string; jwt: string }> {
    if (this.token && this.token.expiraEm > Date.now()) return this.token;
    const basico = Buffer.from(`${this.cred.consumerKey}:${this.cred.consumerSecret}`).toString(
      "base64",
    );
    const r = await this.http({
      url: URL_AUTENTICACAO,
      headers: {
        Authorization: `Basic ${basico}`,
        "Role-Type": "TERCEIROS",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      corpo: "grant_type=client_credentials",
      pfx: this.cred.certificadoP12,
      passphrase: this.cred.certificadoSenha,
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
      url: `${URL_BASE}/${operacao}`,
      headers: {
        Authorization: `Bearer ${access}`,
        jwt_token: jwt,
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
    if (r.status !== 200) throw new ErroSerpro(`Serviço fiscal respondeu ${r.status}.`, r.status);
    const envelope = z.object({ dados: z.string() }).parse(JSON.parse(r.corpo));
    return JSON.parse(envelope.dados);
  }
}

class ErroSerpro extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}
