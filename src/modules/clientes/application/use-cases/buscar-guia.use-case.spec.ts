import type {
  CertidaoCndPort,
  CndDto,
} from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type {
  AutorizacaoDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ObrigacoesFiscaisPort,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { BuscarGuia } from "./buscar-guia.use-case";

const CNPJ = "11.444.777/0001-61";
const logado: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
};
const deslogado: SessaoPort = { usuarioAtual: async () => null };

const pdf = { nomeArquivo: "x.pdf", pdfBase64: "JVBERg==" };

class FontesFalsas implements ObrigacoesFiscaisPort {
  constructor(private readonly opcoes: { falhar?: boolean; autorizado?: boolean } = {}) {}

  async buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>> {
    return this.responder({
      ...pdf,
      nomeArquivo: `das-${cnpj}.pdf`,
      competencia: "2026-09",
      valorCentavos: 150_000,
      vencimento: "2026-10-20",
    });
  }

  async buscarGuiaParcelamento(): Promise<Result<GuiaParcelamentoDto, AppError>> {
    return this.responder({
      ...pdf,
      parcela: "202609",
      valorCentavos: 1,
      vencimento: "2026-10-31",
    });
  }

  async consultarAutorizacao(): Promise<Result<AutorizacaoDto, AppError>> {
    return this.responder(
      this.opcoes.autorizado === false
        ? { vigente: false }
        : { vigente: true, dataExpiracao: "2027-12-31" },
    );
  }

  private responder<T>(valor: T): Result<T, AppError> {
    return this.opcoes.falhar ? err(new ServicoExternoError("indisponível")) : ok(valor);
  }
}

class CertidoesFalsas implements CertidaoCndPort {
  async buscarCnd(): Promise<Result<CndDto, AppError>> {
    return ok({ ...pdf, validade: "2027-03-31" });
  }
}

describe("BuscarGuia", () => {
  it("devolve DAS, parcelamento e CND do CNPJ (só dígitos na porta)", async () => {
    const r = await new BuscarGuia(logado, new FontesFalsas(), new CertidoesFalsas()).execute(
      CNPJ,
      "simples_nacional",
    );

    expect(r.ok && r.value.das.nomeArquivo).toBe("das-11444777000161.pdf");
    expect(r.ok && r.value.parcelamento.parcela).toBe("202609");
    expect(r.ok && r.value.cnd.validade).toBe("2027-03-31");
  });

  it("falha da fonte vira erro de domínio, sem lançar", async () => {
    const r = await new BuscarGuia(
      logado,
      new FontesFalsas({ falhar: true }),
      new CertidoesFalsas(),
    ).execute(CNPJ, "simples_nacional");

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("cliente sem autorização vigente falha de forma acionável", async () => {
    const r = await new BuscarGuia(
      logado,
      new FontesFalsas({ autorizado: false }),
      new CertidoesFalsas(),
    ).execute(CNPJ, "simples_nacional");

    expect(!r.ok && r.error.message).toMatch(/sem autorização/);
  });

  it("adapter que lança exceção vira erro de domínio", async () => {
    const certidoes = new CertidoesFalsas();
    certidoes.buscarCnd = async () => {
      throw new Error("timeout");
    };

    const r = await new BuscarGuia(logado, new FontesFalsas(), certidoes).execute(
      CNPJ,
      "simples_nacional",
    );

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("rejeita CNPJ inválido", async () => {
    const r = await new BuscarGuia(logado, new FontesFalsas(), new CertidoesFalsas()).execute(
      "123",
      "simples_nacional",
    );

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejeita regime sem parcelamento do Simples", async () => {
    const r = await new BuscarGuia(logado, new FontesFalsas(), new CertidoesFalsas()).execute(
      CNPJ,
      "lucro_real",
    );

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });

  it("exige sessão", async () => {
    const r = await new BuscarGuia(deslogado, new FontesFalsas(), new CertidoesFalsas()).execute(
      CNPJ,
      "simples_nacional",
    );

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
