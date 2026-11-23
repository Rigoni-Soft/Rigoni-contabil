import type { ValoresDaLinha } from "./contato-da-linha.presenter";
import { contatoNovo } from "./editar-cadastro-operacional.presenter";
import {
  enviosDaLinha,
  existentesDaLinha,
  MENSAGEM_SEM_CANAL,
  numeroRepetidoDaLinha,
} from "./opcoes-da-linha.presenter";

const ana = {
  ...contatoNovo(),
  id: "c1",
  nome: "Ana",
  telefone: "11 99999-0000",
  email: "a@x.com",
};
const beto = { ...contatoNovo(), id: "c2", nome: "Beto", telefone: "11 98888-1111", email: "" };
const nova = { ...contatoNovo(), telefone: "(11) 99999-0000" };

const entradaDosEnvios = (contato: ValoresDaLinha, semCanal = false) => ({
  contato,
  opcoes: [{ valor: "das", rotulo: "DAS" }],
  destinos: [],
  semCanal,
  onMudarCanal: jest.fn(),
  onAlternar: jest.fn(),
});

describe("enviosDaLinha", () => {
  it("contato com um canal só: sem 'Enviar por'", () => {
    const envios = enviosDaLinha(entradaDosEnvios({ ...beto, tipos: ["das"] }));
    expect(envios.canal).toBeUndefined();
    expect(envios.marcados).toEqual(["das"]);
  });

  it("os dois canais sem envio marcado: sem 'Enviar por'", () => {
    expect(enviosDaLinha(entradaDosEnvios({ ...ana, tipos: [] })).canal).toBeUndefined();
  });

  it("os dois canais com envio marcado: 'Enviar por' com o erro quando o Salvar o recusou", () => {
    const sem = enviosDaLinha(entradaDosEnvios({ ...ana, tipos: ["das"] }, true));
    expect(sem.canal?.erro).toBe(MENSAGEM_SEM_CANAL);
    expect(enviosDaLinha(entradaDosEnvios({ ...ana, tipos: ["das"] })).canal?.erro).toBeUndefined();
  });
});

describe("existentesDaLinha", () => {
  const base = {
    disponiveis: [{ id: "c1", contato: ana }],
    onEscolher: jest.fn(),
    onNovo: jest.fn(),
  };

  it("lista só nome, telefone e e-mail dos disponíveis", () => {
    const { opcoes } = existentesDaLinha({ ...base, contato: contatoNovo(), escolheuNovo: false });
    expect(opcoes).toEqual([
      { id: "c1", nome: "Ana", telefone: "11 99999-0000", email: "a@x.com" },
    ]);
  });

  it("modo novo quando escolheu 'Cadastrar novo' ou já digitou algo", () => {
    expect(
      existentesDaLinha({ ...base, contato: contatoNovo(), escolheuNovo: true }).modoNovo,
    ).toBe(true);
    expect(existentesDaLinha({ ...base, contato: nova, escolheuNovo: false }).modoNovo).toBe(true);
    expect(
      existentesDaLinha({ ...base, contato: contatoNovo(), escolheuNovo: false }).modoNovo,
    ).toBe(false);
  });
});

describe("numeroRepetidoDaLinha", () => {
  const entrada = (extra: Partial<Parameters<typeof numeroRepetidoDaLinha>[0]> = {}) => ({
    contatos: [ana, nova],
    indice: 1,
    verificado: "11999990000",
    admin: false,
    naLista: () => false,
    onUsar: jest.fn(),
    ...extra,
  });

  it("sem verificação do número atual: sem aviso", () => {
    expect(numeroRepetidoDaLinha(entrada({ verificado: undefined }))).toBeUndefined();
    expect(numeroRepetidoDaLinha(entrada({ verificado: "11888880000" }))).toBeUndefined();
  });

  it("contato fora da lista: aviso e botão para usá-lo", () => {
    const onUsar = jest.fn();
    const aviso = numeroRepetidoDaLinha(entrada({ onUsar }));
    expect(aviso?.texto).toBe("Este número já é do contato Ana.");
    aviso?.onUsar?.();
    expect(onUsar).toHaveBeenCalledWith("c1");
  });

  it("contato já na lista: aviso sem botão", () => {
    const aviso = numeroRepetidoDaLinha(entrada({ naLista: () => true }));
    expect(aviso?.texto).toContain("que já está na lista deste Setor");
    expect(aviso?.onUsar).toBeUndefined();
  });
});
