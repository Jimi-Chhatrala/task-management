import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import storageRouter from "./storage";
import statusesRouter, { seedDefaultStatuses } from "./statuses";

const router: IRouter = Router();

// Seed default statuses if none exist
seedDefaultStatuses().catch((err) => {
  console.error("Failed to seed default statuses:", err);
});

router.use(healthRouter);
router.use(tasksRouter);
router.use(storageRouter);
router.use(statusesRouter);

export default router;
