/** 复用 Namefi 的极简差异语法：公共前后缀只出现一次，旧片段用删除线。 */
export function InlineDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  if (!before) return <>{after}</>;
  if (!after) return <del>{before}</del>;
  const oldChars = Array.from(before);
  const newChars = Array.from(after);
  let prefix = 0;
  while (
    prefix < oldChars.length &&
    prefix < newChars.length &&
    oldChars[prefix] === newChars[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < oldChars.length - prefix &&
    suffix < newChars.length - prefix &&
    oldChars[oldChars.length - 1 - suffix] ===
      newChars[newChars.length - 1 - suffix]
  )
    suffix++;
  if (prefix + suffix < 3)
    return (
      <>
        <del>{before}</del>
        <span className="diff-arrow"> → </span>
        {after}
      </>
    );
  const removed = oldChars.slice(prefix, oldChars.length - suffix).join("");
  const added = newChars.slice(prefix, newChars.length - suffix).join("");
  return (
    <>
      {oldChars.slice(0, prefix).join("")}
      {removed ? <del>{removed}</del> : null}
      {added ? <span className="diff-added">{added}</span> : null}
      {suffix ? oldChars.slice(-suffix).join("") : ""}
    </>
  );
}
