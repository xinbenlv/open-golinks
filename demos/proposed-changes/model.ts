export type Role = "anonymous" | "member" | "owner" | "admin";
export type Values = {
  url: string;
  description: string;
  tags: string;
  public: boolean;
  warning: boolean;
  caption: string;
  logo: boolean;
};
export type Metadata = {
  location: string | null;
  ip: string;
  device: string;
  os: string;
  browser: string;
  locale: string;
  ua: string;
};
export type Proposal = {
  id: number;
  proposer: string;
  role: Role;
  submitted: string;
  before: Values;
  after: Values;
  note: string;
  metadata: Metadata;
  status: "pending" | "approved" | "rejected";
  actor?: string;
  decided?: string;
  reason?: string;
};
export type State = {
  active: Values;
  proposals: Proposal[];
  edits: { before: Values; after: Values; actor: string; time: string }[];
};
export const labels: Record<keyof Values, string> = {
  url: "Destination",
  description: "Description",
  tags: "Tags",
  public: "Public listing",
  warning: "Warn before opening",
  caption: "QR caption",
  logo: "Include logo",
};
export const actors: Record<Role, string> = {
  anonymous: "Anonymous visitor",
  member: "Maya Chen",
  owner: "Alex Rivera · owner",
  admin: "Jordan Lee · admin",
};
export const fixtureMetadata: Metadata = {
  location: "San Francisco Bay Area, US",
  ip: "192.0.2.42",
  device: "Laptop / desktop",
  os: "macOS 14.5",
  browser: "Safari 17.5",
  locale: "en-US",
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};
export const initialValues: Values = {
  url: "https://example.com/team/handbook",
  description: "Everything you need to get started with the team.",
  tags: "team, onboarding",
  public: true,
  warning: false,
  caption: "Team handbook",
  logo: true,
};
export function changed(before: Values, after: Values) {
  return (Object.keys(labels) as (keyof Values)[]).filter(
    (key) => before[key] !== after[key],
  );
}
export function isStale(proposal: Proposal, active: Values) {
  return changed(proposal.before, proposal.after).some(
    (key) => proposal.before[key] !== active[key],
  );
}
export function seed(): State {
  const older = { ...initialValues, url: "https://example.com/handbook-2025" };
  return {
    active: { ...initialValues },
    edits: [],
    proposals: [
      {
        id: 1,
        proposer: actors.anonymous,
        role: "anonymous",
        submitted: "2026-09-09T15:42:00Z",
        before: { ...initialValues },
        after: {
          ...initialValues,
          url: "https://example.com/team/handbook-2026",
          description:
            "The current team handbook, including our updated onboarding guide.",
        },
        note: "The handbook moved for the new onboarding cycle.",
        metadata: fixtureMetadata,
        status: "pending",
      },
      {
        id: 2,
        proposer: "Sam Patel",
        role: "member",
        submitted: "2026-09-08T18:10:00Z",
        before: older,
        after: { ...older, url: "https://example.com/team/archive" },
        note: "Found this copy in the old team wiki.",
        metadata: {
          location: null,
          ip: "198.51.100.18",
          device: "Phone",
          os: "Android 14",
          browser: "Chrome 128",
          locale: "en-GB",
          ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
        },
        status: "pending",
      },
      {
        id: 3,
        proposer: "Maya Chen",
        role: "member",
        submitted: "2026-09-07T13:15:00Z",
        before: older,
        after: { ...initialValues },
        note: "Use the team’s canonical handbook.",
        metadata: fixtureMetadata,
        status: "approved",
        actor: actors.owner,
        decided: "2026-09-07T14:20:00Z",
      },
    ],
  };
}
export function decide(
  state: State,
  id: number,
  role: Role,
  decision: "approved" | "rejected",
  time: string,
  reason: string,
): State {
  if (role !== "owner" && role !== "admin") return state;
  const proposal = state.proposals.find((item) => item.id === id);
  if (
    !proposal ||
    proposal.status !== "pending" ||
    (decision === "approved" && isStale(proposal, state.active))
  )
    return state;
  const active = { ...state.active };
  if (decision === "approved")
    for (const key of changed(proposal.before, proposal.after))
      Object.assign(active, { [key]: proposal.after[key] });
  return {
    ...state,
    active,
    proposals: state.proposals.map((item) =>
      item.id === id
        ? {
            ...item,
            status: decision,
            actor: actors[role],
            decided: time,
            reason,
          }
        : item,
    ),
  };
}
export function formatTime(value: string) {
  return (
    new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    }) + " PT"
  );
}
