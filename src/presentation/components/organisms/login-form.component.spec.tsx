import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { LoginForm } from "./login-form.component";

type Valores = { email: string; senha: string };

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
    <LoginForm
      register={register}
      errors={errors}
      pendente={pendente}
      erroServidor={erroServidor}
      onSubmit={handleSubmit(onSubmit)}
    />
  );
}

describe("LoginForm", () => {
  it("chama onSubmit com os valores digitados", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<Wrapper onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("E-mail"), "admin@rigonicontabil.local");
    await user.type(screen.getByLabelText("Senha"), "admin123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: "admin@rigonicontabil.local", senha: "admin123" },
      expect.anything(),
    );
  });

  it("não oferece e-mail nem senha salvos pelo navegador", () => {
    render(<Wrapper onSubmit={jest.fn()} />);

    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "new-password");
  });

  it("liga a mensagem de erro de cada campo ao próprio campo", () => {
    render(
      <LoginForm
        register={(() => ({})) as never}
        errors={{
          email: { type: "required", message: "Informe o e-mail." },
          senha: { type: "required", message: "Informe a senha." },
        }}
        pendente={false}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Informe o e-mail.");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Informe a senha.");
  });

  it("desabilita o botão e muda o rótulo quando pendente", () => {
    render(<Wrapper onSubmit={jest.fn()} pendente />);

    const botao = screen.getByRole("button", { name: "Entrando…" });
    expect(botao).toBeDisabled();
  });

  it("mostra o erro do servidor quando informado", () => {
    render(<Wrapper onSubmit={jest.fn()} erroServidor="E-mail ou senha inválidos." />);

    expect(screen.getByText("E-mail ou senha inválidos.")).toBeInTheDocument();
  });
});
