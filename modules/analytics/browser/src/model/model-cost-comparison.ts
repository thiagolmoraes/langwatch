/**
 * Math behind the cost comparison card. Pure, no React.
 * Spec: specs/analytics/model-cost-comparison.feature
 */

import numeral from "numeral";

/** Per-token rates of one model. Null or partial when the catalog has no price. */
export type ReferencePricing = {
  inputCostPerToken?: number;
  outputCostPerToken?: number;
} | null;

/** The bit of model metadata this card reads. */
export type PricedModel = { pricing?: ReferencePricing };

/** The three sums the card asks the timeseries endpoint for, in this order. */
export const COST_COMPARISON_SERIES = [
  { metric: "performance.prompt_tokens", aggregation: "sum" },
  { metric: "performance.completion_tokens", aggregation: "sum" },
  { metric: "performance.total_cost", aggregation: "sum" },
] as const;

/** Model picked when the user has not chosen one and the catalog has it. */
export const DEFAULT_REFERENCE_MODEL = "anthropic/claude-sonnet-4-6";

/** Bucket key the timeseries endpoint uses for series `index`. */
export function seriesKey(index: number): string {
  const series = COST_COMPARISON_SERIES[index];
  if (!series) throw new Error(`No cost comparison series at index ${index}`);
  return `${index}/${series.metric}/${series.aggregation}`;
}

/** Sum of one key over every bucket. Non-numbers count as zero. */
export function sumSeries({
  buckets,
  key,
}: {
  buckets: readonly Record<string, unknown>[] | undefined;
  key: string;
}): number {
  return (buckets ?? []).reduce((total, bucket) => {
    const value = bucket[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function hasCompletePricing(
  pricing: ReferencePricing | undefined,
): pricing is { inputCostPerToken: number; outputCostPerToken: number } {
  return (
    !!pricing &&
    typeof pricing.inputCostPerToken === "number" &&
    typeof pricing.outputCostPerToken === "number"
  );
}

/**
 * What the period's tokens would cost on the reference model.
 * Undefined when pricing is partial: a half-priced estimate looks like a
 * smaller saving than the real one.
 */
export function estimateReferenceCost({
  promptTokens,
  completionTokens,
  pricing,
}: {
  promptTokens: number;
  completionTokens: number;
  pricing: ReferencePricing | undefined;
}): number | undefined {
  if (!hasCompletePricing(pricing)) return undefined;
  return promptTokens * pricing.inputCostPerToken + completionTokens * pricing.outputCostPerToken;
}

/**
 * Models the user can pick as reference: only those with full pricing.
 * Chat vs embedding filtering is the model selector's job.
 */
export function referenceModelOptions(
  modelMetadata: Readonly<Record<string, PricedModel>> | undefined,
): string[] {
  if (!modelMetadata) return [];
  return Object.entries(modelMetadata)
    .filter(([, metadata]) => hasCompletePricing(metadata.pricing))
    .map(([id]) => id)
    .toSorted();
}

/** The user's pick, else the default when offered, else the first option. */
export function pickReferenceModel({
  chosen,
  options,
}: {
  chosen: string | undefined;
  options: readonly string[];
}): string | undefined {
  if (chosen) return chosen;
  return options.includes(DEFAULT_REFERENCE_MODEL) ? DEFAULT_REFERENCE_MODEL : options[0];
}

/** Money for the card. Sub-cent values keep four decimals so they do not read as zero. */
export function formatMoney(value: number): string {
  return value >= 0.01 || value === 0
    ? numeral(value).format("$0.00a")
    : numeral(value).format("$0.0000a");
}

/** Savings with a leading minus when the current setup costs more. */
export function formatSavings(value: number): string {
  return value < 0 ? `-${formatMoney(Math.abs(value))}` : formatMoney(value);
}
