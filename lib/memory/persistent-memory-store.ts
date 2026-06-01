import { promises as fs } from "fs";
import os from "os";
import path from "path";
import Redis from "ioredis";
import { MemoryRecord } from "@/lib/types";
import { retrieveMemoryIndexFromZeroGStorage } from "@/lib/storage/zero-g-memory-retrieval";

const REDIS_MEMORY_RECORDS_KEY = "clawmind:memory:records";
const REDIS_MEMORY_INDEX_URI_KEY = "clawmind:memory:latest-index-uri";
const BOOTSTRAP_MEMORY_INDEX_URI =
  "0g://0x6b856021b2581579576e507ec344dd0d86cdb6f55d7bdbc3e2f3e4ee45e06025?tx=0x1538c1a76c6da1ff64a039ac89223e4a5b64d0e18e6bb3d0c54bcae82ea49535";
const DEFAULT_MEMORY_LIMIT = 200;
const MAX_MEMORY_LIMIT = 1000;

let redisClient: Redis | null = null;
let redisChecked = false;

export function getMemoryLimit(): number {
  const rawLimit = process.env.CLAWMIND_MEMORY_LIMIT;

  if (!rawLimit) {
    return DEFAULT_MEMORY_LIMIT;
  }

  const parsedLimit = Number.parseInt(rawLimit, 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    console.warn(
      `[Memory Store] Invalid CLAWMIND_MEMORY_LIMIT=${rawLimit}; using ${DEFAULT_MEMORY_LIMIT}.`,
    );
    return DEFAULT_MEMORY_LIMIT;
  }

  return Math.min(parsedLimit, MAX_MEMORY_LIMIT);
}

function getRedisUrl(): string {
  return process.env.KV_REDIS_URL || process.env.REDIS_URL || "";
}

