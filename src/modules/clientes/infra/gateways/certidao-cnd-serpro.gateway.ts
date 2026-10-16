import { z } from "zod";

import type {
  CertidaoCndPort,
  CndDto,
} from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import {
  transporteNode,
  type TransporteHttp,
} from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-serpro.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Adapter do produto avulso "Consulta CND" (PGFN/RFB) do Serpro: contrato e token próprios, sem
// certificado digital (docs/pesquisa/serpro-api.md, seção 1).
const PESSOA_JURIDICA = 1;
const STATUS_EM_PROCESSAMENTO = 7;
const STATUS_COM_CERTIDAO = [1, 2]; // encontrada | emitida
const TENTATIVAS = 4;
const ESPERA_MS = 3000;

export type CredenciaisCnd = {
  urlToken: string;
  urlCertidao: string;
  // "Código de identificação do sistema" informado na contratação.
  codigoIdentificacao: string;
  acesso:
    | { tipo: "trial"; token: string }
    | { tipo: "producao"; consumerKey: string; consumerSecret: string };
};

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
const respostaSchema = z.object({
  Status: z.number(),
  Mensagem: z.string().optional(),
  Chave: z.string().optional(),
  Certidao: z
    .object({
      DataValidade: z.string().min(10),
      DocumentoPdf: z.string().min(1),
    })
    .optional(),
});

class ErroCnd extends Error {}

export class CertidaoCndSerproGateway implements CertidaoCndPort {
  private token: { valor: string; expiraEm: number } | null = null;

  constructor(
    private readonly cred: CredenciaisCnd,
    private readonly http: TransporteHttp = transporteNode,
    private readonly esperar: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  async buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>> {
    try {
      return ok(await this.emitir(cnpj));
    } catch (e) {
      return err(
        new ServicoExternoError(
          e instanceof ErroCnd ? e.message : "Serviço de CND indisponível ou fora do contrato.",
        ),
      );
    }
  }

  // Status 7: a consulta passou de 5 s; repete com a `Chave` devolvida até sair o resultado.
  private async emitir(cnpj: string): Promise<CndDto> {
    let chave: string | undefined;
    for (let i = 0; i < TENTATIVAS; i++) {
      const r = await this.consultar(cnpj, chave);
      if (r.Status === STATUS_EM_PROCESSAMENTO) {
        chave = r.Chave;
        await this.esperar(ESPERA_MS);
        continue;
      }
      if (!STATUS_COM_CERTIDAO.includes(r.Status) || !r.Certidao) {
        throw new ErroCnd(r.Mensagem ?? `Certidão não emitida (status ${r.Status}).`);
      }
      return {
        nomeArquivo: `cnd-${cnpj}.pdf`,
        pdfBase64: r.Certidao.DocumentoPdf,
        validade: r.Certidao.DataValidade.slice(0, 10),
      };
    }
    throw new ErroCnd("A certidão ainda está em processamento. Tente novamente em instantes.");
  }

  private async consultar(
    cnpj: string,
    chave?: string,
    repetirSe401 = true,
  ): Promise<z.infer<typeof respostaSchema>> {
    const r = await this.http({
      url: this.cred.urlCertidao,
      headers: {
        Authorization: `Bearer ${await this.autenticar()}`,
        "Content-Type": "application/json",
      },
      corpo: JSON.stringify({
        TipoContribuinte: PESSOA_JURIDICA,
        ContribuinteConsulta: cnpj,
        CodigoIdentificacao: this.cred.codigoIdentificacao,
        GerarCertidaoPdf: true,
        ...(chave && { Chave: chave }),
      }),
    });
    if (r.status === 401 && repetirSe401) {
      this.token = null;
      return this.consultar(cnpj, chave, false);
    }
    // O Serpro responde 200/201/202/404 com o `Status` e a `Mensagem` no corpo.
    if (![200, 201, 202, 404].includes(r.status)) {
      throw new ErroCnd(`Serviço de CND respondeu ${r.status}.`);
    }
    return respostaSchema.parse(JSON.parse(r.corpo));
  }

  private async autenticar(): Promise<string> {
    const { acesso } = this.cred;
    if (acesso.tipo === "trial") return acesso.token;
    if (this.token && this.token.expiraEm > Date.now()) return this.token.valor;
    const basico = Buffer.from(`${acesso.consumerKey}:${acesso.consumerSecret}`).toString("base64");
    const r = await this.http({
      url: this.cred.urlToken,
      headers: {
        Authorization: `Basic ${basico}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      corpo: "grant_type=client_credentials",
    });
    if (r.status !== 200)
      throw new ErroCnd(`Autenticação do serviço de CND respondeu ${r.status}.`);
    const t = tokenSchema.parse(JSON.parse(r.corpo));
    this.token = { valor: t.access_token, expiraEm: Date.now() + (t.expires_in - 60) * 1000 };
    return this.token.valor;
  }
}
