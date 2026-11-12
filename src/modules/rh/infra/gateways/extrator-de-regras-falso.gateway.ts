import type {
  ExtracaoDeRegras,
  ExtratorDeRegrasPort,
} from "@/modules/rh/application/ports/out/extrator-de-regras.provider";

// Adapter falso e determinístico (padrão em dev, CI e Preview; nenhum teste chama modelo de linguagem). Devolve
// sempre os parâmetros da convenção de exemplo (comércio varejista), com um candidato que o domínio recusa
// (intervalo máximo de 150 sem o número no trecho). O marcador `[extrator:falha]` no texto do PDF simula a
// leitura que não deu certo. Sindicato e vigência saem das linhas "Sindicato: X" e "Vigência: dd/mm/aaaa a
// dd/mm/aaaa" do texto do PDF; sem elas, valem os da convenção de exemplo (o falso não lê PDF comprimido).
function identificacao(texto: string) {
  const sindicato = /Sindicato:\s*([^\r\n)]+)/.exec(texto)?.[1]?.trim();
  const vigencia = /Vig[eê]ncia:\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(
    texto,
  );
  return {
    sindicato: sindicato || "Comércio",
    vigenciaInicio: vigencia ? `${vigencia[3]}-${vigencia[2]}-${vigencia[1]}` : "2026-05-01",
    vigenciaFim: vigencia ? `${vigencia[6]}-${vigencia[5]}-${vigencia[4]}` : "2027-04-30",
  };
}

export class ExtratorDeRegrasFalsoGateway implements ExtratorDeRegrasPort {
  async extrair(pdf: Uint8Array): Promise<ExtracaoDeRegras> {
    const texto = Buffer.from(pdf).toString("utf8");
    if (texto.includes("[extrator:falha]")) return { lido: false };
    return {
      lido: true,
      ...identificacao(texto),
      candidatas: [
        {
          chave: "jornada_semanal",
          valor: 2640,
          clausula: "Cláusula 8ª",
          trecho: "A jornada normal de trabalho será de 44 horas semanais.",
        },
        {
          chave: "jornada_diaria",
          valor: 480,
          clausula: "Cláusula 8ª, § 1º",
          trecho: "A jornada diária não excederá 8 horas, de segunda a sábado.",
        },
        {
          chave: "limite_extras_dia",
          valor: 120,
          clausula: "Cláusula 11ª",
          trecho: "É permitida a prorrogação da jornada em até 2 horas por dia.",
        },
        {
          chave: "extra_sabado",
          valor: 60,
          clausula: "Cláusula 12ª",
          trecho: "As horas extras trabalhadas aos sábados serão pagas com adicional de 60%.",
        },
        {
          chave: "datas_especiais",
          valor: [
            { descricao: "Natal", data: "25/12", percentual: 150, percentualComissionado: 100 },
            { descricao: "Confraternização universal", data: "01/01", percentual: 150 },
          ],
          clausula: "Cláusula 14ª",
          trecho:
            "O trabalho em 25/12 e 01/01 será remunerado com adicional de 150%, e de 100% para o comissionado em 25/12.",
        },
        {
          chave: "intervalo_maximo",
          valor: 150,
          clausula: "Cláusula 9ª",
          trecho: "O intervalo para refeição poderá ser ampliado por acordo.",
        },
      ],
    };
  }
}
