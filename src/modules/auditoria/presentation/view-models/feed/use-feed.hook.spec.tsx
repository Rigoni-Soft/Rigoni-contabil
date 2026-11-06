import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

import { AuditoriaFeedFiltro } from "@/presentation/components/organisms/auditoria-feed-filtro.component";

import { useFeed } from "./use-feed.hook";

jest.mock("@/modules/auditoria/presentation/view-models/feed/feed.actions", () => ({
  listarRegistrosAction: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));

function Wrapper() {
  const { register, errors, aoSubmeter, aoLimpar } = useFeed([]);
  return (
    <AuditoriaFeedFiltro
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      onLimpar={aoLimpar}
    />
  );
}

function renderComQueryClient() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Wrapper />
    </QueryClientProvider>,
  );
}

describe("useFeed - Limpar", () => {
  it("limpa de fato os campos de data e texto preenchidos, não só o estado do filtro", () => {
    renderComQueryClient();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-09-22" } });
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "usuario.criar" } });

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Até") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Ação") as HTMLInputElement).value).toBe("");
  });
});
