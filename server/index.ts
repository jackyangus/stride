import express from "express";
import { resolve } from "node:path";
import { createApp } from "./app.ts";
const { app, db } = createApp(
  process.env.DB_PATH || "data/stride.sqlite",
  process.env.SEED_DEMO !== "false",
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("Stride API: http://127.0.0.1:" + (process.env.PORT || 3001)),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
