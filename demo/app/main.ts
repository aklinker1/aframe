document.body.innerHTML = "";

const p = document.createElement("p");
p.textContent = "Hello world!";
document.body.append(p);

console.log("import.meta.env.VITE_EXAMPLE:", import.meta.env.VITE_EXAMPLE);
