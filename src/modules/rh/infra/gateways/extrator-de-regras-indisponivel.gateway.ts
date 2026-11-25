import type {
  ExtracaoDeRegras,
  ExtratorDeRegrasPort,
} from "@/modules/rh/application/ports/out/extrator-de-regras.provider";

export class ExtratorDeRegrasIndisponivelGateway implements ExtratorDeRegrasPort {
  async extrair(): Promise<ExtracaoDeRegras> {
    return { lido: false };
  }
}
