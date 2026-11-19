import {
  avisoDeContatoDeOutroSetor,
  canaisDaEscolha,
  contatoComOMesmoCanal,
  contatoEditavel,
  linhasDeDestino,
  opcoesDeContato,
  opcoesDeTipo,
} from "./destinos-de-envio.presenter";

const ANA = { id: "c-1", nome: "Ana", telefone: "(11) 99999-0000", email: "ana@exemplo.com" };
const BIA = { id: "c-2", nome: "Bia", telefone: "", email: "bia@exemplo.com", donoSetor: "rh" };
const TIPOS = [
  { slug: "das", rotulo: "DAS" },
  { slug: "avisos", rotulo: "Avisos" },
];

describe("opcoesDeContato", () => {
  it("lista só os contatos salvos, pelo WhatsApp ou, sem número, pelo e-mail", () => {
    const semId = { nome: "Novo", telefone: "11988880000", email: "" };

    expect(opcoesDeContato([ANA, BIA, semId])).toEqual([
      { valor: "c-1", rotulo: "(11) 99999-0000" },
      { valor: "c-2", rotulo: "bia@exemplo.com" },
    ]);
  });
});

describe("opcoesDeTipo", () => {
  it("começa pelos 'todos os envios do Setor' e segue o catálogo", () => {
    expect(opcoesDeTipo(TIPOS)).toEqual([
      { valor: "", rotulo: "Todos os envios do Setor" },
      { valor: "das", rotulo: "DAS" },
      { valor: "avisos", rotulo: "Avisos" },
    ]);
  });
});

describe("canaisDaEscolha", () => {
  it("um canal só trava nele; dois canais pedem escolha; sem contato não há opção", () => {
    expect(canaisDaEscolha(BIA)).toMatchObject({ unico: "email" });
    expect(canaisDaEscolha(ANA).unico).toBeUndefined();
    expect(canaisDaEscolha(ANA).opcoes.map((o) => o.rotulo)).toEqual([
      "WhatsApp",
      "E-mail",
      "WhatsApp e E-mail",
    ]);
    expect(canaisDaEscolha(undefined)).toEqual({ opcoes: [], unico: undefined });
  });
});

describe("linhasDeDestino", () => {
  it("monta tipo, contato e canal por extenso", () => {
    const linhas = linhasDeDestino(
      [
        { id: "d-1", contatoId: "c-1", tipo: "das", canal: "whatsapp" },
        { id: "d-2", contatoId: "c-2", tipo: null, canal: "email" },
      ],
      [ANA, BIA],
      TIPOS,
    );

    expect(linhas).toEqual([
      {
        id: "d-1",
        tipo: "DAS",
        contato: "Ana",
        identificador: "(11) 99999-0000",
        canal: "WhatsApp",
        aviso: undefined,
      },
      {
        id: "d-2",
        tipo: "Todos os envios do Setor",
        contato: "Bia",
        identificador: "bia@exemplo.com",
        canal: "E-mail",
        aviso: undefined,
      },
    ]);
  });

  it("avisa quando o canal do destino foi removido do contato", () => {
    const [linha] = linhasDeDestino(
      [{ id: "d-1", contatoId: "c-2", tipo: "avisos", canal: "whatsapp_e_email" }],
      [BIA],
      TIPOS,
    );

    expect(linha.aviso).toContain("deixou de ter o WhatsApp");
  });

  it("contato que sumiu da lista não derruba a tabela", () => {
    const [linha] = linhasDeDestino(
      [{ id: "d-1", contatoId: "c-9", tipo: "legado", canal: "email" }],
      [ANA],
      TIPOS,
    );

    expect(linha).toMatchObject({ contato: "Contato removido", tipo: "legado", aviso: undefined });
  });
});

describe("contatoComOMesmoCanal", () => {
  it("acha o contato pelo mesmo número, em qualquer formatação, ou pelo mesmo e-mail", () => {
    expect(contatoComOMesmoCanal([ANA, BIA], { telefone: "+55 11 99999-0000", email: "" })).toBe(
      ANA,
    );
    expect(contatoComOMesmoCanal([ANA, BIA], { telefone: "", email: " BIA@exemplo.com " })).toBe(
      BIA,
    );
  });

  it("não acha com número e e-mail novos ou em branco", () => {
    expect(contatoComOMesmoCanal([ANA, BIA], { telefone: "11977770000", email: "x@y.com" })).toBe(
      undefined,
    );
    expect(contatoComOMesmoCanal([ANA, BIA], { telefone: "", email: "" })).toBe(undefined);
  });
});

describe("avisoDeContatoDeOutroSetor", () => {
  const rh = { admin: false, setorDoCadastro: "rh" };

  it("diz de quem é o contato em leitura; do Admin, só ele edita", () => {
    expect(avisoDeContatoDeOutroSetor({ id: "c", donoSetor: "simples_nacional" }, rh)).toBe(
      "Contato do Simples Nacional: só o Simples Nacional e o Admin editam. Você pode usá-lo como destino.",
    );
    expect(avisoDeContatoDeOutroSetor({ id: "c", donoSetor: null }, rh)).toBe(
      "Contato do Admin: só o Admin edita. Você pode usá-lo como destino.",
    );
  });

  it("sem texto quando o contato é editável", () => {
    expect(avisoDeContatoDeOutroSetor({ id: "c", donoSetor: "rh" }, rh)).toBeUndefined();
    expect(
      avisoDeContatoDeOutroSetor({ id: "c", donoSetor: "rh" }, { admin: true, setorDoCadastro: "x" }),
    ).toBeUndefined();
  });
});

describe("contatoEditavel", () => {
  const rh = { admin: false, setorDoCadastro: "rh" };

  it("o dono edita; outro Setor e o contato do Admin ficam em leitura", () => {
    expect(contatoEditavel(BIA, rh)).toBe(true);
    expect(contatoEditavel({ id: "c-3", donoSetor: "simples_nacional" }, rh)).toBe(false);
    expect(contatoEditavel({ id: "c-4", donoSetor: null }, rh)).toBe(false);
  });

  it("o Admin edita todos e a linha nova é de quem a digita", () => {
    expect(
      contatoEditavel({ id: "c-3", donoSetor: "simples_nacional" }, { ...rh, admin: true }),
    ).toBe(true);
    expect(contatoEditavel({ donoSetor: undefined }, rh)).toBe(true);
  });
});
