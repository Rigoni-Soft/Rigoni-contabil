// Contrato neutro (ADR 0004): recebe os bytes do PDF da convenção e devolve os parâmetros que o provedor
// encontrou, ainda não confiáveis (o domínio os valida). Nada de provedor, modelo ou token aqui. A
// convenção é pública e pode ir a serviço externo. Nunca rejeita: falha vira `{ lido: false }`.
import type { RegraCandidata } from "@/modules/rh/domain/services/validar-regras-da-convencao.service";

// O sindicato e a vigência (AAAA-MM-DD) identificam a convenção e saem do próprio PDF; sem eles, não leu.
export type ExtracaoDeRegras =
  | {
      lido: true;
      sindicato: string;
      vigenciaInicio: string;
      vigenciaFim: string;
      candidatas: RegraCandidata[];
    }
  | { lido: false };

export interface ExtratorDeRegrasPort {
  extrair(pdf: Uint8Array): Promise<ExtracaoDeRegras>;
}
