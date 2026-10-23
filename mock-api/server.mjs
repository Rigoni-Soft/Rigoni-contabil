// Mock do contrato neutro de docs/contratos/obrigacoes-fiscais.md — só pra
// desenvolver e testar sem provedor real. `yarn mock:api` (porta 4010).
// Controle de cenário: POST /__modo  {"modo":"normal"|"falha"|"sem_autorizacao"|"uma_parcela"|"sem_parcelas"}
// `parcelamentos` devolve 2 guias (atrasada + do mês); `uma_parcela` 1; `sem_parcelas` nenhuma.
import { createServer } from "node:http";

import { PDF_BASE64 as PDF } from "./pdf-teste.mjs";

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
  // Guias de parcelamento do CNPJ (`/clientes/{cnpj}/parcelamentos?ignorar=AAAAMM,...`): uma por
  // parcela emitível, menos as já entregues.
  parcelamentos: (cnpj, ignorar) => {
    const parcelas = { normal: ["202608", "202609"], uma_parcela: ["202609"], sem_parcelas: [] };
    return {
      guias: (parcelas[modo] ?? parcelas.normal)
        .filter((parcela) => !ignorar.includes(parcela))
        .map((parcela) => ({
          nomeArquivo: `parcelamento-${cnpj}-${parcela}.pdf`,
          pdfBase64: PDF,
          parcela,
          valorCentavos: 45_000,
          vencimento: `${parcela.slice(0, 4)}-${parcela.slice(4)}-28`,
        })),
    };
  },
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

  const url = new URL(req.url ?? "", "http://mock");
  const rota = /^\/clientes\/([0-9A-Z]{14})\/(\w+)$/.exec(url.pathname);
  const recurso = rota && recursos[rota[2]];
  if (req.method !== "GET" || !recurso) return responder(res, 404, { erro: "não encontrado" });
  if (modo === "falha") return responder(res, 503, { erro: "indisponível (simulado)" });
  const ignorar = (url.searchParams.get("ignorar") ?? "").split(",").filter(Boolean);
  responder(res, 200, recurso(rota[1], ignorar));
}).listen(Number(process.env.MOCK_API_PORT ?? 4010), () =>
  console.log(`mock-api em http://127.0.0.1:${servidor.address().port}`),
);
