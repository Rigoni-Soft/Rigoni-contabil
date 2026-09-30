import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { AuditoriaFeedFiltro, type FiltroValues } from "./auditoria-feed-filtro.component";

function Wrapper({ onSubmit }: { onSubmit: (v: FiltroValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FiltroValues>();

  return (
    <AuditoriaFeedFiltro
      register={register}
      errors={errors}
      onSubmit={handleSubmit(onSubmit)}
      onLimpar={() => {}}
    />
  );
}

describe("AuditoriaFeedFiltro", () => {
  it("submete os valores preenchidos", async () => {
    const onSubmit = jest.fn();
    const usuario = userEvent.setup();
    render(<Wrapper onSubmit={onSubmit} />);

    await usuario.type(screen.getByLabelText("Ação"), "usuario.criar");
    await usuario.selectOptions(screen.getByLabelText("Resultado"), "sucesso");
    await usuario.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ acao: "usuario.criar", resultado: "sucesso" }),
    );
  });

  it("mostra o aviso de período incompleto no campo correspondente", () => {
    render(
      <AuditoriaFeedFiltro
        register={(() => ({})) as unknown as ReturnType<typeof useForm<FiltroValues>>["register"]}
        errors={{
          dataFim: { type: "custom", message: "Informe as duas datas do período (De e Até)." },
        }}
        onSubmit={() => {}}
        onLimpar={() => {}}
      />,
    );

    expect(screen.getByText("Informe as duas datas do período (De e Até).")).toBeInTheDocument();
  });

  // Devolutiva técnica PR #60, ajuste 03: erro de UUID inválido no ator
  // precisa aparecer no campo, mesmo padrão do aviso de período.
  it("mostra o aviso de ator inválido no campo correspondente", () => {
    render(
      <AuditoriaFeedFiltro
        register={(() => ({})) as unknown as ReturnType<typeof useForm<FiltroValues>>["register"]}
        errors={{
          ator: { type: "custom", message: "Identificador de ator inválido." },
        }}
        onSubmit={() => {}}
        onLimpar={() => {}}
      />,
    );

    expect(screen.getByText("Identificador de ator inválido.")).toBeInTheDocument();
  });

  it("tem os campos de período, setor, ator, ação, alvo e resultado", () => {
    render(<Wrapper onSubmit={jest.fn()} />);

    expect(screen.getByLabelText("De")).toBeInTheDocument();
    expect(screen.getByLabelText("Até")).toBeInTheDocument();
    expect(screen.getByLabelText("Setor")).toBeInTheDocument();
    expect(screen.getByLabelText("Ator")).toBeInTheDocument();
    expect(screen.getByLabelText("Ação")).toBeInTheDocument();
    expect(screen.getByLabelText("Alvo")).toBeInTheDocument();
    expect(screen.getByLabelText("Resultado")).toBeInTheDocument();
  });
});
