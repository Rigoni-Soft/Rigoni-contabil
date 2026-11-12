// Contrato neutro (ADR 0004 e 0011): recebe a foto do Cartão de ponto e devolve o que leu, ainda não
// confiável (o domínio valida). Nada de provedor, modelo ou token aqui. A foto tem dado pessoal: o
// leitor não a guarda. Nunca rejeita: falha vira `{ lido: false }`.
import type { AtestadoLido } from "@/modules/rh/domain/services/atestado.service";
import type { LeituraDoCartao } from "@/modules/rh/domain/services/leitura-do-cartao.service";

export type ImagemDoCartao = { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" };

export type LeituraBruta = { lido: true; leitura: LeituraDoCartao } | { lido: false };

// Atestado ou declaração de comparecimento: só nome, tipo e datas; o documento, o CID e o resto nunca saem do leitor.
export type AtestadoBruto = { lido: true; atestado: AtestadoLido } | { lido: false };

export interface LeitorDeCartaoPort {
  ler(imagem: ImagemDoCartao): Promise<LeituraBruta>;
  lerAtestado(imagem: ImagemDoCartao): Promise<AtestadoBruto>;
}
