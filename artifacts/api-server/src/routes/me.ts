import { Router } from "express";
import {
  registrations,
  serializeDocument,
  tournaments,
  transactions,
  users,
  withdrawals,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  GetMyRegistrationsResponse,
  GetMyTransactionsResponse,
  GetMyWithdrawalsResponse,
} from "@workspace/api-zod";

const router = Router();

async function findUser(clerkUserId: string) {
  return users.collection.findOne({ clerkId: clerkUserId });
}

router.get("/users/me/registrations", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userRegistrations = await registrations.collection
    .find({ userId: user.id })
    .sort({ registeredAt: -1 })
    .toArray();
  const tournamentIds = [...new Set(userRegistrations.map((registration) => registration.tournamentId))];
  const tournamentRows = await tournaments.collection.find({ id: { $in: tournamentIds } }).toArray();
  const tournamentById = new Map(tournamentRows.map((tournament) => [tournament.id, tournament]));

  const enriched = userRegistrations.map((registration) => {
    const tournament = tournamentById.get(registration.tournamentId);
    return {
      id: registration.id,
      tournamentId: registration.tournamentId,
      teamName: registration.teamName,
      registeredAt: registration.registeredAt.toISOString(),
      tournament: tournament
        ? {
            ...serializeDocument(tournament),
            registeredCount: 0,
            estimatedPrizePool: 0,
            finalInformation:
              tournament.status === "registration_closed" || tournament.status === "ongoing"
                ? tournament.finalInformation
                : null,
            registrationDeadline: tournament.registrationDeadline.toISOString(),
            createdAt: tournament.createdAt.toISOString(),
          }
        : null,
    };
  });

  res.json(GetMyRegistrationsResponse.parse(enriched));
});

router.get("/users/me/transactions", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userTransactions = await transactions.collection
    .find({ userId: user.id })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(GetMyTransactionsResponse.parse(
    userTransactions.map((transaction) => ({
      ...serializeDocument(transaction),
      createdAt: transaction.createdAt.toISOString(),
    })),
  ));
});

router.get("/users/me/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const user = await findUser((req as any).clerkUserId as string);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userWithdrawals = await withdrawals.collection
    .find({ userId: user.id })
    .sort({ requestedAt: -1 })
    .toArray();
  res.json(GetMyWithdrawalsResponse.parse(
    userWithdrawals.map((withdrawal) => ({
      ...serializeDocument(withdrawal),
      requestedAt: withdrawal.requestedAt.toISOString(),
    })),
  ));
});

export default router;
