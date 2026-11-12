import type {
  AtestadoBruto,
  LeitorDeAtestadoPort,
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";

// Sem leitor configurado: toda foto cai na digitação manual, em vez de gravar um cartão inventado.
export class LeitorDeCartaoIndisponivelGateway implements LeitorDeCartaoPort, LeitorDeAtestadoPort {
  async ler(): Promise<LeituraBruta> {
    return { lido: false };
  }

  async lerAtestado(): Promise<AtestadoBruto> {
    return { lido: false };
  }
}
