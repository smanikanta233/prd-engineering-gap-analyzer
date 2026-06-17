import { Router, type IRouter } from "express";

const router: IRouter = Router();

function healthResponse() {
  return {
    status: "OK",
    message: "PRD Gap Analyzer backend is running!",
    timestamp: new Date().toISOString(),
  };
}

router.get("/healthz", (_req, res) => {
  res.json(healthResponse());
});

router.get("/health", (_req, res) => {
  res.json(healthResponse());
});

export default router;
