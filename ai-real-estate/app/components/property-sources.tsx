"use client";
import type {
  Property,
  PropertySource,
  PropertySourceField,
} from "@/lib/property-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
const numberFormatter = new Intl.NumberFormat("en-NZ");
const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
export type SourceSelection = {
  source: PropertySource;
  field: PropertySourceField;
  property: Property;
};
const sourceFieldLabels: Record<PropertySourceField, string> = {
  address: "address",
  price: "indicative value",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  landArea: "land area",
};

export function SourceCitations({
  property,
  field,
  onOpen,
}: {
  property: Property;
  field: PropertySourceField;
  onOpen: (source: PropertySource, field: PropertySourceField) => void;
}) {
  const sources =
    property.sources?.filter((source) => source.fields.includes(field)) ?? [];

  if (!sources.length) return null;

  return (
    <span className="source-citations">
      {sources.map((source, index) => (
        <Button
          variant="ghost"
          aria-label={`View source ${index + 1} for ${sourceFieldLabels[field]}`}
          className="source-citation"
          key={source.id}
          onClick={() => onOpen(source, field)}
          type="button"
        >
          [{index + 1}]
        </Button>
      ))}
    </span>
  );
}

export function SourceDetailsDialog({
  selection,
  onClose,
}: {
  selection: SourceSelection;
  onClose: () => void;
}) {
  const { field, property, source } = selection;
  const claimValue = {
    address: property.address,
    price: formatMoney(property.price),
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    landArea: `${numberFormatter.format(property.landArea)} m²`,
  }[field];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="source-modal" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Source details</DialogTitle>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Reference for {sourceFieldLabels[field]}</p>
            <h2>{source.title}</h2>
          </div>
        </div>
        <div className="source-content">
          <dl className="source-claim">
            <div>
              <dt>Property claim</dt>
              <dd>{claimValue}</dd>
            </div>
            <div>
              <dt>Property</dt>
              <dd>{property.address}</dd>
            </div>
          </dl>
          <div className="source-publication">
            <p className="eyebrow">Published by {source.publisher}</p>
            <p>{source.reference}</p>
          </div>
          <div className="source-material">
            <h3>Reference material</h3>
            <blockquote>{source.material}</blockquote>
          </div>
          <a
            className="source-link"
            href={source.url}
            rel="noreferrer"
            target="_blank"
          >
            Open original source ↗
          </a>
          <p className="source-caveat">
            This is a one-time research snapshot. Website estimates and
            historical council values are not current asking prices or confirmed
            sale prices.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
