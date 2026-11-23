import { podeCadastrarContatoUra } from "./contato-ura.service";

const DONO = { id: "func-1", papel: "funcionario" as const, setor: "recepcao" as const };
const ATENDIMENTO = { setor: "recepcao" as const, funcionarioId: "func-1" };

describe("podeCadastrarContatoUra", () => {
  it("libera o Funcionário da Recepção dono do Atendimento da Recepção", () => {
    expect(podeCadastrarContatoUra(DONO, ATENDIMENTO)).toBe(true);
  });

  it("libera o Líder da Recepção quando é o dono", () => {
    expect(podeCadastrarContatoUra({ ...DONO, papel: "lider_setor" }, ATENDIMENTO)).toBe(true);
  });

  it("recusa quem não é o dono, mesmo da Recepção", () => {
    expect(podeCadastrarContatoUra({ ...DONO, id: "func-2" }, ATENDIMENTO)).toBe(false);
  });

  it("recusa o Atendimento sem dono (na espera)", () => {
    expect(podeCadastrarContatoUra(DONO, { ...ATENDIMENTO, funcionarioId: null })).toBe(false);
  });

  it("recusa quem é de outro Setor, ainda que dono do Atendimento", () => {
    const rh = { id: "func-1", papel: "funcionario" as const, setor: "rh" as const };
    expect(podeCadastrarContatoUra(rh, { setor: "rh", funcionarioId: "func-1" })).toBe(false);
  });

  it("recusa o Atendimento que já saiu da Recepção", () => {
    expect(podeCadastrarContatoUra(DONO, { ...ATENDIMENTO, setor: "contabil" })).toBe(false);
  });
});
