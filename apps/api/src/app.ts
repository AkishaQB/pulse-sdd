import { ERROR_HTTP_STATUS, type ErrorBody, type ErrorCode } from '@pulse/shared';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { isConnectionError } from './db/pool.js';
import { DomainError } from './errors.js';

export interface BuildAppOptions {
  /** Registers routes. `container.ts` wires the campaign routes in T12. */
  register?: (app: FastifyInstance) => void | Promise<void>;
  logger?: boolean;
}

// Fastify errors with a status we remap into the spec's error shape.
const FASTIFY_ERROR_CODES: Record<string, ErrorCode> = {
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  FST_ERR_CTP_BODY_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  FST_ERR_CTP_INVALID_JSON_BODY: 'VALIDATION_ERROR',
  FST_ERR_CTP_EMPTY_JSON_BODY: 'VALIDATION_ERROR',
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'VALIDATION_ERROR',
};

function body(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    ajv: {
      // Fastify's default strips unknown properties; AC-3e/AC-25 need a 400 instead.
      customOptions: { removeAdditional: false },
    },
  });

  // Fastify ships a text/plain parser; AC-3f wants only application/json accepted.
  app.removeContentTypeParser('text/plain');

  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof DomainError) {
      return reply.status(ERROR_HTTP_STATUS[err.code]).send(body(err.code, err.message));
    }

    const fastifyErr = err as FastifyError;
    if (fastifyErr.validation) {
      return reply.status(400).send(body('VALIDATION_ERROR', fastifyErr.message));
    }
    const mapped = fastifyErr.code ? FASTIFY_ERROR_CODES[fastifyErr.code] : undefined;
    if (mapped) {
      return reply
        .status(ERROR_HTTP_STATUS[mapped])
        .send(body(mapped, mapped === 'VALIDATION_ERROR' ? fastifyErr.message : mapped));
    }

    request.log.error({ err }, 'request failed');
    if (isConnectionError(err)) {
      return reply
        .status(ERROR_HTTP_STATUS.SERVICE_UNAVAILABLE)
        .send(body('SERVICE_UNAVAILABLE', 'Service temporarily unavailable'));
    }
    // Never expose the cause (AC-38, AC-39).
    return reply
      .status(ERROR_HTTP_STATUS.INTERNAL_ERROR)
      .send(body('INTERNAL_ERROR', 'Internal server error'));
  });

  await options.register?.(app);
  return app;
}
