/**
 * Actual spend vs the same tokens priced on a reference model. Follows the
 * page filters and date range. Spec: specs/analytics/model-cost-comparison.feature
 */

import { Box, HStack, Text, VStack } from "@langwatch/design-system/primitives";
import { useMemo, useState } from "react";

import { analyticsApi } from "../../behavior/analytics-api.ts";
import { ModelSelector, useReferenceModelMetadata } from "../../behavior/lent-model-provider.tsx";
import { useFilterParams } from "../../behavior/use-filter-params.ts";
import { useAnalyticsHost } from "../../model/analytics-host.ts";
import {
  COST_COMPARISON_SERIES,
  estimateReferenceCost,
  formatMoney,
  formatSavings,
  pickReferenceModel,
  referenceModelOptions,
  seriesKey,
  sumSeries,
} from "../../model/model-cost-comparison.ts";
import { SummaryMetric } from "./summary-metric.tsx";

/** Token and cost sums for the filtered period. */
function usePeriodUsage() {
  const { filterParams, queryOpts } = useFilterParams();
  const timeseries = analyticsApi.analytics.getTimeseries.useQuery(
    {
      ...filterParams,
      series: COST_COMPARISON_SERIES.map((series) => ({ ...series })),
      timeScale: "full",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      shouldSkipPreviousPeriod: true,
    },
    queryOpts,
  );
  const buckets = timeseries.data?.currentPeriod as Record<string, unknown>[] | undefined;
  return {
    isLoading: timeseries.isLoading,
    isError: timeseries.isError,
    promptTokens: sumSeries({ buckets, key: seriesKey(0) }),
    completionTokens: sumSeries({ buckets, key: seriesKey(1) }),
    actualCost: sumSeries({ buckets, key: seriesKey(2) }),
  };
}

type PeriodUsage = ReturnType<typeof usePeriodUsage>;

/** Error, empty state, or the three figures. Undefined figures render as loading. */
function ComparisonFigures({
  usage,
  hasTraffic,
  referenceCost,
  savings,
}: {
  usage: PeriodUsage;
  hasTraffic: boolean;
  referenceCost: number | undefined;
  savings: number | undefined;
}) {
  if (usage.isError) {
    return (
      <Text textStyle="sm" color="fg.error">
        Could not load usage for the selected period. Try refreshing the page.
      </Text>
    );
  }
  if (!usage.isLoading && !hasTraffic) {
    return (
      <Text textStyle="sm" color="fg.subtle">
        No traffic in the selected period. Adjust the filters or date range to compare costs.
      </Text>
    );
  }
  return (
    <HStack align="start" gap={0}>
      <SummaryMetric
        label="Current Cost"
        current={usage.isLoading ? undefined : usage.actualCost}
        format={formatMoney}
        increaseIs="neutral"
      />
      <SummaryMetric
        label="Estimated Cost on Selected Model"
        current={referenceCost}
        format={formatMoney}
        increaseIs="neutral"
        tooltip="The period's input and output tokens priced at the selected model's rates."
      />
      <SummaryMetric
        label="Estimated Savings"
        current={savings}
        format={formatSavings}
        increaseIs="good"
        tooltip="Estimated cost on the selected model minus the actual cost. Negative means the current setup costs more."
      />
    </HStack>
  );
}

export function ModelCostComparisonCard() {
  const projectId = useAnalyticsHost().project()?.id;
  const { modelMetadata } = useReferenceModelMetadata({ projectId });
  const options = useMemo(() => referenceModelOptions(modelMetadata), [modelMetadata]);
  const [chosenModel, setChosenModel] = useState<string | undefined>(undefined);
  const selectedModel = pickReferenceModel({ chosen: chosenModel, options });

  const usage = usePeriodUsage();
  const referenceCost = estimateReferenceCost({
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    pricing: selectedModel ? modelMetadata?.[selectedModel]?.pricing : undefined,
  });
  const savings = referenceCost === undefined ? undefined : referenceCost - usage.actualCost;
  const hasTraffic = usage.promptTokens + usage.completionTokens > 0;
  const shown = (value: number | undefined) => (usage.isLoading ? undefined : value);

  return (
    <VStack align="stretch" gap={4}>
      <HStack justify="space-between" flexWrap="wrap" gap={2}>
        <Text textStyle="sm" color="fg.muted">
          What the same traffic would cost on
        </Text>
        <Box minWidth="220px">
          {selectedModel && (
            <ModelSelector
              model={selectedModel}
              options={options}
              onChange={setChosenModel}
              size="sm"
              mode="chat"
            />
          )}
        </Box>
      </HStack>
      <ComparisonFigures
        usage={usage}
        hasTraffic={hasTraffic}
        referenceCost={shown(referenceCost)}
        savings={shown(savings)}
      />
    </VStack>
  );
}
