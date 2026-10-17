import { describe, expect, it } from "vitest";

import {
  DEFAULT_REFERENCE_MODEL,
  estimateReferenceCost,
  formatMoney,
  formatSavings,
  pickReferenceModel,
  type PricedModel,
  referenceModelOptions,
  seriesKey,
  sumSeries,
} from "../model-cost-comparison.ts";

// Spec: specs/analytics/model-cost-comparison.feature

const SONNET = { inputCostPerToken: 0.000003, outputCostPerToken: 0.000015 };

describe("estimateReferenceCost", () => {
  describe("when the reference model has complete pricing", () => {
    /** @scenario Comparing local traffic against a commercial reference model */
    it("prices the period's tokens at the reference per-token rates", () => {
      const cost = estimateReferenceCost({
        promptTokens: 2_000_000,
        completionTokens: 500_000,
        pricing: SONNET,
      });
      expect(cost).toBeCloseTo(13.5, 6);
    });

    it("estimates zero for zero tokens", () => {
      expect(estimateReferenceCost({ promptTokens: 0, completionTokens: 0, pricing: SONNET })).toBe(
        0,
      );
    });
  });

  describe("when pricing is missing or incomplete", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["input only", { inputCostPerToken: 0.000003 }],
      ["output only", { outputCostPerToken: 0.000015 }],
    ])("returns undefined for %s pricing", (_label, pricing) => {
      expect(
        estimateReferenceCost({ promptTokens: 1000, completionTokens: 1000, pricing }),
      ).toBeUndefined();
    });
  });
});

describe("referenceModelOptions", () => {
  describe("when some models lack catalog pricing", () => {
    /** @scenario Only models with catalog pricing are offered as reference */
    it("offers only models with complete pricing, sorted", () => {
      const metadata: Record<string, PricedModel> = {
        "openai/gpt-5-mini": {
          pricing: { inputCostPerToken: 0.00000025, outputCostPerToken: 0.000002 },
        },
        "custom/qwen3-14b": {},
        "anthropic/claude-sonnet-4-6": { pricing: SONNET },
        "custom/half-priced": { pricing: { inputCostPerToken: 0.000001 } },
        "custom/null-priced": { pricing: null },
      };
      expect(referenceModelOptions(metadata)).toEqual([
        "anthropic/claude-sonnet-4-6",
        "openai/gpt-5-mini",
      ]);
    });
  });

  describe("when metadata has not loaded yet", () => {
    it("returns an empty list", () => {
      expect(referenceModelOptions(undefined)).toEqual([]);
    });
  });
});

describe("pickReferenceModel", () => {
  it("keeps the user's pick", () => {
    expect(pickReferenceModel({ chosen: "openai/gpt-5", options: [DEFAULT_REFERENCE_MODEL] })).toBe(
      "openai/gpt-5",
    );
  });

  it("falls back to the default model when it is offered", () => {
    expect(
      pickReferenceModel({ chosen: undefined, options: ["a/a", DEFAULT_REFERENCE_MODEL] }),
    ).toBe(DEFAULT_REFERENCE_MODEL);
  });

  it("falls back to the first option when the default is not offered", () => {
    expect(pickReferenceModel({ chosen: undefined, options: ["a/a", "b/b"] })).toBe("a/a");
  });

  it("returns undefined when nothing is offered", () => {
    expect(pickReferenceModel({ chosen: undefined, options: [] })).toBeUndefined();
  });
});

describe("sumSeries", () => {
  it("adds one key across buckets and skips non-numbers", () => {
    const key = seriesKey(0);
    expect(sumSeries({ buckets: [{ [key]: 10 }, { [key]: "x" }, {}, { [key]: 5 }], key })).toBe(15);
  });

  it("returns zero when there are no buckets", () => {
    expect(sumSeries({ buckets: undefined, key: seriesKey(2) })).toBe(0);
  });
});

describe("seriesKey", () => {
  it("names the bucket key the timeseries endpoint writes", () => {
    expect(seriesKey(0)).toBe("0/performance.prompt_tokens/sum");
    expect(seriesKey(2)).toBe("2/performance.total_cost/sum");
  });

  it("refuses an index with no series", () => {
    expect(() => seriesKey(3)).toThrow(/No cost comparison series/);
  });
});

describe("formatSavings", () => {
  describe("when the current setup costs more than the reference", () => {
    /** @scenario Traffic that already costs more than the reference shows negative savings */
    it("shows the difference as a negative amount", () => {
      expect(formatSavings(-12.5)).toBe("-$12.50");
    });
  });

  it("shows a positive saving as plain money", () => {
    expect(formatSavings(13.5)).toBe("$13.50");
  });
});

describe("formatMoney", () => {
  it("keeps sub-cent values visible", () => {
    expect(formatMoney(0.0042)).toBe("$0.0042");
  });

  it("shows zero as $0.00", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });
});
