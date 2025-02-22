// This import is resolved by a Bun plugin pointing to your project's `server/main.ts` file.
import server from "aframe:server-main";

const port = Number(process.env.PORT) || 3000;
console.log(`Server running @ http://localhost:${port}`);
server.listen(port);
