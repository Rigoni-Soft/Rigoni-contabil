import {
  avisoDeCanalPerdido,
  contatoEditavel,
  contatosComTipos,
  opcoesDeTipos,
  tiposAposAlternar,
  tiposDoContato,
} from "./tipos-de-envio.presenter";

const TIPOS = [
  { slug: "das", rotulo: "DAS" },
  { slug: "avisos", rotulo: "Avisos" },
];

describe("opcoesDeTipos", () => {
  it("começa por 'Todos os envios' e segue o catálogo do Setor", () => {
    expect(opcoesDeTipos(TIPOS)).toEqual([
      { valor: "todos", rotulo: "Todos os envios" },
      { valor: "das", rotulo: "DAS" },
      { valor: "avisos", rotulo: "Avisos" },
    ]);
  });
});

describe("tiposDoContato", () => {
  it("lista o que o contato recebe; o destino sem tipo é 'todos'", () => {
    const destinos = [
      { contatoId: "c-1", tipo: "das", canal: "whatsapp" },
      { contatoId: "c-1", tipo: null, canal: "whatsapp" },
      { contatoId: "c-2", tipo: "avisos", canal: "email" },
    ];

    expect(tiposDoContato(destinos, "c-1")).toEqual(["das", "todos"]);
    expect(tiposDoContato(destinos, "c-3")).toEqual([]);
    expect(tiposDoContato(destinos, undefined)).toEqual([]);
  });
});

describe("tiposAposAlternar", () => {
  const OPCOES = ["todos", "das", "avisos"];

  it("marcar 'Todos os envios' marca todos os outros", () => {
    expect(tiposAposAlternar([], "todos", OPCOES)).toEqual(["todos", "das", "avisos"]);
    expect(tiposAposAlternar(["das"], "todos", OPCOES)).toEqual(["todos", "das", "avisos"]);
  });

  it("desmarcar 'Todos os envios' desmarca todos os outros", () => {
    expect(tiposAposAlternar(["todos", "das", "avisos"], "todos", OPCOES)).toEqual([]);
  });

  it("desmarcar um dos outros desmarca o 'Todos' e mantém os demais", () => {
    expect(tiposAposAlternar(["todos", "das", "avisos"], "avisos", OPCOES)).toEqual(["das"]);
  });

  it("marcar o último que faltava marca o 'Todos'", () => {
    expect(tiposAposAlternar(["das"], "avisos", OPCOES)).toEqual(["todos", "das", "avisos"]);
  });

  it("marcar um só não marca o 'Todos'", () => {
    expect(tiposAposAlternar([], "das", OPCOES)).toEqual(["das"]);
  });
});

describe("contatosComTipos", () => {
  it("devolve cada contato com o que ele recebe", () => {
    const r = contatosComTipos(
      [{ id: "c-1", nome: "Ana" }, { nome: "Sem id" }],
      [{ contatoId: "c-1", tipo: "das", canal: "email" }],
    );

    expect(r).toEqual([
      { id: "c-1", nome: "Ana", tipos: ["das"] },
      { nome: "Sem id", tipos: [] },
    ]);
  });
});

describe("avisoDeCanalPerdido", () => {
  const destinos = [{ contatoId: "c-1", tipo: "das", canal: "whatsapp_e_email" }];

  it("avisa o canal que algum envio usa e o contato deixou de ter, já na tela", () => {
    expect(avisoDeCanalPerdido(destinos, { id: "c-1", telefone: "", email: "a@b.com" })).toContain(
      "deixou de ter o WhatsApp",
    );
    expect(
      avisoDeCanalPerdido(destinos, { id: "c-1", telefone: "11999990000", email: "" }),
    ).toContain("deixou de ter o e-mail");
  });

  it("sem aviso quando o contato mantém os canais ou não recebe nada", () => {
    const completo = { id: "c-1", telefone: "11999990000", email: "a@b.com" };

    expect(avisoDeCanalPerdido(destinos, completo)).toBeUndefined();
    expect(avisoDeCanalPerdido(destinos, { ...completo, id: "c-9", telefone: "" })).toBeUndefined();
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
