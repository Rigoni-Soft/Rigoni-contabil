import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

import {
  convencaoEscolhida,
  duracao,
  empregadosDosAjustes,
  historicoDeConvencoes,
  lerEnvioDoFormulario,
  linhasDeRegras,
  sindicatosDoCliente,
} from "./convencao.presenter";

const REGRAS: RegrasDaConvencao = {
  versao: 1,
  aplicadas: [
    {
      chave: "jornada_diaria",
      valor: 440,
      clausula: "Cláusula 8ª",
      trecho: "jornada de 7h20 por dia",
    },
    {
      chave: "extra_sabado",
      valor: 60,
      clausula: "Cláusula 12ª",
      trecho: "adicional de 60%",
    },
    {
      chave: "limite_extras_dia",
      valor: 120,
      clausula: "Cláusula 11ª",
      trecho: "até 2 horas por dia",
    },
    {
      chave: "datas_especiais",
      valor: [
        { descricao: "Natal", data: "25/12", percentual: 150, percentualComissionado: 100 },
        { descricao: "Feriados em geral", data: null, percentual: 100 },
      ],
      clausula: "Cláusula 14ª",
      trecho: "25/12 com 150% (comissionado 100%); demais feriados, 100%",
    },
  ],
  rejeitadas: [
    { chave: "intervalo_maximo", motivo: "fora_do_trecho" },
    { chave: "vale_refeicao", motivo: "chave_desconhecida" },
  ],
};

const CONVENCAO: ConvencaoDto = {
  id: "cv1",
  sindicato: "Comércio",
  vigenciaInicio: "2026-05-01",
  vigenciaFim: "2027-04-30",
  arquivoNome: "cct.pdf",
  enviadaEm: "2026-11-11",
  regras: REGRAS,
};

describe("duracao", () => {
  it.each([
    [480, "8h"],
    [440, "7h20"],
    [90, "1h30"],
    [30, "30 min"],
    [2640, "44h"],
  ])("%i minutos = %s", (minutos, texto) => {
    expect(duracao(minutos)).toBe(texto);
  });
});

describe("linhasDeRegras", () => {
  const linhas = linhasDeRegras(CONVENCAO);
  const de = (chave: string) => linhas.find((l) => l.chave === chave);

  it("traz uma linha por parâmetro do esquema, na ordem fixa, aplicado ou não", () => {
    expect(linhas.map((l) => l.chave)).toEqual([
      "jornada_semanal",
      "jornada_diaria",
      "limite_extras_dia",
      "intervalo_minimo",
      "intervalo_maximo",
      "extra_sabado",
      "datas_especiais",
      "excecoes_de_feriado",
    ]);
  });

  it("marca quais parâmetros entram no cálculo da Totalização", () => {
    expect(linhas.filter((l) => l.noCalculo).map((l) => l.chave)).toEqual([
      "limite_extras_dia",
      "extra_sabado",
      "datas_especiais",
    ]);
  });

  it("mostra a cláusula, o valor e a diferença para a legislação do tempo", () => {
    expect(de("jornada_diaria")).toMatchObject({
      aplicada: true,
      rotulo: "Jornada diária",
      valor: "7h20",
      legislacao: "8h",
      diferenca: "40 min a menos",
      clausula: "Cláusula 8ª",
      trecho: "jornada de 7h20 por dia",
    });
    expect(de("limite_extras_dia")?.diferenca).toBe("igual à legislação");
  });

  it("mostra a diferença do percentual em pontos", () => {
    expect(de("extra_sabado")).toMatchObject({
      valor: "60%",
      legislacao: "50%",
      diferenca: "+10 pontos",
    });
  });

  it("descreve o calendário de datas especiais e a maior diferença", () => {
    expect(de("datas_especiais")).toMatchObject({
      valor: "25/12 Natal: 150% (comissionado 100%); Feriados em geral: 100%",
      legislacao: "100%",
      diferenca: "+50 pontos na maior",
    });
  });

  it("o que não virou parâmetro fica 'não aplicada' e vale a legislação", () => {
    expect(de("jornada_semanal")).toMatchObject({
      aplicada: false,
      valor: "Não aplicada",
      legislacao: "44h",
      diferenca: "vale a legislação",
      clausula: "",
      motivo: undefined,
    });
  });

  it("explica por que o parâmetro foi rejeitado, e ignora chave fora do esquema", () => {
    expect(de("intervalo_maximo")).toMatchObject({
      aplicada: false,
      motivo: "O número não aparece no trecho citado",
    });
    expect(linhas.some((l) => l.chave === ("vale_refeicao" as never))).toBe(false);
  });

  it("exceções de feriado sem regra própria na legislação", () => {
    expect(de("excecoes_de_feriado")).toMatchObject({
      aplicada: false,
      legislacao: "Sem exceção",
    });
  });
});

