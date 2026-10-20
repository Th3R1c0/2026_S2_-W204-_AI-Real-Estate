"use client";
import { createPortal } from "react-dom";
import RangeSlider from "./range-slider";

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
  Bed,
  Bath,
  Car,
  LandPlot,
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
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
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
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MortgageCalculator from "./mortgage-calculator";
import ComparisonMatrix from "./comparison-matrix";
import { useAccountWorkspace } from "./account-workspace-provider";

import { floodHazardOptions } from "../../lib/flood-hazards";
import { filterProperties } from "../../lib/property-engine";
import type {
  FloodRiskLevel,
  NumericCriterion,
  NumericSearchField,
  Property,
  PropertyFilters,
  PropertyType,
  SchoolOption,
} from "../../lib/property-types";
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
  estimatedWeeklyRent: "Weekly rent",
  capitalValue: "Capital value",
};

type RangeConfig = { min: number; max: number; step: number; format: (value: number) => string };

/** Counts and areas are grouped together as double-ended ranges. */
const RANGE_FIELDS: NumericSearchField[] = [
  "bedrooms",
  "bathrooms",
  "parkingSpaces",
  "landArea",
  "floorArea",
];

const rangeConfig: Record<NumericSearchField, RangeConfig> = {
  bedrooms: { min: 0, max: 10, step: 1, format: (v) => String(v) },
  bathrooms: { min: 0, max: 10, step: 1, format: (v) => String(v) },
  parkingSpaces: { min: 0, max: 10, step: 1, format: (v) => String(v) },
  landArea: {
    min: 0,
    max: 4000,
    step: 50,
    format: (v) => `${numberFormatter.format(v)} m²`,
  },
  floorArea: {
    min: 0,
    max: 600,
    step: 5,
    format: (v) => `${numberFormatter.format(v)} m²`,
  },
  estimatedWeeklyRent: {
    min: 0,
    max: 2000,
    step: 25,
    format: (v) => `${formatMoney(v)}/wk`,
  },
  capitalValue: {
    min: 0,
    max: 5000000,
    step: 50000,
    format: (v) => formatMoney(v),
  },
};

const PRICE_RANGE = { min: 0, max: 5_000_000, step: 50_000 };
const RENT_RANGE = rangeConfig.estimatedWeeklyRent;
const YEAR_RANGE = { min: 1900, max: 2026, step: 1 };

