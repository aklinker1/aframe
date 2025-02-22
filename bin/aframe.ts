import { build, createServer, resolveConfig } from "../src/mod";
import { RESET, BOLD, DIM, UNDERLINE, GREEN, CYAN } from "../src/color";
import { createTimer } from "../src/timer";

const [_bun, _aframe, ...args] = Bun.argv;

async function dev(root?: string) {
  const devServerTimer = createTimer();
  console.log(`${BOLD}${CYAN}ℹ${RESET} Spinning up dev servers...${RESET}`);
  const config = await resolveConfig(root, "serve", "development");
  const devServer = await createServer(config);

  await devServer.listen(config.appPort).then(() => {
    const js = [
      `import server from '${config.serverModule}';`,
      `server.listen(${config.serverPort});`,
    ].join("\n");
    Bun.spawn({
      cmd: [
        "bun",
        "--watch",
        "--define",
        `import.meta.publicDir:"${config.publicDir}"`,
        "--define",
        `import.meta.command:"serve"`,
        "--eval",
        js,
      ],
      // stdio: ["ignore", "inherit", "inherit"],
      cwd: config.serverDir,
    });
  });

  console.log(`${GREEN}✔${RESET} Dev servers started in ${devServerTimer()}`);
  console.log(
    `  ${BOLD}${GREEN}→${RESET} ${BOLD}App${RESET}          ${DIM}@${RESET} ${UNDERLINE}http://localhost:${config.appPort}${RESET}`,
  );
  console.log(
    `  ${BOLD}${GREEN}→${RESET} ${BOLD}Server Proxy${RESET} ${DIM}@${RESET} ${UNDERLINE}http://localhost:${config.appPort}/api${RESET}`,
  );
  console.log(
    `  ${BOLD}${GREEN}→${RESET} ${BOLD}Server${RESET}       ${DIM}@${RESET} ${UNDERLINE}http://localhost:${config.serverPort}${RESET}`,
  );
}

async function help() {
  console.log("Help");
}

if (args[0] === "build") {
  const root = args[1];
  const config = await resolveConfig(root, "build", "production");
  await build(config);
} else if (args.includes("--help") || args.includes("-h")) {
  await help();
} else {
  await dev(args[0]);
}
