---
name: eslint-prettier-clean-arch
description: Configura ESLint e Prettier num projeto Next.js já criado, seguindo os Anexos A, B e E deste time — ordenação de imports, diretivas (use client/use server/use cache) restritas por tipo de arquivo, regra de dependência entre camadas (domain/application/infra/presentation) via dependency-cruiser, e nomenclatura kebab-case por sufixo de papel. Use quando o usuário pedir para configurar lint/formatação, revisar organização de imports, ou aplicar/checar as regras de dependência entre camadas.
---

# ESLint + Prettier + regras de camada (Clean Architecture modular)

Pressupõe um projeto Next.js com `src/` e alias `@/*` já existente (veja a skill `next-project-init` se ainda não existir). Fonte das regras: `docs/arquitetura.md` deste time — Anexos A, B e E, e a tabela da seção 3.4. Se o arquivo existir no projeto, leia-o antes de aplicar; ele tem prioridade sobre o texto fixo aqui se algo divergir.

## 1. Instalar

```bash
yarn add server-only
yarn add -D prettier eslint-config-prettier prettier-plugin-tailwindcss @ianvs/prettier-plugin-sort-imports dependency-cruiser typescript@^6
```

`typescript@^6` é exigência do Anexo A: o `dependency-cruiser` ainda não suporta TypeScript 7 (analisa 0 módulos em silêncio se a versão for maior).

## 2. `.prettierrc.json` (decisão desta skill: estilo e ordem de imports)

A ordem segue o sentido de dependência da seção 3.4 do documento: módulos externos antes dos internos, relativo por último.

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "auto",
  "plugins": ["@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  "importOrder": [
    "<BUILTIN_MODULES>",
    "",
    "^(react|react-dom)(/.*)?$",
    "^next(/.*)?$",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@/app/",
    "^@/presentation/",
    "^@/main/",
    "^@/modules/",
    "^@/shared/",
    "",
    "^[.]"
  ],
  "importOrderTypeScriptVersion": "5.0.0",
  "tailwindStylesheet": "./src/app/globals.css",
  "tailwindFunctions": ["cn", "cva"]
}
```

`.prettierignore`:
```
.next
node_modules
coverage
public
yarn.lock
next-env.d.ts
*.md
```

## 3. `eslint.config.mjs` (Anexo B do documento + regras de import)

Substitua o arquivo gerado pelo `create-next-app`. Se os três imports do Next no arquivo gerado forem diferentes (versão do Next mudou), mantenha os do arquivo gerado e só acrescente o resto.

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const sel = (v, message) => ({ selector: `ExpressionStatement > Literal[value='${v}']`, message });
const CLIENT = sel("use client", "'use client' só em *.container.tsx, providers/, ui/ (shadcn) e error.tsx");
const SERVER = sel("use server", "'use server' só em *.actions.ts");
const CACHE = sel("use cache", "'use cache' só em *.server.ts");
const HOOK_CALL = { selector: "CallExpression[callee.name=/^use[A-Z]/]", message: "View burra: sem hooks." };
const HOOK_IMPORT = { selector: "ImportDeclaration[source.value='react'] ImportSpecifier[imported.name=/^use[A-Z]/]", message: "View burra: sem hooks." };
const rule = (...s) => ({ "no-restricted-syntax": ["error", ...s] });

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
      "import/first": "error",
      "import/no-duplicates": "error",
    },
  },
  { files: ["src/**/*.{ts,tsx}"], rules: rule(CLIENT, SERVER, CACHE) },
  { files: ["**/*.container.tsx", "src/presentation/providers/**", "src/presentation/components/ui/**",
            "src/app/**/error.tsx", "src/app/**/global-error.tsx"], rules: rule(SERVER, CACHE) },
  { files: ["**/*.actions.ts"], rules: rule(CLIENT, CACHE) },
  { files: ["**/*.server.ts"], rules: rule(CLIENT, SERVER) },
  { files: ["src/presentation/components/{atoms,molecules,organisms,templates,pages}/**/*.tsx"],
    rules: rule(CLIENT, SERVER, CACHE, HOOK_CALL, HOOK_IMPORT) },
  prettier,
]);
```

`consistent-type-imports`, `import/first` e `import/no-duplicates` são decisão desta skill (organização de imports); o resto do bloco é o Anexo B literal.

## 4. Regras de camada: `.dependency-cruiser.cjs` (Anexo A)

O ESLint não reescreve a tabela de dependências entre camadas (isso duplicaria e divergiria do documento). Quem garante isso é o `dependency-cruiser`.

