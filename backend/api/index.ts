// Vercel serverless entry point.
//
// main.ts (`npm run start`) is for Render/Docker/any host that runs a
// persistent Node process — it calls app.listen() and stays up. Vercel
// doesn't run persistent processes at all; every request either hits a
// warm serverless function container or spins up a fresh one, and the
// function must export a (req, res) handler instead of binding a port.
//
// This file duplicates main.ts's app-configuration steps (helmet, CORS,
// the service-scope gate, validation pipe, exception filter, response
// envelope, global prefix) — deliberately kept in lockstep with main.ts
// by hand, since Nest doesn't have a clean way to share "configure this
// app instance" between an app.listen() bootstrap and a handler export
// without adding an extra abstraction layer for one call site. If you
// change main.ts's app configuration, mirror the change here too.
//
// The Nest app itself is built ONCE per warm container and cached in
// `cachedApp` — NOT rebuilt per request. A cold start pays Nest's
// full module-graph bootstrap cost (including a new PrismaClient, which
// opens its own connection pool); a warm invocation reuses it. This is
// also why Prisma's DATABASE_URL should point at a pooled connection
// (e.g. Neon's "-pooler" host, or PgBouncer) in this deployment — many
// concurrent cold starts each opening a full Prisma connection pool
// against Postgres directly can exhaust Postgres's own max_connections
// fast. See backend/.env.example for the exact guidance.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { createServiceScopeMiddleware, ServiceScope } from '../src/common/middleware/service-scope.middleware';
import { GLOBAL_PREFIX } from '../src/config/global-prefix';

// NOTE: this used to wrap `expressApp` with @vendia/serverless-express
// and call the result as `cachedHandler(req, res)`. That's wrong here:
// serverlessExpress() returns an AWS Lambda handler with the signature
// (event, context) — it expects a raw API Gateway/ALB/Lambda Function
// URL *event* object and reconstructs an Express request from it via
// getEventSourceNameBasedOnEvent(). Vercel's Node runtime is not API
// Gateway: it hands the function real (req, res) Node http objects
// directly. Passing those in as if they were a Lambda "event" made the
// library try to sniff `req` for API-Gateway/ALB/Records shape, fail,
// and throw "Unable to determine event source based on event" — the
// 500s seen on every route (worst on favicon requests, which have the
// sparsest headers to sniff).
//
// An Express app instance is itself a valid (req, res) request
// handler, so on Vercel we can hand it to Vercel directly — no adapter
// needed.
let cachedApp: Express | undefined;

async function bootstrapServer(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { cors: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string[]>('corsOrigins')!.includes('*') ? true : config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  const serviceScope = config.get<ServiceScope>('serviceScope')!;
  app.use(createServiceScopeMiddleware(serviceScope));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.setGlobalPrefix(GLOBAL_PREFIX);

  // No Swagger UI here on purpose — a serverless function per request
  // is the wrong place to serve static docs assets, and NODE_ENV on
  // Vercel is 'production' for every real deployment anyway (main.ts
  // already only mounts /api/docs outside production).

  await app.init();
  return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cachedApp = cachedApp ?? (await bootstrapServer());
  return cachedApp(req, res);
}
