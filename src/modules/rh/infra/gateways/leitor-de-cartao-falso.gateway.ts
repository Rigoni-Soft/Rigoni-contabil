import type {
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";

const h = (hh: number, mm = 0) => hh * 60 + mm;

// Leitor de dev, CI e Preview: não olha a foto e devolve sempre o mesmo cartão (Erick Falso, 1ª quinzena:
// dois dias úteis, uma falta anotada, um atestado e uma hora extra). Em Produção gravaria um empregado
// inventado: lá o modo é "indisponivel" ou o real.
export class LeitorDeCartaoFalsoGateway implements LeitorDeCartaoPort {
  async ler(): Promise<LeituraBruta> {
    const dia = (n: number) => ({
      dia: n,
      batidas: [
        { entrada: h(8, 30), saida: h(12) },
        { entrada: h(13, 30), saida: h(18) },
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
          { ...dia(7), extra: { entrada: h(18, 30), saida: h(20) } },
        ],
      },
    };
  }
}
