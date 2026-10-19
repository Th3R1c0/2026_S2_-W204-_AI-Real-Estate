import { describe, expect, it } from "vitest";
import { parseOneRoofRichHtml } from "../lib/oneroof-parser";

const sampleOneRoofHtml = `
<!DOCTYPE html>
<html>
<body>
<script>self.__next_f.push([1,"44:T180,\\u003cp\\u003eOn the market for the first time in 24 years, and ready for its next chapter.\\r\\u003c/p\\u003e\\u003cp\\u003e\\r\\u003c/p\\u003e\\u003cp\\u003eVacant and ready: move straight in, or add a little TLC and build value from day one.\\r\\u003c/p\\u003e\\u003cp\\u003eMinutes to Sylvia Park Shopping Centre.\\u003c/p\\u003e45:[]\\n"])</script>
<script>self.__next_f.push([1,"54:{\\"label\\":\\"Property Type\\",\\"value\\":\\"House\\",\\"alias\\":\\"propertyType\\"}\\n56:{\\"label\\":\\"Floor Area\\",\\"value\\":\\"100m\\\\u0026sup2;\\",\\"alias\\":\\"floorarea\\"}\\n57:{\\"label\\":\\"Decade Built\\",\\"value\\":\\"1960s\\",\\"alias\\":\\"age\\"}\\n58:{\\"label\\":\\"Title\\",\\"value\\":\\"Cross-Lease\\",\\"alias\\":\\"tt\\"}\\n59:{\\"label\\":\\"Title Number\\",\\"value\\":\\"NA26A/18\\",\\"alias\\":\\"title\\"}\\n5a:{\\"label\\":\\"Contour\\",\\"value\\":\\"Level\\",\\"alias\\":\\"cont\\"}\\n5c:{\\"label\\":\\"Construction\\",\\"value\\":\\"External Walls: Brick\\\\nRoof: Tiles\\",\\"alias\\":\\"cons\\"}\\n60:{\\"label\\":\\"Legal Description\\",\\"value\\":\\"FLAT 1 DP 55081, LOT 77 DP 15897 1214M2\\",\\"alias\\":\\"ld\\"}\\n61:{\\"label\\":\\"Unitary Plan\\",\\"value\\":\\"Zone 18 Residential - Mixed Housing Suburban Zone\\",\\"alias\\":\\"unitary\\"}\\n53:[\\"$54\\",\\"$56\\",\\"$57\\",\\"$58\\",\\"$59\\",\\"$5a\\",\\"$5c\\",\\"$60\\",\\"$61\\"]\\n52:{\\"updateAt\\":1738035220,\\"valuationAt\\":1714478400,\\"landValue\\":\\"$$560,000\\",\\"improvementValue\\":\\"$$240,000\\",\\"rateableValue\\":\\"$$800,000\\",\\"lastValuationAt\\":1622462400,\\"landValueChange\\":\\"-15\\",\\"improvementValueChange\\":\\"9\\",\\"rateableValueChange\\":\\"-9\\",\\"data\\":\\"$53\\"}\\n62:{\\"avm\\":\\"$$735,000\\",\\"high\\":\\"$$820,000\\",\\"low\\":\\"$$650,000\\",\\"rv\\":\\"$$800,000\\",\\"rvTime\\":1714478400,\\"confidence\\":4,\\"showAvm\\":true,\\"confidenceScore\\":\\"High\\"}\\n28:{\\"propertyId\\":166145,\\"houseId\\":2536943,\\"uid\\":\\"oeScH\\",\\"teaser\\":\\"SHE NEEDS A BIT OF TLC\\",\\"description\\":\\"$44\\",\\"publicRecords\\":\\"$52\\",\\"avm\\":\\"$62\\",\\"rv\\":\\"$$800,000\\",\\"rvTime\\":1714478400,\\"buildingAge\\":\\"1960\\"}\\n"])</script>
<script>self.__next_f.push([1,"6c:[\\"$\\",\\"$L89\\",null,{\\"data\\":\\"$28\\",\\"overTime\\":{\\"avm\\":[{\\"date\\":\\"20260801\\",\\"month\\":202608,\\"avm\\":740000},{\\"date\\":\\"20260901\\",\\"month\\":202609,\\"avm\\":735000},{\\"date\\":\\"20261001\\",\\"month\\":202610,\\"avm\\":735000}],\\"median\\":[{\\"date\\":\\"20260801\\",\\"month\\":202608,\\"suburbMedianAvm\\":840000},{\\"date\\":\\"20260901\\",\\"month\\":202609,\\"suburbMedianAvm\\":850000},{\\"date\\":\\"20261001\\",\\"month\\":202610,\\"suburbMedianAvm\\":850000}]},\\"histories\\":[{\\"type\\":\\"list\\",\\"label\\":\\"Listed for sale\\",\\"labelTime\\":1790766000,\\"labelValue\\":\\"\\",\\"labelExtra\\":\\"Property listed\\"},{\\"type\\":\\"cv\\",\\"label\\":\\"RV reassessment: $800,000\\",\\"labelTime\\":1714478400,\\"labelValue\\":\\"$$800,000\\",\\"labelExtra\\":\\"RV reassessment\\"},{\\"type\\":\\"cv\\",\\"label\\":\\"RV reassessment: $880,000\\",\\"labelTime\\":1622462400,\\"labelValue\\":\\"$$880,000\\",\\"labelExtra\\":\\"RV reassessment\\"},{\\"type\\":\\"sale\\",\\"label\\":\\"Property sold: $155,000\\",\\"labelTime\\":1020168000,\\"labelValue\\":\\"$$155,000\\",\\"labelExtra\\":\\"Verified by city council\\",\\"saleTypeDes\\":\\"Whole - Freehold market level sale.\\"},{\\"type\\":\\"build\\",\\"label\\":\\"Home built\\",\\"labelTime\\":-315662400,\\"labelValue\\":1960,\\"labelExtra\\":\\"\\"}]}]\\n"])</script>
</body>
</html>
`;

