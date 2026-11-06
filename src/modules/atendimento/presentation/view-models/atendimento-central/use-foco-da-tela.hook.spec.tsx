import { render } from "@testing-library/react";

import { useFocoNaLista, useFocoNoChat } from "./use-foco-da-tela.hook";

function Chat({ abertoId, pronto }: { abertoId: string | null; pronto: boolean }) {
  const ref = useFocoNoChat(abertoId, pronto);
  return <section ref={ref} tabIndex={-1} aria-label="chat" />;
}

function Lista({ abertoId }: { abertoId: string | null }) {
  const ref = useFocoNaLista(abertoId);
  return <section ref={ref} tabIndex={-1} aria-label="lista" />;
}

const foco = () => document.activeElement?.getAttribute("aria-label") ?? null;

describe("useFocoNoChat", () => {
  it("leva o foco ao chat quando a conversa abre e fica pronta, uma vez por conversa", () => {
    const { rerender, getByLabelText } = render(<Chat abertoId={null} pronto={false} />);
    expect(foco()).toBeNull();

    rerender(<Chat abertoId="a" pronto={false} />);
    expect(foco()).toBeNull();

    rerender(<Chat abertoId="a" pronto />);
    expect(foco()).toBe("chat");

    // O usuário foi para outro lugar: reler a mesma conversa não puxa o foco de volta.
    getByLabelText("chat").blur();
    rerender(<Chat abertoId="a" pronto />);
    expect(foco()).toBeNull();

    rerender(<Chat abertoId="b" pronto />);
    expect(foco()).toBe("chat");
  });
});

describe("useFocoNaLista", () => {
  it("devolve o foco à lista ao fechar a conversa, não ao montar", () => {
    const { rerender } = render(<Lista abertoId={null} />);
    expect(foco()).toBeNull();

    rerender(<Lista abertoId="a" />);
    expect(foco()).toBeNull();

    rerender(<Lista abertoId={null} />);
    expect(foco()).toBe("lista");
  });
});
