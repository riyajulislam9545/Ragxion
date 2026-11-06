import { Router } from "express";
import {
  nextId,
  registrations,
  serializeDocument,
  tournaments,
  transactions,
  users,
  withTransaction,
  type Tournament,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  CreateTournamentBody,
  DeclareWinnersBody,
  DeclareWinnersParams,
  GetTournamentParams,
  GetTournamentRegistrationsParams,
  ListTournamentsQueryParams,
  RegisterForTournamentBody,
  RegisterForTournamentParams,
  UpdateTournamentBody,
  UpdateTournamentParams,
} from "@workspace/api-zod";

const router = Router();

function enrichTournament(tournament: Tournament, registeredCount: number) {
  return {
    ...serializeDocument(tournament),
    finalInformation:
      tournament.status === "registration_closed" || tournament.status === "ongoing"
        ? tournament.finalInformation
        : null,
    registeredCount,
    estimatedPrizePool: registeredCount * tournament.entryFee,
    registrationDeadline: tournament.registrationDeadline.toISOString(),
    createdAt: tournament.createdAt.toISOString(),
  };
}

async function registrationCounts(tournamentIds: number[]) {
  if (tournamentIds.length === 0) return new Map<number, number>();
  const rows = await registrations.collection.aggregate<{ _id: number; count: number }>([
    { $match: { tournamentId: { $in: tournamentIds } } },
    { $group: { _id: "$tournamentId", count: { $sum: 1 } } },
  ]).toArray();
  return new Map(rows.map((row) => [row._id, row.count]));
}

async function findAdmin(clerkUserId: string) {
  return users.collection.findOne({ clerkId: clerkUserId, isAdmin: true });
}

router.get("/tournaments", async (req, res): Promise<void> => {
  const parsed = ListTournamentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const rows = await tournaments.collection.find(filter).sort({ createdAt: -1 }).toArray();
  const counts = await registrationCounts(rows.map((tournament) => tournament.id));
  res.json(rows.map((tournament) => enrichTournament(tournament, counts.get(tournament.id) ?? 0)));
});

router.post("/tournaments", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  if (!await findAdmin(clerkUserId)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const parsed = CreateTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const tournament: Tournament = {
    id: await nextId("tournaments"),
    gameName: data.gameName,
    teamSize: data.teamSize,
    maxSlots: data.maxSlots,
    entryFee: data.entryFee,
    basePrize1st: data.basePrize1st,
    basePrize2nd: data.basePrize2nd,
    basePrize3rd: data.basePrize3rd,
    finalPrize1st: null,
    finalPrize2nd: null,
    finalPrize3rd: null,
    prizePercent1st: data.prizePercent1st,
    prizePercent2nd: data.prizePercent2nd,
    prizePercent3rd: data.prizePercent3rd,
    registrationDeadline: new Date(data.registrationDeadline),
    status: data.status ?? "upcoming",
    rules: data.rules ?? null,
    imageUrl: data.imageUrl ?? null,
    finalInformation: null,
    winner1stId: null,
    winner2ndId: null,
    winner3rdId: null,
    createdAt: new Date(),
  };
  await tournaments.collection.insertOne(tournament);
  res.status(201).json(enrichTournament(tournament, 0));
});

router.get("/tournaments/:id", async (req, res): Promise<void> => {
  const params = GetTournamentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tournament = await tournaments.collection.findOne({ id: params.data.id });
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const tournamentRegistrations = await registrations.collection
    .find({ tournamentId: tournament.id })
    .sort({ registeredAt: 1 })
    .toArray();
  const participantIds = [...new Set(tournamentRegistrations.map((registration) => registration.userId))];
  const participantRows = await users.collection
    .find({ id: { $in: participantIds } })
    .project({ id: 1, username: 1 })
    .toArray();
  const participantById = new Map(participantRows.map((participant) => [participant.id, participant]));

  const clerkUserId = getClerkUserId(req);
  const currentUser = clerkUserId
    ? await users.collection.findOne({ clerkId: clerkUserId })
    : null;
  const myRegistration = currentUser
    ? tournamentRegistrations.find((registration) => registration.userId === currentUser.id)
    : undefined;

  res.json({
    tournament: enrichTournament(tournament, tournamentRegistrations.length),
    registrations: tournamentRegistrations.map((registration) => ({
      id: registration.id,
      tournamentId: registration.tournamentId,
      userId: registration.userId,
      teamName: registration.teamName,
      username: participantById.get(registration.userId)?.username ?? null,
      isWinner: registration.isWinner,
      prizeWon: registration.prizeWon,
      registeredAt: registration.registeredAt.toISOString(),
    })),
    myRegistration: myRegistration
      ? {
          ...serializeDocument(myRegistration),
          username: participantById.get(myRegistration.userId)?.username ?? null,
          registeredAt: myRegistration.registeredAt.toISOString(),
        }
      : undefined,
  });
});

