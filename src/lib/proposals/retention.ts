/** 删除超过 30 天的私有请求详情；保留提议、审核和不可逆 IP 哈希用于审计。 */
import { and, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "../../db/db";
export async function purgeProposalMetadata() {
  await db
    .update(schema.linkProposalsTable)
    .set({ requestMetadata: null })
    .where(
      and(
        isNotNull(schema.linkProposalsTable.requestMetadata),
        sql`${schema.linkProposalsTable.submittedAt} < now() - interval '30 days'`,
      ),
    );
}
export function startProposalRetention() {
  const run = () => {
    void purgeProposalMetadata().catch(() =>
      console.warn("[proposals] metadata retention failed"),
    );
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
}
