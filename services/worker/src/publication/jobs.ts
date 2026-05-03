import type { Event } from "nostr-tools";
import { publicationJobs } from "@relaypress/db";
import { db } from "../db.js";
import { parsePublicationIntent, type SupportedPlatform } from "./intents.js";

function jobIdFor(eventId: string, platform: string): string {
  return `${eventId}:${platform}`;
}

function platformsOrReview(platforms: SupportedPlatform[]): string[] {
  return platforms.length > 0 ? platforms : ["review"];
}

export async function createPublicationJobsFromEvent(event: Event): Promise<number> {
  const intent = parsePublicationIntent(event);

  if (!intent.shouldCreateJob) {
    return 0;
  }

  const platforms = platformsOrReview(intent.platforms);

  let created = 0;

  for (const platform of platforms) {
    const result = await db
      .insert(publicationJobs)
      .values({
        id: jobIdFor(event.id, platform),
        sourceEventId: event.id,
        platform,
        status: platform === "review" ? "pending_review" : "pending",
        adaptedContent: intent.content,
      })
      .onConflictDoNothing()
      .returning({ id: publicationJobs.id });

    if (result.length > 0) {
      created += 1;

      console.log(JSON.stringify({
        service: "relaypress-worker",
        component: "publication-jobs",
        status: "job_created",
        eventId: event.id,
        jobId: result[0].id,
        platform,
        reason: intent.reason,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return created;
}
