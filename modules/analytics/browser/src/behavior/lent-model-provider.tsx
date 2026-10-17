/**
 * What analytics borrows from model-provider: its model picker and its price
 * list. One seam, so analytics never imports model-provider's browser code.
 * ARCHITECTURE.md §3.4, rule 7.
 */

import { Lent } from "@langwatch/browser-host/lent";
import { type ModelSelectorProps, ModelSelectorToken } from "@langwatch/model-provider-client";
import {
  getModelMetadataForFrontend,
  mergeCustomModelMetadata,
  type ModelMetadataForFrontend,
} from "@langwatch/model-provider-contract";
import { useMemo } from "react";

import { analyticsApi } from "./analytics-api.ts";

/** Model-provider's model picker, rendered as model-provider lends it. */
export function ModelSelector(props: ModelSelectorProps) {
  return <Lent of={ModelSelectorToken} props={props} />;
}

/** Catalog half is the same for every project: build it once per page load. */
let catalogMetadata: Record<string, ModelMetadataForFrontend> | undefined;
const catalog = (): Record<string, ModelMetadataForFrontend> => {
  catalogMetadata ??= getModelMetadataForFrontend();
  return catalogMetadata;
};

/** Catalog plus the project's custom models, keyed `<provider>/<model>`, with prices. */
export function useReferenceModelMetadata({ projectId }: { projectId: string | undefined }): {
  modelMetadata: Record<string, ModelMetadataForFrontend> | undefined;
} {
  const providers = analyticsApi.modelProvider.getAllForProjectForFrontend.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const modelMetadata = useMemo(
    () => (providers.data ? mergeCustomModelMetadata(catalog(), providers.data) : undefined),
    [providers.data],
  );

  return { modelMetadata };
}
