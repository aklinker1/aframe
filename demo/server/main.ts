import { fetchStatic, type AframeServer } from "../../src/server";

export const server: AframeServer = {
  listen(port) {
    Bun.serve({
      fetch: (request) => {
        const url = new URL(request.url);
        if (url.pathname === "/api") return Response.json({ status: "UP 2" });
        return fetchStatic(request);
      },
      port,
    });
  },
};
