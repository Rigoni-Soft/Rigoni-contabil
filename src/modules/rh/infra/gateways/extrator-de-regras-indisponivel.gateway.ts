import type {
  ExtracaoDeRegras,
  ExtratorDeRegrasPort,
} from "@/modules/rh/application/ports/out/extrator-de-regras.provider";

// Sem provedor de extração configurado: toda leitura falha e o envio da convenção é recusado, em vez de
// gravar regras inventadas (o falso só serve a dev, CI e Preview).
export class ExtratorDeRegrasIndisponivelGateway implements ExtratorDeRegrasPort {
  async extrair(): Promise<ExtracaoDeRegras> {
    return { lido: false };
  }
}
