import { describe, expect, it } from "vitest";
import {
  buildOpenHomeCalendar,
  openHomeCalendarFilename,
  toCalendarDateTime,
} from "../lib/open-home-calendar";

const property = {
  address: "1/10 Harding Avenue",
  suburb: "Mount Wellington",
  city: "Auckland",
  listingAgent: {
    name: "Sam Agent",
    contactUrl: "https://www.oneroof.co.nz/agent",
  },
};

const openHomes = [
  {
    date: "2026-10-24",
    startTime: "12:00",
    endTime: "12:30",
    label: "Sat, 24 Oct, 12:00pm - 12:30pm",
  },
  {
    date: "2026-10-25",
    startTime: "09:15",
    endTime: "10:00",
    label: "Sun, 25 Oct, 9:15am - 10:00am",
  },
];

describe("open home iCalendar export", () => {
  it("converts local dates and times to floating iCalendar timestamps", () => {
    expect(toCalendarDateTime("2026-10-24", "12:00")).toBe("20261024T120000");
    expect(toCalendarDateTime("2026-10-25", "9:15")).toBe("20261025T091500");
    expect(toCalendarDateTime("not-a-date", "12:00")).toBeNull();
    expect(toCalendarDateTime("2026-10-24", "25:00")).toBeNull();
  });

  it("builds one VEVENT per open home with reminder alarms and property details", () => {
    const ics = buildOpenHomeCalendar({
      property,
      propertyId: "linz-1881788",
      openHomes,
      propertyUrl: "https://haven.test/properties/linz-1881788",
      now: new Date("2026-10-20T03:04:05Z"),
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Haven//Open Homes//EN");

    // One event per open home.
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);

    // Floating Pacific/Auckland local times.
    expect(ics).toContain("DTSTART;TZID=Pacific/Auckland:20261024T120000");
    expect(ics).toContain("DTEND;TZID=Pacific/Auckland:20261024T123000");
    expect(ics).toContain("DTSTART;TZID=Pacific/Auckland:20261025T091500");
    expect(ics).toContain("DTEND;TZID=Pacific/Auckland:20261025T100000");

    // Summary, location and link back to the listing.
    expect(ics).toContain("SUMMARY:Open home: 1/10 Harding Avenue");
    expect(ics).toContain(
      "LOCATION:1/10 Harding Avenue\\, Mount Wellington\\, Auckland",
    );
    expect(ics).toContain("URL:https://haven.test/properties/linz-1881788");
    expect(ics).toContain("Listing agent: Sam Agent.");

    // Unique UIDs so re-importing updates rather than duplicates events.
    const uids = ics.match(/UID:[^\r\n]+/g) ?? [];
    expect(uids).toHaveLength(2);
    expect(new Set(uids).size).toBe(2);

    // Reminder one hour before each viewing.
    expect(ics.match(/TRIGGER:-PT1H/g)).toHaveLength(2);
  });

  it("uses CRLF line endings and folds long lines at 75 characters", () => {
    const ics = buildOpenHomeCalendar({
      property,
      propertyId: "linz-1881788",
      openHomes,
    });
    expect(ics).not.toMatch(/[^\r]\n/);
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("skips entries with missing or invalid times", () => {
    const ics = buildOpenHomeCalendar({
      property,
      propertyId: "linz-1881788",
      openHomes: [
        { date: "2026-10-24", startTime: "", endTime: "", label: "TBC" },
        ...openHomes.slice(0, 1),
      ],
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("names the downloaded file after the address", () => {
    expect(openHomeCalendarFilename("1/10 Harding Avenue")).toBe(
      "open-home-1-10-harding-avenue.ics",
    );
    expect(openHomeCalendarFilename("")).toBe("open-home-open-home.ics");
  });
});
