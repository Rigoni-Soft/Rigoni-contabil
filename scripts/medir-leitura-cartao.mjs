// Mede o leitor de visão nas fotos de cartão de ponto: roda o gateway e o validador reais e imprime
// uma linha por foto (leu? validou? nome, dias, batidas, extras, anotações). Chama a API de verdade:
// custa por foto. Uso: yarn medir:leitura <pasta> [competência AAAA-MM] (padrão 2026-09)
// A quinzena sai do nome do arquivo (`...quin-1.jpeg`). Imprime só números e o nome lido; nunca grava foto.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = resolve(import.meta.dirname, "..");
const tenta = (base) => [`${base}.ts`, join(base, "index.ts")].find((c) => existsSync(c));

// Node não resolve o alias "@/" nem import sem extensão: mapeia para src/ e acrescenta .ts.
registerHooks({
  resolve(spec, ctx, next) {
    const base = spec.startsWith("@/")
      ? join(raiz, "src", spec.slice(2))
      : spec.startsWith(".") && ctx.parentURL?.startsWith("file:")
        ? resolve(new URL(".", ctx.parentURL).pathname.replace(/^\/(\w:)/, "$1"), spec)
        : null;
    const achado = base && !/\.(ts|tsx|js|mjs|json)$/.test(base) ? tenta(base) : null;
    return achado ? { url: pathToFileURL(achado).href, shortCircuit: true } : next(spec, ctx);
  },
});

const chave = process.env.ANTHROPIC_API_KEY;
if (!chave) {
  console.error(
    "Defina ANTHROPIC_API_KEY (ex.: node --env-file=.env.local, já feito pelo yarn medir:leitura).",
  );
  process.exit(1);
}
const [pasta, competencia = "2026-09"] = process.argv.slice(2);
if (!pasta) {
  console.error("Uso: yarn medir:leitura <pasta> [AAAA-MM]");
  process.exit(1);
}

const { LeitorDeCartaoVisaoGateway } =
  await import("@/modules/rh/infra/gateways/leitor-de-cartao-visao.gateway");
const { validarLeitura } = await import("@/modules/rh/domain/services/leitura-do-cartao.service");
// Esforço opcional (EFORCO=medium) injetado no corpo; o status HTTP de falha vai para o motivo.
let ultimoStatus = "";
const http = async (url, init) => {
  const corpo = JSON.parse(init.body);
  if (process.env.ESFORCO) corpo.output_config = { effort: process.env.ESFORCO };
  // Sonnet 5.5 recusa tool_choice forçado: o texto da instrução já pede só a ferramenta.
  if (/sonnet/.test(corpo.model)) corpo.tool_choice = { type: "auto" };
  const r = await fetch(url, { ...init, body: JSON.stringify(corpo) });
  ultimoStatus = r.ok ? "" : `http ${r.status}`;
  if (!r.ok && !globalThis.__e) {
    globalThis.__e = 1;
    console.error("# erro:", (await r.clone().text()).slice(0, 300));
  }
  return r;
};
const leitor = new LeitorDeCartaoVisaoGateway(
  chave,
  process.env.LEITURA_CARTAO_MODELO || "claude-haiku-5-5",
  http,
);
const hm = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const linhas = [
  [
    "arquivo",
    "leu",
    "validou",
    "motivo",
    "nome",
    "dias",
    "batidas",
    "extras",
    "atestados",
    "faltou",
  ],
];
const fotos = readdirSync(pasta).filter((f) => /quin-?[12]\.(jpe?g|png)$/i.test(f));
for (const f of fotos) {
  const quinzena = /quin-?2/i.test(f) ? 2 : 1;
  const tipo = /\.png$/i.test(f) ? "image/png" : "image/jpeg";
  const bruta = await leitor.ler({ bytes: readFileSync(join(pasta, f)), tipo });
  if (!bruta.lido) {
    linhas.push([f, "não", "", ultimoStatus || "formato/rede", "", "", "", "", "", ""]);
    continue;
  }
  const d = bruta.leitura.dias;
  if (process.env.DETALHE && new RegExp(process.env.DETALHE).test(f)) {
    console.log(`# ${f}`);
    for (const x of d) {
      const b = x.batidas.map((q) => `${hm(q.entrada)}-${hm(q.saida)}`).join(" ");
      console.log(
        `#  ${x.dia}: ${b}${x.extra ? " extra " + hm(x.extra.entrada) + "-" + hm(x.extra.saida) : ""}${x.atestado ? " ATESTADO" : ""}${x.faltou ? " FALTOU" : ""}`,
      );
    }
  }
  const v = validarLeitura(bruta.leitura, { competencia, quinzena });
  linhas.push([
    f,
    "sim",
    v.ok ? "sim" : "não",
    v.ok ? "" : v.error.message,
    bruta.leitura.nome ?? "",
    d.length,
    d.reduce((s, x) => s + x.batidas.length, 0),
    d.filter((x) => x.extra).length,
    d.filter((x) => x.atestado).length,
    d.filter((x) => x.faltou).length,
  ]);
}

const csv = linhas.map((l) => l.join(";")).join("\n");
console.log(csv);
const ok = linhas.slice(1).filter((l) => l[2] === "sim").length;
console.log(
  `\nValidaram: ${ok}/${fotos.length} (a conferência dos horários contra a foto é manual).`,
);
if (process.env.SAIDA) writeFileSync(process.env.SAIDA, csv);
