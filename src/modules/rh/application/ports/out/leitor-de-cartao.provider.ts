import type { AtestadoLido } from "@/modules/rh/domain/services/atestado.service";
import type { LeituraDoCartao } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import type { FotoDoPonto } from "@/shared/kernel/foto-do-ponto";

export type ImagemDoCartao = FotoDoPonto;

export type LeituraBruta = { lido: true; leitura: LeituraDoCartao } | { lido: false };

export type AtestadoBruto = { lido: true; atestado: AtestadoLido } | { lido: false };

export interface LeitorDeCartaoPort {
  ler(imagem: ImagemDoCartao): Promise<LeituraBruta>;
}

export interface LeitorDeAtestadoPort {
  lerAtestado(imagem: ImagemDoCartao): Promise<AtestadoBruto>;
}
