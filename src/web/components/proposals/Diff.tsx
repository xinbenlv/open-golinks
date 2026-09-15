/** Namefi 极简差异；无变化字段不重复展示。 */
import type { ProposalValues } from "../../../lib/proposals/types";
import { InlineDiff } from "./InlineDiff";
export function Diff({
  before,
  after,
}: {
  before: ProposalValues;
  after: ProposalValues;
}) {
  return (
    <dl className="proposal-diff">
      {(["url", "description"] as const)
        .filter((key) => before[key] !== after[key])
        .map((key) => (
          <div className="diff-row" key={key}>
            <dt>{key === "url" ? "Destination" : "Description"}</dt>
            <dd
              dir="auto"
              aria-label={`Before: ${before[key] || "Empty"}. Proposed: ${after[key] || "Empty"}.`}
            >
              <span aria-hidden="true">
                <InlineDiff before={before[key]} after={after[key]} />
              </span>
            </dd>
          </div>
        ))}
      {after.tags !== undefined && JSON.stringify(before.tags ?? []) !== JSON.stringify(after.tags) ? (
        <div className="diff-row"><dt>Tags</dt><dd aria-label={"Before: " + (before.tags?.join(", ") || "None") + ". Proposed: " + (after.tags.join(", ") || "None") }>
          {(before.tags ?? []).filter((tag) => !after.tags!.includes(tag)).map((tag) => <del key={tag} className="tag-chip">{tag}</del>)}
          {after.tags.filter((tag) => !(before.tags ?? []).includes(tag)).map((tag) => <span key={tag} className="tag-chip">+ {tag}</span>)}
        </dd></div>
      ) : null}
      {after.isPublic !== undefined && before.isPublic !== after.isPublic ? (
        <div className="diff-row"><dt>Publish</dt><dd aria-label={"Before: " + (before.isPublic ? "On" : "Off") + ". Proposed: " + (after.isPublic ? "On" : "Off") }><InlineDiff before={before.isPublic ? "On" : "Off"} after={after.isPublic ? "On" : "Off"} /></dd></div>
      ) : null}
    </dl>
  );
}
