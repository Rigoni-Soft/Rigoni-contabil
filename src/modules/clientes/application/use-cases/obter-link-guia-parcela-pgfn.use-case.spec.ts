import type { ArquivoComLinkPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ok, type Result } from "@/shared/kernel/result";

import { ObterLinkGuiaParcelaPgfn } from "./obter-link-guia-parcela-pgfn.use-case";

const INPUT = { parcelamentoId: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", competencia: "202610" };

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "f-1", papel: "funcionario", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

function montar(caminho: string | null = "c1/guias-pgfn/d2/202610-abc.pdf") {
  const sessao = new SessaoFalsa();
  const links: { caminho: string; validade: number }[] = [];
  const storage: ArquivoComLinkPort = {
    linkTemporario: async (c, validade) => {
      links.push({ caminho: c, validade });
      return ok("https://storage.exemplo/assinado") as Result<string, AppError>;
    },
  };
  const guias = { arquivo: async () => ok(caminho) } as unknown as GuiaParcelaPgfnRepository;
  return { sessao, links, caso: new ObterLinkGuiaParcelaPgfn(sessao, guias, storage) };
}

describe("ObterLinkGuiaParcelaPgfn", () => {
  it("gera um link temporário do PDF da guia que o banco liberou ao usuário", async () => {
    const { caso, links } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: true, value: { url: "https://storage.exemplo/assinado" } });
    expect(links).toEqual([{ caminho: "c1/guias-pgfn/d2/202610-abc.pdf", validade: 120 }]);
  });

  it("sem sessão não gera link", async () => {
    const { caso, sessao, links } = montar();
    sessao.ator = null;

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(links).toEqual([]);
  });

  it("guia que o usuário não vê (ou não existe) não gera link", async () => {
    const { caso, links } = montar(null);

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(NotFoundError) });
    expect(links).toEqual([]);
  });
});