```js
const MOD = "^src/modules/([^/]+)";   // $1 = nome do módulo
const VIEWS = "^src/presentation/components/(atoms|molecules|organisms|templates|pages)/";

module.exports = {
  forbidden: [
    { name: "shared-puro", severity: "error", from: { path: "^src/shared/" }, to: { pathNot: "^src/shared/" } },
    { name: "domain-so-shared", severity: "error",
      from: { path: `${MOD}/domain/` }, to: { pathNot: ["^src/shared/", "^src/modules/$1/domain/"] } },
    { name: "application-so-domain-e-shared", severity: "error",
      from: { path: `${MOD}/application/` }, to: { pathNot: ["^src/shared/", "^src/modules/$1/(domain|application)/"] } },
    { name: "infra-so-dentro-do-modulo", severity: "error",
      from: { path: `${MOD}/infra/` }, to: { pathNot: ["^src/shared/", "^src/modules/$1/(domain|application|infra)/", "node_modules/"] } },

    { name: "so-main-importa-infra", severity: "error",
      from: { pathNot: ["^src/main/", "/infra/"] }, to: { path: "^src/modules/[^/]+/infra/" } },
    { name: "so-actions-importam-main", severity: "error",
      from: { path: "^src/(modules|presentation|app)/", pathNot: "\\.(actions|server|webhook)\\.tsx?$" }, to: { path: "^src/main/(?!client/)" } },
    { name: "so-realtime-importa-main-client", severity: "error",
      from: { pathNot: ["\\.realtime\\.tsx?$", "^src/main/"] }, to: { path: "^src/main/client/" } },
    { name: "main-client-sem-servidor", severity: "error",
      from: { path: "^src/main/client/" }, to: { path: ["^src/main/(?!client/)", "node_modules/server-only/"] } },
    { name: "supabase-so-em-infra-main-e-auth", severity: "error",
      from: { pathNot: ["^src/modules/[^/]+/infra/", "^src/main/", "^src/presentation/auth/"] }, to: { path: "@supabase/" } },
    { name: "webhook-route-so-importa-handler", severity: "error",
      from: { path: "^src/app/api/webhooks/" }, to: { pathNot: ["^src/modules/[^/]+/presentation/webhooks/", "node_modules/"] } },
    { name: "modulos-isolados", severity: "error",
      from: { path: `${MOD}/` }, to: { path: "^src/modules/[^/]+/", pathNot: "^src/modules/$1/" } },
    { name: "app-so-presentation", severity: "error",
      from: { path: "^src/app/" }, to: { path: "^src/modules/[^/]+/(domain|application|infra)/" } },
    { name: "presentation-global-sem-modulos", severity: "error",
      from: { path: "^src/presentation/" }, to: { path: "^src/modules/" } },

    { name: "view-burra", severity: "error",
      from: { path: VIEWS }, to: { path: ["^src/main/", "^src/modules/[^/]+/(domain|application|infra)/", "/view-models/"] } },
    { name: "view-sem-next", severity: "error",
      from: { path: VIEWS }, to: { path: "node_modules/next/(?!(link|image)\\.js)" } },
    { name: "so-container-e-presenter-importam-view", severity: "error",
      from: { path: "^src/modules/", pathNot: "\\.(container|presenter)\\.tsx?$" }, to: { path: "^src/presentation/components/" } },
    { name: "viewmodel-sem-domain-nem-infra", severity: "error",
      from: { path: "^src/modules/[^/]+/presentation/view-models/" }, to: { path: "^src/modules/[^/]+/(domain|infra)/" } },
    { name: "container-so-atom-molecule-organism", severity: "error",
      from: { path: "\\.container\\.tsx$" }, to: { path: "^src/presentation/components/(templates|pages)/" } },

    { name: "ad-atom", severity: "error", from: { path: "/atoms/" }, to: { path: "/(molecules|organisms|templates|pages)/" } },
    { name: "ad-molecule", severity: "error", from: { path: "/molecules/" }, to: { path: "/(organisms|templates|pages)/" } },
    { name: "ad-organism", severity: "error", from: { path: "/organisms/" }, to: { path: "/(templates|pages)/" } },
    { name: "ad-template", severity: "error", from: { path: "/templates/" }, to: { path: "/pages/" } },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,      // enxerga `import type`
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.(spec|test)\\.tsx?$" },   // testes unitários (*.spec) e de integração (*.test)
  },
};
```

Regra adicional da premissa 1 do documento (sem `route.ts` fora de `src/app/api/webhooks/`; nada deve ser impresso):

```bash
find src/app -name "route.ts*" -not -path "src/app/api/webhooks/*"
```

## 5. Nomenclatura e scaffolding (Anexos E e C)

`scripts/check-naming.mjs`:

