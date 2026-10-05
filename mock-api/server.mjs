// Mock do contrato neutro de docs/contratos/obrigacoes-fiscais.md — só pra
// desenvolver e testar sem provedor real. `yarn mock:api` (porta 4010).
// Controle de cenário: POST /__modo  {"modo":"normal"|"falha"|"sem_autorizacao"}
import { createServer } from "node:http";

const PDF = Buffer.from("%PDF-1.4\n% mock\n%%EOF").toString("base64");
let modo = "normal";

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
  parcelamento: (cnpj) => ({
    nomeArquivo: `parcelamento-${cnpj}.pdf`,
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

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/__modo") {
    let corpo = "";
    req.on("data", (parte) => (corpo += parte));
    req.on("end", () => {
      modo = JSON.parse(corpo || "{}").modo ?? "normal";
      responder(res, 200, { modo });
    });
    return;
  }

  const rota = /^\/clientes\/(\d{14})\/(\w+)$/.exec(req.url ?? "");
  const recurso = rota && recursos[rota[2]];
  if (req.method !== "GET" || !recurso) return responder(res, 404, { erro: "não encontrado" });
  if (modo === "falha") return responder(res, 503, { erro: "indisponível (simulado)" });
  responder(res, 200, recurso(rota[1]));
}).listen(Number(process.env.MOCK_API_PORT ?? 4010), () =>
  console.log("mock-api em http://127.0.0.1:4010"),
);
