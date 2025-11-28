import { fetchStatic, type AframeServer } from "@aklinker1/aframe/server";
import {} from "oxlint";

console.log("process.env.EXAMPLE:", process.env.EXAMPLE);

const _fetchStatic = fetchStatic();

const server: AframeServer = {
  listen(port) {
    Bun.serve({
      fetch: (request) => {
        const url = new URL(request.url);
        if (url.pathname === "/api") return Response.json({ status: "UP" });
        return _fetchStatic(request);
      },
      port,
    });
  },
};

export default server;
