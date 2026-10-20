import { expect, it } from "vitest";
import { interpretPropertyQueryWithJev } from "../lib/jev-search";
import { filterProperties } from "../lib/property-engine";
import { complexSearches, evaluationHome } from "./fixtures/complex-searches";
import responses from "./fixtures/jev-responses.json";

it.each(
  complexSearches.map((test, index) => ({
    ...test,
    response: responses[index],
  })),
)(
  "compiles and applies every constraint: $query",
  async ({ query, expected, home: overrides, response }) => {
    // Replay a real Jev response. Only the external network boundary is replaced.
    const home = { ...evaluationHome, ...overrides };
    const result = await interpretPropertyQueryWithJev(query, [home], {
      apiKey: "replay-key",
      fetchImpl: async () => Response.json(response),
    });
    expect(result.status).toBe("ready");
    expect(result.filters).toEqual(expected);
    expect(filterProperties([home], result.filters).map((p) => p.id)).toEqual([
      "evaluation-house",
    ]);
    // A superficially similar property must fail when each requested numeric condition is violated.
    for (const [field, range] of Object.entries(
      expected.numericCriteria ?? {},
    )) {
      const wrong = range.min !== undefined ? range.min - 1 : range.max! + 1;
      expect(
        filterProperties([{ ...home, [field]: wrong }], result.filters),
      ).toEqual([]);
    }
    if (expected.maxPrice)
      expect(
        filterProperties(
          [{ ...home, price: expected.maxPrice + 1 }],
          result.filters,
        ),
      ).toEqual([]);
    if (expected.yearBuiltFrom)
      expect(
        filterProperties(
          [{ ...home, yearBuilt: expected.yearBuiltFrom - 1 }],
          result.filters,
        ),
      ).toEqual([]);
    if (expected.yearBuiltTo)
      expect(
        filterProperties(
          [{ ...home, yearBuilt: expected.yearBuiltTo + 1 }],
          result.filters,
        ),
      ).toEqual([]);
    if (expected.schoolId)
      expect(
        filterProperties(
          [{ ...home, schoolZones: [], nearbySchools: [] }],
          result.filters,
        ),
      ).toEqual([]);
    if (expected.hasOpenHome)
      expect(
        filterProperties([{ ...home, openHomes: [] }], result.filters),
      ).toEqual([]);
  },
);
