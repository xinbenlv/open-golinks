import { Link } from "react-router-dom";

export type DashboardLink = {
  slug: string;
  url: string;
  visits: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  metadata: {
    description?: string;
    tags?: string[];
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LinkRow({
  link,
  onDelete,
  deleting,
}: {
  link: DashboardLink;
  onDelete: (slug: string) => void;
  deleting?: boolean;
}) {
  const tags = Array.isArray(link.metadata?.tags) ? link.metadata.tags : [];
  const description = link.metadata?.description;

  return (
    <div className="link-row">
      <div className="link-row__slug">
        <a href={`/${link.slug}`} target="_blank" rel="noreferrer">
          /{link.slug}
        </a>
        <span>{link.isPublic ? "Public" : "Private"}</span>
      </div>
      <div className="link-row__url-wrap">
        <a
          className="link-row__url"
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={link.url}
        >
          {link.url}
        </a>
        {description ? (
          <span className="link-row__description">{description}</span>
        ) : null}
        {tags.length ? (
          <div className="link-row__tags">
            {tags.map((tag) => (
              <span className="tag-chip tag-chip--static" key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="link-row__metric">{link.visits.toLocaleString()}</div>
      <div className="link-row__date">{formatDate(link.createdAt)}</div>
      <div className="link-row__actions">
        <Link className="btn btn--ghost btn--sm" to={`/edit/${link.slug}`}>
          Edit
        </Link>
        <Link className="btn btn--ghost btn--sm" to={`/qr/${link.slug}`}>
          QR
        </Link>
        <Link className="btn btn--ghost btn--sm" to={`/stats/${link.slug}`}>
          Stats
        </Link>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => onDelete(link.slug)}
          disabled={deleting}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
