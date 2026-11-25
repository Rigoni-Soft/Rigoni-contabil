import {
  camposMudaram,
  contatoDoMesmoNumero,
  contatoDoSetor,
  contatoEditavel,
  emBranco,
  enviosMudaram,
  instantaneoDe,
  problemasDosCampos,
  textoDoNumeroRepetido,
  type ValoresDaLinha,
} from "./contato-da-linha.presenter";
import { contatoNovo } from "./editar-cadastro-operacional.presenter";

const ana: ValoresDaLinha = {
  ...contatoNovo(),
  id: "c1",
  nome: "Ana",
  telefone: "(11) 99999-0000",
  email: "a@x.com",
};

describe("problemasDosCampos", () => {
  it("contato válido: nenhum problema", () => {
    expect(problemasDosCampos(ana)).toEqual([]);
  });

  it("nome vazio: o problema cai no campo nome", () => {
    const problemas = problemasDosCampos({ ...ana, nome: "" });
    expect(problemas.map((p) => p.campo)).toContain("nome");
  });
});

describe("emBranco", () => {
  it("só a linha sem nome, WhatsApp, e-mail e envios está em branco", () => {
    expect(emBranco(contatoNovo())).toBe(true);
    expect(emBranco({ ...contatoNovo(), nome: "Ana" })).toBe(false);
    expect(emBranco({ ...contatoNovo(), tipos: ["das"] })).toBe(false);
  });
});

describe("camposMudaram", () => {
  const antes = instantaneoDe(ana, []);

  it("compara o telefone pelos dígitos e o e-mail sem caixa nem espaço", () => {
    expect(camposMudaram(antes, { ...ana, telefone: "11999990000", email: " A@X.com " })).toBe(
      false,
    );
    expect(camposMudaram(antes, { ...ana, nome: "Ana Maria" })).toBe(true);
  });

  it("linha nova (sem id ou sem instantâneo) sempre grava os campos", () => {
    expect(camposMudaram(undefined, ana)).toBe(true);
    expect(camposMudaram(antes, { ...ana, id: undefined })).toBe(true);
  });
});

describe("enviosMudaram", () => {
  const antes = instantaneoDe(ana, ["das", "avisos"]);

  it("mesmos tipos em outra ordem: não mudou", () => {
    expect(enviosMudaram(antes, ana, ["avisos", "das"], false)).toBe(false);
  });

  it("tipo a mais ou a menos: mudou", () => {
    expect(enviosMudaram(antes, ana, ["das"], false)).toBe(true);
  });

  it("o canal só conta quando o contato o exige", () => {
    expect(enviosMudaram(antes, { ...ana, canal: "email" }, ["das", "avisos"], false)).toBe(false);
    expect(enviosMudaram(antes, { ...ana, canal: "email" }, ["das", "avisos"], true)).toBe(true);
  });

  it("sem instantâneo, basta ter envio", () => {
    expect(enviosMudaram(undefined, ana, [], false)).toBe(false);
    expect(enviosMudaram(undefined, ana, ["das"], false)).toBe(true);
  });
});

describe("contatoEditavel", () => {
  const rh = { admin: false, setorDoCadastro: "rh" };

  it("o dono edita; outro Setor e o contato do Admin ficam em leitura", () => {
    expect(contatoEditavel({ id: "c", donoSetor: "rh" }, rh)).toBe(true);
    expect(contatoEditavel({ id: "c", donoSetor: "simples_nacional" }, rh)).toBe(false);
    expect(contatoEditavel({ id: "c", donoSetor: null }, rh)).toBe(false);
  });

  it("o Admin edita todos e a linha nova é de quem a digita", () => {
    const admin = { admin: true, setorDoCadastro: "rh" };

    expect(contatoEditavel({ id: "c", donoSetor: "simples_nacional" }, admin)).toBe(true);
    expect(contatoEditavel({ donoSetor: undefined }, rh)).toBe(true);
    expect(contatoEditavel({ id: "c", donoSetor: undefined }, rh)).toBe(true);
  });
});

describe("contatoDoSetor", () => {
  it("é do Setor quem ele cadastrou ou escolheu", () => {
    expect(contatoDoSetor({ donoSetor: "rh" }, "rh")).toBe(true);
    expect(contatoDoSetor({ donoSetor: "simples_nacional", setores: ["rh"] }, "rh")).toBe(true);
    expect(contatoDoSetor({ donoSetor: "simples_nacional", setores: [] }, "rh")).toBe(false);
  });
});

describe("contatoDoMesmoNumero", () => {
  const contatos = [
    { id: "c-1", nome: "Ana", telefone: "(11) 99999-0000", email: "" },
    { id: "c-2", nome: "Bia", telefone: "", email: "bia@exemplo.com" },
    { nome: "Nova", telefone: "(11) 98888-0000", email: "" },
  ];

  it("acha o contato salvo pela chave do número: sem máscara e sem o DDI 55", () => {
    expect(contatoDoMesmoNumero(contatos, 2, "11999990000")?.contato.nome).toBe("Ana");
    expect(contatoDoMesmoNumero(contatos, 2, "+55 11 99999-0000")?.indice).toBe(0);
  });

  it("ignora a própria linha, o número vazio, o número novo e a linha ainda sem id", () => {
    expect(contatoDoMesmoNumero(contatos, 0, "(11) 99999-0000")).toBeUndefined();
    expect(contatoDoMesmoNumero(contatos, 2, "")).toBeUndefined();
    expect(contatoDoMesmoNumero(contatos, 2, "(11) 97777-0000")).toBeUndefined();
    expect(contatoDoMesmoNumero(contatos, 0, "(11) 98888-0000")).toBeUndefined();
  });
});

describe("textoDoNumeroRepetido", () => {
  it("fora da lista só informa de quem é o número; na lista diz que o contato já está nela", () => {
    expect(textoDoNumeroRepetido("Ana", false, true)).toBe("Este número já é do contato Ana.");
    expect(textoDoNumeroRepetido("Ana", true, true)).toBe(
      "Este número já é do contato Ana, que já está na lista deste Setor.",
    );
    expect(textoDoNumeroRepetido("Ana", true, false)).toBe(
      "Este número já é do contato Ana, que já está na lista.",
    );
  });
});
