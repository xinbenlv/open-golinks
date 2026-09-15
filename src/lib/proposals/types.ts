/** 提议 API 的共享数据契约；私有提交详情不混入列表。 */
export type ProposalValues = { url: string; description: string; tags?: string[]; isPublic?: boolean };
export type ProposalStatus = "pending" | "approved" | "rejected";
export type AccountSubmissionMetadata = { accountId: string; email: string | null };
export type SubmissionMetadata = AccountSubmissionMetadata | BrowserSubmissionMetadata;
export type BrowserSubmissionMetadata = {
  ip: string;
  ua: string;
  locale: string;
  device: string;
  os: string;
  browser: string;
  location: {
    label: string;
    latitude: number;
    longitude: number;
    radiusKm: number | null;
  } | null;
};
export type ProposalDTO = {
  id: string;
  before: ProposalValues;
  after: ProposalValues;
  note: string;
  proposer: string;
  anonymousDetails?: BrowserSubmissionMetadata;
  status: ProposalStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reason: string | null;
  stale: boolean;
};
export type ProposalList = {
  canReview: boolean;
  proposals: ProposalDTO[];
  nextCursor: string | null;
};
