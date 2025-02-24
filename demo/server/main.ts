import { fetchStatic, type AframeServer } from "../../src/client/server";

console.log("process.env.EXAMPLE:", process.env.EXAMPLE);

const server: AframeServer = {
  listen(port) {
    Bun.serve({
      fetch: (request) => {
        const url = new URL(request.url);
        if (url.pathname === "/api") return Response.json({ status: "UP" });
        return fetchStatic(request);
      },
      port,
    });
  },
};

export default server;
