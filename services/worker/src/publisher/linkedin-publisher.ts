import { workerConfig } from "../config.js";
import type { ClaimedPublicationJob, PublicationPublisher } from "./types.js";

function requireLinkedInPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "linkedin") {
    throw new Error(`LinkedIn publisher cannot publish platform: ${job.platform}`);
  }
}

export function createLinkedInPublisher(): PublicationPublisher {
  return {
    mode: "linkedin_real",
    component: "linkedin-publisher",
    supportedPlatforms: ["linkedin"],
    isReady: () => {
      if (!workerConfig.linkedinAccessToken) {
        return { ready: false, reason: "LINKEDIN_ACCESS_TOKEN is missing" };
      }

      if (!workerConfig.linkedinAuthorUrn) {
        return { ready: false, reason: "LINKEDIN_AUTHOR_URN is missing" };
      }

      return { ready: true };
    },
    publish: async (job) => {
      requireLinkedInPlatform(job);

      throw new Error(
        "LinkedIn real publishing is prepared but not implemented yet. Keep PUBLISHER_MODE=mock until the LinkedIn API connector is added.",
      );
    },
  };
}
