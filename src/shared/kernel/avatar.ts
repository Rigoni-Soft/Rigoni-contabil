// A foto do usuário sai da rota autenticada `/api/avatar`, que só serve a do próprio usuário (ADR 0012).
// O `?v=` é o instante da gravação: trocar ou remover a foto muda a URL e o navegador não reaproveita a antiga.
const ROTA_DO_AVATAR = "/api/avatar";

// A imagem do avatar na cadeia foto → logo do Setor → logo do escritório (esta já vem em `logo`).
export function srcDoAvatar({
  avatarAtualizadoEm,
  logo,
}: {
  avatarAtualizadoEm?: string | null;
  logo: string;
}): string {
  if (!avatarAtualizadoEm) return logo;
  return `${ROTA_DO_AVATAR}?v=${encodeURIComponent(avatarAtualizadoEm)}`;
}