```js
// yarn check:naming  →  falha se algum nome sob src/ violar as regras de nomenclatura
import { readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? "src";
const KEBAB = "[a-z0-9]+(?:-[a-z0-9]+)*";
const DIR = new RegExp(`^(?:${KEBAB}|\\[\\.{0,3}${KEBAB}\\]|\\(${KEBAB}\\)|@${KEBAB})$`);   // kebab, [param], (grupo), @slot
const FILE = new RegExp(`^${KEBAB}(?:\\.${KEBAB})*\\.(?:ts|tsx|css)$`);                     // nome[.papel][.spec|.test].ext
const NEXT = /^(layout|page|loading|error|global-error|not-found|template|default|route|globals|robots|sitemap)\.(tsx?|css)$/;
const NEXT_ROOT = /^(middleware|proxy)\.ts$/;
const VENDOR = /\/presentation\/(components\/ui|lib|hooks)\//;                                // gerado pelo shadcn: só kebab-case

// pasta → papéis permitidos no sufixo (`nome.<papel>.ts`)
const ROLES = [
  [/\/domain\/entities\//, ["entity"]],
  [/\/domain\/aggregates\//, ["aggregate"]],
  [/\/domain\/builders\//, ["builder"]],
  [/\/domain\/value-objects\//, ["vo"]],
  [/\/domain\/services\//, ["service"]],
  [/\/domain\/events\//, ["event"]],
  [/\/(domain|shared)\/errors\//, ["error"]],
  [/\/application\/ports\/(in|out)\//, ["provider", "repository"]],
  [/\/application\/use-cases\//, ["use-case"]],
  [/\/(application|infra|shared)\/dtos\//, ["dto"]],
  [/\/(application|infra)\/mappers\//, ["mapper"]],
  [/\/infra\/repositories\//, ["repository"]],
  [/\/infra\/(gateways|realtime)\//, ["gateway"]],
  [/\/presentation\/webhooks\//, ["webhook"]],
  [/\/presentation\/view-models\//, ["actions", "server", "queries", "realtime", "store", "schema", "presenter", "hook", "container"]],
  [/\/presentation\/stores\//, ["store"]],
  [/\/presentation\/providers\//, ["provider", "providers"]],
  [/\/presentation\/components\/(atoms|molecules|organisms|templates)\//, ["component"]],
  [/\/presentation\/components\/pages\//, ["page"]],
  [/\/presentation\/auth\//, ["factory", "provider"]],
  [/\/main\//, ["factory"]],
];

const erros = [];

function percorrer(dir) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).replaceAll("\\", "/");
    if (entrada.isDirectory()) {
      if (!DIR.test(entrada.name)) erros.push(`${caminho}: diretório fora de kebab-case`);
      percorrer(caminho);
    } else if (/\.(ts|tsx|css)$/.test(entrada.name)) {
      verificar(caminho, entrada.name);
    }
  }
}

function verificar(caminho, arquivo) {
  const rel = `/${caminho}`;
  if (rel.includes("/src/app/")) {
    if (!NEXT.test(arquivo)) erros.push(`${caminho}: em app/ só são permitidos arquivos de convenção do Next.js`);
    return;
  }
  if (/^\/src\/[^/]+$/.test(rel) && NEXT_ROOT.test(arquivo)) return;
  if (!FILE.test(arquivo)) return void erros.push(`${caminho}: arquivo fora de kebab-case`);
  if (VENDOR.test(rel)) return;
  const regra = ROLES.find(([re]) => re.test(rel));
  if (!regra) return;
  const partes = arquivo.split(".").slice(0, -1);                     // sem extensão
  if (["spec", "test"].includes(partes.at(-1))) partes.pop();       // *.spec = unitário/componente; *.test = integração
  const papel = partes.length > 1 ? partes.at(-1) : undefined;
  if (!regra[1].includes(papel)) erros.push(`${caminho}: sufixo deve ser um de .${regra[1].join(", .")}`);
}

percorrer(ROOT);
erros.forEach((e) => console.error(e));
if (erros.length) process.exit(1);
console.log("nomenclatura ok");
```

`scripts/new-module.mjs` (mensagem de uso trocada para `yarn`, resto literal do Anexo C):

```js
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const nome = process.argv[2];
if (!/^[a-z][a-z0-9-]*$/.test(nome ?? "")) { console.error("uso: yarn new:module <nome-kebab>"); process.exit(1); }
if (existsSync(`src/modules/${nome}`)) { console.error(`módulo "${nome}" já existe`); process.exit(1); }

const base = `src/modules/${nome}`;
const dirs = [
  "domain/aggregates", "domain/entities", "domain/builders", "domain/value-objects", "domain/services", "domain/errors",
  "application/ports/in", "application/ports/out", "application/use-cases", "application/dtos", "application/mappers",
  "infra/repositories", "infra/gateways", "infra/realtime", "infra/dtos", "infra/mappers",
  "presentation/view-models", "presentation/webhooks",
];
for (const d of dirs) { mkdirSync(`${base}/${d}`, { recursive: true }); writeFileSync(`${base}/${d}/.gitkeep`, ""); }
mkdirSync("src/main/client", { recursive: true });
writeFileSync(`src/main/${nome}.factory.ts`, `import "server-only";\n// Injeção de dependências do módulo ${nome}: instancia infra e injeta nos casos de uso.\nexport {};\n`);
console.log(`módulo "${nome}" criado em ${base} + src/main/${nome}.factory.ts`);
```

## 6. Scripts no `package.json`

```bash
npm pkg set "scripts.lint:fix=eslint --fix"
npm pkg set "scripts.format=prettier --write ."
npm pkg set "scripts.format:check=prettier --check ."
npm pkg set "scripts.check:deps=depcruise src --config .dependency-cruiser.cjs"
npm pkg set "scripts.check:naming=node scripts/check-naming.mjs"
npm pkg set "scripts.new:module=node scripts/new-module.mjs"
```

## 7. Conferir

```bash
yarn format
yarn lint
yarn check:deps
yarn check:naming
```
