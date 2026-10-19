import type {
  AvmHistoryPoint,
  PastSale,
  PropertyHistoryEvent,
  ValuationRecord,
} from "./property-types";

export type OneRoofParsedResult = {
  teaser?: string;
  description?: string;
  avm?: {
    median: number;
    low?: number;
    high?: number;
    confidence?: string;
  };
  publicRecords: {
    capitalValue?: number;
    landValue?: number;
    improvementValue?: number;
    valuationDate?: string;
    rateableValueChange?: number;
    landArea?: number;
    floorArea?: number;
    yearBuilt?: number;
    ownershipType?: string;
    titleNumber?: string;
    contour?: string;
    construction?: string;
    condition?: string;
    legalDescription?: string;
    estateDescription?: string;
    council?: string;
    unitaryPlanZone?: string;
  };
  valuationHistory: ValuationRecord[];
  avmHistory: AvmHistoryPoint[];
  pastSales: PastSale[];
  propertyHistory: PropertyHistoryEvent[];
};

function parseMoney(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const match = value.match(/([\d,]+(?:\.\d+)?)\s*([KMB])?/i);
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return undefined;
  const unit = match[2]?.toUpperCase();
  const mult =
    unit === "B"
      ? 1_000_000_000
      : unit === "M"
        ? 1_000_000
        : unit === "K"
          ? 1_000
          : 1;
  return Math.round(base * mult);
}

function parseArea(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const match = value.match(/([\d,]+(?:\.\d+)?)\s*(?:m|ha)/i);
  if (!match) return undefined;
  const num = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return /ha/i.test(value) ? Math.round(num * 10_000) : Math.round(num);
}

function unixSecondsToIsoDate(seconds: unknown): string {
  const num = Number(seconds);
  if (!Number.isFinite(num)) return "2026-01-01";
  const date = new Date(num * 1000);
  if (Number.isNaN(date.getTime())) return "2026-01-01";
  return date.toISOString().slice(0, 10);
}

