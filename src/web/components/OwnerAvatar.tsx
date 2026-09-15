/** 根据服务端邮箱 seed 绘制 Jazzicon 头像；无需个人资料或第三方图片请求。 */
import { useEffect, useId, useRef, useState } from "react";

export type LinkOwner = { avatarSeed: string };

export function OwnerAvatar({ owner }: { owner?: LinkOwner | null }) {
  const [dismissed, setDismissed] = useState(false);
  const tooltipId = useId();
  const seed = owner?.avatarSeed;
  const valid = typeof seed === "string" && /^[a-f0-9]{16}$/.test(seed);
  const image = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const container = image.current;
    if (!container || !valid) return;
    let active = true;
    // 页面先显示主内容，头像库按需加载；加载失败时保留渐变占位。
    void import("@metamask/jazzicon").then(({ default: jazzicon }) => {
      if (active) container.replaceChildren(jazzicon(32, Number.parseInt(seed.slice(0, 8), 16)));
    }).catch(() => {});
    return () => { active = false; container.replaceChildren(); };
  }, [seed, valid]);
  return <span className="owner-avatar" data-testid="owner-avatar" data-dismissed={dismissed}>
    <button type="button" className="owner-avatar__trigger" aria-label="Link owner" aria-describedby={tooltipId}
      onFocus={() => setDismissed(false)} onMouseEnter={() => setDismissed(false)} onClick={() => setDismissed(false)}
      onKeyDown={event => { if (event.key === "Escape") setDismissed(true); }}>
      <span ref={image} className="owner-avatar__image" aria-hidden="true" />
    </button>
    <span id={tooltipId} role="tooltip" className="owner-avatar__tooltip">Link owner</span>
  </span>;
}
