import { localRoutes } from "./routes/local.route.js";
import fs from "node:fs";
import path from "node:path";
import { config } from "../services/config.service.js";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { aiRoutes } from "./routes/ai.route.js";
import { accountRoutes } from "./routes/accounts.route.js";
import { oauthRoutes } from "./routes/oauth.route.js";
import { systemRoutes } from "./routes/system.route.js";
import { logger } from "../utils/logger.util.js";

export function createServer(): FastifyInstance {
  const app = Fastify({
    logger: false, // We use custom structured logger
    bodyLimit: 50 * 1024 * 1024, // 50MB
  });

  // Enable CORS
  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["*"],
  });

  // Enable Multipart
  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Register routes
  app.register(localRoutes);
  app.register(aiRoutes);
  app.register(accountRoutes);
  app.register(oauthRoutes);
  app.register(systemRoutes);

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(fs.readFileSync(path.resolve("web/index.html"), "utf8"));
  });
  app.post("/local-chat", async (request, reply) => {
    if (request.headers.origin !== `http://${request.headers.host}`) {
      return reply.code(403).send({ error: { message: "Only local browser requests are allowed." } });
    }
    const body = request.body as { model?: string; messages?: unknown[] };
    const response = await app.inject({
      method: "POST", url: "/v1/chat/completions",
      headers: { authorization: `Bearer ${config.authKey}` },
      payload: { model: body.model || "gpt-4o-mini", messages: body.messages, stream: false },
    });
    return reply.code(response.statusCode).type("application/json").send(response.body);
  });

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    logger.error("Unhandled error:", error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: {
        message: error.message || "Internal server error",
        type: "api_error",
        code: error.code || "internal_error",
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        message: `Endpoint ${request.method} ${request.url} not found.`,
        type: "invalid_request_error",
        code: "not_found",
      },
    });
  });

  return app;
}
