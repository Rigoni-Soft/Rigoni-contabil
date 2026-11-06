import { EnvioEmailSmtpGateway } from "./envio-email-smtp.gateway";

const CONFIG = {
  usuario: "setor@gmail.com",
  senha: "senha-app",
  remetente: "Rigoni <setor@gmail.com>",
};
const EMAIL = {
  para: "cliente@empresa.com.br",
  assunto: "Guia do DAS",
  texto: "Segue a guia.",
  anexo: { url: "https://storage.test/das.pdf", nomeArquivo: "das.pdf" },
};

describe("EnvioEmailSmtpGateway", () => {
  it("envia assunto, texto com o aviso de não responder e o anexo pela URL", async () => {
    const sendMail = jest.fn().mockResolvedValue({});

    const r = await new EnvioEmailSmtpGateway(CONFIG, { sendMail }).enviar(EMAIL);

    expect(r.ok).toBe(true);
    const msg = sendMail.mock.calls[0][0];
    expect(msg).toMatchObject({
      from: CONFIG.remetente,
      to: EMAIL.para,
      subject: "Guia do DAS",
      attachments: [{ filename: "das.pdf", path: "https://storage.test/das.pdf" }],
    });
    expect(msg.text).toMatch(/^Segue a guia\./);
    expect(msg.text).toMatch(/não responda este e-mail/);
  });

  it("sem anexo não manda attachments", async () => {
    const sendMail = jest.fn().mockResolvedValue({});

    await new EnvioEmailSmtpGateway(CONFIG, { sendMail }).enviar({
      para: EMAIL.para,
      assunto: "Lembrete",
      texto: "Oi",
    });

    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("attachments");
  });

  it("endereço recusado é ValidationError; auth, limite e rede são ServicoExternoError", async () => {
    const codigo = async (erro: object) => {
      const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error("x"), erro));
      const r = await new EnvioEmailSmtpGateway(CONFIG, { sendMail }).enviar(EMAIL);
      return !r.ok && r.error.code;
    };

    expect(await codigo({ code: "EENVELOPE" })).toBe("VALIDATION_ERROR");
    expect(await codigo({ responseCode: 550 })).toBe("VALIDATION_ERROR");
    expect(await codigo({ code: "EAUTH", responseCode: 535 })).toBe("EXTERNAL_SERVICE_ERROR");
    expect(await codigo({ responseCode: 421 })).toBe("EXTERNAL_SERVICE_ERROR");
    expect(await codigo({ code: "ETIMEDOUT" })).toBe("EXTERNAL_SERVICE_ERROR");
  });
});
