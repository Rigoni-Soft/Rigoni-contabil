import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { SerproFalsoGateway } from "@/modules/clientes/infra/gateways/serpro-falso.gateway";

import { BuscarGuia } from "./buscar-guia.use-case";

const CNPJ = "11.444.777/0001-61";
const logado: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
};
const deslogado: SessaoPort = { usuarioAtual: async () => null };

describe("BuscarGuia", () => {
  it("devolve DAS, parcelamento e CND do CNPJ", async () => {
    const r = await new BuscarGuia(logado, new SerproFalsoGateway()).execute(CNPJ);

    expect(r.ok && r.value.das.nomeArquivo).toBe("das-11444777000161.pdf");
    expect(r.ok && r.value.parcelamento.parcela).toBe("202609");
    expect(r.ok && r.value.cnd.validade).toBe("2027-03-31");
  });

  it("falha do Serpro vira erro de domínio, sem lançar", async () => {
    const r = await new BuscarGuia(logado, new SerproFalsoGateway({ falhar: true })).execute(CNPJ);

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("cliente sem procuração vigente falha de forma acionável", async () => {
    const r = await new BuscarGuia(
      logado,
      new SerproFalsoGateway({ procuracaoVigente: false }),
    ).execute(CNPJ);

    expect(!r.ok && r.error.message).toMatch(/sem procuração/);
  });

  it("rejeita CNPJ inválido", async () => {
    const r = await new BuscarGuia(logado, new SerproFalsoGateway()).execute("123");

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });

  it("exige sessão", async () => {
    const r = await new BuscarGuia(deslogado, new SerproFalsoGateway()).execute(CNPJ);

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
