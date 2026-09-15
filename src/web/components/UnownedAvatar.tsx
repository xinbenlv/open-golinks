/** 无主链接以空缺头像展示；点击后复用 ZGID 登录/认领操作。 */
import { useEffect, useRef, type ComponentProps } from "react";
import { ClaimOwnership } from "./ClaimOwnership";

export function UnownedAvatar(props: ComponentProps<typeof ClaimOwnership>) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const element = panel.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return <details ref={panel} className="owner-avatar unowned-avatar" data-testid="unowned-avatar"
    onKeyDown={event => {
      if (event.key !== "Escape" || !panel.current?.open) return;
      event.preventDefault();
      panel.current.open = false;
      panel.current.querySelector("summary")?.focus();
    }}>
    <summary className="owner-avatar__trigger" aria-label="Unclaimed link — claim ownership" title="Unclaimed link">
      <svg className="unowned-avatar__image" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="16" cy="16" r="14.5" strokeDasharray="3 3" />
        <circle cx="16" cy="12" r="3.5" />
        <path d="M9 24a7 7 0 0 1 14 0" />
      </svg>
    </summary>
    <div className="unowned-avatar__panel"><ClaimOwnership {...props} /></div>
  </details>;
}
