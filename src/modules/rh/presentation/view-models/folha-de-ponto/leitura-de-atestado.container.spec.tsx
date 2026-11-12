import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { lerAtestadoDePontoAction } from "./folha-de-ponto.actions";
import { LeituraDeAtestadoContainer } from "./leitura-de-atestado.container";

jest.mock("./folha-de-ponto.actions", () => ({ lerAtestadoDePontoAction: jest.fn() }));

const FOTO = new File([new Uint8Array([0xff, 0xd8])], "atestado-medico-2.jpeg", {
  type: "image/jpeg",
});

function montar(aoAbonar = jest.fn()) {
  // O jsdom não implementa showModal/close do <dialog>: marca o atributo `open` como o navegador faria.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  render(
    <LeituraDeAtestadoContainer empregadoId="e1" nomeDoEmpregado="Roberto" aoAbonar={aoAbonar} />,
  );
  return aoAbonar;
}

const modal = () => document.querySelector("dialog") as HTMLDialogElement;

describe("LeituraDeAtestadoContainer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("o botão abre a modal; sucesso envia o empregado e a foto, fecha a modal e avisa o cartão", async () => {
    jest
      .mocked(lerAtestadoDePontoAction)
      .mockResolvedValue({ ok: true, data: { tipo: "atestado", abonados: 2 } });
    const aoAbonar = montar();
    const user = userEvent.setup({ applyAccept: false });
    expect(modal()).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Ler atestado" }));
    expect(modal()).toHaveAttribute("open");
    await user.upload(screen.getByLabelText("Foto do atestado (JPEG ou PNG)"), FOTO);
    await user.click(screen.getByRole("button", { name: "Abonar pelo atestado" }));

    await waitFor(() =>
      expect(aoAbonar).toHaveBeenCalledWith("2 dias abonados pelo atestado. Confira o cartão."),
    );
    expect(Object.fromEntries(jest.mocked(lerAtestadoDePontoAction).mock.calls[0][0])).toEqual({
      empregadoId: "e1",
      imagem: expect.any(File),
    });
    expect(modal()).not.toHaveAttribute("open");
  });

  it("falha mantém a modal aberta com o motivo e não avisa o cartão", async () => {
    jest.mocked(lerAtestadoDePontoAction).mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "O nome no atestado não confere com Roberto." },
    });
    const aoAbonar = montar();
    const user = userEvent.setup({ applyAccept: false });
    await user.click(screen.getByRole("button", { name: "Ler atestado" }));
    await user.upload(screen.getByLabelText("Foto do atestado (JPEG ou PNG)"), FOTO);

    await user.click(screen.getByRole("button", { name: "Abonar pelo atestado" }));

    expect(await screen.findByText(/não confere com Roberto/)).toBeInTheDocument();
    expect(modal()).toHaveAttribute("open");
    expect(aoAbonar).not.toHaveBeenCalled();
  });

  it("sem foto avisa no campo e não envia", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Ler atestado" }));

    await userEvent.click(screen.getByRole("button", { name: "Abonar pelo atestado" }));

    expect(
      await screen.findByText("Escolha a foto do atestado (JPEG ou PNG)."),
    ).toBeInTheDocument();
    expect(lerAtestadoDePontoAction).not.toHaveBeenCalled();
  });

  it("Cancelar fecha a modal sem enviar", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Ler atestado" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(modal()).not.toHaveAttribute("open");
    expect(lerAtestadoDePontoAction).not.toHaveBeenCalled();
  });
});
