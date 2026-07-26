/**
 * Simple Response Factory
 * Replaces 2,925-line AORP system with clean, direct response formatting
 */

import { createSuccessResponse, createErrorResponse, type SimpleResponse } from './simple-response';
import type { ResponseMetadata } from '../types/responses';
import type { ResponseData } from '../types';

/**
 * Simple response metadata
 */
export interface SimpleResponseMetadata {
  /** Processing information */
  processing?: {
    /** Processing time in ms */
    processingTimeMs?: number;
    /** Operation context */
    operation?: string;
  };
  /** Timestamp */
  timestamp?: string;
  /** Success flag */
  success?: boolean;
  /** Error information */
  error?: {
    code: string;
    message: string;
  };
  /** Session ID */
  sessionId?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Create a simple response (replaces createAorpResponse)
 * Direct replacement for AORP factory functions
 */
export function createSimpleResponse(
  operation: string,
  message: string,
  data?: ResponseData,
  options?: {
    success?: boolean;
    metadata?: ResponseMetadata;
    processingTimeMs?: number;
  }
): SimpleResponse {
  const { success = true, metadata } = options || {};

  if (success) {
    return createSuccessResponse(operation, message, data, {
      timestamp: new Date().toISOString(),
      success,
      operation,
      ...metadata,
    });
  } else {
    return createErrorResponse(operation, message, 'OPERATION_FAILED', {
      timestamp: new Date().toISOString(),
      success: false,
      operation,
      ...metadata,
    });
  }
}

/**
 * Response wire formats supported by {@link formatResponseForMcp}.
 */
export type McpResponseFormat = 'markdown' | 'json';

/**
 * Resolve the wire format from the environment.
 *
 * Defaults to 'markdown' so existing behaviour is unchanged. Set
 * `VIKUNJA_MCP_RESPONSE_FORMAT=json` for machine-readable output.
 *
 * Read per call rather than cached at import time so tests (and a long-lived
 * process whose env is adjusted) observe the current value.
 */
export function resolveMcpResponseFormat(): McpResponseFormat {
  return process.env.VIKUNJA_MCP_RESPONSE_FORMAT?.trim().toLowerCase() === 'json'
    ? 'json'
    : 'markdown';
}

/**
 * Format response for MCP (replaces AORP formatting)
 *
 * Markdown remains the default. Under `VIKUNJA_MCP_RESPONSE_FORMAT=json` the
 * structured payload is emitted instead, which matters for programmatic callers
 * for two reasons: the markdown has to be parsed apart to be used at all, and it
 * is lossy, since collection items are dropped once a result exceeds 10 rows.
 */
export function formatResponseForMcp(response: SimpleResponse): string {
  if (resolveMcpResponseFormat() === 'json') {
    const payload: Record<string, unknown> = {
      success: response.metadata?.success ?? true,
    };

    if (response.metadata?.operation !== undefined) {
      payload.operation = response.metadata.operation;
    }
    if (response.message !== undefined) {
      payload.message = response.message;
    }
    if (response.data !== undefined) {
      payload.data = response.data;
    }
    if (response.metadata !== undefined) {
      payload.metadata = response.metadata;
    }

    return JSON.stringify(payload, null, 2);
  }

  return response.content;
}

/**
 * Create task response (replaces createTaskResponse)
 * Now handles flexible data for backward compatibility
 */
export function createTaskResponse(
  operation: string,
  message: string,
  data: { tasks?: ResponseData[] } | ResponseData,
  metadata?: ResponseMetadata,
  sessionId?: string
): SimpleResponse {
  // Handle both task data structure and arbitrary data objects
  const responseData = data && typeof data === 'object' && 'tasks' in data ? data.tasks : data;

  // Respect success flag from metadata, default to true
  const successFlag = metadata?.success !== undefined ? metadata.success : true;

  const responseMetadata: ResponseMetadata = {
    timestamp: new Date().toISOString(),
    success: successFlag,
    operation,
    ...metadata,
  };

  if (sessionId !== undefined) {
    responseMetadata.sessionId = sessionId;
  }

  // Use createErrorResponse for failed operations, createSuccessResponse for successful ones
  if (successFlag) {
    return createSuccessResponse(operation, message, responseData as ResponseData, responseMetadata);
  } else {
    return createErrorResponse(operation, message, 'OPERATION_FAILED', responseMetadata);
  }
}

/**
 * Create error response (replaces createAorpErrorResponse)
 */
export function createSimpleErrorResponse(
  operation: string,
  message: string,
  errorCode: string = 'UNKNOWN_ERROR',
  metadata?: ResponseMetadata
): SimpleResponse {
  return createErrorResponse(operation, message, errorCode, metadata);
}

// Legacy exports for backward compatibility
export { createTaskResponse as createStandardResponse };
export { createTaskResponse as createTaskAorpResponse };
export { createSimpleErrorResponse as createAorpErrorResponse };
export { formatResponseForMcp as formatAorpAsMarkdown };

// Additional AORP compatibility exports
export { createSimpleResponse as createAorpResponse };

// Export SimpleResponse type for external use
export type { SimpleResponse } from './simple-response';

/**
 * Create AORP response from data (compatibility function)
 * Simple replacement for createAorpFromData
 */
export function createAorpFromData(
  operation: string,
  message: string,
  success: boolean = true,
  details?: string
): SimpleResponse {
  return createSimpleResponse(operation, details || message, undefined, { success });
}

// AORP compatibility types (inline to avoid external dependencies)
export interface AorpBuilderConfig {
  confidenceMethod?: string;
  enableCaching?: boolean;
  maxCacheSize?: number;
  [key: string]: unknown;
}

export type AorpVerbosityLevel = 'minimal' | 'standard' | 'detailed';

export interface ComplexityFactors {
  dataComplexity: number;
  nestingLevel: number;
  itemCount: number;
  hasNestedArrays: boolean;
}