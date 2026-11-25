import type { RegraCandidata } from "@/modules/rh/domain/services/validar-regras-da-convencao.service";

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
