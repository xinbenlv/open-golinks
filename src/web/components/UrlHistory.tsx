type UrlHistoryEntry = {
  url: string;
  changedAt: string | null;
  changedBy: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function normalizeUrlHistoryEntries(value: unknown): UrlHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const url = asString(record.url);
    if (!url) return [];
    return [
      {
        url,
        changedAt: asString(record.changedAt) ?? asString(record.changed_at),
        changedBy: asString(record.changedBy) ?? asString(record.changed_by),
      },
    ];
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function UrlHistory({
  currentUrl,
  updatedAt,
  history,
}: {
  currentUrl: string;
  updatedAt: string | null;
  history: unknown;
}) {
  const entries = normalizeUrlHistoryEntries(history);
  const timeline = [...entries].reverse();

  return (
    <section className="url-history">
      <div className="url-history__header">
        <div>
          <p className="dashboard-kicker">URL History</p>
          <h2>Destinations</h2>
        </div>
      </div>
      <div className="url-history__current">
        <span>Current</span>
        <a href={currentUrl} target="_blank" rel="noreferrer">
          {currentUrl}
        </a>
        <small>since {formatDate(updatedAt)}</small>
      </div>
      {timeline.length ? (
        <div className="url-history__list">
          {timeline.map((entry, index) => (
            <article className="url-history__item" key={`${entry.url}-${entry.changedAt ?? index}`}>
              <time dateTime={entry.changedAt ?? undefined}>
                {formatDate(entry.changedAt)}
              </time>
              <a href={entry.url} target="_blank" rel="noreferrer">
                {entry.url}
              </a>
              {index === timeline.length - 1 ? <span>original</span> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty">No previous URLs</div>
      )}
    </section>
  );
}
