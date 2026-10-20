"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { propertyPhotos } from "@/lib/property-photos";
import { floodHazardOptions } from "@/lib/flood-hazards";
import type { Property } from "@/lib/property-types";

const money = (n: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(n);
const positive = (n: number | undefined) => (n && n > 0 ? n : undefined);
const area = (n: number) => `${n.toLocaleString("en-NZ")} m²`;
type Row = {
  label: string;
  number?: (p: Property) => number | undefined;
  text?: (p: Property) => string;
  format?: (n: number) => string;
};
const rows: Row[] = [
  { label: "Price", number: (p) => positive(p.price), format: money },
  { label: "Bedrooms", number: (p) => p.bedrooms },
  { label: "Bathrooms", number: (p) => p.bathrooms },
  { label: "Parking", number: (p) => p.parkingSpaces },
  { label: "Floor area", number: (p) => positive(p.floorArea), format: area },
  { label: "Land area", number: (p) => positive(p.landArea), format: area },
  {
    label: "Price / m² of floor",
    number: (p) =>
      p.price > 0 && p.floorArea > 0 ? p.price / p.floorArea : undefined,
    format: money,
  },
  { label: "Built in", number: (p) => positive(p.yearBuilt) },
  {
    label: "Capital value",
    number: (p) => positive(p.capitalValue),
    format: money,
  },
  {
    label: "Weekly rent estimate",
    number: (p) => positive(p.estimatedWeeklyRent),
    format: money,
  },
  { label: "Style", text: (p) => p.architecturalStyle ?? "Not provided" },
  { label: "Ownership", text: (p) => p.ownershipType ?? "Not provided" },
  {
    label: "Flood mapping",
    text: (p) =>
      p.floodHazards === undefined
        ? "Not synced"
        : p.floodHazards.length
          ? floodHazardOptions
              .filter(({ type }) =>
                p.floodHazards?.some((h) => h.type === type),
              )
              .map(({ label }) => label)
              .join(", ")
          : "No mapped intersection",
  },
  {
    label: "Schools nearby",
    number: (p) => p.nearbySchools?.length,
    format: (n) => `${n} within 2.5 km`,
  },
];

export default function ComparisonMatrix({
  properties,
  onRemove,
}: {
  properties: Property[];
  onRemove: (id: string) => void;
}) {
  const [highlight, setHighlight] = useState(true);
  return (
    <>
      <div className="comparison-toolbar">
        <span>{properties.length} homes · slide across to compare</span>
        <Field orientation="horizontal" className="comparison-highlight-toggle">
          <Switch
            id="comparison-highlight"
            size="sm"
            checked={highlight}
            onCheckedChange={setHighlight}
          />
          <FieldLabel htmlFor="comparison-highlight">
            Highlight largest values
          </FieldLabel>
        </Field>
      </div>
      <div
        className="comparison-matrix"
        style={{ "--compare-count": properties.length } as CSSProperties}
      >
        <Table className="comparison-table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <span className="comparison-essentials">The essentials</span>
              </TableHead>
              {properties.map((p) => (
                <TableHead scope="col" key={p.id}>
                  <div className="compare-property-head">
                    <div className="compare-thumb">
                      <Image
                        alt={p.imageAlt}
                        fill
                        sizes="240px"
                        src={propertyPhotos(p)[0]}
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Remove ${p.address}`}
                        onClick={() => onRemove(p.id)}
                        type="button"
                      >
                        <X />
                      </Button>
                    </div>
                    <Link href={`/properties/${encodeURIComponent(p.id)}`}>
                      {p.address}
                    </Link>
                    <span>
                      {p.suburb} · {p.propertyType}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const numbers = properties.map((p) => row.number?.(p));
              const known = numbers.filter(
                (n): n is number => n !== undefined && Number.isFinite(n),
              );
              const max = known.length > 1 ? Math.max(...known) : undefined;
              return (
                <TableRow key={row.label}>
                  <TableHead scope="row">{row.label}</TableHead>
                  {properties.map((p, i) => (
                    <TableCell
                      key={p.id}
                      data-highlight={
                        highlight && max !== undefined && numbers[i] === max
                          ? "true"
                          : undefined
                      }
                    >
                      {row.text
                        ? row.text(p)
                        : numbers[i] === undefined
                          ? "Not provided"
                          : (row.format ?? String)(numbers[i]!)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="comparison-footnote">
        Tint shows the largest figure, rather than a recommendation. Council
        mapping is not a site-specific risk assessment.
      </p>
    </>
  );
}
