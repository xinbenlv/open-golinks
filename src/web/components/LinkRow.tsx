import { Link } from "react-router-dom";

export type DashboardLink = {
  slug: string;
  url: string;
  visits: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
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
  return (
    <div className="link-row">
      <div className="link-row__slug">
        <a href={`/${link.slug}`} target="_blank" rel="noreferrer">
          /{link.slug}
        </a>
        <span>{link.isPublic ? "Public" : "Private"}</span>
      </div>
      <a
        className="link-row__url"
        href={link.url}
        target="_blank"
        rel="noreferrer"
        title={link.url}
      >
        {link.url}
      </a>
      <div className="link-row__metric">{link.visits.toLocaleString()}</div>
      <div className="link-row__date">{formatDate(link.createdAt)}</div>
      <div className="link-row__actions">
        <Link className="btn btn--ghost btn--sm" to={`/edit/${link.slug}`}>
          Edit
        </Link>
        <Link className="btn btn--ghost btn--sm" to={`/qr/${link.slug}`}>
          QR
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
