/** 登录回跳只接受本站的编辑、认领或 Dashboard 路径；兼容旧邮件模板在新 tab 打开。 */
const RETURN_KEY = "ogl.auth.return";

export function safeAuthReturn(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  return /^\/(?:edit|claim)\/[a-zA-Z0-9_-]+$/.test(value) || value === "/dashboard"
    ? value : "/dashboard";
}

export function rememberAuthReturn(path: string) {
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ path: safeAuthReturn(path), expiresAt: Date.now() + 30 * 60 * 1000 }));
  } catch { /* 禁用存储时仍可使用 callback 的 next 参数。 */ }
}

export function consumeAuthReturn(next: string | null): string {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(RETURN_KEY) ?? "null");
    localStorage.removeItem(RETURN_KEY);
  } catch { /* 存储不可用时回到安全默认路径。 */ }
  return safeAuthReturn(next ?? (saved?.expiresAt > Date.now() ? saved.path : null));
}