function formatNumericFilter(
  field: NumericSearchField,
  range: NumericCriterion,
): string {
  const format = (value: number) => {
    if (field === "estimatedWeeklyRent" || field === "capitalValue")
      return formatMoney(value);
    if (field === "landArea" || field === "floorArea")
      return `${numberFormatter.format(value)} m²`;
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

function countSelection(range: NumericCriterion | undefined, exact?: number) {
  if (range && (range.min !== undefined || range.max !== undefined)) {
    return range.min !== undefined && range.min === range.max
      ? String(range.min)
      : "";
  }
  return exact !== undefined ? String(exact) : "any";
}

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace("NZ", "");
}

/**
 * Free-text multi-value field. Entries are committed with Enter or a comma and
 * rendered as removable chips; matching suggestions are offered inline.
 */
function TokenField({
  id,
  label,
  placeholder,
  values,
  suggestions,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  // Ignore the blur that follows a suggestion click; the click commits for us.
  const skipBlur = useRef(false);

  function commit(raw: string) {
    const entries = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!entries.length) return;
    const next = [...values];
    for (const entry of entries) {
      if (!next.some((value) => value.toLowerCase() === entry.toLowerCase()))
        next.push(entry);
    }
    onChange(next);
    setDraft("");
  }

  const matches = draft.trim()
    ? suggestions
        .filter(
          (suggestion) =>
            suggestion.toLowerCase().includes(draft.trim().toLowerCase()) &&
            !values.some(
              (value) => value.toLowerCase() === suggestion.toLowerCase(),
            ),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="token-field">
      {values.length > 0 && (
        <div className="token-list">
          {values.map((value) => (
            <span className="token-chip" key={value}>
              {value}
              <Button
                variant="ghost"
                className="token-chip-remove"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
                type="button"
              >
                ×
              </Button>
            </span>
          ))}
        </div>
      )}
      <div className="token-input-wrap">
        <input
          id={id}
          className="token-input"
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (skipBlur.current) {
              skipBlur.current = false;
              return;
            }
            commit(draft);
          }}
        />
        {matches.length > 0 && (
          <ul className="token-suggestions" aria-label={`${label} suggestions`}>
            {matches.map((match) => (
              <li key={match}>
                <button
                  className="token-suggestion"
                  onMouseDown={() => {
                    skipBlur.current = true;
                  }}
                  onClick={() => commit(match)}
                  type="button"
                >
                  {match}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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

const PropertyCard = memo(function PropertyCard({
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
  onCompare: (id: string) => void;
  onSave: (id: string) => void;
  eager?: boolean;
}) {
  const handleCompare = useCallback(
    () => onCompare(property.id),
    [onCompare, property.id],
  );
  const handleSave = useCallback(
    () => onSave(property.id),
    [onSave, property.id],
  );

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
            priority={eager}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px"
            src={propertyPhotos(property)[0]}
          />
        </div>
        <div className="property-body">
          <h3 title={property.address}>{property.address}</h3>
          <p
            className="property-location"
            title={`${property.suburb}, ${property.city}`}
          >
            {property.suburb}, {property.city}
          </p>
          <div className="property-specs" aria-label="Property features">
            <span
              className="property-spec-item"
              title={`${property.bedrooms} bedrooms`}
            >
              <Bed aria-hidden="true" />
              <span>{property.bedrooms}</span>
            </span>
            <span
              className="property-spec-item"
              title={`${property.bathrooms} bathrooms`}
            >
              <Bath aria-hidden="true" />
              <span>{property.bathrooms}</span>
            </span>

            <span
              className="property-spec-item"
              title={
                property.parkingSpaces === undefined
                  ? "Parking not provided"
                  : `${property.parkingSpaces} parking spaces`
              }
            >
              <Car aria-hidden="true" />
              <span>{property.parkingSpaces ?? "—"}</span>
            </span>
            {property.landArea > 0 ? (
              <span
                className="property-spec-item property-spec-land"
                title={`${numberFormatter.format(property.landArea)} m² land area`}
              >
                <LandPlot aria-hidden="true" />
                <span>{numberFormatter.format(property.landArea)} m²</span>
              </span>
            ) : null}
          </div>
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
        onClick={handleSave}
        type="button"
      >
        <Heart />
      </Button>
      <label className={cn("compare-check", selected && "is-selected")}>
        <Checkbox
          aria-label={`Compare ${property.address}`}
          checked={selected}
          onCheckedChange={handleCompare}
        />
        <span>Compare</span>
      </label>
    </article>
  );
});

function ComparisonDialog({
  properties,
  onClose,
  onRemove,
}: {
  properties: Property[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
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
          <ComparisonMatrix properties={properties} onRemove={onRemove} />
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
  const [comparisonOpen, setComparisonOpen] = useState(false);
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
        savedIdsRef.current = account.workspace.savedPropertyIds;
        setSavedIds(account.workspace.savedPropertyIds);

        // Auto-migrate local guest data into account if account is newly initialized
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

  const persistSavedIds = useCallback(
    (next: string[]) => {
      savedIdsRef.current = next;
      setSavedIds(next);
      if (account?.status === "signedIn")
        void account.save("savedPropertyIds", next);
      else if (!account || account.status === "guest") {
        try {
          localStorage.setItem(
            "haven_saved_property_ids",
            JSON.stringify(next),
          );
        } catch {}
      }
    },
    [account],
  );

  const filteredProperties = useMemo(
    () => filterProperties(properties, filters),
    [properties, filters],
  );
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
    });

  const locationSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          properties.flatMap(({ suburb, city }) =>
            [suburb, city].filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [properties],
  );
  const schoolSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...schoolOptions.map(({ name }) => name),
            ...properties.flatMap(({ schoolZones }) =>
              (schoolZones ?? []).map(
                (zone) => zone.name ?? zone.schoolName ?? "",
              ),
            ),
          ].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [schoolOptions, properties],
  );
  const ownershipOptions = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .map((p) => p.ownershipType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [properties],
  );

  function updateListFilter(key: "locations" | "schoolNames") {
    return (next: string[]) => {
      setFilters((current) => ({ ...current, [key]: next.length ? next : undefined }));
      setAiMessage("");
    };
  }

  /** Store a double-ended range, treating full-width thumbs as "no filter". */
  function setNumericRange(field: NumericSearchField, min: number, max: number) {
    const config = rangeConfig[field];
    setFilters((current) => {
      const numericCriteria = { ...current.numericCriteria };
      const atMin = min <= config.min;
      const atMax = max >= config.max;
      if (atMin && atMax) delete numericCriteria[field];
      else numericCriteria[field] = { min, max };
      return {
        ...current,
        bedrooms:
          field === "bedrooms" ? undefined : current.bedrooms,
        numericCriteria: Object.keys(numericCriteria).length
          ? numericCriteria
          : undefined,
      };
    });
    setAiMessage("");
  }

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
        floodHazards: p.floodHazards?.map(({ type }) => type),
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
        floodHazards: p.floodHazards?.map(({ type }) => type),
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

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
          if (result.status === "ready") setFilters(result.filters);
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
    ++searchSeqRef.current;
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
      propertyTypes: current.propertyTypes?.filter((item) => item !== type),
    }));
    setAiMessage("");
  }

  function clearFilters() {
    ++searchSeqRef.current;
    setFilters({});
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

  const toggleCompare = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const toggleSave = useCallback(
    (id: string) => {
      const current = savedIdsRef.current;
      persistSavedIds(
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      );
    },
    [persistSavedIds],
  );

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
      <SiteHeader currentPage="discover">
        <Button variant="ghost" className="saved-homes-nav" asChild>
          <Link
            href="/profile#saved-homes"
            aria-label={`Saved Homes ${savedIds.length}`}
          >
            <Heart data-icon="inline-start" />
            <span className="saved-homes-label">Saved Homes</span>
            <Badge variant="secondary">{savedIds.length}</Badge>
          </Link>
        </Button>
      </SiteHeader>
      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <h1>
              Find your kind of <em>home.</em>
            </h1>
            <form className="ai-search" onSubmit={submitAiSearch}>
              <Field>
                <FieldLabel className="sr-only" htmlFor="ai-property-search">
                  Describe your ideal property
                </FieldLabel>
                <InputGroup className="search-input-group">
                  <InputGroupInput
                    id="ai-property-search"
                    aria-label="Describe your ideal property"
                    placeholder="A character villa in Ponsonby under $2.5m…"
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                  />
                  <InputGroupAddon className="desktop-search-icon">
                    <Search />
                  </InputGroupAddon>
                  <InputGroupAddon
                    align="inline-end"
                    className="desktop-search-actions"
                  >
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
                  <InputGroupAddon
                    align="inline-end"
                    className="mobile-search-actions"
                  >
                    <InputGroupButton
                      className="mobile-search-action"
                      size="icon-sm"
                      type={query ? "button" : "submit"}
                      aria-label={
                        isSearching
                          ? "Searching properties"
                          : query
                            ? "Clear property search"
                            : "Search properties"
                      }
                      disabled={isSearching}
                      onClick={
                        query && !isSearching
                          ? () => handleQueryChange("")
                          : undefined
                      }
                    >
                      {isSearching ? <Spinner /> : query ? <X /> : <Search />}
                    </InputGroupButton>
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
          <div className="filter-focus-region">
            <div className="filter-focus-clip">
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
                    type="multiple"
                    value={
                      filters.propertyTypes?.length
                        ? filters.propertyTypes
                        : ["all"]
                    }
                    onValueChange={(values) => {
                      const next =
                        values.at(-1) === "all"
                          ? []
                          : values.filter((value) => value !== "all");
                      setFilters((current) => ({
                        ...current,
                        propertyTypes: next.length
                          ? (next as PropertyType[])
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
                        <ToggleGroupItem
                          value={type}
                          key={type}
                          aria-label={type}
                        >
                          <TypeIcon data-icon="inline-start" />
                          {type}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </div>
                <div className="filter-actions">
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

                <CollapsibleContent>
                  <FieldGroup className="advanced-filters">
                    <FieldSet className="filter-card-box range-group">
                      <FieldLegend>Price</FieldLegend>
                      <div className="range-pair">
                        <RangeSlider
                          label="Price range"
                          min={PRICE_RANGE.min}
                          max={PRICE_RANGE.max}
                          step={PRICE_RANGE.step}
                          value={[
                            filters.minPrice ?? PRICE_RANGE.min,
                            filters.maxPrice ?? PRICE_RANGE.max,
                          ]}
                          formatValue={formatMoney}
                          onChange={([minPrice, maxPrice]) =>
                            setFilters((current) => ({
                              ...current,
                              minPrice:
                                minPrice <= PRICE_RANGE.min ? undefined : minPrice,
                              maxPrice:
                                maxPrice >= PRICE_RANGE.max ? undefined : maxPrice,
                            }))
                          }
                        />
                        <RangeSlider
                          label="Rent range"
                          min={RENT_RANGE.min}
                          max={RENT_RANGE.max}
                          step={RENT_RANGE.step}
                          value={[
                            filters.numericCriteria?.estimatedWeeklyRent?.min ??
                              RENT_RANGE.min,
                            filters.numericCriteria?.estimatedWeeklyRent?.max ??
                              RENT_RANGE.max,
                          ]}
                          formatValue={(value) => `${formatMoney(value)}/wk`}
                          onChange={([min, max]) => setNumericRange("estimatedWeeklyRent", min, max)}
                        />
                      </div>
                    </FieldSet>

                    <FieldSet className="filter-card-box">
                      <FieldLegend>Property size &amp; capacity</FieldLegend>
                      <div className="range-stack">
                        {RANGE_FIELDS.map((field) => {
                          const config = rangeConfig[field];
                          const range = filters.numericCriteria?.[field];
                          return (
                            <RangeSlider
                              key={field}
                              label={numericFilterLabels[field]}
                              min={config.min}
                              max={config.max}
                              step={config.step}
                              value={[range?.min ?? config.min, range?.max ?? config.max]}
                              formatValue={config.format}
                              onChange={([min, max]) => setNumericRange(field, min, max)}
                            />
                          );
                        })}
                      </div>
                    </FieldSet>

                    <FieldSet className="filter-card-box">
                      <FieldLegend>Age</FieldLegend>
                      <RangeSlider
                        label="Year built"
                        min={YEAR_RANGE.min}
                        max={YEAR_RANGE.max}
                        step={YEAR_RANGE.step}
                        value={[
                          filters.yearBuiltFrom ?? YEAR_RANGE.min,
                          filters.yearBuiltTo ?? YEAR_RANGE.max,
                        ]}
                        formatValue={(value) => String(value)}
                        onChange={([from, to]) =>
                          setFilters((current) => ({
                            ...current,
                            yearBuiltFrom:
                              from <= YEAR_RANGE.min ? undefined : from,
                            yearBuiltTo: to >= YEAR_RANGE.max ? undefined : to,
                          }))
                        }
                      />
                    </FieldSet>

                    <FieldSet className="filter-card-box">
                      <FieldLegend>Title</FieldLegend>
                      <div className="check-list">
                        {ownershipOptions.map((ownership) => (
                          <label key={ownership}>
                            <Checkbox
                              checked={
                                filters.ownershipTypes?.includes(ownership) ??
                                false
                              }
                              onCheckedChange={(checked) =>
                                setFilters((current) => {
                                  const next = checked
                                    ? [...(current.ownershipTypes ?? []), ownership]
                                    : current.ownershipTypes?.filter(
                                        (value) => value !== ownership,
                                      );
                                  return {
                                    ...current,
                                    ownershipTypes: next?.length
                                      ? next
                                      : undefined,
                                  };
                                })
                              }
                            />
                            <span>{ownership}</span>
                          </label>
                        ))}
                      </div>
                    </FieldSet>

                    <Field className="filter-card-box">
                      <FieldLabel htmlFor="flood-risk-filter">Flood risk</FieldLabel>
                      <NativeSelect
                        id="flood-risk-filter"
                        value={filters.floodRisk ?? "none"}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            floodRisk:
                              event.target.value === "none"
                                ? undefined
                                : (event.target.value as FloodRiskLevel),
                            floodHazardTypes: undefined,
                            noMappedFloodHazard: undefined,
                          }))
                        }
                      >
                        <option value="none">No flood filter</option>
                        <option value="exclude_low">
                          Exclude areas with low flood risk
                        </option>
                        <option value="exclude_high">
                          Exclude areas with high flood risk
                        </option>
                      </NativeSelect>
                    </Field>

                    <Field className="full-width-field">
                      <FieldLabel htmlFor="location-input">
                        Location / Suburb
                      </FieldLabel>
                      <TokenField
                        id="location-input"
                        label="Suburb or location filter"
                        placeholder="e.g. Ponsonby, Grey Lynn"
                        values={filters.locations ?? []}
                        suggestions={locationSuggestions}
                        onChange={updateListFilter("locations")}
                      />
                      <p className="filter-help">
                        Type a suburb or city and press Enter. Add several to
                        search them together.
                      </p>
                    </Field>

                    <Field className="filter-card-box full-width-field">
                      <FieldLabel htmlFor="school-input">School</FieldLabel>
                      <TokenField
                        id="school-input"
                        label="School"
                        placeholder="e.g. Auckland Grammar, Epsom Girls"
                        values={filters.schoolNames ?? []}
                        suggestions={schoolSuggestions}
                        onChange={updateListFilter("schoolNames")}
                      />
                      <p className="filter-help">
                        Match a nearby school or enrolment zone. Add several to
                        search them together.
                      </p>
                    </Field>
                  </FieldGroup>

                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

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
                    {(filters.locations ?? (filters.location ? [filters.location] : [])).map(
                      (location) => (
                        <span className="filter-chip" key={`location-${location}`}>
                          📍 {location}
                          <Button
                            variant="ghost"
                            aria-label={`Remove location ${location}`}
                            className="filter-chip-remove"
                            onClick={() =>
                              setFilters((curr) => {
                                const next = (curr.locations ?? []).filter(
                                  (value) => value !== location,
                                );
                                return {
                                  ...curr,
                                  locations: next.length ? next : undefined,
                                  location:
                                    curr.location === location
                                      ? undefined
                                      : curr.location,
                                };
                              })
                            }
                            type="button"
                          >
                            ×
                          </Button>
                        </span>
                      ),
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
                    {filters.schoolNames?.map((name) => (
                      <span className="filter-chip" key={`school-${name}`}>
                        🎓 {name}
                        <Button
                          variant="ghost"
                          aria-label={`Remove school ${name}`}
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => {
                              const next = (current.schoolNames ?? []).filter(
                                (value) => value !== name,
                              );
                              return {
                                ...current,
                                schoolNames: next.length ? next : undefined,
                              };
                            })
                          }
                          type="button"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    {filters.floodRisk && (
                      <span className="filter-chip">
                        {filters.floodRisk === "exclude_low"
                          ? "Exclude low flood risk"
                          : "Exclude high flood risk"}
                        <Button
                          variant="ghost"
                          aria-label="Remove flood risk filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((curr) => ({
                              ...curr,
                              floodRisk: undefined,
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
                    {filters.minPrice !== undefined && (
                      <span className="filter-chip">
                        Price ≥ $
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
                    {filters.maxPrice !== undefined && (
                      <span className="filter-chip">
                        Price ≤ $
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
                    {filters.ownershipTypes?.map((ownership) => (
                      <span className="filter-chip" key={ownership}>
                        {ownership}
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${ownership.toLowerCase()} title filter`}
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
                    {(filters.yearBuiltFrom !== undefined ||
                      filters.yearBuiltTo !== undefined) && (
                      <span className="filter-chip">
                        Built {filters.yearBuiltFrom ?? YEAR_RANGE.min}–
                        {filters.yearBuiltTo ?? YEAR_RANGE.max}
                        <Button
                          variant="ghost"
                          aria-label="Remove age filter"
                          className="filter-chip-remove"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              yearBuiltFrom: undefined,
                              yearBuiltTo: undefined,
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
                    onCompare={toggleCompare}
                    onSave={toggleSave}
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
          <div className="calculator-container">
            <MortgageCalculator defaultPrice={1250000} />
          </div>
        </section>
      </main>

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

      {!!selectedProperties.length &&
        typeof document !== "undefined" &&
        createPortal(
          <section className="compare-tray" aria-label="Your comparison">
            <span className="compare-tray-count">
              {selectedProperties.length} selected
            </span>
            <div className="compare-tray-homes">
              {selectedProperties.map((property) => (
                <Badge variant="secondary" key={property.id}>
                  <span title={property.address}>{property.address}</span>
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
          </section>,
          document.body,
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
