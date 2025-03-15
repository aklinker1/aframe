import { isPrerendering } from "../../src/client/app";

document.body.innerHTML = "";

const p = document.createElement("p");
p.textContent = "Hello world! Pre-rendered:" + isPrerendering();
document.body.append(p);

console.log("import.meta.env.APP_EXAMPLE:", import.meta.env.APP_EXAMPLE);
