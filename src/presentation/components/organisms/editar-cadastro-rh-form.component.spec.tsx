import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";
import { EditarCadastroRhForm } from "./editar-cadastro-rh-form.component";

function Montado({
  readOnly,
  extras,
}: {
  readOnly: boolean;
  extras?: {
    responsavel?: React.ReactNode;
    mesDoAcompanhamento?: React.ReactNode;
    acompanhamento?: React.ReactNode;
  };
}) {
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
      {...extras}
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

  it("mostra o erro de campo das observações", () => {
    function ComErro() {
      const { register, control } = useForm<EditarCadastroOperacionalFormValues>({
        defaultValues: { contatos: [], observacoesGerais: "" },
      });
      return (
        <EditarCadastroRhForm
          cabecalho={{ empresa: "Padaria Sol", cnpj: "11.444.777/0001-61" }}
          register={register}
          control={control}
          errors={{ observacoesGerais: { type: "max", message: "Passou de 2000 caracteres" } }}
          onSubmit={(e) => e.preventDefault()}
          pendente={false}
          readOnly={false}
          contatos={[]}
          onAdicionarContato={jest.fn()}
          onRemoverContato={jest.fn()}
          onLimpar={jest.fn()}
        />
      );
    }
    render(<ComErro />);

    expect(screen.getByText("Passou de 2000 caracteres")).toBeInTheDocument();
  });

  it("o Responsável entra no cabeçalho e o acompanhamento no mesmo cartão, antes dos contatos", () => {
    render(
      <Montado
        readOnly={false}
        extras={{
          responsavel: (
            <label>
              Responsável
              <input readOnly value="Ana" />
            </label>
          ),
          acompanhamento: <h2>Acompanhamento do mês</h2>,
        }}
      />,
    );

    const cartao = screen.getByLabelText("Empresa").closest("form")!;
    expect(cartao).toContainElement(screen.getByLabelText("Responsável"));
    const acompanhamento = screen.getByRole("heading", { name: "Acompanhamento do mês" });
    expect(cartao).toContainElement(acompanhamento);
    expect(
      acompanhamento.compareDocumentPosition(screen.getByText("Contatos")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("a nota de obrigatórios vem primeiro, depois o mês, e só então o cabeçalho do cadastro (ordem do foco)", () => {
    render(
      <Montado
        readOnly={false}
        extras={{ mesDoAcompanhamento: <a href="?mes=2026-10">Mês anterior</a> }}
      />,
    );

    const nota = screen.getByText(/são obrigatórios/);
    const mes = screen.getByRole("link", { name: "Mês anterior" });
    const empresa = screen.getByLabelText("Empresa");
    const antes = (a: Node, b: Node) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(antes(nota, mes)).toBeTruthy();
    expect(antes(mes, empresa)).toBeTruthy();
  });
});
