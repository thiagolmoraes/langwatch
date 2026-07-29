/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  api: {
    modelProvider: {
      getAllForProjectForFrontend: {
        useQuery: vi.fn(),
      },
      // The hook also reads the flat row list for ID-based lookups in the
      // edit drawer, so the mock has to answer that query too.
      listAllForProjectForFrontend: {
        useQuery: vi.fn(),
      },
    },
  },
}));

import { api } from "../../utils/api";
import { useModelProvidersSettings } from "../useModelProvidersSettings";

const mockUseQuery = vi.mocked(
  api.modelProvider.getAllForProjectForFrontend.useQuery,
);

const mockListAllUseQuery = vi.mocked(
  api.modelProvider.listAllForProjectForFrontend.useQuery
);

describe("useModelProvidersSettings()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every case below drives hasEnabledProviders through the Record-shaped
    // query; the flat list only has to resolve so the hook can read its
    // isLoading flag.
    mockListAllUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
  });

  describe("hasEnabledProviders", () => {
    describe("when loading", () => {
      beforeEach(() => {
        mockUseQuery.mockReturnValue({
          data: undefined,
          isLoading: true,
          refetch: vi.fn(),
        } as any);
      });

      it("returns true (optimistic default)", () => {
        const { result } = renderHook(() =>
          useModelProvidersSettings({ projectId: "project-123" }),
        );

        expect(result.current.hasEnabledProviders).toBe(true);
      });
    });

    describe("when providers is undefined", () => {
      beforeEach(() => {
        mockUseQuery.mockReturnValue({
          data: undefined,
          isLoading: false,
          refetch: vi.fn(),
        } as any);
      });

      it("returns true (optimistic default)", () => {
        const { result } = renderHook(() =>
          useModelProvidersSettings({ projectId: "project-123" }),
        );

        expect(result.current.hasEnabledProviders).toBe(true);
      });
    });

    describe("when no providers are configured", () => {
      beforeEach(() => {
        mockUseQuery.mockReturnValue({
          data: { providers: {}, modelMetadata: {} },
          isLoading: false,
          refetch: vi.fn(),
        } as any);
      });

      it("returns false", () => {
        const { result } = renderHook(() =>
          useModelProvidersSettings({ projectId: "project-123" }),
        );

        expect(result.current.hasEnabledProviders).toBe(false);
      });
    });

    describe("when all providers are disabled", () => {
      beforeEach(() => {
        mockUseQuery.mockReturnValue({
          data: {
            providers: {
              openai: { enabled: false, provider: "openai" },
              anthropic: { enabled: false, provider: "anthropic" },
            },
            modelMetadata: {},
          },
          isLoading: false,
          refetch: vi.fn(),
        } as any);
      });

      it("returns false", () => {
        const { result } = renderHook(() =>
          useModelProvidersSettings({ projectId: "project-123" }),
        );

        expect(result.current.hasEnabledProviders).toBe(false);
      });
    });

    describe("when at least one provider is enabled", () => {
      beforeEach(() => {
        mockUseQuery.mockReturnValue({
          data: {
            providers: {
              openai: { enabled: true, provider: "openai" },
              anthropic: { enabled: false, provider: "anthropic" },
            },
            modelMetadata: {},
          },
          isLoading: false,
          refetch: vi.fn(),
        } as any);
      });

      it("returns true", () => {
        const { result } = renderHook(() =>
          useModelProvidersSettings({ projectId: "project-123" }),
        );

        expect(result.current.hasEnabledProviders).toBe(true);
      });
    });
  });
});
