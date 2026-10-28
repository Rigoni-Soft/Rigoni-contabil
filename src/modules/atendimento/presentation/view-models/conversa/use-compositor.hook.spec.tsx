import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { subirAnexoEmPartes } from "./anexo-em-partes.upload";
import {
  enviarAnexoGuardadoAction,
  enviarMensagemAction,
  obterConversaAction,
} from "./conversa.actions";
import { useCompositor } from "./use-compositor.hook";

// conversa.queries invalida as chaves da Fila e dos Meus atendimentos: importa os módulos delas.
jest.mock("../fila/fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));

jest.mock("./anexo-em-partes.upload", () => ({ subirAnexoEmPartes: jest.fn() }));
jest.mock("./conversa.actions", () => ({
  enviarAnexoGuardadoAction: jest.fn(),
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const mensagem = jest.mocked(enviarMensagemAction);
const obter = jest.mocked(obterConversaAction);
const guardado = jest.mocked(enviarAnexoGuardadoAction);
const subir = jest.mocked(subirAnexoEmPartes);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  podeAtender: true,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [],
  ultimaTransferencia: null,
  ura: null,
  temMaisAnteriores: false,
  avisoInatividade: false,
  setoresDestino: [],
  documentos: [],
};

function renderizar(conversa: ConversaVista = CONVERSA) {
  const cliente = new QueryClient();
  return renderHook(() => useCompositor("at-1", conversa), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useCompositor", () => {
  beforeEach(() => {
    mensagem.mockReset();
    guardado.mockReset();
    subir.mockReset();
    obter.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("está visível num Atendimento em andamento e escondido num encerrado", () => {
    expect(renderizar().result.current.visivel).toBe(true);
    expect(renderizar({ ...CONVERSA, encerrado: true }).result.current.visivel).toBe(false);
  });

  it("leitura de supervisão (Líder/Admin em conversa de outro) não mostra o campo de resposta", () => {
    expect(renderizar({ ...CONVERSA, podeAtender: false }).result.current.visivel).toBe(false);
  });

  it("envia a mensagem e conta o envio para esvaziar o campo", async () => {
    mensagem.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();

    act(() => result.current.aoEnviar("Bom dia"));

    await waitFor(() => expect(result.current.enviadas).toBe(1));
    expect(mensagem).toHaveBeenCalledWith({ atendimentoId: "at-1", texto: "Bom dia" });
  });

  it("falha ao enviar mostra o erro e não conta o envio", async () => {
    mensagem.mockResolvedValue({
      ok: false,
      error: { code: "SERVICO_EXTERNO", message: "Falha ao enviar a mensagem." },
    });
    const { result } = renderizar();

    act(() => result.current.aoEnviar("Bom dia"));

    await waitFor(() => expect(result.current.erro).toBe("Falha ao enviar a mensagem."));
    expect(result.current.enviadas).toBe(0);
  });

  describe("anexo", () => {
    const PDF = new File(["%PDF"], "balanco.pdf", { type: "application/pdf" });

    beforeAll(() => {
      URL.createObjectURL = jest.fn(() => "blob:previa");
      URL.revokeObjectURL = jest.fn();
    });

    beforeEach(() => subir.mockResolvedValue("at-1/u-1/balanco.pdf"));

    it("escolher um arquivo mostra a prévia e o envio vai como anexo, com o texto de legenda", async () => {
      guardado.mockResolvedValue({ ok: true, data: undefined });
      const { result } = renderizar();

      act(() => result.current.aoAnexar(PDF));
      await waitFor(() =>
        expect(result.current.anexo).toEqual({
          nome: "balanco.pdf",
          tamanho: "4 B",
          miniaturaUrl: null,
        }),
      );

      act(() => result.current.aoEnviar("Segue"));

      await waitFor(() => expect(result.current.enviadas).toBe(1));
      expect(subir).toHaveBeenCalledWith("at-1", PDF);
      const dados = guardado.mock.calls[0][0];
      expect(dados.get("atendimentoId")).toBe("at-1");
      expect(dados.get("caminho")).toBe("at-1/u-1/balanco.pdf");
      expect(dados.get("nome")).toBe("balanco.pdf");
      expect(dados.get("legenda")).toBe("Segue");
      expect(mensagem).not.toHaveBeenCalled();
      // Enviado: a prévia some.
      await waitFor(() => expect(result.current.anexo).toBeUndefined());
    });

    it("imagem ganha miniatura local, que é liberada ao remover", async () => {
      const { result } = renderizar();
      const foto = new File(["x"], "foto.png", { type: "image/png" });

      act(() => result.current.aoAnexar(foto));
      await waitFor(() => expect(result.current.anexo?.miniaturaUrl).toBe("blob:previa"));

      act(() => result.current.aoRemoverAnexo());
      await waitFor(() => expect(result.current.anexo).toBeUndefined());
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa");
    });

    it("recusa tipo não aceito e arquivo acima de 10 MB com mensagem clara, sem anexar", async () => {
      const { result } = renderizar();

      act(() => result.current.aoAnexar(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })));
      await waitFor(() => expect(result.current.erro).toMatch(/Tipo de arquivo não aceito/));
      expect(result.current.anexo).toBeUndefined();

      const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
      Object.defineProperty(grande, "size", { value: 10 * 1024 * 1024 + 1 });
      act(() => result.current.aoAnexar(grande));
      await waitFor(() => expect(result.current.erro).toBe("O arquivo aceita até 10 MB."));
      expect(result.current.anexo).toBeUndefined();
    });

    it("segundo envio e troca de arquivo durante o envio são ignorados", async () => {
      let concluir: (r: { ok: true; data: undefined }) => void = () => {};
      guardado.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
      const { result } = renderizar();
      act(() => result.current.aoAnexar(PDF));
      await waitFor(() => expect(result.current.anexo).toBeDefined());

      act(() => result.current.aoEnviar("1"));
      await waitFor(() => expect(result.current.enviando).toBe(true));
      act(() => result.current.aoEnviar("2"));
      act(() => result.current.aoAnexar(new File(["y"], "outro.pdf", { type: "application/pdf" })));

      expect(guardado).toHaveBeenCalledTimes(1);
      expect(result.current.anexo?.nome).toBe("balanco.pdf");
      await act(async () => concluir({ ok: true, data: undefined }));
      await waitFor(() => expect(result.current.enviadas).toBe(1));
    });

    it("erro de rede (a action lança) vira mensagem legível e mantém o arquivo", async () => {
      guardado.mockRejectedValue(new Error("fetch failed"));
      const { result } = renderizar();
      act(() => result.current.aoAnexar(PDF));
      await waitFor(() => expect(result.current.anexo).toBeDefined());

      act(() => result.current.aoEnviar(""));

      await waitFor(() => expect(result.current.erro).toMatch(/Confira a conexão/));
      expect(result.current.anexo?.nome).toBe("balanco.pdf");
    });

    it("falha no envio do anexo mantém o arquivo e mostra o erro do servidor", async () => {
      guardado.mockResolvedValue({
        ok: false,
        error: { code: "SERVICO_EXTERNO", message: "Falha ao enviar o arquivo." },
      });
      const { result } = renderizar();
      act(() => result.current.aoAnexar(PDF));
      await waitFor(() => expect(result.current.anexo).toBeDefined());

      act(() => result.current.aoEnviar(""));

      await waitFor(() => expect(result.current.erro).toBe("Falha ao enviar o arquivo."));
      expect(result.current.anexo?.nome).toBe("balanco.pdf");
      expect(result.current.enviadas).toBe(0);
    });
  });

  it("sobe o áudio em partes, pede ao servidor que o entregue e só chama aoConcluir se deu certo", async () => {
    subir.mockResolvedValue("at-1/u-1/gravacao.webm");
    guardado.mockResolvedValueOnce({
      ok: false,
      error: { code: "EXTERNAL_SERVICE_ERROR", message: "Sem conversão." },
    });
    const { result } = renderizar();
    const audio = new File(["x"], "gravacao.webm", { type: "audio/webm" });
    const aoConcluir = jest.fn();

    act(() => result.current.aoEnviarAudio(audio, aoConcluir));
    await waitFor(() => expect(result.current.erro).toBe("Sem conversão."));
    expect(aoConcluir).not.toHaveBeenCalled();
    expect(subir).toHaveBeenCalledWith("at-1", audio);
    const dados = guardado.mock.calls[0][0];
    expect(dados.get("atendimentoId")).toBe("at-1");
    expect(dados.get("caminho")).toBe("at-1/u-1/gravacao.webm");
    expect(dados.get("nome")).toBe("gravacao.webm");
    expect(dados.get("legenda")).toBeNull();

    // Descartar a gravação apaga o erro dela.
    act(() => result.current.aoCancelarAudio());
    await waitFor(() => expect(result.current.erro).toBeUndefined());

    guardado.mockResolvedValueOnce({ ok: true, data: undefined });
    act(() => result.current.aoEnviarAudio(audio, aoConcluir));
    await waitFor(() => expect(aoConcluir).toHaveBeenCalledTimes(1));
  });

  it("falha ao subir as partes mostra o erro do envio e não chama o servidor", async () => {
    subir.mockRejectedValue(new Error("Não foi possível enviar o arquivo."));
    const { result } = renderizar();

    act(() =>
      result.current.aoEnviarAudio(new File(["x"], "g.webm", { type: "audio/webm" }), jest.fn()),
    );

    await waitFor(() => expect(result.current.erro).toBe("Não foi possível enviar o arquivo."));
    expect(guardado).not.toHaveBeenCalled();
  });
});
