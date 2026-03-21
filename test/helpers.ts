import type { RuntimeDependencies } from "../src/types/cli.js";

export interface MockResponseDefinition {
  assertUrl?: (url: URL) => void;
  body?: unknown;
  status?: number;
}

type FetchInput = Parameters<typeof fetch>[0];

const toUrl = (input: FetchInput): URL => {
  if (input instanceof Request) {
    return new URL(input.url);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(String(input));
};

export const createQueuedFetch = (
  responses: MockResponseDefinition[]
): typeof fetch => {
  const queue = [...responses];

  return (input) => {
    const nextResponse = queue.shift();

    if (!nextResponse) {
      throw new Error(`Unexpected request: ${toUrl(input).toString()}`);
    }

    const url = toUrl(input);

    nextResponse.assertUrl?.(url);

    return Promise.resolve(
      new Response(
        nextResponse.body === undefined ? null : JSON.stringify(nextResponse.body),
        {
          headers: {
            "content-type": "application/json"
          },
          status: nextResponse.status ?? 200
        }
      )
    );
  };
};

export interface CapturedIo {
  stderr: string;
  stdout: string;
}

export const createTestRuntimeDependencies = (
  fetchImplementation: typeof fetch,
  io: CapturedIo,
  overrides?: Partial<Pick<RuntimeDependencies, "cwd" | "env">>
): RuntimeDependencies => ({
  cwd: overrides?.cwd ?? process.cwd(),
  env: overrides?.env ?? {
    COMPANIES_HOUSE_API_KEY: "test-api-key"
  },
  fetchImplementation,
  writeStderr: (text) => {
    io.stderr += text;
  },
  writeStdout: (text) => {
    io.stdout += text;
  }
});