async function getRedis(): Promise<Redis | null> {
  if (redisChecked) {
    return redisClient;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    redisChecked = true;
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          return null;
        }

        return Math.min(times * 200, 2000);
      },
    });

    await client.ping();
    redisClient = client;
    redisChecked = true;
    return redisClient;
  } catch (error) {
    console.warn(
      `[Memory Store] Redis unavailable, using file/0G fallback: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    redisChecked = true;
    return null;
  }
}

function getMemoryDir(): string {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    return path.join(os.tmpdir(), "clawmind");
  }

  return path.join(process.cwd(), ".clawmind");
}

function getMemoryFile(): string {
  return path.join(getMemoryDir(), "memories.json");
}

function getLatestMemoryIndexFile(): string {
  return path.join(getMemoryDir(), "latest-memory-index-uri.txt");
}

async function ensureMemoryFileExists(): Promise<void> {
  const memoryDir = getMemoryDir();
  const memoryFile = getMemoryFile();

  await fs.mkdir(memoryDir, { recursive: true });

  try {
    await fs.access(memoryFile);
  } catch {
    await fs.writeFile(memoryFile, JSON.stringify([], null, 2), "utf-8");
  }
}

export async function rememberLatestMemoryIndexUri(storageUri?: string): Promise<void> {
  if (!storageUri || !storageUri.startsWith("0g://")) {
    return;
  }

  const redis = await getRedis();

  if (redis) {
    try {
      await redis.set(REDIS_MEMORY_INDEX_URI_KEY, storageUri);
    } catch (error) {
      console.warn(
        `[Memory Store] Failed to persist latest 0G memory index URI in Redis: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  try {
    await fs.mkdir(getMemoryDir(), { recursive: true });
    await fs.writeFile(getLatestMemoryIndexFile(), storageUri, "utf-8");
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to remember latest 0G memory index URI: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function readLatestMemoryIndexUri(): Promise<string | null> {
  const explicitUri = process.env.ZERO_G_MEMORY_INDEX_URI;

  if (typeof explicitUri === "string" && explicitUri.startsWith("0g://")) {
    return explicitUri;
  }

  const redis = await getRedis();

  if (redis) {
    try {
      const redisUri = await redis.get(REDIS_MEMORY_INDEX_URI_KEY);

      if (typeof redisUri === "string" && redisUri.startsWith("0g://")) {
        return redisUri;
      }
    } catch (error) {
      console.warn(
        `[Memory Store] Failed to read latest 0G memory index URI from Redis: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  try {
    const raw = await fs.readFile(getLatestMemoryIndexFile(), "utf-8");
    const trimmed = raw.trim();

    return trimmed.startsWith("0g://") ? trimmed : null;
  } catch {
    return BOOTSTRAP_MEMORY_INDEX_URI;
  }
}

export async function getLatestMemoryIndexUri(): Promise<string | null> {
  return readLatestMemoryIndexUri();
}

function normalizeMemoryTask(task: string): string {
  return task
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function getMemoryDeduplicationKey(memory: MemoryRecord): string {
  const normalizedTask = normalizeMemoryTask(memory.task);

  if (normalizedTask.length > 0) {
    return `task:${normalizedTask}`;
  }

  if (memory.storageUri && memory.storageUri.trim().length > 0) {
    return `storage:${memory.storageUri.trim()}`;
  }

  return `id:${memory.id}`;
}

function deduplicateMemories(memories: MemoryRecord[]): MemoryRecord[] {
  const newestFirst = [...memories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const seenKeys = new Set<string>();
  const deduplicated: MemoryRecord[] = [];

  for (const memory of newestFirst) {
    const key = getMemoryDeduplicationKey(memory);

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(memory);
    }
  }

  return deduplicated;
}

async function readLocalPersistentMemories(): Promise<MemoryRecord[]> {
  try {
    await ensureMemoryFileExists();

    const memoryFile = getMemoryFile();
    const raw = await fs.readFile(memoryFile, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isMemoryRecord);
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to read persistent memories: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );

    return [];
  }
}

async function readRedisPersistentMemories(): Promise<MemoryRecord[]> {
  const redis = await getRedis();

  if (!redis) {
    return [];
  }

  try {
    const raw = await redis.get(REDIS_MEMORY_RECORDS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isMemoryRecord);
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to read Redis memories: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );

    return [];
  }
}

async function readZeroGMemoryIndex(): Promise<MemoryRecord[]> {
  const latestMemoryIndexUri = await readLatestMemoryIndexUri();

  if (latestMemoryIndexUri === null) {
    return [];
  }

  try {
    const result = await retrieveMemoryIndexFromZeroGStorage(latestMemoryIndexUri);
    return result.memories;
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to read 0G memory index: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    return [];
  }
}

export async function readPersistentMemories(): Promise<MemoryRecord[]> {
  const [redisMemories, localMemories, zeroGMemories] = await Promise.all([
    readRedisPersistentMemories(),
    readLocalPersistentMemories(),
    readZeroGMemoryIndex(),
  ]);

  return deduplicateMemories([...redisMemories, ...zeroGMemories, ...localMemories]).slice(0, getMemoryLimit());
}

export async function writePersistentMemories(memories: MemoryRecord[]): Promise<void> {
  const sortedMemories = deduplicateMemories(memories).slice(0, getMemoryLimit());
  const redis = await getRedis();

  if (redis) {
    try {
      await redis.set(REDIS_MEMORY_RECORDS_KEY, JSON.stringify(sortedMemories));
    } catch (error) {
      console.warn(
        `[Memory Store] Failed to write Redis memories: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  try {
    await ensureMemoryFileExists();

    const memoryFile = getMemoryFile();
    await fs.writeFile(memoryFile, JSON.stringify(sortedMemories, null, 2), "utf-8");
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to write persistent memories: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

export async function appendPersistentMemory(memory: MemoryRecord): Promise<MemoryRecord[]> {
  const existingMemories = await readPersistentMemories();
  const nextMemories = deduplicateMemories([memory, ...existingMemories]).slice(0, getMemoryLimit());

  await writePersistentMemories(nextMemories);

  return nextMemories;
}

export async function clearPersistentMemories(): Promise<void> {
  await writePersistentMemories([]);
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<MemoryRecord>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.task === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.risks) &&
    candidate.risks.every((risk) => typeof risk === "string") &&
    typeof candidate.recommendation === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.createdAt === "string"
  );
}
