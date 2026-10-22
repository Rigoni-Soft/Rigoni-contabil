import type { AvisoCadastroDto } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";

import { anuncioDeAvisos, avisoCadastroParaView } from "./avisos-cadastro.presenter";

const BASE: AvisoCadastroDto = {
  id: "a1",
  tipo: "novo_cliente",
  clienteId: "c1",
  alteracaoId: null,
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
      vistoEm: "2026-10-22T16:00:00.000Z",
    });

    expect(view.titulo).toBe("Nova Alteração contratual");
    expect(view.visto).toBe(true);
  });
});

describe("anuncioDeAvisos", () => {
  it("singular e plural", () => {
    expect(anuncioDeAvisos(1)).toBe("1 aviso de cadastro não visto");
    expect(anuncioDeAvisos(3)).toBe("3 avisos de cadastro não vistos");
  });
});
