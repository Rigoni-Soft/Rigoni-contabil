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
const rule = (...s) => ({ "no-restricted-syntax": ["error", ...s] });

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
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
  prettier,
]);
