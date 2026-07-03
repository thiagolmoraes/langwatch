import { describe, expect, it } from "vitest";

import { resolveGatewayBaseUrl } from "../VirtualKeyUsageSnippet";

describe("resolveGatewayBaseUrl", () => {
  describe("given an explicit override prop", () => {
    it("returns the override verbatim", () => {
      expect(
        resolveGatewayBaseUrl("https://my-ingress.example.com/v1", "https://ignored.example.com"),
      ).toBe("https://my-ingress.example.com/v1");
    });
  });

  describe("given LW_GATEWAY_PUBLIC_URL from publicEnv", () => {
    it("appends /v1 when missing", () => {
      expect(resolveGatewayBaseUrl(undefined, "https://llm.example.org")).toBe(
        "https://llm.example.org/v1",
      );
    });

    it("keeps an existing /v1 suffix", () => {
      expect(resolveGatewayBaseUrl(undefined, "https://llm.example.org/v1")).toBe(
        "https://llm.example.org/v1",
      );
    });

    it("strips trailing slashes before appending /v1", () => {
      expect(resolveGatewayBaseUrl(undefined, "https://llm.example.org///")).toBe(
        "https://llm.example.org/v1",
      );
    });
  });

  describe("given no override and no public URL", () => {
    it("falls back to the hosted SaaS URL outside the browser", () => {
      expect(resolveGatewayBaseUrl(undefined, undefined)).toBe(
        "https://gateway.langwatch.ai/v1",
      );
    });
  });
});
