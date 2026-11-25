import type {
  AtestadoBruto,
  LeitorDeAtestadoPort,
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";

const emMinutos = (horas: number, minutos = 0) => horas * 60 + minutos;

export class LeitorDeCartaoFalsoGateway implements LeitorDeCartaoPort, LeitorDeAtestadoPort {
  async ler(): Promise<LeituraBruta> {
    const dia = (n: number) => ({
      dia: n,
      batidas: [
        { entrada: emMinutos(8, 30), saida: emMinutos(12) },
        { entrada: emMinutos(13, 30), saida: emMinutos(18) },
      ],
      extra: null,
      atestado: false,
      faltou: false,
    });
    return {
      lido: true,
      leitura: {
        nome: "Erick Falso",
        dias: [
          dia(1),
          dia(2),
          { ...dia(3), batidas: [], faltou: true },
          { ...dia(4), batidas: [], atestado: true },
          { ...dia(7), extra: { entrada: emMinutos(18, 30), saida: emMinutos(20) } },
        ],
      },
    };
  }

  async lerAtestado(): Promise<AtestadoBruto> {
    return {
      lido: true,
      atestado: { nome: "Erick Falso", tipo: "declaracao", de: "2026-09-01", ate: null },
    };
  }
}
