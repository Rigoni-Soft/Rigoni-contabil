// Mock do contrato neutro de docs/contratos/obrigacoes-fiscais.md — só pra
// desenvolver e testar sem provedor real. `yarn mock:api` (porta 4010).
// Controle de cenário: POST /__modo  {"modo":"normal"|"falha"|"sem_autorizacao"|<motivo>}
// onde <motivo> (codigo_desconhecido|quitado|fora_do_periodo|ambiguo) recusa só a guia de parcelamento.
import { createServer } from "node:http";

import { PDF_BASE64 as PDF } from "./pdf-teste.mjs";

let modo = "normal";
const MOTIVOS = ["codigo_desconhecido", "quitado", "fora_do_periodo", "ambiguo"];

const recursos = {
  autorizacao: () =>
    modo === "sem_autorizacao"
      ? { vigente: false }
      : { vigente: true, dataExpiracao: "2027-12-31" },
  das: (cnpj) => ({
    nomeArquivo: `das-${cnpj}.pdf`,
    pdfBase64: PDF,
    competencia: "2026-09",
    valorCentavos: 150_000,
    vencimento: "2026-10-20",
  }),
  // Guia por código de parcelamento (`/clientes/{cnpj}/parcelamentos/{codigo}`).
  parcelamentos: (cnpj, codigo) => ({
    nomeArquivo: `parcelamento-${cnpj}-${codigo}.pdf`,
    pdfBase64: PDF,
    parcela: "202609",
    valorCentavos: 45_000,
    vencimento: "2026-10-31",
  }),
  cnd: (cnpj) => ({
    nomeArquivo: `cnd-${cnpj}.pdf`,
    pdfBase64: PDF,
    validade: "2027-03-31",
  }),
};

function responder(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
}

export const servidor = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/__modo") {
    let corpo = "";
    req.on("data", (parte) => (corpo += parte));
    req.on("end", () => {
      modo = JSON.parse(corpo || "{}").modo ?? "normal";
      responder(res, 200, { modo });
    });
    return;
  }

  const rota = /^\/clientes\/([0-9A-Z]{14})\/(\w+)(?:\/([^/]+))?$/.exec(req.url ?? "");
  const recurso = rota && recursos[rota[2]];
  // Só `parcelamentos` leva o código; os outros recursos não têm subcaminho.
  if (req.method !== "GET" || !recurso || Boolean(rota[3]) !== (rota[2] === "parcelamentos")) {
    return responder(res, 404, { erro: "não encontrado" });
  }
  if (modo === "falha") return responder(res, 503, { erro: "indisponível (simulado)" });
  if (rota[2] === "parcelamentos" && MOTIVOS.includes(modo)) {
    return responder(res, 422, { motivo: modo });
  }
  responder(res, 200, recurso(rota[1], rota[3] && decodeURIComponent(rota[3])));
}).listen(Number(process.env.MOCK_API_PORT ?? 4010), () =>
  console.log(`mock-api em http://127.0.0.1:${servidor.address().port}`),
);
