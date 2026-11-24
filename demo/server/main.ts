import {} from "oxlint";
import { fetchApp } from "@aklinker1/aframe/server";

console.log("process.env.EXAMPLE:", process.env.EXAMPLE);

const app = fetchApp();

export default {
  fetch(request: Request) {
    if (new URL(request.url).pathname.startsWith("/api")) {
      return Response.json({ status: "UP" });
    }
    return app(request);
  },
};
