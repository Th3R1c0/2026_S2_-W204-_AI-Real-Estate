"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Car,
  Check,
  Minus,
  MoveUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { propertyPhotos } from "../../lib/property-photos";
import type { Property } from "../../lib/property-types";
import SiteHeader from "./site-header";

const money = (value: number) =>
  value > 0
    ? new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: "NZD",
        maximumFractionDigits: 0,
      }).format(value)
    : "Price on request";
const area = (value: number) =>
  value > 0 ? `${value.toLocaleString("en-NZ")} m²` : "Not provided";
const flood = (p: Property) =>
  p.floodHazards === undefined
    ? "Mapping not synced"
    : p.floodHazards.length
      ? `${p.floodHazards.length} mapped hazard layer${p.floodHazards.length === 1 ? "" : "s"}`
      : "No mapped intersection";
const designs = [
  {
    name: "The visual matrix",
    short: "Visual matrix",
    note: "The familiar side-by-side view, with differences brought forward.",
    tag: "All the detail",
  },
  {
    name: "Property passports",
    short: "Passports",
    note: "A compact portrait of each home, with space and price easy to scan.",
    tag: "Photo-led",
  },
  {
    name: "The numbers view",
    short: "Numbers",
    note: "See the size of the differences, not just the numbers themselves.",
    tag: "Chart-led",
  },
  {
    name: "The trade-off board",
    short: "Trade-offs",
    note: "Turn a long list of attributes into the points worth weighing.",
    tag: "Decision-led",
  },
];

function HomeName({
  home,
  index,
  photo = false,
}: {
  home: Property;
  index: number;
  photo?: boolean;
}) {
  return (
    <div className="studio-home-name" data-home-index={index}>
      {photo && (
        <div className="studio-photo">
          <Image
            src={propertyPhotos(home)[0]}
            alt={home.imageAlt}
            fill
            sizes="(max-width: 768px) 280px, 400px"
          />
        </div>
      )}
      <div className="studio-home-title">
        <span className="studio-dot" />
        <Link href={`/properties/${encodeURIComponent(home.id)}`}>
          {home.address}
        </Link>
        <ArrowUpRight aria-hidden="true" />
      </div>
      <p>
        {home.suburb} · {home.propertyType}
      </p>
    </div>
  );
}

