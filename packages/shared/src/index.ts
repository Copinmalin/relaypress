export const RELAYPRESS_APP_NAME = "relaypress";

export const RelayPressKinds = {
  EditorialScenario: 30420,
  EditorialCampaign: 30421,
  PublicationPolicy: 30422,
  ToneProfile: 30423,
  EditorialProgram: 30424,
  AiGenerationRequest: 50420,
  AiGenerationResult: 60420,
  ExternalPublicationRequest: 50421,
  ExternalPublicationResult: 60421,
} as const;

export type TargetPlatform =
  | "x"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "mastodon"
  | "wordpress";

export type PublicationStatus =
  | "drafted"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "expired"
  | "rejected";

export type SourceItemStatus = "new" | "selected" | "ignored" | "archived" | "failed";

export type SourceProvider = "btcbreakdown" | (string & {});

export interface SourceItem {
  id: string;
  provider: SourceProvider;
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  excerpt?: string;
  language: string;
  status: SourceItemStatus;
  metadata: Record<string, unknown>;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type EditorialSignalStatus =
  | "qualified"
  | "needs_sources"
  | "ready_for_campaign"
  | "ignored"
  | "archived";

export type EditorialSignalRiskLevel = "low" | "medium" | "high";

export type EditorialSignalCategory =
  | "self_custody"
  | "privacy"
  | "opsec"
  | "lightning"
  | "merchant_adoption"
  | "institutional_adoption"
  | "mining_energy"
  | "regulation"
  | "monetary_policy"
  | "open_source"
  | "education"
  | "local_bitcoin"
  | "scam_warning"
  | "sovereign_tools"
  | "nostr"
  | (string & {});

export interface EditorialSignal {
  id: string;
  sourceItemId: string;
  category: EditorialSignalCategory;
  summaryInternal: string;
  editorialAngle: string;
  riskLevel: EditorialSignalRiskLevel;
  status: EditorialSignalStatus;
  primarySources: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalMode = "none" | "required" | "required_for_new_claims";

export interface EditorialScenario {
  id: string;
  name: string;
  objective: string;
  audience: string;
  tone: string;
  platforms: TargetPlatform[];
  approvalMode: ApprovalMode;
  forbidden?: string[];
  preferredAngles?: string[];
}

export interface PublicationJob {
  id: string;
  sourceEventId?: string;
  scenarioId?: string;
  platform: TargetPlatform;
  status: PublicationStatus;
  scheduledAt?: string;
  adaptedContent?: string;
  externalPostId?: string;
  errorMessage?: string;
  generationMode?: "mock" | "openai";
  generationModel?: string;
}
