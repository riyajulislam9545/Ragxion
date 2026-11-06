import {
  Collection,
  MongoClient,
  type ClientSession,
  type Db,
  type Document,
} from "mongodb";

export interface User extends Document {
  id: number;
  clerkId: string;
  arenaId: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  inGameName: string | null;
  walletBalance: number;
  isAdmin: boolean;
  createdAt: Date;
}

export interface Tournament extends Document {
  id: number;
  gameName: string;
  teamSize: string;
  maxSlots: number;
  entryFee: number;
  basePrize1st: number;
  basePrize2nd: number;
  basePrize3rd: number;
  finalPrize1st: number | null;
  finalPrize2nd: number | null;
  finalPrize3rd: number | null;
  prizePercent1st: number;
  prizePercent2nd: number;
  prizePercent3rd: number;
  registrationDeadline: Date;
  status: string;
  rules: string | null;
  imageUrl: string | null;
  finalInformation: string | null;
  winner1stId: number | null;
  winner2ndId: number | null;
  winner3rdId: number | null;
  createdAt: Date;
}

export interface Registration extends Document {
  id: number;
  tournamentId: number;
  userId: number;
  teamName: string;
  isWinner: boolean;
  prizeWon: number | null;
  registeredAt: Date;
}

export interface Transaction extends Document {
  id: number;
  userId: number;
  amount: number;
  type: string;
  reference: string | null;
  description: string | null;
  createdAt: Date;
}

export interface Withdrawal extends Document {
  id: number;
  userId: number;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  adminNote: string | null;
  requestedAt: Date;
}

export interface DepositRequest extends Document {
  id: number;
  userId: number;
  amount: number;
  method: string;
  transactionId: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
}

export interface Counter extends Document {
  _id: string;
  value: number;
}

let client: MongoClient | undefined;
let database: Db | undefined;

export function getMongoDatabase(): Db {
  if (!database) {
    throw new Error("MongoDB has not been connected. Call connectDatabase() first.");
  }
  return database;
}

function collection<T extends Document>(name: string): Collection<T> {
  return getMongoDatabase().collection<T>(name);
}

export const users = {
  get collection() {
    return collection<User>("users");
  },
};

export const tournaments = {
  get collection() {
    return collection<Tournament>("tournaments");
  },
};

export const registrations = {
  get collection() {
    return collection<Registration>("registrations");
  },
};

export const transactions = {
  get collection() {
    return collection<Transaction>("transactions");
  },
};

export const withdrawals = {
  get collection() {
    return collection<Withdrawal>("withdrawals");
  },
};

export const depositRequests = {
  get collection() {
    return collection<DepositRequest>("depositRequests");
  },
};

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI must be set to connect to MongoDB Atlas.");
  }

  if (!client) {
    client = new MongoClient(uri, {
      appName: "ragxion-platform",
      serverSelectionTimeoutMS: 10_000,
    });
    await client.connect();
    database = client.db(process.env.MONGODB_DB_NAME || "ragxion");
  }

  await Promise.all([
    users.collection.createIndex({ id: 1 }, { unique: true }),
    users.collection.createIndex({ clerkId: 1 }, { unique: true }),
    users.collection.createIndex(
      { arenaId: 1 },
      {
        unique: true,
        partialFilterExpression: { arenaId: { $type: "string" } },
      },
    ),
    users.collection.createIndex({ email: 1 }),
    tournaments.collection.createIndex({ id: 1 }, { unique: true }),
    tournaments.collection.createIndex({ status: 1, registrationDeadline: 1 }),
    registrations.collection.createIndex({ id: 1 }, { unique: true }),
    registrations.collection.createIndex(
      { tournamentId: 1, userId: 1 },
      { unique: true },
    ),
    registrations.collection.createIndex({ userId: 1, registeredAt: -1 }),
    transactions.collection.createIndex({ id: 1 }, { unique: true }),
    transactions.collection.createIndex({ userId: 1, createdAt: -1 }),
    withdrawals.collection.createIndex({ id: 1 }, { unique: true }),
    withdrawals.collection.createIndex({ userId: 1, requestedAt: -1 }),
    withdrawals.collection.createIndex({ status: 1, requestedAt: -1 }),
    depositRequests.collection.createIndex({ id: 1 }, { unique: true }),
    depositRequests.collection.createIndex({ userId: 1, createdAt: -1 }),
    depositRequests.collection.createIndex({ status: 1, createdAt: -1 }),
  ]);
}

export async function withTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  if (!client) {
    throw new Error("MongoDB has not been connected. Call connectDatabase() first.");
  }

  const session = client.startSession();
  try {
    return await session.withTransaction(() => operation(session));
  } finally {
    await session.endSession();
  }
}

export async function nextId(
  name: string,
  session?: ClientSession,
): Promise<number> {
  const counters = getMongoDatabase().collection<Counter>("counters");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await counters.findOneAndUpdate(
        { _id: name },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after", session },
      );
      if (!result) {
        throw new Error(`Could not allocate an ID for ${name}.`);
      }
      return result.value;
    } catch (error) {
      if (
        session ||
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== 11000 ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error(`Could not allocate an ID for ${name}.`);
}

export async function closeDatabase(): Promise<void> {
  if (!client) return;
  await client.close();
  client = undefined;
  database = undefined;
}

export function serializeDocument<T>(document: T): Omit<T, "_id"> {
  const mongoDocument = document as T & { _id?: unknown };
  const { _id: _documentId, ...result } = mongoDocument;
  return result;
}
