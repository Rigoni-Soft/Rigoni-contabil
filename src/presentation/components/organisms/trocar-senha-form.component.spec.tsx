import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { TrocarSenhaForm } from "./trocar-senha-form.component";

type Valores = { novaSenha: string; confirmacao: string };

function Wrapper({
  onSubmit,
  pendente = false,
  erroServidor,
}: {
  onSubmit: (v: Valores) => void;
  pendente?: boolean;
  erroServidor?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>();

  return (
    <TrocarSenhaForm
      register={register}
      errors={errors}
      pendente={pendente}
      erroServidor={erroServidor}
      onSubmit={handleSubmit(onSubmit)}
    />
  );
}

describe("TrocarSenhaForm", () => {
  it("chama onSubmit com os valores digitados", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<Wrapper onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senha-nova-123");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { novaSenha: "senha-nova-123", confirmacao: "senha-nova-123" },
      expect.anything(),
    );
  });

  it("desabilita o botão e muda o rótulo quando pendente", () => {
    render(<Wrapper onSubmit={jest.fn()} pendente />);

    const botao = screen.getByRole("button", { name: "Trocando…" });
    expect(botao).toBeDisabled();
  });

  it("mostra o erro do servidor quando informado", () => {
    render(<Wrapper onSubmit={jest.fn()} erroServidor="Sessão inválida." />);

    expect(screen.getByText("Sessão inválida.")).toBeInTheDocument();
  });
});
