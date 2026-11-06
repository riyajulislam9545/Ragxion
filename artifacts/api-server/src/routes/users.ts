import { Router } from "express";
import {
  depositRequests,
  nextId,
  registrations,
  serializeDocument,
  tournaments,
  transactions,
  users,
  withTransaction,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  GetDashboardResponse,
  GetMeResponse,
  GetMyDepositsResponse,
  SubmitDepositRequestBody,
  UpsertMeBody,
  UpsertMeResponse,
} from "@workspace/api-zod";

const router = Router();

async function findUser(clerkUserId: string) {
  return users.collection.findOne({ clerkId: clerkUserId });
}

async function allocateArenaId(session?: Parameters<typeof nextId>[1]) {
  return `ARX${await nextId("arenaIds", session) + 1000}`;
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetMeResponse.parse({
    ...serializeDocument(user),
    createdAt: user.createdAt.toISOString(),
  }));
});

router.put("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  const parsed = UpsertMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;
  const user = await withTransaction(async (session) => {
    const existing = await users.collection.findOne({ clerkId: clerkUserId }, { session });
    if (existing) {
      const updates = Object.fromEntries(
        Object.entries(parsed.data).filter(([, value]) => value !== undefined),
      );
      if (!existing.arenaId) {
        Object.assign(updates, { arenaId: await allocateArenaId(session) });
      }
      const updated = await users.collection.findOneAndUpdate(
        { id: existing.id },
        { $set: updates },
        { returnDocument: "after", session },
      );
      if (!updated) throw new Error(`Could not update user ${existing.id}.`);
      return updated;
    }

    const legacyMatches = email
      ? await users.collection.find({
          email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        }, { session }).toArray()
      : [];

    if (legacyMatches.length === 1) {
      const legacy = legacyMatches[0];
      const updated = await users.collection.findOneAndUpdate(
        { id: legacy.id },
        {
          $set: {
            clerkId: clerkUserId,
            ...Object.fromEntries(
              Object.entries(parsed.data).filter(([, value]) => value !== undefined),
            ),
            username: legacy.username ?? parsed.data.username ?? null,
            email: email ?? legacy.email,
            arenaId: legacy.arenaId ?? await allocateArenaId(session),
          },
        },
        { returnDocument: "after", session },
      );
      if (!updated) throw new Error(`Could not claim legacy profile ${legacy.id}.`);
      return updated;
    }

    const newUser = {
      id: await nextId("users", session),
      clerkId: clerkUserId,
      arenaId: await allocateArenaId(session),
      username: parsed.data.username ?? null,
      email,
      phone: parsed.data.phone ?? null,
      inGameName: parsed.data.inGameName ?? null,
      walletBalance: 0,
      isAdmin: false,
      createdAt: new Date(),
    };
    await users.collection.insertOne(newUser, { session });
    return newUser;
  });

  res.json(UpsertMeResponse.parse({
    ...serializeDocument(user),
    createdAt: user.createdAt.toISOString(),
  }));
});

router.post("/users/me/deposit-request", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitDepositRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const deposit = {
    id: await nextId("depositRequests"),
    userId: user.id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    transactionId: parsed.data.transactionId,
    status: "pending",
    adminNote: null,
    createdAt: new Date(),
  };
  await depositRequests.collection.insertOne(deposit);

  res.status(201).json({
    ...deposit,
    createdAt: deposit.createdAt.toISOString(),
  });
});

router.get("/users/me/deposits", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const deposits = await depositRequests.collection
    .find({ userId: user.id })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(GetMyDepositsResponse.parse(
    deposits.map((deposit) => ({
      ...serializeDocument(deposit),
      createdAt: deposit.createdAt.toISOString(),
    })),
  ));
});

router.get("/users/me/dashboard", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [registrationRows, recentTransactions, totalWonRow, totalSpentRow, pendingDeposits] =
    await Promise.all([
      registrationsForUser(user.id),
      transactions.collection.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).toArray(),
      transactions.collection.aggregate([
        { $match: { userId: user.id, type: "prize_won" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).next(),
      transactions.collection.aggregate([
        { $match: { userId: user.id, type: "fee_paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).next(),
      depositRequests.collection.countDocuments({ userId: user.id, status: "pending" }),
    ]);

  const tournamentRows = await tournaments.collection.find({
    id: { $in: registrationRows.map((registration) => registration.tournamentId) },
  }).project({ id: 1, status: 1 }).toArray();
  const tournamentById = new Map(tournamentRows.map((tournament) => [tournament.id, tournament]));
  const activeCount = registrationRows.filter(
    (registration) => tournamentById.get(registration.tournamentId)?.status !== "completed",
  ).length;

  res.json(GetDashboardResponse.parse({
    user: {
      ...serializeDocument(user),
      createdAt: user.createdAt.toISOString(),
    },
    activeRegistrations: activeCount,
    totalWon: totalWonRow?.total ?? 0,
    totalSpent: totalSpentRow?.total ?? 0,
    recentTransactions: recentTransactions.map((transaction) => ({
      ...serializeDocument(transaction),
      createdAt: transaction.createdAt.toISOString(),
    })),
    pendingDeposits,
  }));
});

async function registrationsForUser(userId: number) {
  return registrations.collection.find({ userId }).toArray();
}

export default router;
