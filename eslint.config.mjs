import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

const sel = (v, message) => ({ selector: `ExpressionStatement > Literal[value='${v}']`, message });
const CLIENT = sel(
  "use client",
  "'use client' só em *.container.tsx, providers/, ui/ (shadcn) e error.tsx",
);
const SERVER = sel("use server", "'use server' só em *.actions.ts");
const CACHE = sel("use cache", "'use cache' só em *.server.ts");
const HOOK_CALL = {
  selector: "CallExpression[callee.name=/^use[A-Z]/]",
  message: "View burra: sem hooks.",
};
const HOOK_IMPORT = {
  selector: "ImportDeclaration[source.value='react'] ImportSpecifier[imported.name=/^use[A-Z]/]",
  message: "View burra: sem hooks.",
};
const HOST_ELEMENT = {
  selector: "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^[a-z]/]",
  message:
    "Elemento HTML cru só em atoms/ e ui/: componha um átomo (Caixa, Texto, ...). Exceção rara: eslint-disable com o motivo.",
};
const rule = (...s) => ({ "no-restricted-syntax": ["error", ...s] });

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
    ".claude/**",
    ".agents/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "import/first": "error",
      "import/no-duplicates": "error",
    },
  },
  { files: ["src/**/*.{ts,tsx}"], rules: rule(CLIENT, SERVER, CACHE) },
  {
    files: [
      "**/*.container.tsx",
      "src/presentation/providers/**",
      "src/presentation/components/ui/**",
      "src/app/**/error.tsx",
      "src/app/**/global-error.tsx",
    ],
    rules: rule(SERVER, CACHE),
  },
  { files: ["**/*.actions.ts"], rules: rule(CLIENT, CACHE) },
  { files: ["**/*.server.ts"], rules: rule(CLIENT, SERVER) },
  {
    files: ["src/presentation/components/{atoms,molecules,organisms,templates,pages}/**/*.tsx"],
    // spec.tsx testa a View com um wrapper (ex.: useForm) por fora dela; não é a própria View com hook.
    ignores: ["**/*.spec.tsx"],
    rules: rule(CLIENT, SERVER, CACHE, HOOK_CALL, HOOK_IMPORT),
  },
  {
    // Pirâmide: só atoms/ e ui/ têm elemento HTML cru; os níveis acima compõem o de baixo.
    files: ["src/presentation/components/{molecules,organisms,templates,pages}/**/*.tsx"],
    ignores: ["**/*.spec.tsx"],
    rules: rule(CLIENT, SERVER, CACHE, HOOK_CALL, HOOK_IMPORT, HOST_ELEMENT),
  },
  {
    // Container e page do Next só montam Views: markup vive em atoms/ e ui/.
    files: ["**/*.container.tsx", "src/app/**/page.tsx"],
    ignores: ["**/*.spec.tsx"],
    rules: rule(SERVER, CACHE, HOST_ELEMENT),
  },
  {
    // Variável de ambiente só entra por src/env.ts (servidor) e src/env.client.ts (público), que a
    // validam com Zod. process.env espalhado pelo código fura a validação e os defaults.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/env.ts", "src/env.client.ts", "**/*.{spec,test}.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Leia a variável por @/env (ou @/env.client), que a valida com Zod.",
        },
      ],
    },
  },
  {
    // Object Calisthenics 1 (arquitetura.md, seção 2): um nível de indentação por método em domain e
    // application. `max-depth: 1` reprova `if` dentro de `for`/`if`; extraia o corpo para um método.
    files: ["src/modules/*/{domain,application}/**/*.ts"],
    ignores: ["**/*.{spec,test}.ts"],
    rules: { "max-depth": ["error", 1] },
  },
  {
    // Dívida anterior à regra: só encolhe. Arquivo novo não entra aqui; ao corrigir um, tire-o da lista.
    files: [
      "src/modules/atendimento/application/jobs/alertas-da-rodada.ts",
      "src/modules/atendimento/application/jobs/atribuir-guias-parcelamento.ts",
      "src/modules/atendimento/application/use-cases/entregar-das-na-ura.use-case.ts",
      "src/modules/atendimento/application/use-cases/entregar-parcelamento-na-ura.use-case.ts",
      "src/modules/atendimento/application/use-cases/enviar-guias-parcelamento.use-case.ts",
      "src/modules/atendimento/application/use-cases/preparar-anexo-para-envio.use-case.ts",
      "src/modules/atendimento/application/use-cases/receber-mensagem.use-case.ts",
      "src/modules/atendimento/application/use-cases/receber-midia.use-case.ts",
      "src/modules/atendimento/domain/services/expediente.service.ts",
      "src/modules/clientes/application/mappers/comparativos-sn.mapper.ts",
      "src/modules/clientes/application/mappers/resumo-setor-sn.mapper.ts",
      "src/modules/clientes/application/use-cases/criar-cliente.use-case.ts",
      "src/modules/clientes/application/use-cases/editar-cadastro-rh-cliente.use-case.ts",
      "src/modules/clientes/application/use-cases/remover-guia-parcela-pgfn.use-case.ts",
      "src/modules/clientes/application/use-cases/salvar-parcelamentos-cliente.use-case.ts",
      "src/modules/clientes/application/use-cases/trocar-guia-parcela-pgfn.use-case.ts",
      "src/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case.ts",
      "src/modules/rh/application/use-cases/gerir-servico-acompanhamento.use-case.ts",
      "src/modules/rh/application/use-cases/ler-atestado-de-ponto.use-case.ts",
      "src/modules/rh/application/use-cases/ler-cartao-de-ponto.use-case.ts",
      "src/modules/rh/application/use-cases/obter-acompanhamento-funcionarios.use-case.ts",
      "src/modules/rh/domain/services/leitura-do-cartao.service.ts",
      "src/modules/rh/domain/services/regras-de-calculo.service.ts",
      "src/modules/rh/domain/services/totalizacao.service.ts",
      "src/modules/rh/domain/services/validar-regras-da-convencao.service.ts",
      "src/modules/usuarios/application/use-cases/alterar-papel-usuario.use-case.ts",
      "src/modules/usuarios/application/use-cases/trocar-senha.use-case.ts",
    ],
    rules: { "max-depth": "off" },
  },
  prettier,
  {
    // Depois do `prettier`, que desliga o max-len: ele não reflowa comentário, só este limite pega
    // (aviso: 19 comentários antigos passam de 120; vira erro depois de reformatá-los).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-len": [
        "warn",
        { code: 100000, comments: 120, ignoreUrls: true, ignorePattern: "eslint-disable" },
      ],
    },
  },
]);
