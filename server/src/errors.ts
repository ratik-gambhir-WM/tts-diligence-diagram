import type { ErrorRequestHandler, Request, Response } from 'express'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

type ParserError = Error & {
  status?: unknown
  type?: unknown
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const apiError = toApiError(error)
  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: response.locals.requestId as string,
    },
  })
}

export function notFoundHandler(_request: Request, response: Response) {
  response.status(404).json({
    error: {
      code: 'route_not_found',
      message: 'The requested route does not exist.',
      requestId: response.locals.requestId as string,
    },
  })
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (isParserError(error) && (error.type === 'entity.too.large' || error.status === 413)) {
    return new ApiError(413, 'payload_too_large', 'The request body exceeds the configured size limit.')
  }

  if (isParserError(error) && (error.type === 'encoding.unsupported' || error.status === 415)) {
    return new ApiError(415, 'unsupported_content_encoding', 'Compressed request bodies are not supported.')
  }

  if (isParserError(error) && error.type === 'entity.parse.failed') {
    return new ApiError(400, 'invalid_json', 'The request body must contain valid JSON.')
  }

  return new ApiError(500, 'internal_error', 'The request could not be completed.')
}

function isParserError(value: unknown): value is ParserError {
  return value instanceof Error
}
