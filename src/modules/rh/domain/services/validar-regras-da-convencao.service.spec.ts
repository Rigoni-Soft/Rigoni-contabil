import {
  validarRegrasDaConvencao,
  type RegraCandidata,
} from "@/modules/rh/domain/services/validar-regras-da-convencao.service";
import { VERSAO_DO_ESQUEMA } from "@/shared/kernel/regras-da-convencao";

const cand = (
  chave: string,
  valor: unknown,
  trecho: string,
  clausula = "Cláusula 10ª",
): RegraCandidata => ({ chave, valor, clausula, trecho });

describe("validarRegrasDaConvencao", () => {
  it("aceita o parâmetro cujo número aparece no trecho e guarda a cláusula", () => {
    const r = validarRegrasDaConvencao([
      cand(
        "extra_sabado",
        60,
        "As horas trabalhadas aos sábados serão pagas com adicional de 60%.",
      ),
    ]);

    expect(r.versao).toBe(VERSAO_DO_ESQUEMA);
    expect(r.rejeitadas).toEqual([]);
    expect(r.aplicadas).toEqual([
      {
        chave: "extra_sabado",
        valor: 60,
        clausula: "Cláusula 10ª",
        trecho: "As horas trabalhadas aos sábados serão pagas com adicional de 60%.",
      },
    ]);
  });

  it("descarta o parâmetro cujo número não aparece no trecho", () => {
    const r = validarRegrasDaConvencao([
      cand("extra_sabado", 70, "Aos sábados o adicional será de 60%."),
    ]);

    expect(r.aplicadas).toEqual([]);
    expect(r.rejeitadas).toEqual([{ chave: "extra_sabado", motivo: "fora_do_trecho" }]);
  });

  it("rejeita percentual abaixo do piso da legislação", () => {
    const r = validarRegrasDaConvencao([
      cand("extra_sabado", 30, "Aos sábados o adicional será de 30%."),
    ]);

    expect(r.rejeitadas).toEqual([{ chave: "extra_sabado", motivo: "abaixo_da_legislacao" }]);
  });

  it.each([
    ["minutos escritos", 120, "limite de 120 minutos por dia"],
    ["horas inteiras", 120, "no máximo 2 horas extras por dia"],
    ["hora e minuto", 440, "jornada de 7h20 por dia"],
    ["relógio", 480, "jornada diária de 08:00"],
    ["semana", 2640, "carga de 44 horas semanais", "jornada_semanal"],
  ])("confere o número de tempo em %s", (_nome, minutos, trecho, chave = "limite_extras_dia") => {
    const r = validarRegrasDaConvencao([cand(chave, minutos, trecho)]);
    expect(r.rejeitadas).toEqual([]);
    expect(r.aplicadas).toHaveLength(1);
  });

  it("não aceita o tempo que só aparece por extenso", () => {
    const r = validarRegrasDaConvencao([
      cand("limite_extras_dia", 120, "no máximo duas horas extras por dia"),
    ]);
    expect(r.rejeitadas).toEqual([{ chave: "limite_extras_dia", motivo: "fora_do_trecho" }]);
  });

  it("rejeita chave fora do esquema fechado", () => {
    const r = validarRegrasDaConvencao([cand("vale_refeicao", 30, "vale de 30 reais")]);
    expect(r.rejeitadas).toEqual([{ chave: "vale_refeicao", motivo: "chave_desconhecida" }]);
  });

  it.each([
    ["sem cláusula", { clausula: "", trecho: "adicional de 60%" }],
    ["sem trecho", { clausula: "Cl. 5", trecho: "  " }],
  ])("rejeita parâmetro %s", (_nome, citacao) => {
    const r = validarRegrasDaConvencao([{ chave: "extra_sabado", valor: 60, ...citacao }]);
    expect(r.rejeitadas).toEqual([{ chave: "extra_sabado", motivo: "sem_citacao" }]);
  });

  it.each([
    ["texto no lugar do número", "60", "adicional de 60%"],
    ["número negativo", -5, "adicional de 5%"],
    ["fracionário em minutos", 30.5, "30 e 5 minutos"],
  ])("rejeita valor inválido: %s", (_nome, valor, trecho) => {
    const chave = _nome === "fracionário em minutos" ? "intervalo_minimo" : "extra_sabado";
    const r = validarRegrasDaConvencao([cand(chave, valor, trecho)]);
    expect(r.rejeitadas).toEqual([{ chave, motivo: "valor_invalido" }]);
  });

  it("mantém a primeira regra de uma chave e rejeita a repetida", () => {
    const r = validarRegrasDaConvencao([
      cand("extra_sabado", 60, "adicional de 60%", "Cl. 1"),
      cand("extra_sabado", 80, "adicional de 80%", "Cl. 2"),
    ]);

    expect(r.aplicadas.map((a) => a.clausula)).toEqual(["Cl. 1"]);
    expect(r.rejeitadas).toEqual([{ chave: "extra_sabado", motivo: "duplicada" }]);
  });

  describe("datas especiais", () => {
    const trecho =
      "O trabalho em 25/12 e 01/01 será pago com adicional de 150%; nos demais feriados, 100%.";

    it("aceita o calendário quando cada data e percentual aparecem no trecho", () => {
      const r = validarRegrasDaConvencao([
        cand(
          "datas_especiais",
          [
            { descricao: "Natal", data: "25/12", percentual: 150 },
            { descricao: "Confraternização", data: "01/01", percentual: 150 },
            { descricao: "Demais feriados", data: null, percentual: 100 },
          ],
          trecho,
        ),
      ]);

      expect(r.rejeitadas).toEqual([]);
      expect(r.aplicadas[0]?.chave).toBe("datas_especiais");
    });

    it("aceita o percentual do comissionado se aparece no trecho, sem o piso da legislação", () => {
      const datas = [
        { descricao: "Natal", data: "25/12", percentual: 100, percentualComissionado: 50 },
      ];
      const ok = validarRegrasDaConvencao([
        cand("datas_especiais", datas, "Em 25/12: 100% e, para o comissionado, 50%."),
      ]);
      const fora = validarRegrasDaConvencao([cand("datas_especiais", datas, "Em 25/12: 100%.")]);

      expect(ok.rejeitadas).toEqual([]);
      expect(ok.aplicadas[0]?.valor).toEqual(datas);
      expect(fora.rejeitadas).toEqual([{ chave: "datas_especiais", motivo: "fora_do_trecho" }]);
    });

    it("rejeita o calendário inteiro se uma data não aparece no trecho", () => {
      const r = validarRegrasDaConvencao([
        cand(
          "datas_especiais",
          [
            { descricao: "Natal", data: "25/12", percentual: 150 },
            { descricao: "Ano novo", data: "02/01", percentual: 150 },
          ],
          trecho,
        ),
      ]);

      expect(r.rejeitadas).toEqual([{ chave: "datas_especiais", motivo: "fora_do_trecho" }]);
    });

    it("rejeita percentual de data especial abaixo de 100%", () => {
      const r = validarRegrasDaConvencao([
        cand(
          "datas_especiais",
          [{ descricao: "Natal", data: "25/12", percentual: 50 }],
          "25/12 com 50%",
        ),
      ]);

      expect(r.rejeitadas).toEqual([{ chave: "datas_especiais", motivo: "abaixo_da_legislacao" }]);
    });

    it("rejeita lista vazia, data inexistente e descrição vazia", () => {
      const vazia = validarRegrasDaConvencao([cand("datas_especiais", [], "100%")]);
      const falsa = validarRegrasDaConvencao([
        cand("datas_especiais", [{ descricao: "X", data: "31/02", percentual: 100 }], "31/02 100%"),
      ]);
      const semNome = validarRegrasDaConvencao([
        cand("datas_especiais", [{ descricao: " ", data: "25/12", percentual: 100 }], "25/12 100%"),
      ]);

      for (const r of [vazia, falsa, semNome]) {
        expect(r.rejeitadas).toEqual([{ chave: "datas_especiais", motivo: "valor_invalido" }]);
      }
    });
  });

  describe("exceções de feriado", () => {
    it("aceita quando a descrição aparece no trecho", () => {
      const r = validarRegrasDaConvencao([
        cand(
          "excecoes_de_feriado",
          [{ descricao: "Corpus Christi" }],
          "Não serão considerados feriado: Corpus Christi.",
        ),
      ]);
      expect(r.rejeitadas).toEqual([]);
      expect(r.aplicadas).toHaveLength(1);
    });

    it("rejeita quando a descrição não aparece no trecho", () => {
      const r = validarRegrasDaConvencao([
        cand("excecoes_de_feriado", [{ descricao: "Carnaval" }], "Corpus Christi não é feriado."),
      ]);
      expect(r.rejeitadas).toEqual([{ chave: "excecoes_de_feriado", motivo: "fora_do_trecho" }]);
    });
  });

  it("devolve o conjunto vazio quando nada vem do modelo", () => {
    expect(validarRegrasDaConvencao([])).toEqual({
      versao: VERSAO_DO_ESQUEMA,
      aplicadas: [],
      rejeitadas: [],
    });
  });
});
