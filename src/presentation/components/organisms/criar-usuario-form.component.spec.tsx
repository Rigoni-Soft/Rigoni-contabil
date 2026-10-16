import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { SETORES } from "@/shared/kernel/setores";

import { CriarUsuarioForm, type CriarUsuarioFormValues } from "./criar-usuario-form.component";

function Wrapper({
  onSubmit,
  criado,
  onCadastrarNovo = jest.fn(),
  papeisDisponiveis = ["lider_setor", "funcionario"],
  setoresDisponiveis = SETORES,
}: {
  onSubmit: (v: CriarUsuarioFormValues) => void;
  criado?: { nome: string; email: string; senhaProvisoria: string };
  onCadastrarNovo?: () => void;
  papeisDisponiveis?: Array<"lider_setor" | "funcionario">;
  setoresDisponiveis?: readonly string[];
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
      onCadastrarNovo={onCadastrarNovo}
      papeisDisponiveis={papeisDisponiveis}
      setoresDisponiveis={setoresDisponiveis}
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

  it("Papel e Setor vêm pré-selecionados e travados quando só há 1 opção (Líder), e submetem sem precisar escolher", async () => {
    const onSubmit = jest.fn();
    const usuario = userEvent.setup();
    render(
      <Wrapper
        onSubmit={onSubmit}
        papeisDisponiveis={["funcionario"]}
        setoresDisponiveis={["contabil"]}
      />,
    );

    const papel = screen.getByLabelText("Papel");
    const setor = screen.getByLabelText("Setor");
    expect(papel).toBeDisabled();
    expect(papel).toHaveValue("funcionario");
    expect(setor).toBeDisabled();
    expect(setor).toHaveValue("contabil");

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        nome: "Jéssica Souza",
        email: "jessica@rigonicontabil.local",
        papel: "funcionario",
        setor: "contabil",
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

  it("depois de criado, 'Cadastrar outro' chama onCadastrarNovo e 'Finalizar' linka pra home", async () => {
    const onCadastrarNovo = jest.fn();
    const usuario = userEvent.setup();
    render(
      <Wrapper
        onSubmit={jest.fn()}
        onCadastrarNovo={onCadastrarNovo}
        criado={{
          nome: "Jéssica Souza",
          email: "jessica@rigonicontabil.local",
          senhaProvisoria: "ABCDEFGHJKLM",
        }}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: "Cadastrar outro" }));
    expect(onCadastrarNovo).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: "Finalizar" })).toHaveAttribute("href", "/");
  });
});
