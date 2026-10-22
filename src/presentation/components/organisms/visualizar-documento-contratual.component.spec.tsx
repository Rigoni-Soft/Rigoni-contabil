import { fireEvent, render, screen } from "@testing-library/react";

import { VisualizarDocumentoContratual } from "./visualizar-documento-contratual.component";

function montar(sobrescrever: Partial<Parameters<typeof VisualizarDocumentoContratual>[0]> = {}) {
  const props = {
    rotulo: "Alteração nº 3 - 05/03/2025",
    onAbrir: jest.fn(),
    abrindo: false,
    ...sobrescrever,
  };
  render(<VisualizarDocumentoContratual {...props} />);
  return props;
}

describe("VisualizarDocumentoContratual (#140)", () => {
  it("mostra o documento em destaque e o botão que abre em nova aba, sem diálogo", () => {
    montar();

    expect(screen.getByText("Alteração nº 3 - 05/03/2025", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Abrir / })).toHaveTextContent("Abrir em nova aba");
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
  });

  it("o nome acessível do botão contém o texto visível, para o comando de voz (WCAG 2.5.3)", () => {
    montar();

    const botao = screen.getByRole("button", { name: /^Abrir / });
    expect(botao).toHaveAccessibleName("Abrir em nova aba: Alteração nº 3 - 05/03/2025");
    expect(botao).toHaveAccessibleName(expect.stringContaining(botao.textContent ?? ""));
  });

  it("só o contrato social: mostra o contrato", () => {
    montar({ rotulo: "Contrato social" });

    expect(screen.getByText("Contrato social", { selector: "p" })).toBeInTheDocument();
  });

  it("'Abrir' dispara a abertura", () => {
    const props = montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir em nova aba: Alteração nº 3 - 05/03/2025" }),
    );
    expect(props.onAbrir).toHaveBeenCalledTimes(1);
  });

  it("mostra o link alternativo, em nova aba, quando o navegador bloqueou a aba", () => {
    montar({
      erro: "O navegador bloqueou a nova aba.",
      linkAlternativo: "https://storage/assinado",
    });

    const link = screen.getByRole("link", { name: "Abrir Alteração nº 3 - 05/03/2025" });
    expect(link).toHaveAttribute("href", "https://storage/assinado");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("mostra 'Abrindo…' e o erro quando houver", () => {
    montar({ abrindo: true, erro: "Não foi possível abrir o documento." });

    expect(screen.getByRole("button", { name: "Abrindo…" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o documento.");
  });

  it("enquanto abre, 'aria-disabled' (não 'disabled') mantém o foco no botão e o clique não abre de novo", () => {
    const props = montar({ abrindo: true });
    const botao = screen.getByRole("button", { name: "Abrindo…" });

    botao.focus();
    fireEvent.click(botao);

    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toBeDisabled();
    expect(botao).toHaveFocus();
    expect(props.onAbrir).not.toHaveBeenCalled();
  });

  it("fora do estado de abrir, não é aria-disabled", () => {
    montar();

    expect(screen.getByRole("button", { name: /^Abrir / })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("com `anexarPainelId`, mostra 'Anexar alteração' ao lado de 'Abrir em nova aba'", () => {
    montar({ anexarPainelId: "painel-anexar" });

    const abrir = screen.getByRole("button", { name: /^Abrir / });
    const anexar = screen.getByRole("button", { name: "Anexar alteração" });
    expect(anexar).toHaveAttribute("popovertarget", "painel-anexar");
    expect(abrir.parentElement).toBe(anexar.parentElement);
  });
});

describe("VisualizarDocumentoContratual: destaque ao chegar por aviso (#144)", () => {
  it("destacar: o anel de 4 px vale enquanto o botão tem foco, com mouse ou teclado (o foco é do Container, pelo ref)", () => {
    montar({ destacar: true });

    expect(screen.getByRole("button", { name: /^Abrir / })).toHaveClass(
      "focus:ring-4",
      "focus-visible:ring-4",
    );
  });

  it("repassa o ref ao botão de abrir", () => {
    const ref = { current: null as HTMLButtonElement | null };
    montar({ botaoAbrirRef: ref });

    expect(ref.current).toBe(screen.getByRole("button", { name: /^Abrir / }));
  });

  it("sem destacar: nada em foco e sem anel", () => {
    montar();

    const botao = screen.getByRole("button", { name: /^Abrir / });
    expect(botao).not.toHaveFocus();
    expect(botao).not.toHaveClass("focus:ring-4");
  });

  it("destacar não mexe no botão de anexar nem no que o botão faz", () => {
    const props = montar({ destacar: true, anexarPainelId: "painel-anexar" });

    expect(screen.getByRole("button", { name: /Anexar alteração/ })).not.toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /^Abrir / }));
    expect(props.onAbrir).toHaveBeenCalledTimes(1);
  });
});
