import { Router } from "express";
import {
  nextId,
  serializeDocument,
  transactions,
  users,
  withTransaction,
  withdrawals,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  AdminListWithdrawalsQueryParams,
  ProcessWithdrawalBody,
  ProcessWithdrawalParams,
  RequestWithdrawalBody,
} from "@workspace/api-zod";

const router = Router();

router.post("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clerkUserId = (req as any).clerkUserId as string;
  const user = await users.collection.findOne({ clerkId: clerkUserId });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { amount, method, accountNumber } = parsed.data;
  const result = await withTransaction(async (session) => {
    const debited = await users.collection.updateOne(
      { id: user.id, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { session },
    );
    if (debited.matchedCount !== 1) return null;

    const withdrawal = {
      id: await nextId("withdrawals", session),
      userId: user.id,
      amount,
      method,
      accountNumber,
      status: "pending",
      adminNote: null,
      requestedAt: new Date(),
    };
    await withdrawals.collection.insertOne(withdrawal, { session });
    return withdrawal;
  });

  if (!result) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  res.status(201).json({
    ...result,
    requestedAt: result.requestedAt.toISOString(),
  });
});

router.get("/admin/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  const adminUser = await users.collection.findOne({ clerkId: clerkUserId });
  if (!adminUser?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const parsed = AdminListWithdrawalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const rows = await withdrawals.collection
    .find(filter)
    .sort({ requestedAt: -1 })
    .toArray();
  const userIds = [...new Set(rows.map((withdrawal) => withdrawal.userId))];
  const userRows = await users.collection
    .find({ id: { $in: userIds } })
    .project({ id: 1, username: 1, email: 1, phone: 1 })
    .toArray();
  const userById = new Map(userRows.map((user) => [user.id, user]));

  res.json(rows.map((withdrawal) => ({
    ...serializeDocument(withdrawal),
    username: userById.get(withdrawal.userId)?.username ?? null,
    email: userById.get(withdrawal.userId)?.email ?? null,
    phone: userById.get(withdrawal.userId)?.phone ?? null,
    requestedAt: withdrawal.requestedAt.toISOString(),
  })));
});

router.patch("/admin/withdrawals/:id/process", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  const adminUser = await users.collection.findOne({ clerkId: clerkUserId });
  if (!adminUser?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const params = ProcessWithdrawalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ProcessWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await withTransaction(async (session) => {
    const withdrawal = await withdrawals.collection.findOneAndUpdate(
      { id: params.data.id, status: "pending" },
      {
        $set: {
          status: parsed.data.action === "approve" ? "completed" : "rejected",
          adminNote: parsed.data.adminNote ?? null,
        },
      },
      { returnDocument: "after", session },
    );
    if (!withdrawal) {
      const existing = await withdrawals.collection.findOne(
        { id: params.data.id },
        { session },
      );
      return {
        ok: false as const,
        status: existing ? 400 : 404,
        error: existing ? "Withdrawal already processed" : "Withdrawal not found",
      };
    }

    if (parsed.data.action === "reject") {
      const refunded = await users.collection.updateOne(
        { id: withdrawal.userId },
        { $inc: { walletBalance: withdrawal.amount } },
        { session },
      );
      if (refunded.matchedCount !== 1) {
        throw new Error(`Withdrawal ${withdrawal.id} references missing user ${withdrawal.userId}.`);
      }
    } else {
      await transactions.collection.insertOne({
        id: await nextId("transactions", session),
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        type: "withdrawal",
        reference: String(withdrawal.id),
        description: `Withdrawal to ${withdrawal.method} (${withdrawal.accountNumber})`,
        createdAt: new Date(),
      }, { session });
    }

    return { ok: true as const, withdrawal };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    ...serializeDocument(result.withdrawal),
    requestedAt: result.withdrawal.requestedAt.toISOString(),
  });
});

export default router;
