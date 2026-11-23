import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { LINHAS_DE_CONTATO_DE_TESTE } from "../../../../test-support/linhas-de-contato-de-teste";
import { ContatosDoCadastro } from "./contatos-do-cadastro.component";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

const CONTATOS = [
  { nome: "Ana", telefone: "(11) 99999-0000", email: "ana@exemplo.com" },
  { nome: "Bia", telefone: "", email: "bia@exemplo.com" },
];

type Linhas = React.ComponentProps<typeof ContatosDoCadastro>["linhas"];
// As fixtures são estreitas (`() => boolean`); cada teste troca só o que precisa.
const comLinhas = (troca: Partial<Linhas>): Linhas => ({ ...LINHAS_DE_CONTATO_DE_TESTE, ...troca });

function Montado({
  readOnly = false,
  linhas = LINHAS_DE_CONTATO_DE_TESTE as Linhas,
  onAdicionar = jest.fn(),
}: {
  readOnly?: boolean;
  linhas?: Linhas;
  onAdicionar?: () => void;
}) {
  const { register, control, formState } = useForm<EditarCadastroOperacionalFormValues>({
    defaultValues: { contatos: CONTATOS } as Partial<EditarCadastroOperacionalFormValues>,
  });
  return (
    <ContatosDoCadastro
      register={register}
      control={control}
      errors={formState.errors}
      readOnly={readOnly}
      contatos={CONTATOS.map((_, indice) => ({ id: `campo-${indice}` }))}
      onAdicionar={onAdicionar}
      linhas={linhas}
    />
  );
}

describe("ContatosDoCadastro", () => {
  it("uma linha por contato visível, numerada pela tela, com o botão de adicionar", () => {
    render(<Montado />);

    expect(screen.getByRole("group", { name: "Contato 1" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Contato 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar contato" })).toBeInTheDocument();
  });

  it("contato escondido (de outro Setor ainda não usado) não vira linha e não conta na numeração", () => {
    render(
      <Montado
        linhas={comLinhas({
          visivel: (indice: number) => indice === 1,
          numero: () => 1,
        })}
      />,
    );

    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getAllByRole("group", { name: "Contato 1" })).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "Contato 2" })).toBeNull();
  });

  it("Adicionar contato chama o callback", async () => {
    const aoAdicionar = jest.fn();
    render(<Montado onAdicionar={aoAdicionar} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Adicionar contato" }));

    expect(aoAdicionar).toHaveBeenCalledTimes(1);
  });

  it("só visualização: sem Adicionar, sem a dica, sem lixeira", () => {
    render(<Montado readOnly />);

    expect(screen.queryByRole("button", { name: "Adicionar contato" })).toBeNull();
    expect(screen.queryByText(/informe ao menos o WhatsApp ou o e-mail/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remover contato/ })).toBeNull();
  });

  it("Editar e Remover da linha chamam as ações com o índice dela", async () => {
    const linhas = {
      ...LINHAS_DE_CONTATO_DE_TESTE,
      onEditar: jest.fn(),
      onRemover: jest.fn(),
    };
    const usuario = userEvent.setup();
    render(<Montado linhas={linhas} />);

    await usuario.click(screen.getByRole("button", { name: "Editar contato 2" }));
    await usuario.click(screen.getByRole("button", { name: "Remover contato 1" }));

    expect(linhas.onEditar).toHaveBeenCalledWith(1);
    expect(linhas.onRemover).toHaveBeenCalledWith(0);
  });

  it("sair do WhatsApp avisa a linha (o aviso de número repetido nasce dali)", async () => {
    const linhas = { ...LINHAS_DE_CONTATO_DE_TESTE, onSairDoTelefone: jest.fn() };
    const usuario = userEvent.setup();
    render(<Montado linhas={linhas} />);

    await usuario.click(screen.getAllByLabelText("WhatsApp")[0]);
    await usuario.tab();

    expect(linhas.onSairDoTelefone).toHaveBeenCalledWith(0);
  });

  it("a mensagem de confirmação vai à região aria-live, e a pergunta de deixar de usar aparece na linha", () => {
    render(
      <Montado
        linhas={comLinhas({
          aviso: "Contato 1 salvo.",
          confirmacaoDeRemocao: (indice: number) =>
            indice === 1
              ? {
                  texto: "Deixar de usar este contato?",
                  onConfirmar: jest.fn(),
                  onCancelar: jest.fn(),
                }
              : undefined,
        })}
      />,
    );

    expect(screen.getByText("Contato 1 salvo.")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Deixar de usar este contato?")).toBeInTheDocument();
  });
});
