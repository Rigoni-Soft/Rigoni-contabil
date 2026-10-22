import type { AvisoCadastroDto } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";

import { anuncioDeAvisos, avisoCadastroParaView } from "./avisos-cadastro.presenter";

const BASE: AvisoCadastroDto = {
  id: "a1",
  tipo: "novo_cliente",
  clienteId: "c1",
  alteracaoId: null,
  alteracaoNumero: null,
  criadoEm: "2026-10-22T15:30:00.000Z",
  vistoEm: null,
};

describe("avisoCadastroParaView", () => {
  it("novo cliente não visto: título do fato, data de São Paulo e destino no Cliente", () => {
    expect(avisoCadastroParaView(BASE)).toEqual({
      id: "a1",
      titulo: "Novo Cliente no Cadastro operacional",
      quando: "22/10/2026, 12:30",
      visto: false,
      href: "/clientes/c1",
    });
  });

  it("nova alteração vista: título da alteração e visto verdadeiro", () => {
    const view = avisoCadastroParaView({
      ...BASE,
      tipo: "nova_alteracao",
      alteracaoId: "alt1",
      alteracaoNumero: 2,
      vistoEm: "2026-10-22T16:00:00.000Z",
    });

    expect(view.titulo).toBe("Nova Alteração contratual nº 2");
    expect(view.visto).toBe(true);
  });
});

describe("avisoCadastroParaView: título da alteração (#144)", () => {
  const ALTERACAO: AvisoCadastroDto = {
    ...BASE,
    tipo: "nova_alteracao",
    alteracaoId: "alt1",
    alteracaoNumero: 3,
  };

  it("diz o nº da alteração, para duas do mesmo Cliente não parecerem a mesma", () => {
    expect(avisoCadastroParaView(ALTERACAO).titulo).toBe("Nova Alteração contratual nº 3");
    expect(avisoCadastroParaView({ ...ALTERACAO, alteracaoNumero: 12 }).titulo).toBe(
      "Nova Alteração contratual nº 12",
    );
  });

  it("sem nº (aviso antigo ou alteração removida) mantém o título sem nº", () => {
    expect(avisoCadastroParaView({ ...ALTERACAO, alteracaoNumero: null }).titulo).toBe(
      "Nova Alteração contratual",
    );
  });

  it("novo cliente não ganha nº, mesmo com nº no dado", () => {
    expect(avisoCadastroParaView({ ...BASE, alteracaoNumero: 3 }).titulo).toBe(
      "Novo Cliente no Cadastro operacional",
    );
  });
});

describe("avisoCadastroParaView: destino (#144)", () => {
  const ALTERACAO: AvisoCadastroDto = {
    ...BASE,
    tipo: "nova_alteracao",
    alteracaoId: "alt1",
    alteracaoNumero: 2,
  };

  it("nova alteração leva ao Cliente com o nº da alteração do aviso", () => {
    expect(avisoCadastroParaView(ALTERACAO).href).toBe("/clientes/c1?alteracao=2");
  });

  it("o nº é o do aviso, não o da mais recente: alteração antiga também é apontada", () => {
    expect(avisoCadastroParaView({ ...ALTERACAO, alteracaoNumero: 1 }).href).toBe(
      "/clientes/c1?alteracao=1",
    );
  });

  it("novo cliente leva ao formulário sem destaque, mesmo com nº no dado", () => {
    expect(avisoCadastroParaView({ ...BASE, alteracaoNumero: 2 }).href).toBe("/clientes/c1");
  });

  it("nova alteração sem nº (aviso antigo ou alteração removida) cai no Cliente sem destaque", () => {
    expect(avisoCadastroParaView({ ...ALTERACAO, alteracaoNumero: null }).href).toBe(
      "/clientes/c1",
    );
  });
});

describe("anuncioDeAvisos", () => {
  it("singular e plural", () => {
    expect(anuncioDeAvisos(1)).toBe("1 aviso de cadastro não visto");
    expect(anuncioDeAvisos(3)).toBe("3 avisos de cadastro não vistos");
  });
});
