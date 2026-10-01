import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { CriarUsuarioForm, type CriarUsuarioFormValues } from "./criar-usuario-form.component";

function Wrapper({
  onSubmit,
  criado,
}: {
  onSubmit: (v: CriarUsuarioFormValues) => void;
  criado?: { nome: string; email: string; senhaProvisoria: string };
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarUsuarioFormValues>();

  return (
    <CriarUsuarioForm
      register={register}
      errors={errors}
      onSubmit={handleSubmit(onSubmit)}
      pendente={false}
      criado={criado}
    />
  );
}

describe("CriarUsuarioForm", () => {
  it("submete nome, e-mail, papel e setor preenchidos", async () => {
    const onSubmit = jest.fn();
    const usuario = userEvent.setup();
    render(<Wrapper onSubmit={onSubmit} />);

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.selectOptions(screen.getByLabelText("Papel"), "funcionario");
    await usuario.selectOptions(screen.getByLabelText("Setor"), "simples_nacional");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        nome: "Jéssica Souza",
        email: "jessica@rigonicontabil.local",
        papel: "funcionario",
        setor: "simples_nacional",
      }),
    );
  });

  it("mostra a senha provisória depois de criado, em vez do formulário", () => {
    render(
      <Wrapper
        onSubmit={jest.fn()}
        criado={{
          nome: "Jéssica Souza",
          email: "jessica@rigonicontabil.local",
          senhaProvisoria: "ABCDEFGHJKLM",
        }}
      />,
    );

    expect(screen.getByText("ABCDEFGHJKLM")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
  });
});
