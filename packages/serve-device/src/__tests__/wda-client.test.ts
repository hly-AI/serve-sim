import { describe, expect, test } from "bun:test";
import { normalizedToPixels, WdaClient } from "../wda/wda-client";

describe("normalizedToPixels", () => {
  test("maps 0.5,0.5 on 390x844 to 195,422", () => {
    expect(normalizedToPixels(0.5, 0.5, 390, 844)).toEqual({
      x: 195,
      y: 422,
    });
  });
});

describe("WdaClient", () => {
  test("tap posts pixel coords after reading window size", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? String(init.body) : undefined });
      if (url.endsWith("/status")) {
        return new Response(JSON.stringify({ value: { ready: true } }), {
          status: 200,
        });
      }
      if (url.endsWith("/session") && init?.method === "POST") {
        return new Response(JSON.stringify({ value: { sessionId: "S1" } }), {
          status: 200,
        });
      }
      if (url.endsWith("/window/size")) {
        return new Response(
          JSON.stringify({ value: { width: 390, height: 844 } }),
          { status: 200 },
        );
      }
      if (url.endsWith("/wda/tap")) {
        return new Response(JSON.stringify({ value: null }), { status: 200 });
      }
      return new Response("missing", { status: 404 });
    };

    const client = new WdaClient({
      baseUrl: "http://127.0.0.1:8100",
      fetch: fetchMock,
    });
    await client.tap(0.5, 0.5);
    const tapCall = calls.find((c) => c.url.endsWith("/wda/tap"));
    expect(tapCall?.body).toBe(JSON.stringify({ x: 195, y: 422 }));
  });

  test("status reports ready on 200", async () => {
    const client = new WdaClient({
      baseUrl: "http://127.0.0.1:8100",
      fetch: async () => new Response("{}", { status: 200 }),
    });
    expect(await client.status()).toEqual({
      ready: true,
      detail: "WDA /status OK",
    });
  });
});
