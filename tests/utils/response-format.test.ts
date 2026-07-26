/**
 * Tests for the MCP response wire format switch.
 *
 * Markdown stays the default. `VIKUNJA_MCP_RESPONSE_FORMAT=json` emits the
 * structured payload instead, which programmatic callers need because the
 * markdown must be parsed apart and drops collection items past 10 rows.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  formatResponseForMcp,
  resolveMcpResponseFormat,
} from '../../src/utils/response-factory';
import { createSuccessResponse, createErrorResponse } from '../../src/utils/simple-response';

describe('MCP response format', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.VIKUNJA_MCP_RESPONSE_FORMAT;
    delete process.env.VIKUNJA_MCP_RESPONSE_FORMAT;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.VIKUNJA_MCP_RESPONSE_FORMAT;
    } else {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = original;
    }
  });

  const tasksOf = (count: number): Array<{ id: number; title: string; done: boolean }> =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}`, done: false }));

  describe('resolveMcpResponseFormat', () => {
    it('defaults to markdown when unset', () => {
      expect(resolveMcpResponseFormat()).toBe('markdown');
    });

    it('returns json for the json value', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'json';
      expect(resolveMcpResponseFormat()).toBe('json');
    });

    it('is tolerant of case and surrounding whitespace', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = '  JSON  ';
      expect(resolveMcpResponseFormat()).toBe('json');
    });

    it('falls back to markdown for unrecognised values', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'yaml';
      expect(resolveMcpResponseFormat()).toBe('markdown');
    });
  });

  describe('markdown (default)', () => {
    it('returns the pre-rendered markdown content unchanged', () => {
      const response = createSuccessResponse('list-tasks', 'Found 1 tasks', {
        tasks: tasksOf(1) as never,
      });

      expect(formatResponseForMcp(response)).toBe(response.content);
      expect(formatResponseForMcp(response)).toContain('## ');
    });
  });

  describe('json', () => {
    it('emits parseable JSON carrying message, data and metadata', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'json';

      const response = createSuccessResponse(
        'list-tasks',
        'Found 2 tasks',
        { tasks: tasksOf(2) as never },
        { count: 2 }
      );

      const parsed = JSON.parse(formatResponseForMcp(response));

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe('list-tasks');
      expect(parsed.message).toBe('Found 2 tasks');
      expect(parsed.data.tasks).toHaveLength(2);
      expect(parsed.data.tasks[0]).toMatchObject({ id: 1, title: 'Task 1' });
      expect(parsed.metadata.count).toBe(2);
    });

    it('retains every item for collections larger than the markdown cutoff', () => {
      // The markdown renderer omits items entirely past 10, so a 50-row listing
      // renders as a bare count. JSON must not lose them.
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'json';

      const response = createSuccessResponse('list-tasks', 'Found 50 tasks', {
        tasks: tasksOf(50) as never,
      });

      expect(response.content).not.toContain('Task 42');

      const parsed = JSON.parse(formatResponseForMcp(response));
      expect(parsed.data.tasks).toHaveLength(50);
      expect(parsed.data.tasks[41]).toMatchObject({ id: 42, title: 'Task 42' });
    });

    it('reports failure and error details for error responses', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'json';

      const response = createErrorResponse('update-task', 'Nope', 'VALIDATION_ERROR');
      const parsed = JSON.parse(formatResponseForMcp(response));

      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Nope');
      expect(parsed.metadata.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Nope' });
    });

    it('omits data entirely when the response carried none', () => {
      process.env.VIKUNJA_MCP_RESPONSE_FORMAT = 'json';

      const parsed = JSON.parse(
        formatResponseForMcp(createSuccessResponse('ping', 'ok'))
      );

      expect(parsed).not.toHaveProperty('data');
      expect(parsed.message).toBe('ok');
    });
  });
});
