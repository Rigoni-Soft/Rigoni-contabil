/** Garante que o checker pega Server Action sem Zod e respeita a lista de isentas. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { actionsSemZod } from "./check-actions.mjs";

describe("actionsSemZod", () => {
  let raiz: string;

  const criar = (relativo: string, conteudo: string) => {
    const caminho = join(raiz, relativo);
    mkdirSync(join(caminho, ".."), { recursive: true });
    writeFileSync(caminho, conteudo);
    return caminho.replaceAll("\\", "/");
  };

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "actions-"));
  });

  afterEach(() => rmSync(raiz, { recursive: true, force: true }));

  it("aceita action que importa o schema do ViewModel", () => {
    criar("a/x.actions.ts", 'import { xSchema } from "./x.schema";');

    expect(actionsSemZod(raiz, new Set())).toEqual([]);
  });

  it("aceita action que importa o zod direto", () => {
    criar("a/x.actions.ts", 'import { z } from "zod";');

    expect(actionsSemZod(raiz, new Set())).toEqual([]);
  });

  it("pega action sem validação", () => {
    const caminho = criar("a/x.actions.ts", "export async function xAction(input: unknown) {}");

    expect(actionsSemZod(raiz, new Set())).toEqual([caminho]);
  });

  it("respeita a lista de isentas e ignora arquivos que não são actions", () => {
    const isenta = criar("a/sair.actions.ts", "export async function sair() {}");
    criar("a/x.hook.ts", "export const x = 1;");

    expect(actionsSemZod(raiz, new Set([isenta]))).toEqual([]);
  });
});
