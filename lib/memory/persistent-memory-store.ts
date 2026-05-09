import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { MemoryRecord } from "@/lib/types";
import { retrieveMemoryIndexFromZeroGStorage } from "@/lib/storage/zero-g-memory-retrieval";

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

  try {
    const raw = await fs.readFile(getLatestMemoryIndexFile(), "utf-8");
    const trimmed = raw.trim();

    return trimmed.startsWith("0g://") ? trimmed : null;
  } catch {
    return null;
  }
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
  const [localMemories, zeroGMemories] = await Promise.all([readLocalPersistentMemories(), readZeroGMemoryIndex()]);

  return deduplicateMemories([...zeroGMemories, ...localMemories]).slice(0, 50);
}

export async function writePersistentMemories(memories: MemoryRecord[]): Promise<void> {
  try {
    await ensureMemoryFileExists();

    const memoryFile = getMemoryFile();
    const sortedMemories = deduplicateMemories(memories).slice(0, 50);

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
  const nextMemories = deduplicateMemories([memory, ...existingMemories]).slice(0, 50);

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