function formatCompactDate(compact: unknown): string {
  const str = String(compact ?? "").trim();
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-01`;
  }
  return "2026-10-01";
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&sup2;/gi, "²");
}

function htmlToCleanParagraphs(rawHtml: string): string {
  const withBreaks = rawHtml
    .replace(/\\r\\n|\\r|\\n/g, "\n")
    .replace(/\r\n|\r/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded = decodeHtmlEntities(withBreaks);
  const paragraphs = decoded
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(
      (p) =>
        p.length > 0 &&
        !/^Disclaimer\s*[-–:]/i.test(p) &&
        !/^\*\*\s*Photos have been virtually staged/i.test(p),
    );
  return paragraphs.join("\n\n").trim();
}

export function parseOneRoofRichHtml(html: string): OneRoofParsedResult {
  // 1. Collect and unescape all Next.js RSC push chunks
  const rscChunks: string[] = [];
  const pushRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let match: RegExpExecArray | null;
  while ((match = pushRegex.exec(html)) !== null) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`);
      if (typeof decoded === "string") {
        rscChunks.push(decoded);
      }
    } catch {
      const fallback = match[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\u003c/gi, "<")
        .replace(/\\u003e/gi, ">")
        .replace(/\\u0026/gi, "&")
        .replace(/\\\\/g, "\\");
      rscChunks.push(fallback);
    }
  }

  const fullRscStream = rscChunks.join("");

  // Parse RSC keyed records: e.g. `28:{...}` or `54:{"label":...}`
  const rscMap = new Map<string, unknown>();
  const rscTextMap = new Map<string, string>();

  // Extract `<id>:T<hex>,<html...>` text blocks
  const textBlockRegex = /(?:^|\n)([0-9a-fA-F]+):T([0-9a-fA-F]+),([\s\S]*?)(?=\n[0-9a-fA-F]+:|$)/g;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = textBlockRegex.exec(fullRscStream)) !== null) {
    const id = tMatch[1];
    const body = tMatch[3];
    if (body && (!rscTextMap.has(id) || body.length > (rscTextMap.get(id)?.length ?? 0))) {
      rscTextMap.set(id, body);
    }
  }

  // Also scan individual lines for JSON values `<id>:<json>`
  for (const line of fullRscStream.split("\n")) {
    const lineMatch = /^([0-9a-fA-F]+):(\{[\s\S]*\}|\[[\s\S]*\])$/.exec(line.trim());
    if (!lineMatch) continue;
    const [, id, jsonPart] = lineMatch;
    try {
      rscMap.set(id, JSON.parse(jsonPart));
    } catch {
      // Ignore partial lines
    }
  }

  // Locate main property object (contains `propertyId` and `uid`)
  let propObj: Record<string, unknown> | undefined;
  let overTimeObj: Record<string, unknown> | undefined;
  let historiesArr: Array<Record<string, unknown>> = [];

  for (const val of rscMap.values()) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const rec = val as Record<string, unknown>;
      if ("propertyId" in rec && ("uid" in rec || "teaser" in rec)) {
        propObj = rec;
      }
    } else if (Array.isArray(val)) {
      for (const el of val) {
        if (el && typeof el === "object" && !Array.isArray(el)) {
          const rec = el as Record<string, unknown>;
          if ("overTime" in rec || "histories" in rec) {
            if (rec.overTime && typeof rec.overTime === "object") {
              overTimeObj = rec.overTime as Record<string, unknown>;
            }
            if (Array.isArray(rec.histories)) {
              historiesArr = rec.histories as Array<Record<string, unknown>>;
            }
          }
        }
      }
    }
  }

  const resolveRef = (ref: unknown): unknown => {
    if (typeof ref === "string" && ref.startsWith("$")) {
      const id = ref.slice(1);
      return rscMap.get(id) ?? rscTextMap.get(id);
    }
    return ref;
  };

  // Extract description
  let rawDescription = "";
  if (propObj?.description) {
    const resolved = resolveRef(propObj.description);
    if (typeof resolved === "string") {
      rawDescription = resolved;
    }
  }
  if (!rawDescription) {
    // Fallback: check largest RSC text entry containing `<p>`
    for (const txt of rscTextMap.values()) {
      if (txt.includes("<p>") && txt.length > rawDescription.length) {
        rawDescription = txt;
      }
    }
  }
  if (!rawDescription) {
    // Fallback: check rendered HTML DOM for description container
    const domDescMatch =
      /<div[^>]*class="[^"]*childs-\[p\+p\]:mt-10[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(
        html,
      );
    if (domDescMatch) {
      rawDescription = domDescMatch[1];
    }
  }

  const description = rawDescription ? htmlToCleanParagraphs(rawDescription) : undefined;
  const teaser =
    typeof propObj?.teaser === "string" && propObj.teaser.trim()
      ? propObj.teaser.trim()
      : undefined;

  // Extract AVM object
  const avmRaw = (resolveRef(propObj?.avm) ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const avmMedian = parseMoney(avmRaw?.avm);
  const avmLow = parseMoney(avmRaw?.low);
  const avmHigh = parseMoney(avmRaw?.high);
  const avmConfidence =
    typeof avmRaw?.confidenceScore === "string" ? avmRaw.confidenceScore : undefined;

  const avm = avmMedian
    ? {
        median: avmMedian,
        ...(avmLow ? { low: avmLow } : {}),
        ...(avmHigh ? { high: avmHigh } : {}),
        ...(avmConfidence ? { confidence: avmConfidence } : {}),
      }
    : undefined;

  // Extract publicRecords object
  const pubRaw = (resolveRef(propObj?.publicRecords) ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const pubDataRefs = (resolveRef(pubRaw?.data) ?? []) as unknown[];
  const pubItems: Array<{ label?: string; value?: string; alias?: string }> = [];
  if (Array.isArray(pubDataRefs)) {
    for (const itemRef of pubDataRefs) {
      const item = resolveRef(itemRef);
      if (item && typeof item === "object") {
        pubItems.push(item as { label?: string; value?: string; alias?: string });
      }
    }
  }

  const findPubValue = (alias: string, labelFallback?: string): string | undefined => {
    const lowerAlias = alias.toLowerCase();
    const byAlias = pubItems.find((i) => i.alias?.toLowerCase() === lowerAlias);
    if (typeof byAlias?.value === "string" && byAlias.value.trim()) {
      return decodeHtmlEntities(byAlias.value.trim());
    }
    if (labelFallback) {
      const lowerLabel = labelFallback.toLowerCase();
      const byLabel = pubItems.find((i) => i.label?.toLowerCase() === lowerLabel);
      if (typeof byLabel?.value === "string" && byLabel.value.trim()) {
        return decodeHtmlEntities(byLabel.value.trim());
      }
    }
    return undefined;
  };

  const capitalValue =
    parseMoney(pubRaw?.rateableValue) ??
    parseMoney(propObj?.rv) ??
    parseMoney(avmRaw?.rv);
  const landValue = parseMoney(pubRaw?.landValue);
  const improvementValue = parseMoney(pubRaw?.improvementValue);
  const valuationDate = pubRaw?.valuationAt
    ? unixSecondsToIsoDate(pubRaw.valuationAt)
    : propObj?.rvTime
      ? unixSecondsToIsoDate(propObj.rvTime)
      : undefined;
  const rvChangeNum = Number(pubRaw?.rateableValueChange);
  const rateableValueChange = Number.isFinite(rvChangeNum) ? rvChangeNum : undefined;

  const floorArea = parseArea(findPubValue("floorarea"));
  const landArea = parseArea(findPubValue("landarea"));
  const decadeStr = findPubValue("age") ?? (typeof propObj?.buildingAge === "string" ? propObj.buildingAge : undefined);
  const yearBuiltMatch = decadeStr?.match(/(\d{4})/);
  const yearBuilt = yearBuiltMatch ? Number(yearBuiltMatch[1]) : undefined;
  const ownershipType = findPubValue("tt");
  const titleNumber = findPubValue("title");
  const contour = findPubValue("cont");
  const constructionRaw = findPubValue("cons");
  const construction = constructionRaw
    ? constructionRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" · ")
    : undefined;
  const conditionRaw = findPubValue("cond");
  const condition = conditionRaw
    ? conditionRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" · ")
    : undefined;
  const legalDescription = findPubValue("ld");
  const estateDescription = findPubValue("ed");
  const council = findPubValue("council");
  const unitaryPlanZone = findPubValue("unitary");

  // Extract monthly AVM history (`overTime.avm` + `overTime.median`)
  const avmHistory: AvmHistoryPoint[] = [];
  const rawAvmSeries = Array.isArray(overTimeObj?.avm)
    ? (overTimeObj.avm as Array<Record<string, unknown>>)
    : [];
  const rawMedianSeries = Array.isArray(overTimeObj?.median)
    ? (overTimeObj.median as Array<Record<string, unknown>>)
    : [];
  const medianByDate = new Map<string, number>();
  for (const m of rawMedianSeries) {
    const d = formatCompactDate(m.date ?? m.month);
    const val = parseMoney(m.suburbMedianAvm);
    if (val) medianByDate.set(d, val);
  }
  for (const pt of rawAvmSeries) {
    const date = formatCompactDate(pt.date ?? pt.avmDate ?? pt.month);
    const value = parseMoney(pt.avm);
    if (value) {
      const suburbMedian = medianByDate.get(date);
      avmHistory.push({
        date,
        value,
        ...(suburbMedian ? { suburbMedian } : {}),
      });
    }
  }

  // Extract Property History timeline (`histories`)
  const propertyHistory: PropertyHistoryEvent[] = [];
  const valuationHistory: ValuationRecord[] = [];
  const pastSales: PastSale[] = [];

  if (avm) {
    const latestAvmDate =
      avmHistory.length > 0
        ? avmHistory[avmHistory.length - 1].date
        : "2026-10-01";
    valuationHistory.push({
      date: latestAvmDate,
      value: avm.median,
      source: "OneRoof Estimate",
      kind: "avm",
      medianEstimate: avm.median,
      ...(avm.low ? { lowEstimate: avm.low } : {}),
      ...(avm.high ? { highEstimate: avm.high } : {}),
    });
  }

  let firstCvSeen = false;
  for (const h of historiesArr) {
    const type = typeof h.type === "string" ? h.type : "event";
    const date = unixSecondsToIsoDate(h.labelTime);
    const label = typeof h.label === "string" ? h.label.replace(/\$\$/g, "$") : type;
    const rawValue = h.labelValue;
    const parsedPrice = parseMoney(rawValue) ?? parseMoney(label);
    const detail =
      typeof h.saleTypeDes === "string" && h.saleTypeDes.trim()
        ? h.saleTypeDes.trim()
        : typeof h.labelExtra === "string" && h.labelExtra.trim()
          ? h.labelExtra.trim()
          : undefined;

    propertyHistory.push({
      type,
      date,
      label,
      ...(parsedPrice
        ? { value: parsedPrice }
        : typeof rawValue === "number" || (typeof rawValue === "string" && rawValue)
          ? { value: String(rawValue).replace(/\$\$/g, "$") }
          : {}),
      ...(detail ? { detail } : {}),
    });

    if (type === "cv" && parsedPrice) {
      const isLatestCv = !firstCvSeen;
      firstCvSeen = true;
      valuationHistory.push({
        date,
        value: parsedPrice,
        source: "Council RV",
        kind: "rv",
        capitalValue: parsedPrice,
        ...(isLatestCv && landValue ? { landValue } : {}),
        ...(isLatestCv && improvementValue ? { improvementValue } : {}),
        ...(isLatestCv && rateableValueChange !== undefined
          ? { changePercent: rateableValueChange }
          : {}),
      });
    } else if (type === "sale" && parsedPrice) {
      pastSales.push({
        date,
        price: parsedPrice,
        source: "Council Verified (OneRoof)",
        ...(detail ? { saleType: detail } : {}),
      });
    }
  }

  // If no CV history was in `histories`, but `capitalValue` exists, add a Council RV record
  if (!firstCvSeen && capitalValue) {
    valuationHistory.push({
      date: valuationDate ?? "2024-05-01",
      value: capitalValue,
      source: "Council RV",
      kind: "rv",
      capitalValue,
      ...(landValue ? { landValue } : {}),
      ...(improvementValue ? { improvementValue } : {}),
      ...(rateableValueChange !== undefined
        ? { changePercent: rateableValueChange }
        : {}),
    });
  }

  return {
    ...(teaser ? { teaser } : {}),
    ...(description ? { description } : {}),
    ...(avm ? { avm } : {}),
    publicRecords: {
      ...(capitalValue ? { capitalValue } : {}),
      ...(landValue ? { landValue } : {}),
      ...(improvementValue ? { improvementValue } : {}),
      ...(valuationDate ? { valuationDate } : {}),
      ...(rateableValueChange !== undefined ? { rateableValueChange } : {}),
      ...(landArea ? { landArea } : {}),
      ...(floorArea ? { floorArea } : {}),
      ...(yearBuilt ? { yearBuilt } : {}),
      ...(ownershipType ? { ownershipType } : {}),
      ...(titleNumber ? { titleNumber } : {}),
      ...(contour ? { contour } : {}),
      ...(construction ? { construction } : {}),
      ...(condition ? { condition } : {}),
      ...(legalDescription ? { legalDescription } : {}),
      ...(estateDescription ? { estateDescription } : {}),
      ...(council ? { council } : {}),
      ...(unitaryPlanZone ? { unitaryPlanZone } : {}),
    },
    valuationHistory,
    avmHistory,
    pastSales,
    propertyHistory,
  };
}
