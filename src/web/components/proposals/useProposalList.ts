/** 分页请求过期后丢弃响应，避免切换历史或身份时混入旧数据。 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProposalList } from "../../../lib/proposals/types";
import { authFetch } from "../../hooks/useAuth";
export function useProposalList(
  endpoint: string,
  history: boolean,
  identity: string | undefined,
  revision: number,
  refresh: number,
) {
  const [data, setData] = useState<ProposalList>();
  const [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      const requestGeneration = generation.current;
      const query = new URLSearchParams({
        status: history ? "history" : "pending",
      });
      if (cursor) query.set("cursor", cursor);
      const res = await authFetch(`${endpoint}?${query}`, { signal });
      if (!res.ok)
        throw new Error(`Could not load proposals (HTTP ${res.status}).`);
      const body = (await res.json()) as ProposalList;
      if (!signal?.aborted && requestGeneration === generation.current)
        setData((previous) =>
          cursor && previous
            ? { ...body, proposals: [...previous.proposals, ...body.proposals] }
            : body,
        );
    },
    [endpoint, history],
  );
  useEffect(() => {
    generation.current++;
    const abort = new AbortController();
    setData(undefined);
    setError("");
    void load(undefined, abort.signal).catch((err) => {
      if (!abort.signal.aborted) setError(err.message);
    });
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [load, identity, revision, refresh]);

  return { data, error, setError, load };
}