describe("historicoDeConvencoes e convencaoEscolhida", () => {
  const outra: ConvencaoDto = { ...CONVENCAO, id: "cv0", vigenciaInicio: "2025-05-01" };

  it("formata a vigência e o envio e marca a que está em tela", () => {
    expect(historicoDeConvencoes([CONVENCAO, outra], "cv0", "/rh/x")).toEqual([
      {
        id: "cv1",
        sindicato: "Comércio",
        vigencia: "01/05/2026 a 30/04/2027",
        arquivoNome: "cct.pdf",
        enviadaEm: "11/11/2026",
        href: "/rh/x?convencao=cv1",
        selecionada: false,
      },
      {
        id: "cv0",
        sindicato: "Comércio",
        vigencia: "01/05/2025 a 30/04/2027",
        arquivoNome: "cct.pdf",
        enviadaEm: "11/11/2026",
        href: "/rh/x?convencao=cv0",
        selecionada: true,
      },
    ]);
  });

  it("sem pedido (ou id desconhecido) abre a mais recente", () => {
    expect(convencaoEscolhida([CONVENCAO, outra])?.id).toBe("cv1");
    expect(convencaoEscolhida([CONVENCAO, outra], "x")?.id).toBe("cv1");
    expect(convencaoEscolhida([CONVENCAO, outra], "cv0")?.id).toBe("cv0");
    expect(convencaoEscolhida([])).toBeUndefined();
  });
});

describe("sindicatosDoCliente e empregadosDosAjustes", () => {
  it("lista os sindicatos sem repetir, em ordem, e o ponteiro de cada empregado", () => {
    const outra: ConvencaoDto = { ...CONVENCAO, id: "cv2", sindicato: "Bancários" };
    const renovada: ConvencaoDto = { ...CONVENCAO, id: "cv3" };

    expect(sindicatosDoCliente([CONVENCAO, outra, renovada])).toEqual(["Bancários", "Comércio"]);
    expect(
      empregadosDosAjustes({
        empregados: [
          { id: "e1", nome: "Ana", convencaoSindicato: null },
          { id: "e2", nome: "Bia", convencaoSindicato: "Comércio" },
        ],
      } as never),
    ).toEqual([
      { id: "e1", nome: "Ana", sindicato: "" },
      { id: "e2", nome: "Bia", sindicato: "Comércio" },
    ]);
  });
});

describe("lerEnvioDoFormulario", () => {
  const pdf = new File(["%PDF-1.7"], "cct.pdf", { type: "application/pdf" });

  it("monta o FormData da Server Action com o Cliente e o PDF", () => {
    const r = lerEnvioDoFormulario("c1", pdf);

    expect(r.ok && Object.fromEntries(r.formData)).toEqual({
      clienteId: "c1",
      arquivo: expect.any(File),
    });
  });

  it.each([
    ["sem arquivo", undefined, "Escolha o PDF da convenção."],
    [
      "arquivo que não é PDF",
      new File(["x"], "cct.docx", { type: "application/msword" }),
      "Envie a convenção em PDF.",
    ],
  ])("recusa %s", (_nome, arquivo, erro) => {
    expect(lerEnvioDoFormulario("c1", arquivo)).toEqual({ ok: false, erro });
  });

  it("recusa PDF acima de 4 MB", () => {
    const grande = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "cct.pdf", {
      type: "application/pdf",
    });

    expect(lerEnvioDoFormulario("c1", grande)).toEqual({
      ok: false,
      erro: "O PDF passa de 4 MB.",
    });
  });
});
