import {
  decidirAcesso,
  type FinalidadeDoAcesso,
  type PedidoDeAcesso,
} from "@/modules/rh/domain/services/acesso-rh.service";

const AGORA = new Date("2026-11-15T15:00:00Z");
const MENSAGENS = { semAcesso: "Sem acesso ao teste.", mesFuturo: "Mês futuro no teste." };

const RESPONSAVEL = { id: "u-resp", papel: "funcionario", setor: "rh" };
const COLEGA = { id: "u-colega", papel: "funcionario", setor: "rh" };
const LIDER = { id: "u-lider", papel: "lider_setor", setor: "rh" };
const ADMIN = { id: "u-admin", papel: "admin", setor: "administrativo" };
const OUTRO_SETOR = { id: "u-sn", papel: "funcionario", setor: "simples_nacional" };

const pedir = (parcial: Partial<PedidoDeAcesso> & { finalidade: FinalidadeDoAcesso }) =>
  decidirAcesso({
    ator: RESPONSAVEL,
    agora: AGORA,
    responsavelDoCliente: RESPONSAVEL.id,
    mensagens: MENSAGENS,
    ...parcial,
  });

const MES = { corrente: "2026-11", passado: "2026-10", futuro: "2026-12" };

describe("decidirAcesso: leitura", () => {
  it("o RH inteiro e o Admin leem; outro setor não; sem sessão usa a mensagem da tela", () => {
    for (const ator of [RESPONSAVEL, COLEGA, LIDER, ADMIN]) {
      expect(pedir({ finalidade: "leitura", ator }).ok).toBe(true);
    }
    const outro = pedir({ finalidade: "leitura", ator: OUTRO_SETOR });
    expect(!outro.ok && outro.error.message).toBe(MENSAGENS.semAcesso);
    const anonimo = pedir({ finalidade: "leitura", ator: null });
    expect(!anonimo.ok && anonimo.error.message).toBe(MENSAGENS.semAcesso);
  });

  it("alcance 'lideranca': só o Líder do RH e o Admin", () => {
    expect(pedir({ finalidade: "leitura", alcance: "lideranca", ator: LIDER }).ok).toBe(true);
    expect(pedir({ finalidade: "leitura", alcance: "lideranca", ator: ADMIN }).ok).toBe(true);
    expect(pedir({ finalidade: "leitura", alcance: "lideranca", ator: RESPONSAVEL }).ok).toBe(
      false,
    );
  });

  it("o Funcionário lê só os seus Clientes (escopo pelo id); Líder e Admin leem todos", () => {
    const func = pedir({ finalidade: "leitura", ator: RESPONSAVEL });
    const lider = pedir({ finalidade: "leitura", ator: LIDER });
    const admin = pedir({ finalidade: "leitura", ator: ADMIN });

    expect(func.ok && func.value.escopo).toEqual({ responsavelId: RESPONSAVEL.id });
    expect(lider.ok && lider.value.escopo).toEqual({ responsavelId: null });
    expect(admin.ok && admin.value.escopo).toEqual({ responsavelId: null });
  });

  it("sem competência vale o mês corrente; passado vale; futuro e formato inválido são recusados", () => {
    const semMes = pedir({ finalidade: "leitura" });
    expect(semMes.ok && semMes.value.competencia.valor).toBe(MES.corrente);
    expect(pedir({ finalidade: "leitura", competencia: MES.passado }).ok).toBe(true);
    const futuro = pedir({ finalidade: "leitura", competencia: MES.futuro });
    expect(!futuro.ok && futuro.error.message).toBe(MENSAGENS.mesFuturo);
    expect(pedir({ finalidade: "leitura", competencia: "11/2026" }).ok).toBe(false);
  });
});

describe("decidirAcesso: edição", () => {
  it("o Responsável do Cliente, o Líder e o Admin editam o mês corrente; o colega e outro setor não", () => {
    for (const ator of [RESPONSAVEL, LIDER, ADMIN]) {
      expect(pedir({ finalidade: "edicao", ator, competencia: MES.corrente }).ok).toBe(true);
    }
    for (const ator of [COLEGA, OUTRO_SETOR]) {
      const r = pedir({ finalidade: "edicao", ator, competencia: MES.corrente });
      expect(!r.ok && r.error.message).toBe(MENSAGENS.semAcesso);
    }
  });

  it("Cliente sem Responsável: só o Líder e o Admin editam", () => {
    const sem = { finalidade: "edicao", responsavelDoCliente: null } as const;
    expect(pedir({ ...sem, ator: RESPONSAVEL }).ok).toBe(false);
    expect(pedir({ ...sem, ator: LIDER }).ok).toBe(true);
    expect(pedir({ ...sem, ator: ADMIN }).ok).toBe(true);
  });

  it("mês passado não se edita aqui; futuro é recusado; sem sessão é recusado", () => {
    expect(pedir({ finalidade: "edicao", competencia: MES.passado }).ok).toBe(false);
    const futuro = pedir({ finalidade: "edicao", competencia: MES.futuro });
    expect(!futuro.ok && futuro.error.message).toBe(MENSAGENS.mesFuturo);
    const anonimo = pedir({ finalidade: "edicao", ator: null });
    expect(!anonimo.ok && anonimo.error.message).toBe("Sessão inválida. Entre novamente.");
  });
});

describe("decidirAcesso: edição retroativa", () => {
  it("só o Líder do RH e o Admin editam o mês passado; o Responsável não", () => {
    expect(
      pedir({ finalidade: "edicao_retroativa", ator: LIDER, competencia: MES.passado }).ok,
    ).toBe(true);
    expect(
      pedir({ finalidade: "edicao_retroativa", ator: ADMIN, competencia: MES.passado }).ok,
    ).toBe(true);
    const resp = pedir({
      finalidade: "edicao_retroativa",
      ator: RESPONSAVEL,
      competencia: MES.passado,
    });
    expect(!resp.ok && resp.error.message).toBe(MENSAGENS.semAcesso);
  });

  it("mês futuro é recusado até para o Líder", () => {
    const r = pedir({ finalidade: "edicao_retroativa", ator: LIDER, competencia: MES.futuro });
    expect(!r.ok && r.error.message).toBe(MENSAGENS.mesFuturo);
  });
});

describe("decidirAcesso: download", () => {
  it("o Responsável do Cliente, o Líder e o Admin baixam o mês corrente ou o passado; o colega não", () => {
    for (const ator of [RESPONSAVEL, LIDER, ADMIN]) {
      expect(pedir({ finalidade: "download", ator, competencia: MES.passado }).ok).toBe(true);
      expect(pedir({ finalidade: "download", ator, competencia: MES.corrente }).ok).toBe(true);
    }
    expect(pedir({ finalidade: "download", ator: COLEGA }).ok).toBe(false);
  });

  it("mês futuro é recusado", () => {
    const r = pedir({ finalidade: "download", competencia: MES.futuro });
    expect(!r.ok && r.error.message).toBe(MENSAGENS.mesFuturo);
  });
});
