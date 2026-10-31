import("./index.js").catch((error) => {
  console.error("Mehman server.js startup failed");
  console.error(error?.stack || error);
  process.exit(1);
});
