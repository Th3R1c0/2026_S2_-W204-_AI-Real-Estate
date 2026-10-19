import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  decimal,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { BuyerWorkspace } from "../account/workspace";

export const listingTypeEnum = pgEnum("listing_type", ["sale", "rent", "lease"]);
export const propertyStatusEnum = pgEnum("property_status", [
  "draft",
  "active",
  "under_offer",
  "sold",
  "rented",
  "withdrawn",
]);
export const pricingMethodEnum = pgEnum("pricing_method", [
  "fixed",
  "negotiation",
  "auction",
  "tender",
  "enquiries_over",
  "price_on_application",
]);
export const rentPeriodEnum = pgEnum("rent_period", ["week", "fortnight", "month"]);
export const propertyTypeEnum = pgEnum("property_type", [
  "house",
  "apartment",
  "townhouse",
  "unit",
  "section",
  "lifestyle",
  "commercial",
  "other",
]);
export const orientationEnum = pgEnum("orientation", ["North", "East", "South", "West"]);
export const floodHazardTypeEnum = pgEnum("flood_hazard_type", [
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
  "coastal_inundation",
]);

export const users = pgTable(
  "users",
  {
    userId: serial("user_id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_users_username").on(table.username),
    uniqueIndex("uq_users_email").on(table.email),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_user_sessions_user").on(table.userId)],
);

export const buyerWorkspaces = pgTable("buyer_workspaces", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.userId, { onDelete: "cascade" }),
  savedPropertyIds: jsonb("saved_property_ids")
    .$type<BuyerWorkspace["savedPropertyIds"]>()
    .default([])
    .notNull(),
  generalNotes: jsonb("general_notes")
    .$type<BuyerWorkspace["generalNotes"]>()
    .default([])
    .notNull(),
  propertyNotes: jsonb("property_notes")
    .$type<BuyerWorkspace["propertyNotes"]>()
    .default({})
    .notNull(),
  destinations: jsonb("destinations")
    .$type<BuyerWorkspace["destinations"]>()
    .default([])
    .notNull(),
  chatHistory: jsonb("chat_history")
    .$type<BuyerWorkspace["chatHistory"]>()
    .default([])
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const properties = pgTable(
  "properties",
  {
    propertyId: serial("property_id").primaryKey(),
    demoKey: varchar("demo_key", { length: 80 }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    listingType: listingTypeEnum("listing_type").notNull(),
    status: propertyStatusEnum("status").default("draft").notNull(),
    listedAt: timestamp("listed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_properties_demo_key").on(table.demoKey),
    index("idx_properties_status_type").on(table.status, table.listingType),
  ],
);

export const propertyPrice = pgTable(
  "property_price",
  {
    propertyId: integer("property_id")
      .primaryKey()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    pricingMethod: pricingMethodEnum("pricing_method").default("fixed").notNull(),
    salePrice: decimal("sale_price", { precision: 12, scale: 2 }),
    rentPrice: decimal("rent_price", { precision: 10, scale: 2 }),
    rentPeriod: rentPeriodEnum("rent_period"),
    leasePrice: decimal("lease_price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("NZD").notNull(),
  },
  (table) => [
    index("idx_price_sale").on(table.salePrice),
    index("idx_price_rent").on(table.rentPrice),
  ],
);

export const address = pgTable(
  "address",
  {
    propertyId: integer("property_id")
      .primaryKey()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    unitNumber: varchar("unit_number", { length: 20 }),
    streetNumber: varchar("street_number", { length: 20 }).notNull(),
    streetName: varchar("street_name", { length: 120 }).notNull(),
    suburb: varchar("suburb", { length: 100 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }),
    postCode: varchar("post_code", { length: 12 }),
    country: varchar("country", { length: 100 }).default("New Zealand").notNull(),
    latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  },
  (table) => [
    index("idx_address_city_suburb").on(table.city, table.suburb),
    index("idx_address_post_code").on(table.postCode),
    index("idx_address_coords").on(table.latitude, table.longitude),
  ],
);

export const propertyDetails = pgTable(
  "property_details",
  {
    propertyId: integer("property_id")
      .primaryKey()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    propertyType: propertyTypeEnum("property_type").default("house").notNull(),
    displayPropertyType: varchar("display_property_type", { length: 40 }),
    architecturalStyle: varchar("architectural_style", { length: 40 }),
    orientation: orientationEnum("orientation"),
    sunlightHours: decimal("sunlight_hours", { precision: 4, scale: 1 }),
    landArea: decimal("land_area", { precision: 10, scale: 2 }),
    floorArea: decimal("floor_area", { precision: 10, scale: 2 }),
    bedrooms: smallint("bedrooms").default(0).notNull(),
    bathrooms: smallint("bathrooms").default(0).notNull(),
    ensuites: smallint("ensuites").default(0).notNull(),
    toilets: smallint("toilets").default(0).notNull(),
    livingRooms: smallint("living_rooms").default(0).notNull(),
    garageParking: smallint("garage_parking").default(0).notNull(),
    offStreetParking: smallint("off_street_parking").default(0).notNull(),
    yearBuilt: integer("year_built"),
    capitalValue: decimal("capital_value", { precision: 12, scale: 2 }),
    estimatedWeeklyRent: decimal("estimated_weekly_rent", { precision: 10, scale: 2 }),
    ownershipType: varchar("ownership_type", { length: 60 }),
    saleMethod: varchar("sale_method", { length: 160 }),
    imageSourceUrl: varchar("image_source_url", { length: 500 }),
    agentName: varchar("agent_name", { length: 120 }),
    agentSource: varchar("agent_source", { length: 60 }),
    agentContactUrl: varchar("agent_contact_url", { length: 500 }),
  },
  (table) => [
    index("idx_details_beds_baths").on(table.bedrooms, table.bathrooms),
    check(
      "chk_details_unsigned_counts",
      sql`${table.bedrooms} BETWEEN 0 AND 255
        AND ${table.bathrooms} BETWEEN 0 AND 255
        AND ${table.ensuites} BETWEEN 0 AND 255
        AND ${table.toilets} BETWEEN 0 AND 255
        AND ${table.livingRooms} BETWEEN 0 AND 255
        AND ${table.garageParking} BETWEEN 0 AND 255
        AND ${table.offStreetParking} BETWEEN 0 AND 255`,
    ),
    check(
      "chk_details_year_built",
      sql`${table.yearBuilt} IS NULL OR ${table.yearBuilt} BETWEEN 0 AND 65535`,
    ),
  ],
);

export const openHomes = pgTable(
  "open_homes",
  {
    openHomeId: serial("open_home_id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    openDate: date("open_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    label: varchar("label", { length: 160 }),
  },
  (table) => [
    index("idx_open_homes_property_date").on(table.propertyId, table.openDate),
    check("chk_oh_times", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const propertyValuations = pgTable(
  "property_valuations",
  {
    valuationId: serial("valuation_id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    valuationDate: date("valuation_date", { mode: "string" }).notNull(),
    capitalValue: decimal("capital_value", { precision: 12, scale: 2 }),
    landValue: decimal("land_value", { precision: 12, scale: 2 }),
    improvementValue: decimal("improvement_value", { precision: 12, scale: 2 }),
    lowEstimate: decimal("low_estimate", { precision: 12, scale: 2 }),
    medianEstimate: decimal("median_estimate", { precision: 12, scale: 2 }),
    highEstimate: decimal("high_estimate", { precision: 12, scale: 2 }),
    source: varchar("source", { length: 100 }),
  },
  (table) => [index("idx_val_property_date").on(table.propertyId, table.valuationDate)],
);

export const propertySales = pgTable(
  "property_sales",
  {
    saleId: serial("sale_id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    soldPrice: decimal("sold_price", { precision: 12, scale: 2 }).notNull(),
    soldDate: date("sold_date", { mode: "string" }).notNull(),
  },
  (table) => [index("idx_sales_property_date").on(table.propertyId, table.soldDate)],
);

export const propertyImages = pgTable(
  "property_images",
  {
    imageId: serial("image_id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    caption: varchar("caption", { length: 200 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isCover: boolean("is_cover").default(false).notNull(),
  },
  (table) => [
    index("idx_images_property").on(table.propertyId, table.sortOrder),
    check("chk_images_sort_order", sql`${table.sortOrder} BETWEEN 0 AND 65535`),
  ],
);

export const schools = pgTable(
  "schools",
  {
    schoolId: integer("school_id").primaryKey(),
    orgName: varchar("org_name", { length: 200 }).notNull(),
    orgType: varchar("org_type", { length: 100 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    enrolmentScheme: boolean("enrolment_scheme").notNull(),
  },
  (table) => [index("idx_schools_coords").on(table.latitude, table.longitude)],
);

export const schoolZones = pgTable(
  "school_zones",
  {
    schoolZoneId: serial("school_zone_id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.schoolId, { onDelete: "cascade" }),
    zoneName: varchar("zone_name", { length: 200 }),
    zoneType: varchar("zone_type", { length: 100 }),
  },
  (table) => [index("idx_school_zones_school").on(table.schoolId)],
);

export const schoolDataSync = pgTable(
  "school_data_sync",
  {
    singletonId: integer("singleton_id").primaryKey(),
    importedSchoolCount: integer("imported_school_count").notNull(),
    importedZoneCount: integer("imported_zone_count").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("chk_school_data_sync_singleton", sql`${table.singletonId} = 1`),
  ],
);

export const floodHazardSync = pgTable("flood_hazard_sync", {
  hazardType: floodHazardTypeEnum("hazard_type").primaryKey(),
  importedFeatureCount: integer("imported_feature_count").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const propertyFloodHazards = pgTable(
  "property_flood_hazards",
  {
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    hazardType: floodHazardTypeEnum("hazard_type").notNull(),
    sourceFeatureId: varchar("source_feature_id", { length: 100 }).notNull(),
    sourceUrl: varchar("source_url", { length: 500 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.propertyId, table.hazardType, table.sourceFeatureId],
    }),
    index("idx_property_flood_hazards_property").on(table.propertyId),
  ],
);

export const propertySources = pgTable(
  "property_sources",
  {
    propertySourceId: serial("property_source_id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    sourceKey: varchar("source_key", { length: 80 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    publisher: varchar("publisher", { length: 150 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    reference: varchar("reference", { length: 255 }).notNull(),
    material: text("material").notNull(),
    fields: json("fields").$type<string[]>().notNull(),
  },
  (table) => [index("idx_sources_property").on(table.propertyId)],
);

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  price: one(propertyPrice),
  address: one(address),
  details: one(propertyDetails),
  images: many(propertyImages),
  openHomes: many(openHomes),
  sales: many(propertySales),
  floodHazards: many(propertyFloodHazards),
  sources: many(propertySources),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  zones: many(schoolZones),
}));

export const schoolZonesRelations = relations(schoolZones, ({ one }) => ({
  school: one(schools, {
    fields: [schoolZones.schoolId],
    references: [schools.schoolId],
  }),
}));
