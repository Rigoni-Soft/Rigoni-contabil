import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";

import { LerPdfDeParcelamento } from "./ler-pdf-de-parcelamento.use-case";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function montar(
  leitura: LeituraDeParcelamento,
  ator: AtorSessaoDto | null = {
    id: "u-1",
    papel: "funcionario",
    setor: "simples_nacional",
  },
) {
  const sessao: SessaoPort = { usuarioAtual: async () => ator };
  const recebidos: Uint8Array[] = [];
  const leitor: LeitorDeParcelamentoPort = {
    ler: async (pdf) => {
      recebidos.push(pdf);
      return leitura;
    },
  };
  return { useCase: new LerPdfDeParcelamento(sessao, leitor), recebidos };
}

describe("LerPdfDeParcelamento", () => {
  it("sugere o código e a quantidade lidos do PDF", async () => {
    const { useCase, recebidos } = montar({
      lido: true,
      codigo: " 123456 ",
      quantidadeDeParcelas: 7,
    });

    const r = await useCase.execute({ pdf: PDF });

    expect(r).toEqual({
      ok: true,
      value: { lido: true, codigo: "123456", codigoGerado: false, quantidadeDeParcelas: 7 },
    });
    expect(recebidos).toEqual([PDF]);
  });

  it("PDF sem código: gera um código interno e avisa que foi gerado", async () => {
    const { useCase } = montar({ lido: true, codigo: null, quantidadeDeParcelas: 7 });

    const r = await useCase.execute({ pdf: PDF });

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
      const { useCase } = montar({ lido: true, codigo: "A-1", quantidadeDeParcelas: quantidade });

      const r = await useCase.execute({ pdf: PDF });

      expect(r).toEqual({ ok: true, value: { lido: false, motivo: "ilegivel" } });
    },
  );

  it("repassa o motivo da falha do leitor", async () => {
    const { useCase } = montar({ lido: false, motivo: "limite" });

    expect(await useCase.execute({ pdf: PDF })).toEqual({
      ok: true,
      value: { lido: false, motivo: "limite" },
    });
  });

  it("sem sessão ou sem permissão no Cadastro operacional: Forbidden, sem chamar o leitor", async () => {
    for (const ator of [null, { id: "u-2", papel: "funcionario", setor: "pessoal" }]) {
      const { useCase, recebidos } = montar(
        { lido: true, codigo: "A", quantidadeDeParcelas: 1 },
        ator,
      );

      const r = await useCase.execute({ pdf: PDF });

      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      expect(recebidos).toHaveLength(0);
    }
  });
});
