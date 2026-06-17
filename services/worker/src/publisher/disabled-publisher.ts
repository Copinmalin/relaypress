import type { PublicationPublisher, PublisherPlatform } from "./types.js";

export function createDisabledPublisher(
  platform: PublisherPlatform,
  reason: string,
): PublicationPublisher {
  return {
    platform,
    mode: "disabled",
    component: `${platform}-disabled-publisher`,
    isReady: async () => ({ ready: false, reason }),
    publish: async () => {
      throw new Error(`Publisher for ${platform} is disabled: ${reason}`);
    },
  };
}
