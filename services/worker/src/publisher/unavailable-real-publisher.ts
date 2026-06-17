import type { PublicationPublisher, PublisherPlatform } from "./types.js";

export function createUnavailableRealPublisher(
  platform: PublisherPlatform,
  reason: string,
): PublicationPublisher {
  return {
    mode: `${platform}_real_blocked`,
    component: `${platform}-real-publisher-blocked`,
    supportedPlatforms: [platform],
    isReady: async () => ({ ready: false, reason }),
    publish: async () => {
      throw new Error(reason);
    },
  };
}
