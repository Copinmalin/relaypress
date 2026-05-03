import type { FastifyReply, FastifyRequest } from "fastify";

function getBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim();
}

export async function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const expectedToken = process.env.ADMIN_API_TOKEN;

  if (!expectedToken) {
    reply.code(503).send({
      error: "admin_token_not_configured",
      message: "ADMIN_API_TOKEN is required for write operations",
    });
    return;
  }

  const token = getBearerToken(request);

  if (token !== expectedToken) {
    reply.code(401).send({
      error: "unauthorized",
      message: "Valid Bearer token required",
    });
  }
}
