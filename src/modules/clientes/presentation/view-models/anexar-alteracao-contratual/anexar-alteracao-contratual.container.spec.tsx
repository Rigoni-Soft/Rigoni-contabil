import { render, screen, within } from "@testing-library/react";

import { AnexarAlteracaoContratualContainer } from "./anexar-alteracao-contratual.container";
import { useAnexarAlteracaoContratual } from "./use-anexar-alteracao-contratual.hook";

jest.mock("../visualizar-documento-contratual/documentos-contratuais.queries", () => ({
  useDocumentosContratuais: () => ({
    data: [
      { tipo: "alteracao", numero: 1, data: "2024-01-10", arquivo: "1-alteracao.pdf" },
      { tipo: "contrato", numero: null, data: null, arquivo: "contrato.pdf" },
      { tipo: "alteracao", numero: 3, data: "2025-03-10", arquivo: "3-alteracao.pdf" },
    ],
  }),
}));
jest.mock("./use-anexar-alteracao-contratual.hook", () => ({
  useAnexarAlteracaoContratual: jest.fn(),
}));

const hook = useAnexarAlteracaoContratual as jest.MockedFunction<
  typeof useAnexarAlteracaoContratual
>;
const CLIENTE = "11111111-1111-1111-1111-111111111111";

// useForm real dentro do hook falso: o organismo recebe register/control de verdade.
function simularHook(parcial: Partial<ReturnType<typeof useAnexarAlteracaoContratual>> = {}) {
  hook.mockImplementation(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useForm } = require("react-hook-form");
    const { register, control, formState } = useForm();
    return {
      register,
      control,
      errors: formState.errors,
      onSubmit: jest.fn(),
      pendente: false,
      erroServidor: undefined,
      aviso: undefined,
      aoEscolherArquivo: jest.fn(),
      ...parcial,
    };
  });
}

describe("AnexarAlteracaoContratualContainer (#141)", () => {
  it("lista as alterações do maior nº para o menor, sem o contrato social, e oferece 'Anexar alteração'", () => {
    simularHook();

    render(<AnexarAlteracaoContratualContainer clienteId={CLIENTE} />);

    expect(screen.getByRole("heading", { name: "Alterações contratuais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anexar alteração" })).toBeInTheDocument();
    const itens = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(itens).toEqual([
      "Alteração nº 3 - 10/03/20253-alteracao.pdf",
      "Alteração nº 1 - 10/01/20241-alteracao.pdf",
    ]);
  });

  it("mostra no diálogo o alerta de divergência e o erro do servidor", () => {
    simularHook({
      aviso: "Data anterior à da alteração nº 2, confere?",
      erroServidor: "Já existe a alteração nº 3 deste Cliente.",
    });

    render(<AnexarAlteracaoContratualContainer clienteId={CLIENTE} />);

    const dialogo = screen.getByRole("dialog", { hidden: true });
    expect(
      within(dialogo).getByText("Data anterior à da alteração nº 2, confere?"),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Já existe a alteração nº 3 deste Cliente."),
    ).toBeInTheDocument();
  });

  it("explica no campo de nº de onde vem a sugestão", () => {
    simularHook();

    render(<AnexarAlteracaoContratualContainer clienteId={CLIENTE} />);

    expect(
      screen.getByLabelText("Nº da alteração", { selector: "input" }),
    ).toHaveAccessibleDescription(/Sugerido pelo início do nome do arquivo/);
  });

  it("durante o envio, o botão do diálogo fica desabilitado", () => {
    simularHook({ pendente: true });

    render(<AnexarAlteracaoContratualContainer clienteId={CLIENTE} />);

    expect(screen.getByRole("button", { name: "Anexando...", hidden: true })).toBeDisabled();
  });
});
