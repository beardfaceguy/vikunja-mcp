/**
 * Regression tests for percentDone on the task update path.
 *
 * The update path built both its affectedFields list and its outgoing payload
 * from a fixed set of fields that did not include progress. A caller asking to
 * set percent_done therefore got "Task updated successfully" with an empty
 * affectedFields array while the value never moved.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { updateTask } from '../../../src/tools/tasks/crud';
import type { MockVikunjaClient } from '../../types/mocks';

jest.mock('../../../src/client', () => ({
  getClientFromContext: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { getClientFromContext } from '../../../src/client';

describe('updateTask percentDone', () => {
  let mockClient: MockVikunjaClient;

  const baseTask = {
    id: 1,
    title: 'Test Task',
    description: 'Test Description',
    done: false,
    priority: 1,
    percent_done: 0,
    repeat_after: 0,
    repeat_mode: 0,
    assignees: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      tasks: {
        getTask: jest.fn(),
        createTask: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        updateTaskLabels: jest.fn(),
        bulkAssignUsersToTask: jest.fn(),
        removeUserFromTask: jest.fn(),
      },
    } as any;
    (getClientFromContext as jest.Mock).mockResolvedValue(mockClient);
  });

  const arrange = (percentDone: number): void => {
    const updated = { ...baseTask, percent_done: percentDone };
    mockClient.tasks.getTask.mockResolvedValueOnce(baseTask).mockResolvedValueOnce(updated);
    mockClient.tasks.updateTask.mockResolvedValue(updated);
  };

  it('sends percent_done to the API', async () => {
    arrange(55);

    await updateTask({ id: 1, percentDone: 55 });

    expect(mockClient.tasks.updateTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ percent_done: 55 })
    );
  });

  it('reports percentDone as an affected field', async () => {
    arrange(55);

    const result = await updateTask({ id: 1, percentDone: 55 });
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('percentDone');
  });

  it('accepts 0 as a real value rather than treating it as absent', async () => {
    // 0 is falsy, so a truthiness check here would silently drop a reset to zero.
    const started = { ...baseTask, percent_done: 40 };
    const cleared = { ...baseTask, percent_done: 0 };
    mockClient.tasks.getTask.mockResolvedValueOnce(started).mockResolvedValueOnce(cleared);
    mockClient.tasks.updateTask.mockResolvedValue(cleared);

    await updateTask({ id: 1, percentDone: 0 });

    expect(mockClient.tasks.updateTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ percent_done: 0 })
    );
  });

  it('does not report percentDone when the value is unchanged', async () => {
    const unchanged = { ...baseTask, percent_done: 25 };
    mockClient.tasks.getTask.mockResolvedValueOnce(unchanged).mockResolvedValueOnce(unchanged);
    mockClient.tasks.updateTask.mockResolvedValue(unchanged);

    const result = await updateTask({ id: 1, percentDone: 25 });
    const text = result.content[0]?.text ?? '';

    expect(text).not.toContain('percentDone');
  });

  it('leaves percent_done alone when the caller does not mention it', async () => {
    const withProgress = { ...baseTask, percent_done: 30 };
    mockClient.tasks.getTask
      .mockResolvedValueOnce(withProgress)
      .mockResolvedValueOnce({ ...withProgress, title: 'Renamed' });
    mockClient.tasks.updateTask.mockResolvedValue({ ...withProgress, title: 'Renamed' });

    await updateTask({ id: 1, title: 'Renamed' });

    // buildUpdateData spreads the current task, so the existing value is preserved
    // rather than cleared.
    expect(mockClient.tasks.updateTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ percent_done: 30 })
    );
  });
});
