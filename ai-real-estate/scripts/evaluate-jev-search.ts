import { deepStrictEqual } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { interpretPropertyQueryWithJev } from "../lib/jev-search";
import { filterProperties } from "../lib/property-engine";
import {
  complexSearches,
  evaluationHome,
} from "../tests/fixtures/complex-searches";
import { TypeSafeClient } from "@typesafe-ai/sdk";

async function main() {
  if (!process.env.JEV_API_KEY && !process.env.TYPESAFE_API_KEY)
    throw new Error(
      "Set JEV_API_KEY or TYPESAFE_API_KEY to run the live Jev evaluation.",
    );
  const reports = [];
  const evaluations: unknown[] = [];
  for (const [index, test] of complexSearches.entries()) {
    const start = performance.now();
    const home = { ...evaluationHome, ...test.home };
    let evaluation: unknown;
    const result = await interpretPropertyQueryWithJev(test.query, [home], {
      fetchImpl: async (_url, init) => {
        // Retain the exact production SDK response for diagnosing model errors, without credentials.
        const client = new TypeSafeClient({
          apiKey: process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY,
        });
        evaluation = await client.systemOne(JSON.parse(String(init?.body)));
        return Response.json(evaluation);
      },
    });
    let error: string | undefined;
    try {
      deepStrictEqual(result.source, "jev");
      deepStrictEqual(result.status, "ready");
      deepStrictEqual(result.filters, test.expected);
      deepStrictEqual(
        filterProperties([home], result.filters).map((p) => p.id),
        [home.id],
      );
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    }
    const usage =
      evaluation && typeof evaluation === "object" && "usage" in evaluation
        ? evaluation.usage
        : undefined;
    const report = {
      query: test.query,
      expected: test.expected,
      result,
      usage,
      passed: !error,
      error,
      durationMs: Math.round(performance.now() - start),
    };
    reports.push(report);
    evaluations.push(evaluation);
    console.log(
      `${index + 1}: ${report.passed ? "PASS" : "FAIL"} (${report.durationMs} ms)`,
    );
    if (error) console.log(error);
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/jev-search-evaluation.json",
    JSON.stringify({ evaluatedAt: new Date().toISOString(), reports }, null, 2),
  );
  console.log(
    `${reports.filter((r) => r.passed).length}/${reports.length} live Jev queries passed.`,
  );
  if (reports.some((r) => !r.passed)) process.exitCode = 1;
  else if (process.argv.includes("--record-responses")) {
    await writeFile(
      "tests/fixtures/jev-responses.json",
      JSON.stringify(evaluations, null, 2) + "\n",
    );
  }
}

void main();
