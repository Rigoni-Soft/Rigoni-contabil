import type { DocumentoDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";

export interface GeradorDePdfDoCartaoPort {
  gerar(documento: DocumentoDoCartaoDto): Promise<Uint8Array>;
}
