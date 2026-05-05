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

export type PublicationPublisher = {
  mode: string;
  component: string;
  supportedPlatforms: string[];
  isReady: () => PublisherReadiness;
  publish: (job: ClaimedPublicationJob) => Promise<PublicationPublishResult>;
};
