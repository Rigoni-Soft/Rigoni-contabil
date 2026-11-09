import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";
import { EditarCadastroRhForm } from "./editar-cadastro-rh-form.component";

function Montado({ readOnly }: { readOnly: boolean }) {
  const { register, control, formState } = useForm<EditarCadastroOperacionalFormValues>({
    defaultValues: { contatos: [], observacoesGerais: "" },
  });
  return (
    <EditarCadastroRhForm
      cabecalho={{ empresa: "Padaria Sol", cnpj: "11.444.777/0001-61" }}
      register={register}
      control={control}
      errors={formState.errors}
      onSubmit={(e) => e.preventDefault()}
      pendente={false}
      readOnly={readOnly}
      contatos={[]}
      onAdicionarContato={jest.fn()}
      onRemoverContato={jest.fn()}
      onLimpar={jest.fn()}
    />
  );
}

describe("EditarCadastroRhForm", () => {
  it("mostra empresa e CNPJ, contatos e as observações do RH, sem Regime", () => {
    render(<Montado readOnly={false} />);

    expect(screen.getByLabelText("Empresa")).toHaveValue("Padaria Sol");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.444.777/0001-61");
    expect(screen.getByText("Contatos")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações gerais do RH")).toBeInTheDocument();
    expect(screen.queryByLabelText("Regime")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("somente leitura não tem Salvar nem Adicionar contato", () => {
    render(<Montado readOnly />);

    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar contato/ })).not.toBeInTheDocument();
  });
});
