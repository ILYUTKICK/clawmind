import { promises as fs } from "fs";
import path from "path";
import { MemoryRecord } from "@/lib/types";

const MEMORY_DIR = path.join(process.cwd(), ".clawmind");
const MEMORY_FILE = path.join(MEMORY_DIR, "memories.json");

async function ensureMemoryFileExists(): Promise<void> {
  await fs.mkdir(MEMORY_DIR, { recursive: true });

  try {
    await fs.access(MEMORY_FILE);
  } catch {
    await fs.writeFile(MEMORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export async function readPersistentMemories(): Promise<MemoryRecord[]> {
  await ensureMemoryFileExists();

  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isMemoryRecord);
  } catch {
    return [];
  }
}

export async function writePersistentMemories(
  memories: MemoryRecord[]
): Promise<void> {
  await ensureMemoryFileExists();

  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  await fs.writeFile(
    MEMORY_FILE,
    JSON.stringify(sortedMemories, null, 2),
    "utf-8"
  );
}

export async function appendPersistentMemory(
  memory: MemoryRecord
): Promise<MemoryRecord[]> {
  const existingMemories = await readPersistentMemories();

  const deduplicatedMemories = existingMemories.filter((item) => {
    return item.id !== memory.id;
  });

  const nextMemories = [memory, ...deduplicatedMemories].slice(0, 50);

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
    typeof candidate.recommendation === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.createdAt === "string"
  );
}