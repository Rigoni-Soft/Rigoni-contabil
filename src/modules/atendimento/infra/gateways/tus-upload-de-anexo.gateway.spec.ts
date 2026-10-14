import * as tus from "tus-js-client";

import { TusUploadDeAnexoGateway } from "./tus-upload-de-anexo.gateway";

jest.mock("tus-js-client", () => ({ Upload: jest.fn() }));

const UploadFalso = jest.mocked(tus.Upload);
const ARQUIVO = {
  atendimentoId: "11111111-1111-4111-8111-111111111111",
  nome: "grava ção.webm",
  tipoMime: "audio/webm;codecs=opus",
  conteudo: new Blob(["x"]),
};

function simular(resultado: "sucesso" | "erro") {
  UploadFalso.mockImplementation(function (_conteudo, opcoes) {
    return {
      start: () =>
        resultado === "sucesso"
          ? opcoes.onSuccess?.({} as never)
          : opcoes.onError?.(new Error("x")),
    } as never;
  });
}

describe("TusUploadDeAnexoGateway", () => {
  beforeEach(() => UploadFalso.mockReset());

  it("sobe em partes de 6 MB com o token do usuário, na pasta do Atendimento, e devolve o caminho", async () => {
    simular("sucesso");
    const gateway = new TusUploadDeAnexoGateway("http://sb", async () => "jwt");

    const r = await gateway.enviar(ARQUIVO);

    expect(r.ok).toBe(true);
    const opcoes = UploadFalso.mock.calls[0][1];
    expect(opcoes.endpoint).toBe("http://sb/storage/v1/upload/resumable");
    expect(opcoes.chunkSize).toBe(6 * 1024 * 1024);
    expect(opcoes.headers).toMatchObject({ authorization: "Bearer jwt" });
    expect(opcoes.metadata).toMatchObject({
      bucketName: "anexos-atendimento",
      contentType: "audio/webm",
    });
    expect(opcoes.metadata?.objectName).toMatch(
      /^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\/grava_.*\.webm$/,
    );
    if (r.ok) expect(r.value).toBe(opcoes.metadata?.objectName);
  });

  it("falha do upload vira erro com mensagem clara", async () => {
    simular("erro");
    const gateway = new TusUploadDeAnexoGateway("http://sb", async () => "jwt");

    const r = await gateway.enviar(ARQUIVO);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/Confira a conexão/);
  });

  it("sem sessão, nem tenta subir", async () => {
    const gateway = new TusUploadDeAnexoGateway("http://sb", async () => null);

    const r = await gateway.enviar(ARQUIVO);

    expect(r.ok).toBe(false);
    expect(UploadFalso).not.toHaveBeenCalled();
  });
});
