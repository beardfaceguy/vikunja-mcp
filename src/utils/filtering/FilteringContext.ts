/**
 * Filtering context for strategy selection and execution
 * 
 * This class encapsulates the logic for selecting the appropriate filtering
 * strategy based on configuration and environment settings. It maintains
 * the same behavior as the original implementation while providing a
 * cleaner separation of concerns.
 */

import type { TaskFilteringStrategy } from './TaskFilteringStrategy';
import type { FilteringParams, FilteringResult, StrategyConfig } from './types';
import { ClientSideFilteringStrategy } from './ClientSideFilteringStrategy';
import { HybridFilteringStrategy } from './HybridFilteringStrategy';

export class FilteringContext {
  private strategy: TaskFilteringStrategy;

  constructor(config: StrategyConfig) {
    this.strategy = this.getStrategy(config);
  }

  /**
   * Execute filtering using the selected strategy
   */
  async execute(params: FilteringParams): Promise<FilteringResult> {
    return this.strategy.execute(params);
  }

  /**
   * Select the appropriate filtering strategy based on configuration
   *
   * Server-side filtering is attempted by DEFAULT when a filter is present.
   *
   * Previously this required `NODE_ENV === 'production'` or an explicit opt-in env
   * var. That gate does not fit an MCP server: the process is spawned over stdio by
   * a client (Claude Desktop/Code, Zed, ...) with no NODE_ENV set, so neither branch
   * was ever true in real use and every deployment silently fell back to
   * client-side filtering. Because the client-side path filters only the single page
   * it fetched, a filter whose matches live on a later page returned zero results
   * and reported that as an authoritative answer.
   *
   * Selection order:
   * 1. `VIKUNJA_ENABLE_SERVER_SIDE_FILTERING` is authoritative in both directions
   *    ('true' forces the server-side attempt, 'false' forces client-side only).
   * 2. Otherwise, attempt server-side unless NODE_ENV marks a dev/test harness,
   *    where tests rely on the deterministic client-side path.
   *
   * The server-side attempt is not a correctness risk on its own:
   * HybridFilteringStrategy falls back to client-side if the request fails, so an
   * older Vikunja that ignores or rejects `filter` still works.
   */
  private getStrategy(config: StrategyConfig): TaskFilteringStrategy {
    if (!config.enableServerSide) {
      return new ClientSideFilteringStrategy();
    }

    const optIn = process.env.VIKUNJA_ENABLE_SERVER_SIDE_FILTERING;
    if (optIn === 'true') {
      return new HybridFilteringStrategy();
    }
    if (optIn === 'false') {
      return new ClientSideFilteringStrategy();
    }

    const nodeEnv = process.env.NODE_ENV;
    const isDevOrTestHarness = nodeEnv === 'development' || nodeEnv === 'test';

    return isDevOrTestHarness
      ? new ClientSideFilteringStrategy()
      : new HybridFilteringStrategy();
  }
}