export type PublisherPlatform = "linkedin" | "x" | "facebook" | "instagram" | "nostr_longform";

export type PlatformPublisherMode = "disabled" | "mock" | "real";

export type ClaimedPublicationJob = {
  id: string;
  platform: PublisherPlatform;
  adapted_content: string | null;
};

export type PublisherReadiness = {
  ready: boolean;
  reason?: string;
};

export type PublicationPublishResult = {
  externalPostId: string;
  rawResponse: Record<string, unknown>;
};

export class PublisherPublishError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PublisherPublishError";
  }
}

export function getPublisherErrorRawResponse(error: unknown): Record<string, unknown> | null {
  if (error instanceof PublisherPublishError) {
    return error.rawResponse;
  }

  return null;
}

export type PublicationPublisher = {
  mode: string;
  component: string;
  supportedPlatforms: PublisherPlatform[];
  isReady: () => Promise<PublisherReadiness>;
  publish: (job: ClaimedPublicationJob) => Promise<PublicationPublishResult>;
};

export type PublisherRoute = {
  platform: PublisherPlatform;
  configuredMode: PlatformPublisherMode;
  safetyAckConfigured: boolean;
  publisher: PublicationPublisher | null;
};
