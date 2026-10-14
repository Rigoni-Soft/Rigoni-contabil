import { expedienteDecorrido } from "./expediente.service";
import { decidirInatividade, type EstadoInatividade } from "./inatividade.service";

const sp = (iso: string) => new Date(`${iso}-03:00`);
const NENHUM = new Set<string>();
const HORA = 3_600_000;
// 2026-10-07 é quarta-feira, dia útil.
const T0 = sp("2026-10-07T10:00:00");

describe("expedienteDecorrido", () => {
  it("conta o tempo dentro do dia", () => {
    expect(expedienteDecorrido(T0, sp("2026-10-07T12:00:00"), NENHUM)).toBe(2 * HORA);
  });

  it("pula a noite", () => {
    expect(expedienteDecorrido(sp("2026-10-07T17:00:00"), sp("2026-10-08T09:00:00"), NENHUM)).toBe(
      2 * HORA,
    );
  });

  it("pula fim de semana, feriado nacional e feriado cadastrado", () => {
    // sexta 17h -> terça 09h; 12/10 (segunda) é feriado nacional.
    expect(expedienteDecorrido(sp("2026-10-09T17:00:00"), sp("2026-10-13T09:00:00"), NENHUM)).toBe(
      2 * HORA,
    );
    const extras = new Set(["2026-10-08"]);
    expect(expedienteDecorrido(sp("2026-10-07T17:00:00"), sp("2026-10-09T09:00:00"), extras)).toBe(
      2 * HORA,
    );
  });
});

describe("decidirInatividade", () => {
  const contatoPorUltimo: EstadoInatividade = {
    ultimaDoContato: T0,
    ultimaDoFuncionario: sp("2026-10-07T09:00:00"),
    aviso: null,
  };
  const funcionarioPorUltimo: EstadoInatividade = {
    ultimaDoContato: sp("2026-10-07T09:00:00"),
    ultimaDoFuncionario: T0,
    aviso: null,
  };

  it("1h59 sem resposta não avisa; 2h00 avisa o Funcionário", () => {
    expect(decidirInatividade(contatoPorUltimo, sp("2026-10-07T11:59:00"), NENHUM)).toEqual({
      acao: "nada",
    });
    expect(decidirInatividade(contatoPorUltimo, sp("2026-10-07T12:00:00"), NENHUM)).toEqual({
      acao: "avisar",
      de: "funcionario",
    });
  });

  it("última do Funcionário: o inativo é o cliente", () => {
    expect(decidirInatividade(funcionarioPorUltimo, sp("2026-10-07T11:59:00"), NENHUM)).toEqual({
      acao: "nada",
    });
    expect(decidirInatividade(funcionarioPorUltimo, sp("2026-10-07T12:00:00"), NENHUM)).toEqual({
      acao: "avisar",
      de: "contato",
    });
  });

  it("só tem Mensagem de um lado: o outro é o inativo; sem nenhuma, nada", () => {
    const soContato = { ultimaDoContato: T0, ultimaDoFuncionario: null, aviso: null };
    expect(decidirInatividade(soContato, sp("2026-10-07T12:00:00"), NENHUM)).toEqual({
      acao: "avisar",
      de: "funcionario",
    });
    const nenhuma = { ultimaDoContato: null, ultimaDoFuncionario: null, aviso: null };
    expect(decidirInatividade(nenhuma, sp("2026-10-07T17:00:00"), NENHUM)).toEqual({
      acao: "nada",
    });
  });

  const avisado = (de: "contato" | "funcionario"): EstadoInatividade => ({
    ...(de === "funcionario" ? contatoPorUltimo : funcionarioPorUltimo),
    aviso: { em: sp("2026-10-07T12:00:00"), de },
  });

  it("9m59 depois do aviso não encerra; 10m00 encerra, nos dois casos", () => {
    for (const de of ["contato", "funcionario"] as const) {
      expect(decidirInatividade(avisado(de), sp("2026-10-07T12:09:59"), NENHUM)).toEqual({
        acao: "nada",
      });
      expect(decidirInatividade(avisado(de), sp("2026-10-07T12:10:00"), NENHUM)).toEqual({
        acao: "encerrar",
      });
    }
  });

  it("ação de quem estava inativo cancela, nos dois casos", () => {
    const cliente = { ...avisado("contato"), ultimaDoContato: sp("2026-10-07T12:05:00") };
    const funcionario = {
      ...avisado("funcionario"),
      ultimaDoFuncionario: sp("2026-10-07T12:05:00"),
    };
    for (const estado of [cliente, funcionario]) {
      expect(decidirInatividade(estado, sp("2026-10-07T12:10:00"), NENHUM)).toEqual({
        acao: "cancelar",
      });
    }
  });

  it("Mensagem de quem não estava inativo não cancela", () => {
    const estado = { ...avisado("contato"), ultimaDoFuncionario: sp("2026-10-07T12:05:00") };
    expect(decidirInatividade(estado, sp("2026-10-07T12:10:00"), NENHUM)).toEqual({
      acao: "encerrar",
    });
  });

  it("fora do expediente a URA não avisa nem encerra", () => {
    expect(decidirInatividade(contatoPorUltimo, sp("2026-10-07T18:30:00"), NENHUM)).toEqual({
      acao: "nada",
    });
    expect(decidirInatividade(avisado("contato"), sp("2026-10-07T18:30:00"), NENHUM)).toEqual({
      acao: "nada",
    });
  });

  it("a espera de 10 minutos corre só no expediente", () => {
    const estado: EstadoInatividade = {
      ...funcionarioPorUltimo,
      aviso: { em: sp("2026-10-07T17:55:00"), de: "contato" },
    };
    expect(decidirInatividade(estado, sp("2026-10-08T08:04:00"), NENHUM)).toEqual({ acao: "nada" });
    expect(decidirInatividade(estado, sp("2026-10-08T08:05:00"), NENHUM)).toEqual({
      acao: "encerrar",
    });
  });
});
