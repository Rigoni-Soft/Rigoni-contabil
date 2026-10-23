import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { ok } from "@/shared/kernel/result";

import { LerPdfDeParcelamento } from "./ler-pdf-de-parcelamento.use-case";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CNPJ_DO_CLIENTE = "11444777000161";

const SEM_ACORDO = {
  cnpj: null,
  origem: null,
  totalDeParcelas: null,
  valorDaParcelaCentavos: null,
  dataDeAdesao: null,
};
const lida = (sobrescrever: Partial<Extract<LeituraDeParcelamento, { lido: true }>> = {}) =>
  ({
    lido: true,
    codigo: "123456",
    quantidadeDeParcelas: 7,
    ...SEM_ACORDO,
    ...sobrescrever,
  }) as LeituraDeParcelamento;

function montar(
  leitura: LeituraDeParcelamento,
  opcoes: { ator?: AtorSessaoDto | null; clienteExiste?: boolean } = {},
) {
  const ator =
    opcoes.ator === undefined
      ? { id: "u-1", papel: "funcionario", setor: "simples_nacional" }
      : opcoes.ator;
  const sessao: SessaoPort = { usuarioAtual: async () => ator };
  const cliente = Cliente.builder()
    .comId(CLIENTE_ID)
    .comEmpresa("Padaria Ltda")
    .comCnpj(CNPJ_DO_CLIENTE)
    .comRegime("simples_nacional")
    .comAlteracoesContratuais([])
    .build();
  if (!cliente.ok) throw new Error("setup inválido");
  const clientes = {
    buscarPorId: async () => ok(opcoes.clienteExiste === false ? null : cliente.value),
  } as unknown as ClienteRepository;
  const recebidos: Uint8Array[] = [];
  const leitor: LeitorDeParcelamentoPort = {
    ler: async (pdf) => {
      recebidos.push(pdf);
      return leitura;
    },
  };
  return { useCase: new LerPdfDeParcelamento(sessao, clientes, leitor), recebidos };
}

const entrada = { pdf: PDF, clienteId: CLIENTE_ID };

describe("LerPdfDeParcelamento", () => {
  it("sugere o código e a quantidade lidos do PDF", async () => {
    const { useCase, recebidos } = montar(lida({ codigo: " 123456 " }));

    const r = await useCase.execute(entrada);

    expect(r.ok && r.value).toMatchObject({
      lido: true,
      codigo: "123456",
      codigoGerado: false,
      quantidadeDeParcelas: 7,
    });
    expect(recebidos).toEqual([PDF]);
  });

  it("PDF sem código: gera um código interno e avisa que foi gerado", async () => {
    const { useCase } = montar(lida({ codigo: null }));

    const r = await useCase.execute(entrada);

    expect(r.ok && r.value).toMatchObject({
      lido: true,
      codigoGerado: true,
      quantidadeDeParcelas: 7,
    });
    expect(r.ok && r.value.lido && r.value.codigo).toMatch(/^PARC-[0-9A-F]{8}$/);
  });

  it.each([0, -3, 2.5, Number.NaN])(
    "quantidade %s é ilegível, nunca sugerida",
    async (quantidade) => {
      const { useCase } = montar(lida({ quantidadeDeParcelas: quantidade }));

      const r = await useCase.execute(entrada);

      expect(r).toEqual({ ok: true, value: { lido: false, motivo: "ilegivel" } });
    },
  );

  it("repassa o motivo da falha do leitor", async () => {
    const { useCase } = montar({ lido: false, motivo: "limite" });

    expect(await useCase.execute(entrada)).toEqual({
      ok: true,
      value: { lido: false, motivo: "limite" },
    });
  });

  it("sem sessão ou sem permissão no Cadastro operacional: Forbidden, sem chamar o leitor", async () => {
    for (const ator of [null, { id: "u-2", papel: "funcionario", setor: "pessoal" }]) {
      const { useCase, recebidos } = montar(lida(), { ator });

      const r = await useCase.execute(entrada);

      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      expect(recebidos).toHaveLength(0);
    }
  });

  it("Cliente inexistente: NotFound, sem chamar o leitor", async () => {
    const { useCase, recebidos } = montar(lida(), { clienteExiste: false });

    const r = await useCase.execute(entrada);

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(recebidos).toHaveLength(0);
  });

  describe("dados do acordo", () => {
    it("leva origem, total, valor da parcela e data de adesão lidos", async () => {
      const { useCase } = montar(
        lida({
          origem: "pgfn",
          totalDeParcelas: 5,
          valorDaParcelaCentavos: 26289,
          dataDeAdesao: "2026-01-27",
        }),
      );

      const r = await useCase.execute(entrada);

      expect(r.ok && r.value.lido && r.value.acordo).toEqual({
        origem: "pgfn",
        totalDeParcelas: 5,
        valorDaParcelaCentavos: 26289,
        dataDeAdesao: "2026-01-27",
      });
    });

    it.each([
      ["CNPJ igual (com pontuação)", "11.444.777/0001-61", true],
      ["CNPJ de outra empresa", "10.690.529/0001-38", false],
      ["PDF sem CNPJ legível", null, null],
    ])("%s: cnpjConfere = %s", async (_nome, cnpj, esperado) => {
      const { useCase } = montar(lida({ cnpj }));

      const r = await useCase.execute(entrada);

      expect(r.ok && r.value.lido && r.value.cnpjConfere).toBe(esperado);
    });
  });
});
