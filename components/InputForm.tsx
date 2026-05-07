"use client";

import { FormEvent, useState } from "react";

type InputFormProps = {
  isLoading: boolean;
  onSubmit: (task: string) => Promise<void>;
};

const defaultTask =
  "Analyze this Web3 AI protocol idea: an autonomous DeFi agent manages user funds across multiple yield protocols, uses LLM reasoning to rebalance positions, and optimizes APY while storing decisions in decentralized infrastructure.";

export function InputForm({ isLoading, onSubmit }: InputFormProps) {
  const [task, setTask] = useState(defaultTask);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTask = task.trim();

    if (trimmedTask.length < 10) {
      setError("Describe the project in at least 10 characters.");
      return;
    }

    setError(null);
    await onSubmit(trimmedTask);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur"
    >
      <div className="mb-4">
        <label
          htmlFor="task"
          className="block text-sm font-medium text-zinc-200"
        >
          Project or idea to analyze
        </label>
        <p className="mt-1 text-sm text-zinc-400">
          Describe a Web3/AI idea, protocol, product, or agent system.
        </p>
      </div>

      <textarea
        id="task"
        value={task}
        onChange={(event) => setTask(event.target.value)}
        rows={7}
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-100 outline-none ring-0 transition placeholder:text-zinc-600 focus:border-cyan-400"
      />

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          Live 0G testnet pipeline with compute, storage, memory, and retrieval.
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Running agents..." : "Run Analysis"}
        </button>
      </div>
    </form>
  );
}