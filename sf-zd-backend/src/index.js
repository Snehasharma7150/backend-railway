/**
 * src/index.js — Express server entry point
 * Run:  npm start   (production)
 *       npm run dev (nodemon watch)
 */

require("dotenv").config();
require("express-async-errors");

const express  = require("express");
const morgan   = require("morgan");

const { requireAppSecret } = require("./middleware/auth");
const casesRouter    = require("./routes/cases");
const webhooksRouter = require("./routes/webhooks");
const healthRouter   = require("./routes/health");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Public
app.use("/health", healthRouter);

// Webhooks — authenticated by Salesforce/Zendesk, not our secret
app.use("/webhooks", webhooksRouter);

// Protected by X-App-Secret (sent by the ZAF sidebar)
app.use("/cases", requireAppSecret, casesRouter);

app.post("/sync/:sfCaseId", requireAppSecret, async (req, res) => {
  const sync = require("./services/sync");
  const { sfCaseId } = req.params;
  await sync.syncCase(sfCaseId);
  const data = await sync.buildCasePayload(sfCaseId);
  res.json({ ok: true, data });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error("[Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log("[Server] Running on http://localhost:" + PORT);
  console.log("[Server] Health: http://localhost:" + PORT + "/health");
});
