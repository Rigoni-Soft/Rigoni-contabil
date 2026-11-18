/** Garante que o checker pega route.ts fora das exceções e deixa passar as três permitidas. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rotasFora } from "./check-rotas.mjs";

describe("rotasFora", () => {
  let raiz: string;

  const criar = (relativo: string) => {
    const caminho = join(raiz, relativo);
    mkdirSync(join(caminho, ".."), { recursive: true });
    writeFileSync(caminho, "export {};");
  };

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "rotas-"));
  });

  afterEach(() => rmSync(raiz, { recursive: true, force: true }));

  it("aceita webhook, job e avatar", () => {
    criar("api/webhooks/whatsapp/route.ts");
    criar("api/jobs/lembretes/route.ts");
    criar("api/avatar/route.ts");

    expect(rotasFora(raiz)).toEqual([]);
  });

  it("pega route.ts em qualquer outro lugar", () => {
    criar("api/clientes/route.ts");
    criar("perfil/route.tsx");
    criar("api/avatar-extra/route.ts");

    expect(rotasFora(raiz)).toHaveLength(3);
  });

  it("ignora page.tsx e outros arquivos", () => {
    criar("perfil/page.tsx");
    criar("api/clientes/handler.ts");

    expect(rotasFora(raiz)).toEqual([]);
  });
});