describe("parseOneRoofRichHtml", () => {
  it("extracts full multi-paragraph description without HTML tags", () => {
    const parsed = parseOneRoofRichHtml(sampleOneRoofHtml);
    expect(parsed.teaser).toBe("SHE NEEDS A BIT OF TLC");
    expect(parsed.description).toContain(
      "On the market for the first time in 24 years, and ready for its next chapter.",
    );
    expect(parsed.description).toContain(
      "Vacant and ready: move straight in, or add a little TLC and build value from day one.",
    );
    expect(parsed.description).toContain("Minutes to Sylvia Park Shopping Centre.");
    expect(parsed.description).not.toContain("<p>");
  });

  it("extracts OneRoof AVM estimate with low/high range and public record valuation split", () => {
    const parsed = parseOneRoofRichHtml(sampleOneRoofHtml);
    expect(parsed.avm).toEqual({
      median: 735000,
      low: 650000,
      high: 820000,
      confidence: "High",
    });
    expect(parsed.publicRecords).toMatchObject({
      capitalValue: 800000,
      landValue: 560000,
      improvementValue: 240000,
      rateableValueChange: -9,
      ownershipType: "Cross-Lease",
      titleNumber: "NA26A/18",
      contour: "Level",
      construction: "External Walls: Brick · Roof: Tiles",
      legalDescription: "FLAT 1 DP 55081, LOT 77 DP 15897 1214M2",
      unitaryPlanZone: "Zone 18 Residential - Mixed Housing Suburban Zone",
      yearBuilt: 1960,
    });
  });

  it("extracts valuation history (OneRoof Estimate + Council RV reassessments) and monthly AVM series", () => {
    const parsed = parseOneRoofRichHtml(sampleOneRoofHtml);
    expect(parsed.valuationHistory.length).toBeGreaterThanOrEqual(3);
    expect(parsed.valuationHistory[0]).toMatchObject({
      source: "OneRoof Estimate",
      value: 735000,
      lowEstimate: 650000,
      medianEstimate: 735000,
      highEstimate: 820000,
      kind: "avm",
    });
    const rv2024 = parsed.valuationHistory.find(
      (v) => v.source === "Council RV" && v.value === 800000,
    );
    expect(rv2024).toMatchObject({
      value: 800000,
      capitalValue: 800000,
      landValue: 560000,
      improvementValue: 240000,
      kind: "rv",
    });
    expect(parsed.avmHistory).toEqual([
      { date: "2026-08-01", value: 740000, suburbMedian: 840000 },
      { date: "2026-09-01", value: 735000, suburbMedian: 850000 },
      { date: "2026-10-01", value: 735000, suburbMedian: 850000 },
    ]);
  });

  it("extracts verified past sales and full property timeline events from Property history", () => {
    const parsed = parseOneRoofRichHtml(sampleOneRoofHtml);
    expect(parsed.pastSales).toEqual([
      {
        date: "2002-04-30",
        price: 155000,
        source: "Council Verified (OneRoof)",
        saleType: "Whole - Freehold market level sale.",
      },
    ]);
    expect(parsed.propertyHistory.map((e) => e.type)).toEqual([
      "list",
      "cv",
      "cv",
      "sale",
      "build",
    ]);
  });
});
