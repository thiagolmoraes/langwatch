/**
 * @vitest-environment jsdom
 *
 * Spec: specs/analytics/model-cost-comparison.feature
 */
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as LentModelProvider from "../../../behavior/lent-model-provider.tsx";

type QueryState = { data: unknown; isLoading: boolean; isError: boolean };

const timeseriesInputs: Record<string, unknown>[] = [];
const providerQueryOptions: { enabled?: boolean }[] = [];
let timeseriesState: QueryState;

const PROMPT = "0/performance.prompt_tokens/sum";
const COMPLETION = "1/performance.completion_tokens/sum";
const COST = "2/performance.total_cost/sum";

vi.mock("../../../behavior/analytics-api.ts", () => ({
  analyticsApi: {
    analytics: {
      getTimeseries: {
        useQuery: (input: Record<string, unknown>) => {
          timeseriesInputs.push(input);
          return timeseriesState;
        },
      },
    },
    modelProvider: {
      getAllForProjectForFrontend: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => {
          providerQueryOptions.push(options);
          return { data: options.enabled ? {} : undefined, isLoading: false };
        },
      },
    },
  },
}));

vi.mock("../../../behavior/use-filter-params.ts", () => ({
  useFilterParams: () => ({
    filterParams: {
      projectId: "proj-1",
      startDate: 100,
      endDate: 200,
      filters: { "metadata.labels": ["checkout"] },
    },
    queryOpts: { enabled: true },
  }),
}));

vi.mock("../../../behavior/lent-model-provider.tsx", async (importOriginal) => ({
  ...(await importOriginal<typeof LentModelProvider>()),
  ModelSelector: ({ model }: { model: string }) => <span data-testid="selector">{model}</span>,
}));

import { renderWithAnalyticsHost } from "../../../testing.tsx";
import { ModelCostComparisonCard } from "../model-cost-comparison-card.tsx";

function withUsage(bucket: Record<string, number>): QueryState {
  return {
    data: { currentPeriod: [bucket], previousPeriod: [] },
    isLoading: false,
    isError: false,
  };
}

afterEach(cleanup);

beforeEach(() => {
  timeseriesInputs.length = 0;
  providerQueryOptions.length = 0;
  timeseriesState = withUsage({ [PROMPT]: 2_000_000, [COMPLETION]: 500_000, [COST]: 0 });
});

describe("<ModelCostComparisonCard />", () => {
  describe("when the page is filtered", () => {
    /** @scenario Comparison respects the page filters */
    it("asks for token sums with the page's filters and date range", () => {
      renderWithAnalyticsHost(<ModelCostComparisonCard />);

      expect(timeseriesInputs[0]).toMatchObject({
        projectId: "proj-1",
        startDate: 100,
        endDate: 200,
        filters: { "metadata.labels": ["checkout"] },
        timeScale: "full",
        shouldSkipPreviousPeriod: true,
      });
    });
  });

  describe("when the period has traffic", () => {
    it("shows the current cost and the reference model picker", () => {
      renderWithAnalyticsHost(<ModelCostComparisonCard />);

      expect(screen.getByText("Current Cost")).toBeTruthy();
      expect(screen.getByText("Estimated Savings")).toBeTruthy();
      expect(screen.getByTestId("selector").textContent).toBe("anthropic/claude-sonnet-4-6");
    });
  });

  describe("when the filtered period has zero tokens", () => {
    /** @scenario No traffic in the period */
    it("shows an empty state instead of a $0.00 comparison", () => {
      timeseriesState = withUsage({ [PROMPT]: 0, [COMPLETION]: 0, [COST]: 0 });

      renderWithAnalyticsHost(<ModelCostComparisonCard />);

      expect(screen.getByText(/No traffic in the selected period/)).toBeTruthy();
      expect(screen.queryByText("Estimated Savings")).toBeNull();
    });
  });

  describe("when no project is in scope yet", () => {
    it("does not ask for model prices and offers no picker", () => {
      renderWithAnalyticsHost(<ModelCostComparisonCard />, { project: undefined });

      expect(providerQueryOptions.every((options) => options.enabled === false)).toBe(true);
      expect(screen.queryByTestId("selector")).toBeNull();
    });
  });

  describe("when usage fails to load", () => {
    it("shows an error message", () => {
      timeseriesState = { data: undefined, isLoading: false, isError: true };

      renderWithAnalyticsHost(<ModelCostComparisonCard />);

      expect(screen.getByText(/Could not load usage/)).toBeTruthy();
    });
  });
});
