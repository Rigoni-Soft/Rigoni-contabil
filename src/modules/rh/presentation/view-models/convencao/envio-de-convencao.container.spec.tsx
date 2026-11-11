import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { enviarConvencaoAction } from "./convencao.actions";
import { EnvioDeConvencaoContainer } from "./envio-de-convencao.container";

const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("./convencao.actions", () => ({ enviarConvencaoAction: jest.fn() }));

const PDF = new File(["%PDF-1.7"], "cct-2026.pdf", { type: "application/pdf" });

async function preencher(arquivo: File | null = PDF) {
  const user = userEvent.setup({ applyAccept: false });
  const formulario = screen.getByRole("form", { name: "Enviar convenção" });
  await user.type(formulario.querySelector("input[name=sindicato]")!, "Comércio");
  const inicio = formulario.querySelector("input[name=vigenciaInicio]") as HTMLInputElement;
  const fim = formulario.querySelector("input[name=vigenciaFim]") as HTMLInputElement;
  await user.type(inicio, "2026-05-01");
  await user.type(fim, "2027-04-30");
  if (arquivo) await user.upload(screen.getByLabelText("Convenção (PDF)"), arquivo);
  return user;
}

describe("EnvioDeConvencaoContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(enviarConvencaoAction).mockResolvedValue({ ok: true, data: undefined });
  });

  it("envia o PDF com o Cliente, o sindicato e a vigência, e recarrega a tela", async () => {
    render(<EnvioDeConvencaoContainer clienteId="c1" />);
    const user = await preencher();

    await user.click(screen.getByRole("button", { name: "Enviar convenção" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const enviado = jest.mocked(enviarConvencaoAction).mock.calls[0][0];
    expect(Object.fromEntries(enviado)).toEqual({
      clienteId: "c1",
      sindicato: "Comércio",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2027-04-30",
      arquivo: expect.any(File),
    });
    expect((enviado.get("arquivo") as File).name).toBe("cct-2026.pdf");
  });

  it("sem PDF escolhido, avisa e não envia", async () => {
    render(<EnvioDeConvencaoContainer clienteId="c1" />);
    const user = await preencher(null);

    await user.click(screen.getByRole("button", { name: "Enviar convenção" }));

    expect(await screen.findByText("Escolha o PDF da convenção.")).toBeInTheDocument();
    expect(enviarConvencaoAction).not.toHaveBeenCalled();
  });

  it("mostra a recusa do servidor e preserva o que foi digitado", async () => {
    jest.mocked(enviarConvencaoAction).mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Não foi possível ler a convenção." },
    });
    render(<EnvioDeConvencaoContainer clienteId="c1" />);
    const user = await preencher();

    await user.click(screen.getByRole("button", { name: "Enviar convenção" }));

    expect(await screen.findByText("Não foi possível ler a convenção.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Sindicato" })).toHaveValue("Comércio");
  });
});
