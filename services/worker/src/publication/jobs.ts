import type { Event } from "nostr-tools";
import { publicationJobs } from "@relaypress/db";
import { db } from "../db.js";
import { adaptPublicationContent, type PublicationTarget } from "./content-adapter.js";
import { parsePublicationIntent, type SupportedPlatform } from "./intents.js";

function jobIdFor(eventId: string, platform: string): string {
  return `${eventId}:${platform}`;
}

function platformsOrReview(platforms: SupportedPlatform[]): PublicationTarget[] {
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
    const adapted = adaptPublicationContent(intent.content, platform);
    const result = await db
      .insert(publicationJobs)
      .values({
        id: jobIdFor(event.id, platform),
        sourceEventId: event.id,
        platform,
        status: platform === "review" ? "pending_review" : "pending",
        adaptedContent: adapted.content,
        errorMessage: adapted.warnings.length > 0 ? adapted.warnings.join(",") : null,
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
        warnings: adapted.warnings,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return created;
}
