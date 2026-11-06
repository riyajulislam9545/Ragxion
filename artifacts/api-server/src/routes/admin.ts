import { Router, type Response } from "express";
import {
  depositRequests,
  nextId,
  serializeDocument,
  tournaments,
  transactions,
  users,
  withTransaction,
  withdrawals,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  AdminApproveDepositResponse,
  AdminListDepositsQueryParams,
  AdminListDepositsResponse,
  AdminListUsersResponse,
  AdminRejectDepositBody,
  AdminRejectDepositResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";

const router = Router();

async function getAdmin(
  clerkUserId: string,
  res: Response,
): Promise<User | null> {
  const user = await users.collection.findOne({ clerkId: clerkUserId });
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return user;
}

router.get("/admin/users", requireAuth, async (req, res): Promise<void> => {
  const admin = await getAdmin((req as any).clerkUserId as string, res);
  if (!admin) return;

  const allUsers = await users.collection.find().sort({ createdAt: 1 }).toArray();
  res.json(AdminListUsersResponse.parse(
    allUsers.map((user) => ({
      ...serializeDocument(user),
      createdAt: user.createdAt.toISOString(),
    })),
  ));
});

router.get("/admin/stats", requireAuth, async (req, res): Promise<void> => {
  const admin = await getAdmin((req as any).clerkUserId as string, res);
  if (!admin) return;

  const [
    totalUsers,
    totalTournaments,
    activeTournaments,
    prizeTotals,
    feeTotals,
    pendingWithdrawalStats,
    pendingDepositStats,
  ] = await Promise.all([
    users.collection.countDocuments(),
    tournaments.collection.countDocuments(),
    tournaments.collection.countDocuments({
      status: { $in: ["registration_open", "registration_closed", "ongoing"] },
    }),
    transactions.collection.aggregate([
      { $match: { type: "prize_won" } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]).next(),
    transactions.collection.aggregate([
      { $match: { type: "fee_paid" } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]).next(),
    withdrawals.collection.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
    ]).next(),
    depositRequests.collection.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
    ]).next(),
  ]);

  res.json(GetAdminStatsResponse.parse({
    totalUsers,
    totalTournaments,
    activeTournaments,
    totalPrizeDistributed: prizeTotals?.sum ?? 0,
    totalFeesCollected: feeTotals?.sum ?? 0,
    pendingWithdrawals: pendingWithdrawalStats?.count ?? 0,
    pendingWithdrawalAmount: pendingWithdrawalStats?.sum ?? 0,
    pendingDeposits: pendingDepositStats?.count ?? 0,
    pendingDepositAmount: pendingDepositStats?.sum ?? 0,
  }));
});

router.get("/admin/deposits", requireAuth, async (req, res): Promise<void> => {
  const admin = await getAdmin((req as any).clerkUserId as string, res);
  if (!admin) return;

  const parsed = AdminListDepositsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const requests = await depositRequests.collection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  const userIds = [...new Set(requests.map((request) => request.userId))];
  const userRows = await users.collection
    .find({ id: { $in: userIds } })
    .project({ id: 1, username: 1, arenaId: 1, phone: 1 })
    .toArray();
  const userById = new Map(userRows.map((user) => [user.id, user]));

  res.json(AdminListDepositsResponse.parse(
    requests.map((request) => {
      const owner = userById.get(request.userId);
      return {
        ...serializeDocument(request),
        createdAt: request.createdAt.toISOString(),
        username: owner?.username ?? null,
        arenaId: owner?.arenaId ?? null,
        phone: owner?.phone ?? null,
      };
    }),
  ));
});

router.post("/admin/deposits/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const admin = await getAdmin((req as any).clerkUserId as string, res);
  if (!admin) return;

  const depositId = Number(req.params.id);
  if (!Number.isSafeInteger(depositId) || depositId < 1) {
    res.status(400).json({ error: "Invalid deposit request ID" });
    return;
  }

  const result = await withTransaction(async (session) => {
    const deposit = await depositRequests.collection.findOneAndUpdate(
      { id: depositId, status: "pending" },
      { $set: { status: "approved" } },
      { returnDocument: "after", session },
    );

    if (!deposit) {
      const existing = await depositRequests.collection.findOne(
        { id: depositId },
        { session },
      );
      return {
        ok: false as const,
        status: existing ? 400 : 404,
        error: existing
          ? `Deposit already ${existing.status}`
          : "Deposit request not found",
      };
    }

    const credited = await users.collection.updateOne(
      { id: deposit.userId },
      { $inc: { walletBalance: deposit.amount } },
      { session },
    );
    if (credited.matchedCount !== 1) {
      throw new Error(`Deposit ${deposit.id} references missing user ${deposit.userId}.`);
    }

    await transactions.collection.insertOne({
      id: await nextId("transactions", session),
      userId: deposit.userId,
      amount: deposit.amount,
      type: "recharge",
      reference: null,
      description: `Deposit approved via ${deposit.method} (TxID: ${deposit.transactionId})`,
      createdAt: new Date(),
    }, { session });

    return { ok: true as const, deposit };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(AdminApproveDepositResponse.parse({
    ...serializeDocument(result.deposit),
    createdAt: result.deposit.createdAt.toISOString(),
  }));
});

router.post("/admin/deposits/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const admin = await getAdmin((req as any).clerkUserId as string, res);
  if (!admin) return;

  const depositId = Number(req.params.id);
  if (!Number.isSafeInteger(depositId) || depositId < 1) {
    res.status(400).json({ error: "Invalid deposit request ID" });
    return;
  }

  const parsed = AdminRejectDepositBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await withTransaction(async (session) => {
    const deposit = await depositRequests.collection.findOneAndUpdate(
      { id: depositId, status: "pending" },
      { $set: { status: "rejected", adminNote: parsed.data.adminNote ?? null } },
      { returnDocument: "after", session },
    );

    if (!deposit) {
      const existing = await depositRequests.collection.findOne(
        { id: depositId },
        { session },
      );
      return {
        ok: false as const,
        status: existing ? 400 : 404,
        error: existing
          ? `Deposit already ${existing.status}`
          : "Deposit request not found",
      };
    }

    return { ok: true as const, deposit };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(AdminRejectDepositResponse.parse({
    ...serializeDocument(result.deposit),
    createdAt: result.deposit.createdAt.toISOString(),
  }));
});

export default router;
