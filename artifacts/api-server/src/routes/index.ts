import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import storageRouter from "./storage";
import statusesRouter, { seedDefaultStatuses } from "./statuses";
import attachmentsRouter from "./attachments";
import subtasksRouter from "./subtasks";
import relationsRouter from "./relations";
import notificationsRouter from "./notifications";
import pushRouter from "./push";

const router: IRouter = Router();

// Seed default statuses if none exist
seedDefaultStatuses().catch((err) => {
  console.error("Failed to seed default statuses:", err);
});

router.use(healthRouter);
router.use(tasksRouter);
router.use(storageRouter);
router.use(statusesRouter);
router.use(attachmentsRouter);
router.use("/tasks/:id/subtasks", subtasksRouter);
router.use("/tasks/:id/relations", relationsRouter);
router.use(notificationsRouter);
router.use(pushRouter);

export default router;