function QuickStats({ home }: { home: Property }) {
  return (
    <div className="studio-stats">
      <span>
        <BedDouble aria-hidden="true" />
        {home.bedrooms}
        <span className="sr-only"> bedrooms</span>
      </span>
      <span>
        <Bath aria-hidden="true" />
        {home.bathrooms}
        <span className="sr-only"> bathrooms</span>
      </span>
      <span>
        <Car aria-hidden="true" />
        {home.parkingSpaces ?? "—"}
        <span className="sr-only"> parking spaces</span>
      </span>
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  index,
  format = area,
}: {
  label: string;
  value: number;
  max: number;
  index: number;
  format?: (n: number) => string;
}) {
  return (
    <div className="studio-meter" data-home-index={index}>
      <div>
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </div>
      <div className="studio-track">
        <span style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function DesignSection({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const design = designs[index];
  return (
    <section
      className="studio-design"
      aria-labelledby={`design-title-${index}`}
      id={`design-${index + 1}`}
    >
      <div className="studio-design-heading">
        <span className="studio-design-number">0{index + 1}</span>
        <div>
          <h2 id={`design-title-${index}`}>{design.name}</h2>
          <p>{design.note}</p>
        </div>
        <Badge variant="outline">{design.tag}</Badge>
      </div>
      {children}
    </section>
  );
}

export default function ComparisonDesigns({
  properties,
}: {
  properties: Property[];
}) {
  const [count, setCount] = useState("2");
  const homes = properties.slice(0, Number(count));
  const lowestPrice = Math.min(
    ...homes.map((p) => p.price).filter((p) => p > 0),
  );
  const maxPrice = Math.max(...homes.map((p) => p.price));
  const maxFloor = Math.max(...homes.map((p) => p.floorArea));
  const maxLand = Math.max(...homes.map((p) => p.landArea));
  const gridStyle = { "--home-count": homes.length } as CSSProperties;
  const winner = (field: "price" | "floorArea" | "landArea") =>
    homes.reduce(
      (best, p) =>
        (field === "price" ? p[field] < best[field] : p[field] > best[field])
          ? p
          : best,
      homes[0],
    );
  const rows = [
    {
      label: "Price",
      value: (p: Property) => money(p.price),
      highlight: (p: Property) => p.price === lowestPrice,
      detail: "Lowest highlighted",
    },
    { label: "Bedrooms", value: (p: Property) => p.bedrooms },
    { label: "Bathrooms", value: (p: Property) => p.bathrooms },
    {
      label: "Parking",
      value: (p: Property) => p.parkingSpaces ?? "Not provided",
    },
    {
      label: "Floor area",
      value: (p: Property) => area(p.floorArea),
      highlight: (p: Property) => p.floorArea === maxFloor,
      detail: "Largest highlighted",
    },
    {
      label: "Land area",
      value: (p: Property) => area(p.landArea),
      highlight: (p: Property) => p.landArea === maxLand,
      detail: "Largest highlighted",
    },
    {
      label: "Price / m² of floor",
      value: (p: Property) =>
        p.floorArea && p.price ? money(p.price / p.floorArea) : "Not provided",
    },
    { label: "Built", value: (p: Property) => p.yearBuilt || "Not provided" },
    {
      label: "Ownership",
      value: (p: Property) => p.ownershipType ?? "Not provided",
    },
    { label: "Council flood mapping", value: flood },
    {
      label: "Schools nearby",
      value: (p: Property) =>
        p.nearbySchools
          ? `${p.nearbySchools.length} within 2.5 km`
          : "Not provided",
    },
  ];
  return (
    <div className="site-shell comparison-studio">
      <SiteHeader />
      <main className="studio-main">
        <div className="studio-intro">
          <div>
            <Badge variant="secondary">
              Comparison studio · temporary preview
            </Badge>
            <h1>
              A clearer picture.
              <br />
              <em>Four ways to compare.</em>
            </h1>
            <p>The same homes. Four different ways to see what matters.</p>
          </div>
          <div className="studio-count">
            <span>Try each layout with</span>
            <ToggleGroup
              type="single"
              value={count}
              onValueChange={(v) => v && setCount(v)}
              aria-label="Number of properties"
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="2" aria-label="2 properties">
                2 properties
              </ToggleGroupItem>
              <ToggleGroupItem value="3" aria-label="3 properties">
                3 properties
              </ToggleGroupItem>
            </ToggleGroup>
            <small aria-live="polite">
              Comparing {homes.length} properties in every design
            </small>
          </div>
        </div>
        <nav
          className="studio-directions"
          aria-label="Comparison design directions"
        >
          {designs.map((d, i) => (
            <Button variant="outline" asChild key={d.name}>
              <a href={`#design-${i + 1}`}>
                <span>0{i + 1}</span>
                {d.short}
                <MoveUpRight data-icon="inline-end" />
              </a>
            </Button>
          ))}
        </nav>

        <DesignSection index={0}>
          <div className="studio-surface studio-matrix">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="studio-row-label">
                    The essentials
                    <small>{homes.length} homes, one clear view</small>
                  </TableHead>
                  {homes.map((p, i) => (
                    <TableHead key={p.id}>
                      <HomeName home={p} index={i} photo />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableHead scope="row">
                      {row.label}
                      {row.detail && <small>{row.detail}</small>}
                    </TableHead>
                    {homes.map((p) => (
                      <TableCell
                        key={p.id}
                        data-highlight={row.highlight?.(p) || undefined}
                      >
                        <span>{row.value(p)}</span>
                        {row.highlight?.(p) && (
                          <Check aria-label="Highlighted comparison" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="studio-footnote">
            Highlights compare these listings only. Council mapping is not a
            site-specific flood risk rating.
          </p>
        </DesignSection>

        <DesignSection index={1}>
          <div className="studio-scroll">
            <div className="studio-home-grid" style={gridStyle}>
              {homes.map((p, i) => (
                <Card className="studio-passport" key={p.id}>
                  <CardHeader>
                    <HomeName home={p} index={i} photo />
                    <CardTitle className="studio-price">
                      {money(p.price)}
                    </CardTitle>
                    <CardDescription>
                      {p.price === lowestPrice
                        ? "Lowest price in this comparison"
                        : `${money(p.price - lowestPrice)} above the lowest price`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <QuickStats home={p} />
                    <div className="studio-area-pair">
                      <div>
                        <span>Floor area</span>
                        <strong>{area(p.floorArea)}</strong>
                      </div>
                      <div>
                        <span>Land area</span>
                        <strong>{area(p.landArea)}</strong>
                      </div>
                    </div>
                    <Meter
                      label="Floor space, relatively"
                      value={p.floorArea}
                      max={maxFloor}
                      index={i}
                    />
                    <Meter
                      label="Land, relatively"
                      value={p.landArea}
                      max={maxLand}
                      index={i}
                    />
                    <div className="studio-passport-facts">
                      <span>{p.ownershipType ?? "Title not provided"}</span>
                      <span>
                        {p.yearBuilt
                          ? `Built ${p.yearBuilt}`
                          : "Build year not provided"}
                      </span>
                      <span>{flood(p)}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline">
                      <Link href={`/properties/${encodeURIComponent(p.id)}`}>
                        Explore this home
                        <ArrowUpRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </DesignSection>

        <DesignSection index={2}>
          <div className="studio-insight-grid">
            {[
              {
                label: "Price spread",
                value: money(maxPrice - lowestPrice),
                note: "between the lowest and highest price",
              },
              {
                label: "Floor area spread",
                value: area(
                  maxFloor - Math.min(...homes.map((p) => p.floorArea)),
                ),
                note: "between the smallest and largest interior",
              },
              {
                label: "Largest land area",
                value: area(maxLand),
                note: winner("landArea").address,
              },
            ].map((insight) => (
              <div className="studio-insight" key={insight.label}>
                <span>{insight.label}</span>
                <strong>{insight.value}</strong>
                <small>{insight.note}</small>
              </div>
            ))}
          </div>
          <div className="studio-surface studio-charts">
            <div className="studio-chart-legend">
              {homes.map((p, i) => (
                <HomeName key={p.id} home={p} index={i} />
              ))}
            </div>
            <div className="studio-chart-grid">
              {[
                {
                  label: "Price",
                  field: "price" as const,
                  max: maxPrice,
                  format: money,
                  note: "A shorter bar means a lower price.",
                },
                {
                  label: "Floor area",
                  field: "floorArea" as const,
                  max: maxFloor,
                  format: area,
                  note: "A longer bar means more interior space.",
                },
                {
                  label: "Land area",
                  field: "landArea" as const,
                  max: maxLand,
                  format: area,
                  note: "A longer bar means a larger section.",
                },
              ].map((chart) => (
                <div key={chart.field}>
                  <h3>{chart.label}</h3>
                  <p>{chart.note}</p>
                  {homes.map((p, i) => (
                    <Meter
                      key={p.id}
                      label={p.address}
                      value={p[chart.field]}
                      max={chart.max}
                      index={i}
                      format={chart.format}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="studio-footnote">
            Every chart starts at zero. Bars show actual listing figures, with
            separate scales for each metric.
          </p>
        </DesignSection>

        <DesignSection index={3}>
          <div className="studio-board-intro">
            <span>Start with the differences.</span>
            <p>No overall score. Just the trade-offs in your shortlist.</p>
          </div>
          <div className="studio-scroll">
            <div className="studio-home-grid" style={gridStyle}>
              {homes.map((p, i) => {
                const strengths = [
                  p.price === lowestPrice && "Lowest purchase price",
                  p.floorArea === maxFloor && "Most interior space",
                  p.landArea === maxLand && "Largest section",
                  p.bedrooms === Math.max(...homes.map((h) => h.bedrooms)) &&
                    "Most bedrooms",
                ].filter(Boolean) as string[];
                const tradeoffs = [
                  p.price > lowestPrice &&
                    `${money(p.price - lowestPrice)} more than the lowest-priced home`,
                  p.floorArea < maxFloor &&
                    `${area(maxFloor - p.floorArea)} less floor space than the largest home`,
                  p.parkingSpaces === undefined &&
                    "Confirm parking capacity with the agent",
                ].filter(Boolean) as string[];
                return (
                  <Card
                    key={p.id}
                    className="studio-tradeoff"
                    data-home-index={i}
                  >
                    <CardHeader>
                      <HomeName home={p} index={i} />
                      <CardTitle className="studio-price">
                        {money(p.price)}
                      </CardTitle>
                      <CardDescription>
                        <QuickStats home={p} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="studio-strengths">
                        <h3>What stands out</h3>
                        {(strengths.length
                          ? strengths
                          : ["Sits between the other homes on price and space"]
                        ).map((text) => (
                          <p key={text}>
                            <Check aria-hidden="true" />
                            {text}
                          </p>
                        ))}
                      </div>
                      <div className="studio-weigh">
                        <h3>Worth weighing</h3>
                        {(tradeoffs.length
                          ? tradeoffs
                          : [
                              "Compare condition, location and title details in person",
                            ]
                        ).map((text) => (
                          <p key={text}>
                            <Minus aria-hidden="true" />
                            {text}
                          </p>
                        ))}
                      </div>
                      <div className="studio-bottom-line">
                        <span>Keep in view</span>
                        <strong>
                          {area(p.floorArea)} floor · {area(p.landArea)} land
                        </strong>
                        <p>{flood(p)}</p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button asChild variant="ghost">
                        <Link href={`/properties/${encodeURIComponent(p.id)}`}>
                          See the full picture
                          <ArrowUpRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </DesignSection>
        <div className="studio-end">
          <span>Which direction feels right?</span>
          <p>
            Each layout uses the same listing facts. Pick the one that makes
            your decision easier.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">
              Back to Discover
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
