// PDF mínimo e válido (1 página em branco A4, sem dados reais) para o mock devolver em
// base64. Monta os objetos e a tabela xref com os offsets reais para qualquer leitor abrir.
const objetos = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
];

function montar() {
  let corpo = "%PDF-1.4\n";
  const offsets = objetos.map((objeto, i) => {
    const offset = Buffer.byteLength(corpo, "latin1");
    corpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(corpo, "latin1");
  const linhas = offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${linhas}`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, "latin1");
}

export const PDF_BASE64 = montar().toString("base64");
