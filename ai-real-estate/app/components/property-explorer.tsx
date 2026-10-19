"use client";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

import Image from "next/image";
import {
  House,
  Heart,
  Search,
  X,
  SlidersHorizontal,
  CalendarDays,
  LayoutGrid,
  Building2,
  Fence,
  Trees,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { propertyPhotos } from "@/lib/property-photos";
import SiteHeader from "./site-header";
import { PropertyGridSkeleton } from "./property-skeleton";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MortgageCalculator from "./mortgage-calculator";
import { useAccountWorkspace } from "./account-workspace-provider";

import { filterProperties } from "../../lib/property-engine";
import { floodHazardOptions } from "../../lib/flood-hazards";
import type {
  ArchitecturalStyle,
  FloodHazardType,
  NumericCriterion,
  NumericSearchField,
  Property,
  PropertyFilters,
  PropertyType,
  SchoolOption,
} from "../../lib/property-types";
import { SCHOOL_NEARBY_RADIUS_METRES } from "../../lib/school-data";
import {
  readSavedLocations,
  straightLineDistanceKm,
  type SavedLocation,
} from "../../lib/saved-locations";

type AiSearchResult = {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
  source: "jev" | "gemini" | "local";
};

type PropertyExplorerProps = {
  properties: Property[];
  comparableSales: Property[];
  schoolOptions?: SchoolOption[];
  schoolDataSynced?: boolean;
  aiSearch?: (query: string) => Promise<AiSearchResult>;
};

const typeIcons = {
  Villa: House,
  Townhouse: Building2,
  Apartment: Building2,
  House,
  "Lifestyle block": Trees,
  Section: Fence,
};

const propertyTypes: PropertyType[] = [
  "Villa",
  "Townhouse",
  "Apartment",
  "House",
  "Lifestyle block",
  "Section",
];

const architecturalStyles: ArchitecturalStyle[] = [
  "Character",
  "Modernist",
  "Contemporary",
  "Craftsman",
  "Mid-Century",
];

const numberFormatter = new Intl.NumberFormat("en-NZ");
const moneyFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});
const numericFilterLabels: Record<NumericSearchField, string> = {
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  parkingSpaces: "Parking spaces",
  landArea: "Land area",
  floorArea: "Floor area",
  sunlightHours: "Sunlight",
  estimatedWeeklyRent: "Weekly rent",
  capitalValue: "Capital value",
};

function formatNumericFilter(
  field: NumericSearchField,
  range: NumericCriterion,
): string {
  const format = (value: number) => {
    if (field === "estimatedWeeklyRent" || field === "capitalValue")
      return formatMoney(value);
    if (field === "landArea" || field === "floorArea")
      return `${numberFormatter.format(value)} m²`;
    if (field === "sunlightHours") return `${value} hours`;
    return numberFormatter.format(value);
  };
  const label = numericFilterLabels[field];
  if (
    range.min !== undefined &&
    range.max !== undefined &&
    range.min === range.max
  ) {
    return `${label}: ${format(range.min)}`;
  }
  if (range.min !== undefined && range.max !== undefined) {
    return `${label}: ${format(range.min)}–${format(range.max)}`;
  }
  if (range.min !== undefined) return `${label} ≥ ${format(range.min)}`;
  if (range.max !== undefined) return `${label} ≤ ${format(range.max)}`;
  return label;
}

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace("NZ", "");
}

