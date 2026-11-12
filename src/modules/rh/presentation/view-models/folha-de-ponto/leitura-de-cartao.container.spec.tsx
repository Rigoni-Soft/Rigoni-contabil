import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { lerCartaoDePontoAction } from "./folha-de-ponto.actions";
import { LeituraDeCartaoContainer } from "./leitura-de-cartao.container";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./folha-de-ponto.actions", () => ({ lerCartaoDePontoAction: jest.fn() }));

const FOTO = new File([new Uint8Array([0xff, 0xd8])], "ponto-erick-quin-1.jpeg", {
  type: "image/jpeg",
});
const LIDO = {
  empregadoId: "e1",
  nome: "Erick",
  cadastrado: true,
  dias: 3,
  faltas: 1,
  abonos: 0,
};

describe("LeituraDeCartaoContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(lerCartaoDePontoAction).mockResolvedValue({ ok: true, data: LIDO });
  });

  it("envia a foto com o Cliente, o mês e a quinzena, resume a leitura e recarrega a tela", async () => {
    render(<LeituraDeCartaoContainer clienteId="c1" competencia="2026-09" />);
    const user = userEvent.setup({ applyAccept: false });
    await user.selectOptions(screen.getByLabelText("Quinzena"), "2");
    await user.upload(screen.getByLabelText("Foto do cartão (JPEG ou PNG)"), FOTO);

    await user.click(screen.getByRole("button", { name: "Ler cartão" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const enviado = jest.mocked(lerCartaoDePontoAction).mock.calls[0][0];
    expect(Object.fromEntries(enviado)).toEqual({
      clienteId: "c1",
      competencia: "2026-09",
      quinzena: "2",
      imagem: expect.any(File),
    });
    expect(
      await screen.findByText(
        "Erick (cadastrado no quadro): 3 dias lidos, 1 falta anotada. Confira o cartão.",
      ),
    ).toBeInTheDocument();
  });

  it("sem foto escolhida, avisa e não envia", async () => {
    render(<LeituraDeCartaoContainer clienteId="c1" competencia="2026-09" />);

    await userEvent.click(screen.getByRole("button", { name: "Ler cartão" }));

    expect(await screen.findByText(/Escolha a foto do cartão/)).toBeInTheDocument();
    expect(lerCartaoDePontoAction).not.toHaveBeenCalled();
  });

  it("leitura que falha mostra o erro (digitar à mão) e preserva a foto escolhida", async () => {
    jest.mocked(lerCartaoDePontoAction).mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Não foi possível ler o cartão. Digite à mão." },
    });
    render(<LeituraDeCartaoContainer clienteId="c1" competencia="2026-09" />);
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText("Foto do cartão (JPEG ou PNG)"), FOTO);

    await user.click(screen.getByRole("button", { name: "Ler cartão" }));

    expect(await screen.findByText(/Digite à mão/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("ponto-erick-quin-1.jpeg")).toBeInTheDocument();
  });
});
