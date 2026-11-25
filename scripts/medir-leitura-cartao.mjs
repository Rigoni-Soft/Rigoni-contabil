import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = resolve(import.meta.dirname, "..");
const acharModuloTs = (base) => [`${base}.ts`, join(base, "index.ts")].find((c) => existsSync(c));

registerHooks({
  resolve(spec, ctx, next) {
    const base = spec.startsWith("@/")
      ? join(raiz, "src", spec.slice(2))
      : spec.startsWith(".") && ctx.parentURL?.startsWith("file:")
        ? resolve(new URL(".", ctx.parentURL).pathname.replace(/^\/(\w:)/, "$1"), spec)
        : null;
    const modulo = base && !/\.(ts|tsx|js|mjs|json)$/.test(base) ? acharModuloTs(base) : null;
    return modulo ? { url: pathToFileURL(modulo).href, shortCircuit: true } : next(spec, ctx);
  },
});

const chaveDaApi = process.env.ANTHROPIC_API_KEY;
if (!chaveDaApi) {
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
const TAMANHO_DO_ERRO_MOSTRADO = 300;
let ultimoStatus = "";
let corpoDoErroJaMostrado = false;
const httpComEsforcoEToolAuto = async (url, init) => {
  const corpo = JSON.parse(init.body);
  if (process.env.ESFORCO) corpo.output_config = { effort: process.env.ESFORCO };
  if (/sonnet/.test(corpo.model)) corpo.tool_choice = { type: "auto" };
  const resposta = await fetch(url, { ...init, body: JSON.stringify(corpo) });
  ultimoStatus = resposta.ok ? "" : `http ${resposta.status}`;
  if (!resposta.ok && !corpoDoErroJaMostrado) {
    corpoDoErroJaMostrado = true;
    console.error("# erro:", (await resposta.clone().text()).slice(0, TAMANHO_DO_ERRO_MOSTRADO));
  }
  return resposta;
};
const leitor = new LeitorDeCartaoVisaoGateway(
  chaveDaApi,
  process.env.LEITURA_CARTAO_MODELO || "claude-haiku-5-5",
  httpComEsforcoEToolAuto,
);
const horaDoMinuto = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

const linhasDoCsv = [
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
const fotos = readdirSync(pasta).filter((arquivo) => /quin-?[12]\.(jpe?g|png)$/i.test(arquivo));
for (const arquivo of fotos) {
  const quinzena = /quin-?2/i.test(arquivo) ? 2 : 1;
  const tipo = /\.png$/i.test(arquivo) ? "image/png" : "image/jpeg";
  const bruta = await leitor.ler({ bytes: readFileSync(join(pasta, arquivo)), tipo });
  if (!bruta.lido) {
    linhasDoCsv.push([arquivo, "não", "", ultimoStatus || "formato/rede", "", "", "", "", "", ""]);
    continue;
  }
  const dias = bruta.leitura.dias;
  if (process.env.DETALHE && new RegExp(process.env.DETALHE).test(arquivo)) {
    console.log(`# ${arquivo}`);
    for (const dia of dias) {
      const batidas = dia.batidas
        .map((batida) => `${horaDoMinuto(batida.entrada)}-${horaDoMinuto(batida.saida)}`)
        .join(" ");
      const extra = dia.extra
        ? ` extra ${horaDoMinuto(dia.extra.entrada)}-${horaDoMinuto(dia.extra.saida)}`
        : "";
      console.log(
        `#  ${dia.dia}: ${batidas}${extra}${dia.atestado ? " ATESTADO" : ""}${dia.faltou ? " FALTOU" : ""}`,
      );
    }
  }
  const validacao = validarLeitura(bruta.leitura, { competencia, quinzena });
  linhasDoCsv.push([
    arquivo,
    "sim",
    validacao.ok ? "sim" : "não",
    validacao.ok ? "" : validacao.error.message,
    bruta.leitura.nome ?? "",
    dias.length,
    dias.reduce((total, dia) => total + dia.batidas.length, 0),
    dias.filter((dia) => dia.extra).length,
    dias.filter((dia) => dia.atestado).length,
    dias.filter((dia) => dia.faltou).length,
  ]);
}

const { validarAtestado } = await import("@/modules/rh/domain/services/atestado.service");
const atestados = readdirSync(pasta).filter((arquivo) => /^atestado.*.(jpe?g|png)$/i.test(arquivo));
for (const arquivo of atestados) {
  const tipo = /.png$/i.test(arquivo) ? "image/png" : "image/jpeg";
  const lido = await leitor.lerAtestado({ bytes: readFileSync(join(pasta, arquivo)), tipo });
  if (!lido.lido) {
    console.log(`# ${arquivo}: não leu (${ultimoStatus || "formato/rede"})`);
    continue;
  }
  const { nome, tipo: tipoDoAtestado, de, ate } = lido.atestado;
  const validacao = validarAtestado(lido.atestado);
  const nomeParaExibir = process.env.NOMES
    ? ` nome=${nome}`
    : ` nome=${nome ? "lido" : "ilegível"}`;
  console.log(
    `# ${arquivo}: ${tipoDoAtestado} de=${de} ate=${ate}${nomeParaExibir} validou=${validacao.ok ? "sim" : "não: " + validacao.error.message}`,
  );
}

const csv = linhasDoCsv.map((linha) => linha.join(";")).join("\n");
console.log(csv);
const COLUNA_VALIDOU = 2;
const ok = linhasDoCsv.slice(1).filter((linha) => linha[COLUNA_VALIDOU] === "sim").length;
console.log(
  `\nValidaram: ${ok}/${fotos.length} (a conferência dos horários contra a foto é manual).`,
);
if (process.env.SAIDA) writeFileSync(process.env.SAIDA, csv);
