import { srcDoAvatar } from "./avatar";

describe("srcDoAvatar", () => {
  const logo = "/logos/logo-rigoni.jpeg";

  it("sem foto, é a logo", () => {
    expect(srcDoAvatar({ avatarAtualizadoEm: null, logo })).toBe(logo);
    expect(srcDoAvatar({ logo })).toBe(logo);
  });

  it("com foto, é a rota do avatar versionada pela data da gravação", () => {
    expect(srcDoAvatar({ avatarAtualizadoEm: "2026-11-18T10:00:00.000Z", logo })).toBe(
      "/api/avatar?v=2026-11-18T10%3A00%3A00.000Z",
    );
  });
});
