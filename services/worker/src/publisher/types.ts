export type ClaimedPublicationJob = {
  id: string;
  platform: string;
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
  supportedPlatforms: string[];
  isReady: () => Promise<PublisherReadiness>;
  publish: (job: ClaimedPublicationJob) => Promise<PublicationPublishResult>;
};
