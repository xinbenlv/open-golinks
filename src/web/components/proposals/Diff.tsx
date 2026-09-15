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
    </dl>
  );
}