router.patch("/tournaments/:id", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  if (!await findAdmin(clerkUserId)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const params = UpdateTournamentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { registrationDeadline, ...fields } = parsed.data;
  const updates: Record<string, unknown> = {
    ...fields,
    ...(registrationDeadline ? { registrationDeadline: new Date(registrationDeadline) } : {}),
  };

  const result = await withTransaction(async (session) => {
    const tournament = await tournaments.collection.findOneAndUpdate(
      { id: params.data.id },
      { $inc: { _registrationLock: 1 } },
      { returnDocument: "after", session },
    );
    if (!tournament) return null;

    if (parsed.data.status === "registration_closed") {
      const registeredCount = await registrations.collection.countDocuments(
        { tournamentId: tournament.id },
        { session },
      );
      const totalFees = registeredCount * tournament.entryFee;
      Object.assign(updates, {
        finalPrize1st: totalFees * (tournament.prizePercent1st / 100),
        finalPrize2nd: totalFees * (tournament.prizePercent2nd / 100),
        finalPrize3rd: totalFees * (tournament.prizePercent3rd / 100),
      });
    }

    return tournaments.collection.findOneAndUpdate(
      { id: tournament.id },
      { $set: updates, $unset: { _registrationLock: "" } },
      { returnDocument: "after", session },
    );
  });

  if (!result) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const registeredCount = await registrations.collection.countDocuments({ tournamentId: result.id });
  res.json(enrichTournament(result, registeredCount));
});

