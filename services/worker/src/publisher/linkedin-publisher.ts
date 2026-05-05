import { workerConfig } from "../config.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const LINKEDIN_UGC_POSTS_PATH = "/ugcPosts";

type LinkedInErrorResponse = {
  message?: unknown;
  serviceErrorCode?: unknown;
  status?: unknown;
  code?: unknown;
};

function requireLinkedInPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "linkedin") {
    throw new Error(`LinkedIn publisher cannot publish platform: ${job.platform}`);
  }
}

function requireContent(job: ClaimedPublicationJob): string {
  const content = job.adapted_content?.trim();

  if (!content) {
    throw new Error("LinkedIn publisher cannot publish empty content");
  }

  return content;
}

function buildLinkedInPostPayload(authorUrn: string, content: string): Record<string, unknown> {
  return {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

function sanitizeLinkedInError(payload: LinkedInErrorResponse | string): Record<string, unknown> {
  if (typeof payload === "string") {
    return {
      message: payload.slice(0, 1_000),
    };
  }

  return {
    message: typeof payload.message === "string" ? payload.message.slice(0, 1_000) : undefined,
    serviceErrorCode: payload.serviceErrorCode,
    status: payload.status,
    code: payload.code,
  };
}

function extractExternalPostId(response: Response): string {
  const createdEntity = response.headers.get("x-restli-id");

  if (createdEntity) {
    return `linkedin:${createdEntity}`;
  }

  return `linkedin:ugcPosts:${Date.now()}`;
}

async function readLinkedInError(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();

  if (!body) {
    return {
      message: response.statusText,
      status: response.status,
    };
  }

  try {
    return sanitizeLinkedInError(JSON.parse(body) as LinkedInErrorResponse);
  } catch {
    return sanitizeLinkedInError(body);
  }
}

async function publishLinkedInPost(job: ClaimedPublicationJob): Promise<PublicationPublishResult> {
  requireLinkedInPlatform(job);

  const content = requireContent(job);
  const url = `${workerConfig.linkedinApiBaseUrl}${LINKEDIN_UGC_POSTS_PATH}`;
  const payload = buildLinkedInPostPayload(workerConfig.linkedinAuthorUrn, content);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerConfig.linkedinAccessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await readLinkedInError(response);
    const message = `LinkedIn API error ${response.status}: ${
      typeof errorPayload.message === "string" ? errorPayload.message : response.statusText
    }`;

    throw new PublisherPublishError(message, {
      ok: false,
      provider: "linkedin",
      endpoint: LINKEDIN_UGC_POSTS_PATH,
      status: response.status,
      statusText: response.statusText,
      error: errorPayload,
      contentLength: content.length,
    });
  }

  const externalPostId = extractExternalPostId(response);

  return {
    externalPostId,
    rawResponse: {
      ok: true,
      provider: "linkedin",
      endpoint: LINKEDIN_UGC_POSTS_PATH,
      status: response.status,
      externalPostId,
      contentLength: content.length,
    },
  };
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
    publish: publishLinkedInPost,
  };
}
