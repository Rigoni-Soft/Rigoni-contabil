import {
  cartaoFeito,
  diaTemApontamento,
  situacaoDoCartao,
} from "@/modules/rh/domain/services/situacao-do-cartao.service";

const vazio = { batidas: [], extra: null, abono: false };
const comBatida = { ...vazio, batidas: [{ entrada: 480, saida: 720 }] };
const base = { ativo: true, semMovimento: false, iniciado: false, dias: [vazio] };

describe("diaTemApontamento", () => {
  it("batida, extra ou abono contam; o dia em branco não", () => {
    expect(diaTemApontamento(vazio)).toBe(false);
    expect(diaTemApontamento(comBatida)).toBe(true);
    expect(diaTemApontamento({ ...vazio, extra: { entrada: 1080, saida: 1140 } })).toBe(true);
    expect(diaTemApontamento({ ...vazio, abono: true })).toBe(true);
  });
});

describe("situacaoDoCartao", () => {
  it("sem apontamento nem marca, o cartão está por fazer", () => {
    expect(situacaoDoCartao(base)).toBe("por_fazer");
    expect(situacaoDoCartao({ ...base, dias: [] })).toBe("por_fazer");
  });

  it("iniciado sem apontamento não é feito", () => {
    const situacao = situacaoDoCartao({ ...base, iniciado: true });
    expect(situacao).toBe("iniciado");
    expect(cartaoFeito(situacao)).toBe(false);
  });

  it("dia salvo sem apontamento não faz o cartão feito", () => {
    expect(situacaoDoCartao({ ...base, dias: [vazio, vazio] })).toBe("por_fazer");
  });

  it("um dia com apontamento basta: o cartão incompleto é feito", () => {
    const situacao = situacaoDoCartao({ ...base, dias: [vazio, comBatida] });
    expect(situacao).toBe("feito");
    expect(cartaoFeito(situacao)).toBe(true);
  });

  it("só abono já é apontamento", () => {
    expect(situacaoDoCartao({ ...base, dias: [{ ...vazio, abono: true }] })).toBe("feito");
  });

  it("com apontamento, a marca iniciado não muda nada", () => {
    expect(situacaoDoCartao({ ...base, iniciado: true, dias: [comBatida] })).toBe("feito");
  });

  it("sem movimento e desligado vencem o apontamento", () => {
    expect(situacaoDoCartao({ ...base, semMovimento: true, dias: [comBatida] })).toBe(
      "sem_movimento",
    );
    expect(situacaoDoCartao({ ...base, ativo: false, semMovimento: true, dias: [comBatida] })).toBe(
      "desligado",
    );
  });
});