router.post("/tournaments/:id/declare-winners", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  if (!await findAdmin(clerkUserId)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const params = DeclareWinnersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DeclareWinnersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await withTransaction(async (session) => {
    const tournament = await tournaments.collection.findOneAndUpdate(
      { id: params.data.id, status: "completed", winner1stId: null },
      { $inc: { _payoutLock: 1 } },
      { returnDocument: "after", session },
    );
    if (!tournament) {
      const existing = await tournaments.collection.findOne(
        { id: params.data.id },
        { session },
      );
      return {
        ok: false as const,
        status: existing ? 400 : 404,
        error: existing
          ? existing.status !== "completed"
            ? "Set the tournament to completed before declaring winners"
            : "Winners have already been declared"
          : "Tournament not found",
      };
    }

    const winners = [
      { registrationId: parsed.data.winner1stRegistrationId, prize: tournament.finalPrize1st ?? tournament.basePrize1st, place: "1st" },
      { registrationId: parsed.data.winner2ndRegistrationId, prize: tournament.finalPrize2nd ?? tournament.basePrize2nd, place: "2nd" },
      { registrationId: parsed.data.winner3rdRegistrationId, prize: tournament.finalPrize3rd ?? tournament.basePrize3rd, place: "3rd" },
    ].filter((winner) => winner.registrationId != null);
    const ids = winners.map((winner) => winner.registrationId!);
    if (new Set(ids).size !== ids.length) {
      await tournaments.collection.updateOne(
        { id: tournament.id },
        { $unset: { _payoutLock: "" } },
        { session },
      );
      return { ok: false as const, status: 400, error: "A registration can only be assigned to one place" };
    }

    const winnerRegistrations = await registrations.collection.find({
      id: { $in: ids },
      tournamentId: tournament.id,
    }, { session }).toArray();
    if (winnerRegistrations.length !== ids.length) {
      await tournaments.collection.updateOne(
        { id: tournament.id },
        { $unset: { _payoutLock: "" } },
        { session },
      );
      return {
        ok: false as const,
        status: 400,
        error: "Winner registration does not belong to this tournament",
      };
    }

    const registrationById = new Map(
      winnerRegistrations.map((registration) => [registration.id, registration]),
    );
    const winnerUserIds: Array<number | null> = [null, null, null];
    for (const [placeIndex, winner] of [
      { registrationId: parsed.data.winner1stRegistrationId, prize: tournament.finalPrize1st ?? tournament.basePrize1st, place: "1st" },
      { registrationId: parsed.data.winner2ndRegistrationId, prize: tournament.finalPrize2nd ?? tournament.basePrize2nd, place: "2nd" },
      { registrationId: parsed.data.winner3rdRegistrationId, prize: tournament.finalPrize3rd ?? tournament.basePrize3rd, place: "3rd" },
    ].entries()) {
      if (winner.registrationId == null) continue;
      const registration = registrationById.get(winner.registrationId);
      if (!registration) continue;

      await registrations.collection.updateOne(
        { id: registration.id },
        { $set: { isWinner: true, prizeWon: winner.prize } },
        { session },
      );
      const credited = await users.collection.updateOne(
        { id: registration.userId },
        { $inc: { walletBalance: winner.prize } },
        { session },
      );
      if (credited.matchedCount !== 1) {
        throw new Error(`Winner registration ${registration.id} references missing user ${registration.userId}.`);
      }

      await transactions.collection.insertOne({
        id: await nextId("transactions", session),
        userId: registration.userId,
        amount: winner.prize,
        type: "prize_won",
        reference: String(tournament.id),
        description: `Prize for ${winner.place} place in ${tournament.gameName}`,
        createdAt: new Date(),
      }, { session });
      winnerUserIds[placeIndex] = registration.userId;
    }

    const updated = await tournaments.collection.findOneAndUpdate(
      { id: tournament.id },
      {
        $set: {
          status: "completed",
          winner1stId: winnerUserIds[0],
          winner2ndId: winnerUserIds[1],
          winner3rdId: winnerUserIds[2],
        },
        $unset: { _payoutLock: "" },
      },
      { returnDocument: "after", session },
    );
    if (!updated) throw new Error(`Could not finalize tournament ${tournament.id}.`);
    return { ok: true as const, tournament: updated };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const registeredCount = await registrations.collection.countDocuments({
    tournamentId: result.tournament.id,
  });
  res.json(enrichTournament(result.tournament, registeredCount));
});

router.post("/tournaments/:id/register", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).clerkUserId as string;
  const params = RegisterForTournamentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RegisterForTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await users.collection.findOne({ clerkId: clerkUserId });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const result = await withTransaction(async (session) => {
    const now = new Date();
    const tournament = await tournaments.collection.findOneAndUpdate(
      {
        id: params.data.id,
        status: "registration_open",
        registrationDeadline: { $gte: now },
      },
      { $inc: { _registrationLock: 1 } },
      { returnDocument: "after", session },
    );
    if (!tournament) {
      const existing = await tournaments.collection.findOne({ id: params.data.id }, { session });
      return {
        ok: false as const,
        status: existing ? 400 : 404,
        error: !existing
          ? "Tournament not found"
          : existing.status !== "registration_open"
            ? "Tournament is not open for registration"
            : "Registration deadline has passed",
      };
    }

    const duplicate = await registrations.collection.findOne(
      { tournamentId: tournament.id, userId: user.id },
      { session },
    );
    if (duplicate) {
      await tournaments.collection.updateOne(
        { id: tournament.id },
        { $unset: { _registrationLock: "" } },
        { session },
      );
      return { ok: false as const, status: 400, error: "Already registered for this tournament" };
    }

    const registeredCount = await registrations.collection.countDocuments(
      { tournamentId: tournament.id },
      { session },
    );
    if (registeredCount >= tournament.maxSlots) {
      await tournaments.collection.updateOne(
        { id: tournament.id },
        { $unset: { _registrationLock: "" } },
        { session },
      );
      return { ok: false as const, status: 400, error: "Tournament is full" };
    }

    const debited = await users.collection.updateOne(
      { id: user.id, walletBalance: { $gte: tournament.entryFee } },
      { $inc: { walletBalance: -tournament.entryFee } },
      { session },
    );
    if (debited.matchedCount !== 1) {
      await tournaments.collection.updateOne(
        { id: tournament.id },
        { $unset: { _registrationLock: "" } },
        { session },
      );
      return {
        ok: false as const,
        status: 400,
        error: `Insufficient balance. You need ${tournament.entryFee} TK`,
      };
    }

    const registration = {
      id: await nextId("registrations", session),
      tournamentId: tournament.id,
      userId: user.id,
      teamName: parsed.data.teamName,
      isWinner: false,
      prizeWon: null,
      registeredAt: new Date(),
    };
    await registrations.collection.insertOne(registration, { session });
    await transactions.collection.insertOne({
      id: await nextId("transactions", session),
      userId: user.id,
      amount: tournament.entryFee,
      type: "fee_paid",
      reference: String(tournament.id),
      description: `Entry fee for ${tournament.gameName}`,
      createdAt: new Date(),
    }, { session });

    const updated = await tournaments.collection.findOneAndUpdate(
      { id: tournament.id },
      { $unset: { _registrationLock: "" } },
      { returnDocument: "after", session },
    );
    if (!updated) throw new Error(`Could not complete registration for tournament ${tournament.id}.`);
    return { ok: true as const, registration };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(201).json({
    ...result.registration,
    username: user.username,
    isWinner: false,
    prizeWon: null,
    registeredAt: result.registration.registeredAt.toISOString(),
  });
});

router.get("/tournaments/:id/registrations", async (req, res): Promise<void> => {
  const params = GetTournamentRegistrationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await registrations.collection
    .find({ tournamentId: params.data.id })
    .sort({ registeredAt: 1 })
    .toArray();
  const participantIds = [...new Set(rows.map((registration) => registration.userId))];
  const participants = await users.collection
    .find({ id: { $in: participantIds } })
    .project({ id: 1, username: 1 })
    .toArray();
  const usernameById = new Map(participants.map((participant) => [participant.id, participant.username]));

  res.json(rows.map((registration) => ({
    id: registration.id,
    tournamentId: registration.tournamentId,
    userId: registration.userId,
    teamName: registration.teamName,
    username: usernameById.get(registration.userId) ?? null,
    isWinner: registration.isWinner,
    prizeWon: registration.prizeWon,
    registeredAt: registration.registeredAt.toISOString(),
  })));
});

export default router;
