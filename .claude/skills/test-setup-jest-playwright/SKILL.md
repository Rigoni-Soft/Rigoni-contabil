---
name: test-setup-jest-playwright
description: Instala e configura Jest, React Testing Library, Supertest e Playwright num projeto Next.js já criado, com os sufixos e projetos exigidos por testes.md deste time (*.spec.ts unitário/componente, *.test.ts integração — inclui webhook com Supertest —, *.e2e.ts Playwright) e o limiar de cobertura. Use quando o usuário pedir para configurar testes, adicionar Playwright/RTL/Supertest, ou citar testes.md.
---

# Jest + RTL + Supertest + Playwright (testes.md)

Pressupõe um projeto Next.js com `src/` e alias `@/*` já existente (veja a skill `next-project-init` se ainda não existir). Fonte das regras: `docs/testes.md` deste time, seções 6 e 7. Se o arquivo existir no projeto, leia-o antes de aplicar; ele tem prioridade sobre o texto fixo aqui se algo divergir.

## 1. Instalar

```bash
yarn add -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event
yarn add -D supertest @types/supertest
yarn add -D @playwright/test
yarn playwright install chromium
```

Supertest só entra nos testes de integração do handler de webhook (testes.md, seção 4.2) — não é um nível à parte, é uma ferramenta usada dentro do nível de integração.

`jest-environment-jsdom`, `@testing-library/dom`, `@testing-library/jest-dom` e `@testing-library/user-event` são decisão desta skill: dependências auxiliares que o Jest com jsdom e a RTL exigem na prática, mas que o documento não cita.

## 2. `tsconfig.json`: tipos do Jest

Acrescente à chave `compilerOptions.types` existente, sem sobrescrever o resto do arquivo:

```json
{ "compilerOptions": { "types": ["jest", "node"] } }
```

## 3. `jest.config.mjs` (testes.md, seção 7.2, com `next/jest` — decisão desta skill)

Sufixos e projetos são do documento: `*.spec.ts(x)` para unitário/componente, `*.test.ts` para integração (webhook incluso).

```js
import nextJest from "next/jest.js";

const criarConfig = nextJest({ dir: "./" });

const ignorar = ["/node_modules/", "/e2e/"]; // e2e/ é do Playwright

const comum = {
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ignorar,
};

export default async () => ({
  projects: [
    await criarConfig({
      ...comum,
      displayName: "unit", // unitário e componente
      testMatch: ["**/*.spec.{ts,tsx}"],
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    })(),
    await criarConfig({
      ...comum,
      displayName: "integration", // integração (inclui os de webhook com Supertest)
      testMatch: ["**/*.test.ts"],
      testEnvironment: "node",
    })(),
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.{spec,test}.{ts,tsx}",
    "!src/presentation/components/ui/**", // shadcn: não é testado (testes.md, seção 3)
    "!src/app/**",
    "!src/main/**",
  ],
  coverageThreshold: {
    global: { statements: 90, lines: 90, functions: 90, branches: 85 }, // testes.md, seção 6
  },
});
```

`jest.setup.ts`:
```ts
import "@testing-library/jest-dom";
```

O `next/jest`, o `testEnvironment` por projeto, o alias `@/` e a lista de exclusões de cobertura são decisão desta skill; os `testMatch`, o `ignorar` e os números de cobertura são literais do documento.

## 4. `playwright.config.ts` (testes.md, seção 7.2, literal)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts", // o padrão do Playwright (test|spec) não pega *.e2e.ts
});
```

```bash
node -e "require('fs').appendFileSync('.gitignore', '\n# playwright\n/test-results/\n/playwright-report/\n/blob-report/\n/playwright/.cache/\n')"
```

## 5. Scripts no `package.json`

Os quatro primeiros são literais do documento; `test:cov` é decisão desta skill para medir a cobertura da seção 6.

```bash
npm pkg set "scripts.test=jest --selectProjects unit"
npm pkg set "scripts.test:int=jest --selectProjects integration"
npm pkg set "scripts.test:e2e=playwright test"
npm pkg set "scripts.test:e2e:diff=playwright test --only-changed=develop"
npm pkg set "scripts.test:cov=jest --coverage"
```

`test:e2e:diff` precisa do histórico do branch base (`develop`) disponível — clone completo no CI, não raso.

## O que este documento não configura

As regras de processo (TDD obrigatório, definição de pronto, o que não é permitido num teste — seções 1 e 6 de `testes.md`) não são configuráveis em arquivo. Se o usuário pedir para "aplicar" essas regras, elas valem como orientação de como escrever os testes, não como algo que esta skill instala.

## 6. Conferir

```bash
yarn test
yarn test:int
```

(`test:e2e` e `test:e2e:diff` só fazem sentido depois que houver pelo menos um `*.e2e.ts` em `e2e/`.)
