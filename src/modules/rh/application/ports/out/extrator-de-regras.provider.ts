// Contrato neutro (ADR 0004): recebe os bytes do PDF da convenção e devolve os parâmetros que o provedor
// encontrou, ainda não confiáveis (o domínio os valida). Nada de provedor, modelo ou token aqui. A
// convenção é pública e pode ir a serviço externo. Nunca rejeita: falha vira `{ lido: false }`.
import type { RegraCandidata } from "@/modules/rh/domain/services/validar-regras-da-convencao.service";

export type ExtracaoDeRegras = { lido: true; candidatas: RegraCandidata[] } | { lido: false };

export interface ExtratorDeRegrasPort {
  extrair(pdf: Uint8Array): Promise<ExtracaoDeRegras>;
}
