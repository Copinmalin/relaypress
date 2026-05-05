import type { PublicationPublisher } from "./types.js";

export function createMockPublisher(): PublicationPublisher {
  return {
    mode: "mock",
    component: "mock-publisher",
    supportedPlatforms: ["x", "linkedin", "facebook", "instagram"],
    isReady: () => ({ ready: true }),
    publish: async (job) => {
      const externalPostId = `mock:${job.platform}:${job.id}`;

      return {
        externalPostId,
        rawResponse: {
          ok: true,
          mode: "mock",
          platform: job.platform,
          externalPostId,
          contentLength: job.adapted_content?.length ?? 0,
        },
      };
    },
  };
}