async function searchWithApi(query: string): Promise<AiSearchResult> {
  console.log("[AI Search] Sending query to /api/search:", query);
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AI Search] API error status: ${response.status}`);
    throw new Error("Search is temporarily unavailable.");
  }
  const result = (await response.json()) as AiSearchResult;
  console.log("[AI Search] Response received from /api/search:", result);
  return result;
}

function PropertyCard({
  property,
  selected,
  isSaved,
  onCompare,
  onSave,
  eager = false,
}: {
  property: Property;
  selected: boolean;
  isSaved: boolean;
  onCompare: () => void;
  onSave: () => void;
  eager?: boolean;
}) {
  return (
    <article className="property-card">
      <Link
        className="property-card-link"
        href={`/properties/${encodeURIComponent(property.id)}`}
        aria-label={`View details for ${property.address}`}
      >
        <div className="property-media">
          <Image
            alt={property.imageAlt}
            className="property-image"
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 540px) 100vw, (max-width: 900px) 50vw, (max-width: 1200px) 33vw, 25vw"
            src={propertyPhotos(property)[0]}
          />
        </div>
        <div className="property-body">
          <h3>{property.address}</h3>
          <p className="property-location">
            {property.suburb}, {property.city}
          </p>
          <p className="property-specs">
            {property.bedrooms} beds · {property.bathrooms} baths ·{" "}
            {numberFormatter.format(property.landArea)} m²
          </p>
          <p className="property-price">{formatMoney(property.price)}</p>
        </div>
      </Link>
      <Button
        variant="outline"
        size="icon"
        aria-label={
          isSaved
            ? `Remove ${property.address} from saved listings`
            : `Save ${property.address}`
        }
        aria-pressed={isSaved}
        className={cn("save-button", isSaved && "is-saved")}
        onClick={onSave}
        type="button"
      >
        <Heart />
      </Button>
      <label className={cn("compare-check", selected && "is-selected")}>
        <Checkbox
          aria-label={`Compare ${property.address}`}
          checked={selected}
          onCheckedChange={onCompare}
        />
        <span>Compare</span>
      </label>
    </article>
  );
}

function SavedListingsDialog({
  savedProperties,
  onClose,
  onRemoveSave,
}: {
  savedProperties: Property[];
  onClose: () => void;
  onRemoveSave: (id: string) => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="saved-modal"
        aria-label="Saved listings dashboard"
        aria-labelledby={undefined}
        aria-describedby={undefined}
      >
        <DialogTitle>
          Saved homes{" "}
          <span className="text-muted-foreground">
            ({savedProperties.length})
          </span>
        </DialogTitle>
        {savedProperties.length ? (
          <div className="saved-home-list">
            {savedProperties.map((property) => (
              <div className="saved-home-row" key={property.id}>
                <Link
                  className="saved-home-link"
                  href={`/properties/${encodeURIComponent(property.id)}`}
                >
                  <div className="saved-home-photo">
                    <Image
                      src={propertyPhotos(property)[0]}
                      alt={property.imageAlt}
                      fill
                      sizes="72px"
                    />
                  </div>
                  <div>
                    <strong>{property.address}</strong>
                    <p>
                      {property.suburb} · {formatMoney(property.price)}
                    </p>
                  </div>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${property.address} from saved listings`}
                  onClick={() => onRemoveSave(property.id)}
                  type="button"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <Heart />
              <EmptyTitle>No saved homes yet</EmptyTitle>
              <EmptyDescription>
                Tap a heart to keep a home here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ComparisonDialog({
  properties,
  onClose,
  onRemove,
}: {
  properties: Property[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [highlight, setHighlight] = useState(false);
  const rows: [string, string[]][] = [
    ["Price", properties.map((property) => formatMoney(property.price))],
    ["Bedrooms", properties.map((property) => String(property.bedrooms))],
    ["Bathrooms", properties.map((property) => String(property.bathrooms))],
    [
      "Floor area",
      properties.map((property) =>
        property.floorArea
          ? `${numberFormatter.format(property.floorArea)} m²`
          : "Not provided",
      ),
    ],
    [
      "Land area",
      properties.map(
        (property) => `${numberFormatter.format(property.landArea)} m²`,
      ),
    ],
    [
      "Parking",
      properties.map((property) =>
        property.parkingSpaces !== undefined
          ? String(property.parkingSpaces)
          : "Not provided",
      ),
    ],
    [
      "Built in",
      properties.map((property) =>
        property.yearBuilt ? String(property.yearBuilt) : "Unknown",
      ),
    ],
    [
      "Style",
      properties.map(
        (property) => property.architecturalStyle ?? "Not provided",
      ),
    ],
    [
      "Ownership",
      properties.map((property) => property.ownershipType ?? "Not provided"),
    ],
    [
      "Flood mapping",
      properties.map((property) =>
        property.floodHazards === undefined
          ? "Not synced"
          : property.floodHazards.length
            ? floodHazardOptions
                .filter(({ type }) =>
                  property.floodHazards?.some((hazard) => hazard.type === type),
                )
                .map(({ label }) => label)
                .join(", ")
            : "No mapped intersection",
      ),
    ],
    [
      "Walkability",
      properties.map((property) =>
        property.walkability?.score !== undefined
          ? `${property.walkability.score}/100`
          : "Not provided",
      ),
    ],
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="comparison-modal"
        aria-label="Property comparison"
        aria-labelledby={undefined}
        aria-describedby={undefined}
      >
        <DialogTitle>Compare your shortlist</DialogTitle>
        {properties.length ? (
          <>
            <div className="comparison-toolbar">
              <span>{properties.length} homes selected</span>
              <label className="switch-label">
                <Checkbox
                  checked={highlight}
                  onCheckedChange={(checked) => setHighlight(checked === true)}
                />
                Highlight differences
              </label>
            </div>
            <Table className="comparison-table">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Your shortlist</TableHead>
                  {properties.map((property) => (
                    <TableHead scope="col" key={property.id}>
                      <div className="compare-property-head">
                        <div className="compare-thumb">
                          <Image
                            alt={property.imageAlt}
                            fill
                            sizes="220px"
                            src={propertyPhotos(property)[0]}
                          />
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Remove ${property.address}`}
                            onClick={() => onRemove(property.id)}
                            type="button"
                          >
                            <X />
                          </Button>
                        </div>
                        <Link
                          href={`/properties/${encodeURIComponent(property.id)}`}
                        >
                          {property.address}
                        </Link>
                        <span>{property.suburb}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(([label, values]) => (
                  <TableRow key={label}>
                    <TableHead scope="row">{label}</TableHead>
                    {values.map((value, index) => (
                      <TableCell
                        className={cn(
                          highlight &&
                            new Set(values).size > 1 &&
                            "is-different",
                        )}
                        key={properties[index].id}
                      >
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No homes selected</EmptyTitle>
              <EmptyDescription>
                Select at least two homes to compare.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={onClose}>Browse homes</Button>
          </Empty>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PropertyExplorer({
  properties,
  schoolOptions = [],
  schoolDataSynced = false,
  aiSearch = searchWithApi,
}: PropertyExplorerProps) {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [query, setQuery] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const savedIdsRef = useRef<string[]>([]);
  const [destinations, setDestinations] = useState<SavedLocation[]>([]);
  const destinationsRef = useRef<SavedLocation[]>([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [maxSavedLocationDistance, setMaxSavedLocationDistance] = useState(5);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const account = useAccountWorkspace();
  const accountStatus = account?.status;

  useEffect(() => {
    if (account && account.status !== "signedIn" && account.status !== "guest")
      return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (account?.status === "signedIn") {
        destinationsRef.current = account.workspace.destinations;
        savedIdsRef.current = account.workspace.savedPropertyIds;
        setDestinations(account.workspace.destinations);
        setSavedIds(account.workspace.savedPropertyIds);

        // Auto-migrate local guest data into account if account is newly initialized
        try {
          const localDestinations = readSavedLocations();
          if (
            account.workspace.destinations.length === 0 &&
            localDestinations.length > 0
          ) {
            destinationsRef.current = localDestinations;
            setDestinations(localDestinations);
            void account.save("destinations", localDestinations);
          }
        } catch {}

        try {
          const raw = localStorage.getItem("haven_saved_property_ids");
          if (raw) {
            const parsed = JSON.parse(raw);
            const localSaved = Array.isArray(parsed)
              ? parsed.filter((id): id is string => typeof id === "string")
              : [];
            if (
              account.workspace.savedPropertyIds.length === 0 &&
              localSaved.length > 0
            ) {
              savedIdsRef.current = localSaved;
              setSavedIds(localSaved);
              void account.save("savedPropertyIds", localSaved);
            }
          }
        } catch {}
      } else {
        const localDestinations = readSavedLocations();
        destinationsRef.current = localDestinations;
        setDestinations(localDestinations);
        try {
          const saved = JSON.parse(
            localStorage.getItem("haven_saved_property_ids") ?? "[]",
          );
          const localSaved = Array.isArray(saved)
            ? saved.filter((id): id is string => typeof id === "string")
            : [];
          savedIdsRef.current = localSaved;
          setSavedIds(localSaved);
        } catch {
          savedIdsRef.current = [];
          setSavedIds([]);
        }
      }
    });
    return () => {
      active = false;
    };
    // Hydrate only when the signed-in identity changes; workspace writes must not reset local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus, account?.user?.userId]);

  function persistSavedIds(next: string[]) {
    savedIdsRef.current = next;
    setSavedIds(next);
    if (account?.status === "signedIn")
      void account.save("savedPropertyIds", next);
    else if (!account || account.status === "guest") {
      try {
        localStorage.setItem("haven_saved_property_ids", JSON.stringify(next));
      } catch {}
    }
  }

  const selectedDestination = destinations.find(
    (destination) =>
      destination.id === selectedDestinationId &&
      destination.latitude !== undefined &&
      destination.longitude !== undefined,
  );
  const filteredProperties = useMemo(() => {
    const matches = filterProperties(properties, filters);
    if (!selectedDestination) return matches;
    return matches.filter(
      (property) =>
        straightLineDistanceKm(
          property.latitude,
          property.longitude,
          selectedDestination.latitude!,
          selectedDestination.longitude!,
        ) <= maxSavedLocationDistance,
    );
  }, [properties, filters, selectedDestination, maxSavedLocationDistance]);
  const selectedProperties = useMemo(
    () => properties.filter(({ id }) => selectedIds.includes(id)),
    [properties, selectedIds],
  );
  const savedProperties = useMemo(
    () => properties.filter(({ id }) => savedIds.includes(id)),
    [properties, savedIds],
  );
  const hasFilters =
    Object.values(filters).some((value) => {
      if (value === undefined || value === false || value === "") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.values(value).some(Boolean);
      return true;
    }) || !!selectedDestination;
  const schoolTypes = Array.from(
    new Set(schoolOptions.map(({ orgType }) => orgType)),
  ).sort((a, b) => a.localeCompare(b));
  const selectableSchools = schoolOptions.filter((school) =>
    filters.schoolSearchMode === "zone"
      ? school.hasZoneGeometry === true
      : school.hasCoordinates !== false,
  );

  useEffect(() => {
    try {
      const summarySaved = savedProperties.map((p) => ({
        id: p.id,
        address: p.address,
        suburb: p.suburb,
        city: p.city,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        landArea: p.landArea,
        floorArea: p.floorArea,
        yearBuilt: p.yearBuilt,
        propertyType: p.propertyType,
        architecturalStyle: p.architecturalStyle,
        floodHazards: p.floodHazards?.map(({ type }) => type),
        orientation: p.orientation,
      }));

      const summaryCompared = selectedProperties.map((p) => ({
        id: p.id,
        address: p.address,
        suburb: p.suburb,
        city: p.city,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        landArea: p.landArea,
        floorArea: p.floorArea,
        yearBuilt: p.yearBuilt,
        propertyType: p.propertyType,
        architecturalStyle: p.architecturalStyle,
        floodHazards: p.floodHazards?.map(({ type }) => type),
        orientation: p.orientation,
      }));

      if (accountStatus === "signedIn")
        localStorage.removeItem("haven_saved_properties");
      else if (!accountStatus || accountStatus === "guest")
        localStorage.setItem(
          "haven_saved_properties",
          JSON.stringify(summarySaved),
        );
      localStorage.setItem(
        "haven_compared_properties",
        JSON.stringify(summaryCompared),
      );

      window.dispatchEvent(
        new CustomEvent("haven_properties_context_updated", {
          detail: {
            savedProperties: summarySaved,
            comparedProperties: summaryCompared,
          },
        }),
      );
    } catch {}
  }, [savedProperties, selectedProperties, accountStatus]);

  // Real-time search sequence and debounce management
  const searchSeqRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const availableLocations = useMemo(() => {
    return Array.from(
      new Set(
        properties.flatMap(({ suburb, city }) =>
          [suburb, city].filter(Boolean),
        ),
      ),
    ).sort();
  }, [properties]);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q) {
        setFilters({});
        setAiMessage("");

        setIsSearching(false);
        return;
      }

      const seq = ++searchSeqRef.current;
      setIsSearching(true);
      try {
        const result = await aiSearch(q);
        if (seq === searchSeqRef.current) {
          setFilters(result.filters);
          setAiMessage(result.message);
        }
      } catch {
        if (seq === searchSeqRef.current) {
          setAiMessage(
            "Search is temporarily unavailable. Please try the filters below.",
          );
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
    },
    [aiSearch],
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setFilters({});
      setAiMessage("");

      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      runSearch(value);
    }, 350);
  };

  function togglePropertyType(type: PropertyType) {
    setFilters((current) => ({
      ...current,
      propertyTypes: current.propertyTypes?.includes(type) ? undefined : [type],
    }));
    setAiMessage("");
  }

  function toggleStyle(style: ArchitecturalStyle) {
    setFilters((current) => {
      const styles = current.architecturalStyles ?? [];
      const nextStyles = styles.includes(style)
        ? styles.filter((item) => item !== style)
        : [...styles, style];
      return {
        ...current,
        architecturalStyles: nextStyles.length ? nextStyles : undefined,
      };
    });
  }

  function clearFilters() {
    setFilters({});
    setSelectedDestinationId("");
    setQuery("");
    setAiMessage("");

    setIsSearching(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }

  function removeNumericFilter(field: NumericSearchField) {
    setFilters((current) => {
      const remaining = { ...current.numericCriteria };
      delete remaining[field];
      return {
        ...current,
        numericCriteria: Object.keys(remaining).length ? remaining : undefined,
      };
    });
  }

  function toggleCompare(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleSave(id: string) {
    const current = savedIdsRef.current;
    persistSavedIds(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function submitAiSearch(event: FormEvent) {
    event.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!query.trim()) {
      clearFilters();
      return;
    }
    await runSearch(query);
  }

  return (
    <div className="site-shell">
      <SiteHeader>
        <Button
          variant="ghost"
          className="saved-homes-nav"
          onClick={() => setSavedModalOpen(true)}
          type="button"
        >
          <Heart data-icon="inline-start" />
          Saved Homes <Badge variant="secondary">{savedIds.length}</Badge>
        </Button>
      </SiteHeader>
      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-location">Auckland, New Zealand</p>
            <h1>
              Find your kind of <em>home.</em>
            </h1>
            <form className="ai-search" onSubmit={submitAiSearch}>
              <Field>
                <FieldLabel className="sr-only" htmlFor="ai-property-search">
                  Describe your ideal property
                </FieldLabel>
                <InputGroup className="search-input-group">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="ai-property-search"
                    aria-label="Describe your ideal property"
                    placeholder="A sunny villa in Ponsonby under $2.5m…"
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    {query && (
                      <InputGroupButton
                        size="icon-sm"
                        aria-label="Clear search query"
                        onClick={() => handleQueryChange("")}
                      >
                        <X />
                      </InputGroupButton>
                    )}
                    <Button type="submit" aria-label="Search">
                      {isSearching ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Search data-icon="inline-start" />
                      )}
                      <span>Search</span>
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </form>
            {aiMessage && (
              <div className="ai-response" role="status">
                <Sparkles />
                <span>{aiMessage}</span>
              </div>
            )}
          </div>
        </section>

        <section className="discover-section" id="discover">
          <Collapsible
            open={moreFiltersOpen}
            onOpenChange={setMoreFiltersOpen}
            className="airbnb-filter-bar"
            role="region"
            aria-label="Property search filters"
          >
            <div className="filter-category-row">
              <ToggleGroup
                aria-label="Property type"
                className="type-grid"
                type="single"
                value={filters.propertyTypes?.[0] ?? "all"}
                onValueChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    propertyTypes:
                      value && value !== "all"
                        ? [value as PropertyType]
                        : undefined,
                  }));
                  setAiMessage("");
                }}
              >
                <ToggleGroupItem value="all">
                  <LayoutGrid data-icon="inline-start" />
                  All homes
                </ToggleGroupItem>
                {propertyTypes.map((type) => {
                  const TypeIcon = typeIcons[type];
                  return (
                    <ToggleGroupItem value={type} key={type} aria-label={type}>
                      <TypeIcon data-icon="inline-start" />
                      {type}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <Button
                variant={filters.hasOpenHome ? "secondary" : "ghost"}
                aria-pressed={!!filters.hasOpenHome}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    hasOpenHome: current.hasOpenHome ? undefined : true,
                  }))
                }
                type="button"
              >
                <CalendarDays data-icon="inline-start" />
                Open homes
              </Button>
            </div>
            <FieldGroup className="basic-filters">
              <Field>
                <FieldLabel htmlFor="location-select">
                  Location / Suburb
                </FieldLabel>
                <NativeSelect
                  id="location-select"
                  value={filters.location ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      location: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">Anywhere in Auckland</option>
                  {availableLocations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="quick-budget">Max price</FieldLabel>
                <NativeSelect
                  id="quick-budget"
                  value={filters.maxPrice ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      maxPrice: Number(event.target.value) || undefined,
                    }))
                  }
                >
                  <option value="">Any price</option>
                  {[
                    750000, 1000000, 1500000, 2000000, 2500000, 3000000,
                    5000000,
                  ].map((price) => (
                    <option key={price} value={price}>
                      {formatMoney(price)}
                    </option>
                  ))}
                  {filters.maxPrice &&
                    ![
                      750000, 1000000, 1500000, 2000000, 2500000, 3000000,
                      5000000,
                    ].includes(filters.maxPrice) && (
                      <option value={filters.maxPrice}>
                        {formatMoney(filters.maxPrice)}
                      </option>
                    )}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel>Bedrooms</FieldLabel>
                <ToggleGroup
                  aria-label="Bedrooms"
                  type="single"
                  spacing={0}
                  value={filters.bedrooms ? String(filters.bedrooms) : "any"}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      bedrooms: Number(value) || undefined,
                    }))
                  }
                >
                  <ToggleGroupItem value="any">Any</ToggleGroupItem>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <ToggleGroupItem
                      key={count}
                      value={String(count)}
                      aria-label={`${count} bed${count > 1 ? "s" : ""}`}
                    >
                      {count}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <div className="more-filter-actions">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" type="button">
                    <SlidersHorizontal data-icon="inline-start" />
                    {moreFiltersOpen ? "Fewer filters" : "More filters"}
                  </Button>
                </CollapsibleTrigger>
                {(hasFilters || query) && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    aria-label="Clear all filters"
                    type="button"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </FieldGroup>
            <CollapsibleContent>
              <FieldGroup className="advanced-filters">
                <Field>
                  <FieldLabel>Price range</FieldLabel>{" "}
                  <div
                    className="year-fields"
                    style={{ paddingBottom: 0, marginTop: 8 }}
                  >
                    <label>
                      Min price ($)
                      <Input
                        inputMode="numeric"
                        onChange={(e) => {
                          const val =
                            Number(e.target.value.replace(/[^0-9]/g, "")) ||
                            undefined;
                          setFilters((curr) => ({ ...curr, minPrice: val }));
                        }}
                        placeholder="e.g. 750,000"
                        value={
                          filters.minPrice
                            ? filters.minPrice.toLocaleString("en-NZ")
                            : ""
                        }
                      />
                    </label>
                    <label>
                      Max price ($)
                      <Input
                        inputMode="numeric"
                        onChange={(e) => {
                          const val =
                            Number(e.target.value.replace(/[^0-9]/g, "")) ||
                            undefined;
                          setFilters((curr) => ({ ...curr, maxPrice: val }));
                        }}
                        placeholder="e.g. 1,500,000"
                        value={
                          filters.maxPrice
                            ? filters.maxPrice.toLocaleString("en-NZ")
                            : ""
                        }
                      />
                    </label>
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Bathrooms</FieldLabel>
                  <ToggleGroup
                    aria-label="Bathrooms"
                    type="single"
                    value={String(
                      filters.numericCriteria?.bathrooms?.min ?? "",
                    )}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        numericCriteria: {
                          ...current.numericCriteria,
                          bathrooms: value
                            ? { min: Number(value), max: Number(value) }
                            : undefined,
                        },
                      }))
                    }
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <ToggleGroupItem
                        key={count}
                        value={String(count)}
                        aria-label={`${count} bath${count > 1 ? "s" : ""}`}
                      >
                        {count}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>{" "}
                  <label className="north-check">
                    <Checkbox
                      checked={filters.northFacingOnly ?? false}
                      onCheckedChange={(checked) =>
                        setFilters((current) => ({
                          ...current,
                          northFacingOnly: checked === true || undefined,
                        }))
                      }
                    />
                    <Sun />
                    <span>
                      <strong>North-facing only</strong>
                    </span>
                  </label>
                </Field>
                {/* Mapped Flood Hazard */}
                <div className="filter-card-box">
                  <label className="field-label" htmlFor="flood-hazard">
                    Mapped flood hazard
                  </label>
                  <NativeSelect
                    id="flood-hazard"
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((current) => {
                        const next = { ...current };
                        delete next.floodHazardTypes;
                        delete next.noMappedFloodHazard;
                        if (value === "any_mapped") {
                          next.floodHazardTypes = floodHazardOptions.map(
                            ({ type }) => type,
                          );
                        } else if (value === "none") {
                          next.noMappedFloodHazard = true;
                        } else if (value) {
                          next.floodHazardTypes = [value as FloodHazardType];
                        }
                        return next;
                      });
                    }}
                    value={
                      filters.noMappedFloodHazard
                        ? "none"
                        : filters.floodHazardTypes?.length ===
                            floodHazardOptions.length
                          ? "any_mapped"
                          : (filters.floodHazardTypes?.[0] ?? "")
                    }
                  >
                    <option value="">Any flood hazard</option>
                    <option value="any_mapped">Any mapped flood hazard</option>
                    <option value="none">No mapped flood hazard</option>
                    {floodHazardOptions.map(({ type, label }) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {/* Architecture & Building Age */}
                <Accordion type="multiple">
                  <AccordionItem value="filters">
                    <AccordionTrigger>
                      Architecture & Era
                      {filters.architecturalStyles?.length ? (
                        <span>{filters.architecturalStyles.length}</span>
                      ) : null}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="check-list">
                        {architecturalStyles.map((style) => (
                          <label key={style}>
                            <Checkbox
                              checked={
                                filters.architecturalStyles?.includes(style) ??
                                false
                              }
                              onCheckedChange={() => toggleStyle(style)}
                            />
                            <span>{style}</span>
                          </label>
                        ))}
                      </div>
                      <div
                        className="year-fields"
                        style={{ paddingBottom: 12 }}
                      >
                        <label>
                          Built from
                          <Input
                            inputMode="numeric"
                            onChange={(event) =>
                              setFilters((current) => ({
                                ...current,
                                yearBuiltFrom:
                                  Number(event.target.value) || undefined,
                              }))
                            }
                            placeholder="1900"
                            value={filters.yearBuiltFrom ?? ""}
                          />
                        </label>
                        <label>
                          Built to
                          <Input
                            inputMode="numeric"
                            onChange={(event) =>
                              setFilters((current) => ({
                                ...current,
                                yearBuiltTo:
                                  Number(event.target.value) || undefined,
                              }))
                            }
                            placeholder="2026"
                            value={filters.yearBuiltTo ?? ""}
                          />
                        </label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Schools & Enrolment Zones */}
                <Accordion type="multiple">
                  <AccordionItem value="filters">
                    <AccordionTrigger>Schools & Catchments</AccordionTrigger>
                    <AccordionContent>
                      <label
                        className="north-check"
                        style={{ margin: "4px 0 10px" }}
                      >
                        <Checkbox
                          checked={filters.inZoneOnly ?? false}
                          onCheckedChange={(checked) =>
                            setFilters((curr) => ({
                              ...curr,
                              inZoneOnly: checked === true || undefined,
                            }))
                          }
                        />
                        <span>
                          <strong>Inside mapped school zone</strong>
                        </span>
                      </label>
                      {schoolDataSynced ? (
                        <div
                          className="compact-select-stack"
                          style={{ paddingBottom: 12 }}
                        >
                          <label
                            className="field-label"
                            htmlFor="nearby-school-type-filter"
                          >
                            Nearby school type (within{" "}
                            {SCHOOL_NEARBY_RADIUS_METRES / 1000} km)
                            <NativeSelect
                              id="nearby-school-type-filter"
                              value={filters.nearbySchoolType ?? ""}
                              onChange={(event) =>
                                setFilters((current) => ({
                                  ...current,
                                  nearbySchoolType:
                                    event.target.value || undefined,
                                }))
                              }
                            >
                              <option value="">Any type</option>
                              {schoolTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <label
                            className="field-label"
                            htmlFor="school-search-mode"
                          >
                            Search by school
                            <NativeSelect
                              id="school-search-mode"
                              value={filters.schoolSearchMode ?? "nearby"}
                              onChange={(event) =>
                                setFilters((current) => ({
                                  ...current,
                                  schoolId: undefined,
                                  schoolSearchMode: event.target.value as
                                    "zone" | "nearby",
                                }))
                              }
                            >
                              <option value="nearby">
                                Within {SCHOOL_NEARBY_RADIUS_METRES / 1000} km
                                of the school
                              </option>
                              <option value="zone">
                                Inside the school&apos;s enrolment zone
                              </option>
                            </NativeSelect>
                          </label>
                          <label
                            className="field-label"
                            htmlFor="school-search-id"
                          >
                            School
                            <NativeSelect
                              id="school-search-id"
                              value={filters.schoolId ?? ""}
                              onChange={(event) =>
                                setFilters((current) => ({
                                  ...current,
                                  schoolId: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                }))
                              }
                            >
                              <option value="">Choose a school</option>
                              {selectableSchools.map((school) => (
                                <option
                                  key={school.schoolId}
                                  value={school.schoolId}
                                >
                                  {school.name} — {school.orgType}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                        </div>
                      ) : (
                        <p
                          style={{
                            opacity: 0.7,
                            fontSize: "0.8rem",
                            margin: "0 0 12px",
                          }}
                        >
                          School zone filters active on pre-mapped catchments.
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Saved Location Proximity */}
                <div className="filter-card-box">
                  <label
                    className="field-label"
                    htmlFor="saved-location-select"
                  >
                    Search near saved location
                  </label>
                  <NativeSelect
                    id="saved-location-select"
                    onChange={(event) =>
                      setSelectedDestinationId(event.target.value)
                    }
                    value={selectedDestination?.id ?? ""}
                  >
                    <option value="">Any location</option>
                    {destinations
                      .filter(
                        (destination) =>
                          destination.latitude !== undefined &&
                          destination.longitude !== undefined,
                      )
                      .map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.name || destination.address}
                        </option>
                      ))}
                  </NativeSelect>
                  <label
                    className="field-label"
                    htmlFor="saved-location-distance"
                    style={{ marginTop: 8 }}
                  >
                    Maximum distance
                  </label>
                  <NativeSelect
                    id="saved-location-distance"
                    onChange={(event) =>
                      setMaxSavedLocationDistance(Number(event.target.value))
                    }
                    value={maxSavedLocationDistance}
                  >
                    {[2, 5, 10, 20].map((distance) => (
                      <option key={distance} value={distance}>
                        {distance} km
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {/* Commute & Transport */}
                <div className="filter-card-box">
                  <label className="field-label" htmlFor="max-commute">
                    Max commute time:{" "}
                    <strong>{filters.maxCommuteTimeMinutes ?? 45} mins</strong>
                  </label>
                  <Slider
                    id="max-commute"
                    aria-label="Maximum commute time"
                    min={10}
                    max={60}
                    step={5}
                    value={[filters.maxCommuteTimeMinutes ?? 45]}
                    onValueChange={([value]) =>
                      setFilters((current) => ({
                        ...current,
                        maxCommuteTimeMinutes: value,
                      }))
                    }
                  />
                  <label
                    className="field-label"
                    htmlFor="commute-mode"
                    style={{ marginTop: 8 }}
                  >
                    Transport Mode
                  </label>
                  <NativeSelect
                    id="commute-mode"
                    value={filters.commuteMode ?? "driving"}
                    onChange={(e) =>
                      setFilters((curr) => ({
                        ...curr,
                        commuteMode: e.target.value
                          ? (e.target.value as
                              "driving" | "transit" | "walking")
                          : undefined,
                      }))
                    }
                  >
                    <option value="driving">Driving</option>
                    <option value="transit">Public Transit</option>
                    <option value="walking">Walking</option>
                  </NativeSelect>
                </div>
              </FieldGroup>
            </CollapsibleContent>
          </Collapsible>

          <div className="results-panel">
            <div className="results-header">
              <div>
                <h2>
                  {filteredProperties.length}{" "}
                  {filteredProperties.length === 1 ? "property" : "properties"}{" "}
                  found
                </h2>
                {hasFilters && (
                  <div className="active-filter-chips">
                    {selectedDestination && (
                      <span className="filter-chip">
                        Within {maxSavedLocationDistance} km of{" "}
                        {selectedDestination.name ||
                          selectedDestination.address}
                        <Button
                          variant="ghost"
                          aria-label="Remove saved location filter"
                          className="filter-chip-remove"
                          onClick={() => setSelectedDestinationId("")}
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.location && (
                      <span className="filter-chip">
                        📍 {filters.location}
                        <Button
                          variant="ghost"
                          aria-label={`Remove location ${filters.location}`}
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              location: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.propertyTypes?.map((t) => (
                      <span className="filter-chip" key={t}>
                        {t}
                        <Button
                          variant="ghost"
                          aria-label={`Remove property type ${t}`}
                          className="filter-chip-remove"
                          onClick={() => togglePropertyType(t)}
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    {filters.architecturalStyles?.map((s) => (
                      <span className="filter-chip" key={s}>
                        {s}
                        <Button
                          variant="ghost"
                          aria-label={`Remove style ${s}`}
                          className="filter-chip-remove"
                          onClick={() => toggleStyle(s)}
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    {filters.floodHazardTypes?.length ? (
                      <span className="filter-chip">
                        {filters.floodHazardTypes.length ===
                        floodHazardOptions.length
                          ? "Any mapped flood hazard"
                          : floodHazardOptions.find(
                              ({ type }) =>
                                type === filters.floodHazardTypes?.[0],
                            )?.label}
                        <Button
                          variant="ghost"
                          aria-label={`Remove flood hazard ${
                            filters.floodHazardTypes.length ===
                            floodHazardOptions.length
                              ? "Any mapped flood hazard"
                              : floodHazardOptions.find(
                                  ({ type }) =>
                                    type === filters.floodHazardTypes?.[0],
                                )?.label
                          }`}
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              floodHazardTypes: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ) : null}
                    {filters.noMappedFloodHazard && (
                      <span className="filter-chip">
                        No mapped flood hazard
                        <Button
                          variant="ghost"
                          aria-label="Remove no mapped flood hazard filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              noMappedFloodHazard: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.hasOpenHome && (
                      <span className="filter-chip">
                        📅 Open homes
                        <Button
                          variant="ghost"
                          aria-label="Remove open home filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              hasOpenHome: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.maxPrice !== undefined && (
                      <span className="filter-chip">
                        ≤ $
                        {filters.maxPrice >= 1_000_000
                          ? (filters.maxPrice / 1_000_000).toFixed(1) + "M"
                          : (filters.maxPrice / 1_000).toFixed(0) + "k"}
                        <Button
                          variant="ghost"
                          aria-label="Remove max price filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              maxPrice: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.minPrice !== undefined && (
                      <span className="filter-chip">
                        ≥ $
                        {filters.minPrice >= 1_000_000
                          ? (filters.minPrice / 1_000_000).toFixed(1) + "M"
                          : (filters.minPrice / 1_000).toFixed(0) + "k"}
                        <Button
                          variant="ghost"
                          aria-label="Remove min price filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              minPrice: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.bedrooms !== undefined && (
                      <span className="filter-chip">
                        {filters.bedrooms} bed{filters.bedrooms > 1 ? "s" : ""}
                        <Button
                          variant="ghost"
                          aria-label="Remove bedroom filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              bedrooms: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {Object.entries(filters.numericCriteria ?? {}).map(
                      ([field, range]) => (
                        <span className="filter-chip" key={field}>
                          {formatNumericFilter(
                            field as NumericSearchField,
                            range,
                          )}
                          <Button
                            variant="ghost"
                            aria-label={`Remove ${numericFilterLabels[field as NumericSearchField].toLowerCase()} filter`}
                            className="filter-chip-remove"
                            onClick={() =>
                              removeNumericFilter(field as NumericSearchField)
                            }
                            type="button"
                          >
                            ×
                          </Button>
                        </span>
                      ),
                    )}
                    {filters.orientations?.map((orientation) => (
                      <span className="filter-chip" key={orientation}>
                        {orientation}-facing
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${orientation.toLowerCase()} facing filter`}
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              orientations: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    {filters.ownershipTypes?.map((ownership) => (
                      <span className="filter-chip" key={ownership}>
                        {ownership}
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${ownership.toLowerCase()} ownership filter`}
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              ownershipTypes: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    {filters.northFacingOnly && (
                      <span className="filter-chip">
                        ☀️ North-facing
                        <Button
                          variant="ghost"
                          aria-label="Remove north facing filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              northFacingOnly: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.inZoneOnly && (
                      <span className="filter-chip">
                        🎓 School zone
                        <Button
                          variant="ghost"
                          aria-label="Remove school zone filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              inZoneOnly: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.schoolZoneName && (
                      <span className="filter-chip">
                        🎓 {filters.schoolZoneName} zone
                        <Button
                          variant="ghost"
                          aria-label="Remove school zone name filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              schoolZoneName: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.yearBuiltFrom !== undefined && (
                      <span className="filter-chip">
                        Built from {filters.yearBuiltFrom}
                        <Button
                          variant="ghost"
                          aria-label="Remove built from filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              yearBuiltFrom: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.yearBuiltTo !== undefined && (
                      <span className="filter-chip">
                        Built to {filters.yearBuiltTo}
                        <Button
                          variant="ghost"
                          aria-label="Remove built to filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              yearBuiltTo: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.maxCommuteTimeMinutes !== undefined && (
                      <span className="filter-chip">
                        ⏱️ Commute ≤ {filters.maxCommuteTimeMinutes}m
                        <Button
                          variant="ghost"
                          aria-label="Remove commute filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              maxCommuteTimeMinutes: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.commuteDestination && (
                      <span className="filter-chip">
                        To {filters.commuteDestination}
                        <Button
                          variant="ghost"
                          aria-label="Remove commute destination filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              commuteDestination: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    {filters.commuteMode && (
                      <span className="filter-chip">
                        By {filters.commuteMode}
                        <Button
                          variant="ghost"
                          aria-label="Remove commute mode filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              commuteMode: undefined,
                            }))
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      className="filter-chip-remove"
                      onClick={clearFilters}
                      style={{
                        color: "var(--forest)",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 6px",
                      }}
                      type="button"
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {account?.status === "loading" ? (
              <PropertyGridSkeleton />
            ) : account?.status === "error" ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t load your account</AlertTitle>
                <AlertDescription>
                  {account.error}
                  <Button
                    variant="outline"
                    onClick={() => void account.refresh()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : filteredProperties.length ? (
              <div className="property-grid">
                {filteredProperties.map((property, index) => (
                  <PropertyCard
                    eager={index < 4}
                    key={property.id}
                    isSaved={savedIds.includes(property.id)}
                    onCompare={() => toggleCompare(property.id)}
                    onSave={() => toggleSave(property.id)}
                    property={property}
                    selected={selectedIds.includes(property.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>
                  <Search />
                </span>
                <h3>No matching listings were found</h3>
                <p>
                  Try widening your location, budget, style or specialist
                  filters.
                </p>
                <Button variant="ghost" onClick={clearFilters} type="button">
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Standalone Mortgage Calculator Section on Home Screen */}
        <section className="calculator-section" id="calculator">
          <div className="section-title">
            <h2>Make the numbers work</h2>
            <p>
              Explore estimated repayments and compare two fixed-rate loan
              options.
            </p>
          </div>
          <div className="calculator-container">
            <MortgageCalculator defaultPrice={1250000} />
          </div>
        </section>
      </main>

      {/* Saved Listings Modal */}
      {savedModalOpen && (
        <SavedListingsDialog
          onClose={() => setSavedModalOpen(false)}
          onRemoveSave={(id) => toggleSave(id)}
          savedProperties={savedProperties}
        />
      )}

      {/* Comparison Modal */}
      {comparisonOpen && (
        <ComparisonDialog
          onClose={() => setComparisonOpen(false)}
          onRemove={(id) =>
            setSelectedIds((curr) => curr.filter((item) => item !== id))
          }
          properties={selectedProperties}
        />
      )}

      {!!selectedProperties.length && (
        <section className="compare-tray" aria-label="Your comparison">
          <div className="compare-tray-homes">
            {selectedProperties.map((property) => (
              <Badge variant="secondary" key={property.id}>
                {property.address}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${property.address} from comparison`}
                  onClick={() => toggleCompare(property.id)}
                  type="button"
                >
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
          <div className="compare-tray-actions">
            <Button
              variant="ghost"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              Clear
            </Button>
            <Button
              disabled={selectedIds.length < 2}
              onClick={() => setComparisonOpen(true)}
              type="button"
            >
              {selectedIds.length < 2
                ? "Select one more"
                : `Compare ${selectedIds.length} homes`}
            </Button>
          </div>
        </section>
      )}
      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">
            <House />
          </span>
          <span>
            haven<span className="brand-dot">.</span>
          </span>
        </a>
        <p>Find your place in Aotearoa.</p>
      </footer>
    </div>
  );
}
