import { extractText, getDocumentProxy } from "unpdf";

export async function extrairTextoDoPdf(pdf: Uint8Array): Promise<string> {
  const documento = await getDocumentProxy(new Uint8Array(pdf));
  return (await extractText(documento, { mergePages: true })).text;
}

export const pega = (texto: string, re: RegExp) => re.exec(texto)?.[1];
export const centavos = (v?: string) =>
  v ? Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) : null;
export const dataIso = (v?: string) => (v ? v.split("/").reverse().join("-") : null);
