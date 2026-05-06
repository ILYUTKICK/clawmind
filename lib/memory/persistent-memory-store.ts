import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { MemoryRecord } from "@/lib/types";

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

export async function readPersistentMemories(): Promise<MemoryRecord[]> {
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
      }`
    );

    return [];
  }
}

export async function writePersistentMemories(
  memories: MemoryRecord[]
): Promise<void> {
  try {
    await ensureMemoryFileExists();

    const memoryFile = getMemoryFile();

    const sortedMemories = [...memories].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    await fs.writeFile(
      memoryFile,
      JSON.stringify(sortedMemories, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.warn(
      `[Memory Store] Failed to write persistent memories: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
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