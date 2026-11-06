import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tournamentsRouter from "./tournaments";
import meRouter from "./me";
import withdrawalsRouter from "./withdrawals";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(tournamentsRouter);
router.use(meRouter);
router.use(withdrawalsRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
