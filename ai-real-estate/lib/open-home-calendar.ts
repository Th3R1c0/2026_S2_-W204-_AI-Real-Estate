import type { OpenHome } from "./property-types";

/**
 * New Zealand has used a single standard-time offset since 1946 and observes
 * no daylight saving, so open home times can be written as floating local
 * times without a VTIMEZONE block.
 */
const NZ_TIMEZONE_LABEL = "Pacific/Auckland";

type CalendarProperty = {
  address: string;
  suburb?: string;
  city?: string;
  listingAgent?: { name: string; contactUrl: string };
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** `2026-10-24` + `12:00` -> `20261024T120000` (floating local time). */
export function toCalendarDateTime(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${year}${month}${day}T${pad(hours)}${pad(minutes)}00`;
}

function stamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/** Escape and fold a text value per RFC 5545 (75-octet lines, escaped commas/semicolons). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export type OpenHomeCalendarInput = {
  property: CalendarProperty;
  propertyId: string;
  openHomes: OpenHome[];
  /** Real page URL, so each event can link back. */
  propertyUrl?: string;
  now?: Date;
};

/**
 * Build an RFC 5545 VCALENDAR with one VEVENT per open home. Each event carries
 * a VALARM so the buyer is reminded an hour before.
 */
export function buildOpenHomeCalendar({
  property,
  propertyId,
  openHomes,
  propertyUrl,
  now = new Date(),
}: OpenHomeCalendarInput): string {
  const location = [property.address, property.suburb, property.city]
    .filter(Boolean)
    .join(", ");
  const summary = `Open home: ${property.address}`;
  const description = [
    `Open home viewing for ${location}.`,
    property.listingAgent
      ? `Listing agent: ${property.listingAgent.name}.`
      : "",
    propertyUrl ? `Property page: ${propertyUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const created = stamp(now);

  const events = openHomes.flatMap((openHome, index) => {
    const start = toCalendarDateTime(openHome.date, openHome.startTime);
    if (!start) return [];
    const end =
      toCalendarDateTime(openHome.date, openHome.endTime) ??
      toCalendarDateTime(openHome.date, openHome.startTime);
    if (!end || end <= start) return [];

    return [
      foldLine("BEGIN:VEVENT"),
      foldLine(
        `UID:${slug(propertyId)}-${openHome.date.replace(/-/g, "")}-${openHome.startTime.replace(":", "")}-${index}@haven`,
      ),
      foldLine(`DTSTAMP:${created}`),
      foldLine(`CREATED:${created}`),
      foldLine(`DTSTART;TZID=${NZ_TIMEZONE_LABEL}:${start}`),
      foldLine(`DTEND;TZID=${NZ_TIMEZONE_LABEL}:${end}`),
      foldLine(`SUMMARY:${escapeText(summary)}`),
      foldLine(`LOCATION:${escapeText(location)}`),
      foldLine(`DESCRIPTION:${escapeText(description)}`),
      foldLine("STATUS:CONFIRMED"),
      foldLine("TRANSP:OPAQUE"),
      ...(propertyUrl ? [foldLine(`URL:${propertyUrl}`)] : []),
      foldLine("BEGIN:VALARM"),
      foldLine("TRIGGER:-PT1H"),
      foldLine("ACTION:DISPLAY"),
      foldLine(
        `DESCRIPTION:${escapeText(`Open home starts soon: ${property.address}`)}`,
      ),
      foldLine("END:VALARM"),
      foldLine("END:VEVENT"),
    ];
  });

  return [
    foldLine("BEGIN:VCALENDAR"),
    foldLine("VERSION:2.0"),
    foldLine("PRODID:-//Haven//Open Homes//EN"),
    foldLine("CALSCALE:GREGORIAN"),
    foldLine("METHOD:PUBLISH"),
    foldLine(`X-WR-CALNAME:${escapeText(`Open homes: ${property.address}`)}`),
    ...events,
    foldLine("END:VCALENDAR"),
    "",
  ].join("\r\n");
}

/** Filename-safe slug for the downloaded `.ics` file. */
export function openHomeCalendarFilename(address: string): string {
  const base = slug(address) || "open-home";
  return `open-home-${base}.ics`;
}

/**
 * Trigger a browser download of the calendar file. Returns false when the
 * environment has no DOM (e.g. server rendering or tests without a document).
 */
export function downloadOpenHomeCalendar(
  input: Omit<OpenHomeCalendarInput, "now">,
  filename = openHomeCalendarFilename(input.property.address),
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const blob = new Blob([buildOpenHomeCalendar(input)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next task so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
