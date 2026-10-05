import type {
  CndDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ProcuracaoDto,
  SerproPort,
} from "@/modules/clientes/application/ports/out/serpro.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// PDF mínimo ("%PDF-1.4 ... %%EOF") em base64, igual pra todo CNPJ.
const PDF_FALSO_BASE64 = Buffer.from("%PDF-1.4\n% serpro falso\n%%EOF").toString("base64");

// Adapter falso (default na composição até o real da #66): dados fixos por
// CNPJ. `falhar` simula indisponibilidade; `procuracaoVigente: false` simula
// cliente sem procuração no e-CAC.
export class SerproFalsoGateway implements SerproPort {
  constructor(private readonly opcoes: { falhar?: boolean; procuracaoVigente?: boolean } = {}) {}

  async buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>> {
    return this.responder({
      nomeArquivo: `das-${cnpj}.pdf`,
      pdfBase64: PDF_FALSO_BASE64,
      competencia: "2026-09",
      valorCentavos: 150_000,
      vencimento: "2026-10-20",
    });
  }

  async buscarGuiaParcelamento(cnpj: string): Promise<Result<GuiaParcelamentoDto, AppError>> {
    return this.responder({
      nomeArquivo: `parcelamento-${cnpj}.pdf`,
      pdfBase64: PDF_FALSO_BASE64,
      parcela: "202609",
      valorCentavos: 45_000,
      vencimento: "2026-10-31",
    });
  }

  async buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>> {
    return this.responder({
      nomeArquivo: `cnd-${cnpj}.pdf`,
      pdfBase64: PDF_FALSO_BASE64,
      validade: "2027-03-31",
    });
  }

  async consultarProcuracao(): Promise<Result<ProcuracaoDto, AppError>> {
    return this.responder(
      this.opcoes.procuracaoVigente === false
        ? { vigente: false }
        : { vigente: true, dataExpiracao: "2027-12-31" },
    );
  }

  private responder<T>(valor: T): Result<T, AppError> {
    if (this.opcoes.falhar) return err(new ServicoExternoError("Serpro indisponível (simulado)."));
    return ok(valor);
  }
}
