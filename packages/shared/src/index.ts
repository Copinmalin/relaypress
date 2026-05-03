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
}
