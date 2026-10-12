import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { requestContext } from '../common/request-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = new URL(process.env.DATABASE_URL!);
    const queryLogThresholdMs = readOptionalThreshold(
      process.env.SLOW_QUERY_LOG_MS,
    );

    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      connectionLimit: readConnectionLimit(process.env.DB_CONNECTION_LIMIT),
    });

    super({
      adapter,
      ...(queryLogThresholdMs === undefined
        ? {}
        : { log: [{ emit: 'event', level: 'query' }] }),
    });

    if (queryLogThresholdMs !== undefined) {
      const logger = new Logger(PrismaService.name);
      const includeSqlTemplate = process.env.SLOW_QUERY_LOG_SQL === 'true';
      this.$on('query', (event) => {
        if (event.duration < queryLogThresholdMs) return;

        logger.warn(
          JSON.stringify({
            event: 'slow_db_query',
            requestId: requestContext.getStore()?.requestId,
            durationMs: event.duration,
            queryFingerprint: createHash('sha256')
              .update(event.query)
              .digest('hex')
              .slice(0, 12),
            ...(includeSqlTemplate
              ? { query: event.query.replace(/\s+/g, ' ').slice(0, 2000) }
              : {}),
          }),
        );
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}

function readOptionalThreshold(value?: string) {
  if (value === undefined || value.trim() === '') return undefined;
  const configured = Number(value);
  return Number.isFinite(configured) && configured >= 0 ? configured : 500;
}

function readConnectionLimit(value?: string) {
  const configured = Number(value ?? 10);
  if (!Number.isFinite(configured)) return 10;
  return Math.max(1, Math.min(Math.floor(configured), 50));
}
