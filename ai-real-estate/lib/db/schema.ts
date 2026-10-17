import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  char,
  customType,
  date,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

const point = customType<{ data: string; driverData: string }>({
  dataType: () => "point",
});

export const users = mysqlTable(
  "users",
  {
    userId: int("user_id", { unsigned: true }).autoincrement().primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_users_username").on(table.username),
    uniqueIndex("uq_users_email").on(table.email),
  ],
);

export const agencies = mysqlTable("agencies", {
  agencyId: int("agency_id", { unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
});

export const realEstateAgents = mysqlTable(
  "real_estate_agents",
  {
    agentId: int("agent_id", { unsigned: true }).autoincrement().primaryKey(),
    agencyId: int("agency_id", { unsigned: true }).references(() => agencies.agencyId, {
      onDelete: "set null",
    }),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 30 }),
    phoneNumber2: varchar("phone_number_2", { length: 30 }),
    photoUrl: varchar("photo_url", { length: 500 }),
  },
  (table) => [uniqueIndex("uq_agents_email").on(table.email)],
);

export const properties = mysqlTable(
  "properties",
  {
    propertyId: int("property_id", { unsigned: true }).autoincrement().primaryKey(),
    demoKey: varchar("demo_key", { length: 80 }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    listingType: mysqlEnum("listing_type", ["sale", "rent", "lease"]).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "active",
      "under_offer",
      "sold",
      "rented",
      "withdrawn",
    ])
      .default("draft")
      .notNull(),
    listedAt: datetime("listed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_properties_demo_key").on(table.demoKey),
    index("idx_properties_status_type").on(table.status, table.listingType),
  ],
);

export const propertyPrice = mysqlTable(
  "property_price",
  {
    propertyId: int("property_id", { unsigned: true })
      .primaryKey()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    pricingMethod: mysqlEnum("pricing_method", [
      "fixed",
      "negotiation",
      "auction",
      "tender",
      "enquiries_over",
      "price_on_application",
    ])
      .default("fixed")
      .notNull(),
    salePrice: decimal("sale_price", { precision: 12, scale: 2 }),
    rentPrice: decimal("rent_price", { precision: 10, scale: 2 }),
    rentPeriod: mysqlEnum("rent_period", ["week", "fortnight", "month"]),
    leasePrice: decimal("lease_price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("NZD").notNull(),
  },
  (table) => [
    index("idx_price_sale").on(table.salePrice),
    index("idx_price_rent").on(table.rentPrice),
  ],
);

export const address = mysqlTable(
  "address",
  {
    propertyId: int("property_id", { unsigned: true })
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
    location: point("location").notNull(),
  },
  (table) => [
    index("idx_address_city_suburb").on(table.city, table.suburb),
    index("idx_address_post_code").on(table.postCode),
  ],
);

export const propertyDetails = mysqlTable(
  "property_details",
  {
    propertyId: int("property_id", { unsigned: true })
      .primaryKey()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    propertyType: mysqlEnum("property_type", [
      "house",
      "apartment",
      "townhouse",
      "unit",
      "section",
      "lifestyle",
      "commercial",
      "other",
    ])
      .default("house")
      .notNull(),
    landArea: decimal("land_area", { precision: 10, scale: 2 }),
    floorArea: decimal("floor_area", { precision: 10, scale: 2 }),
    bedrooms: tinyint("bedrooms", { unsigned: true }).default(0).notNull(),
    bathrooms: tinyint("bathrooms", { unsigned: true }).default(0).notNull(),
    ensuites: tinyint("ensuites", { unsigned: true }).default(0).notNull(),
    toilets: tinyint("toilets", { unsigned: true }).default(0).notNull(),
    livingRooms: tinyint("living_rooms", { unsigned: true }).default(0).notNull(),
    garageParking: tinyint("garage_parking", { unsigned: true }).default(0).notNull(),
    offStreetParking: tinyint("off_street_parking", { unsigned: true }).default(0).notNull(),
    yearBuilt: smallint("year_built", { unsigned: true }),
  },
  (table) => [index("idx_details_beds_baths").on(table.bedrooms, table.bathrooms)],
);

export const propertyAgents = mysqlTable(
  "property_agent",
  {
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    agentId: int("agent_id", { unsigned: true })
      .notNull()
      .references(() => realEstateAgents.agentId, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.propertyId, table.agentId] })],
);

export const openHomes = mysqlTable(
  "open_homes",
  {
    openHomeId: int("open_home_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    openDate: date("open_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("idx_open_homes_property_date").on(table.propertyId, table.openDate),
    check("chk_oh_times", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const propertyValuations = mysqlTable(
  "property_valuations",
  {
    valuationId: int("valuation_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
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

export const propertySales = mysqlTable(
  "property_sales",
  {
    saleId: int("sale_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    soldPrice: decimal("sold_price", { precision: 12, scale: 2 }).notNull(),
    soldDate: date("sold_date", { mode: "string" }).notNull(),
  },
  (table) => [index("idx_sales_property_date").on(table.propertyId, table.soldDate)],
);

export const propertyImages = mysqlTable(
  "property_images",
  {
    imageId: int("image_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    caption: varchar("caption", { length: 200 }),
    sortOrder: smallint("sort_order", { unsigned: true }).default(0).notNull(),
    isCover: boolean("is_cover").default(false).notNull(),
  },
  (table) => [index("idx_images_property").on(table.propertyId, table.sortOrder)],
);

export const features = mysqlTable(
  "features",
  {
    featureId: int("feature_id", { unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
  },
  (table) => [uniqueIndex("uq_features_name").on(table.name)],
);

export const propertyFeatures = mysqlTable(
  "property_features",
  {
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    featureId: int("feature_id", { unsigned: true })
      .notNull()
      .references(() => features.featureId, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.propertyId, table.featureId] })],
);

export const savedProperties = mysqlTable(
  "saved_properties",
  {
    userId: int("user_id", { unsigned: true })
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.propertyId] }),
    index("idx_saved_property").on(table.propertyId),
  ],
);

export const enquiries = mysqlTable(
  "enquiries",
  {
    enquiryId: int("enquiry_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    userId: int("user_id", { unsigned: true }).references(() => users.userId, {
      onDelete: "set null",
    }),
    agentId: int("agent_id", { unsigned: true }).references(() => realEstateAgents.agentId, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_enquiries_property").on(table.propertyId)],
);

export const propertyDemoDetails = mysqlTable("property_demo_details", {
  propertyId: int("property_id", { unsigned: true })
    .primaryKey()
    .references(() => properties.propertyId, { onDelete: "cascade" }),
  displayPropertyType: varchar("display_property_type", { length: 40 }),
  architecturalStyle: varchar("architectural_style", { length: 40 }),
  floodRisk: mysqlEnum("flood_risk", ["Low", "Moderate", "High"]),
  orientation: mysqlEnum("orientation", ["North", "East", "South", "West"]),
  sunlightHours: decimal("sunlight_hours", { precision: 4, scale: 1 }),
  walkabilityScore: tinyint("walkability_score", { unsigned: true }),
  walkabilityLabel: varchar("walkability_label", { length: 40 }),
  parksNearby: tinyint("parks_nearby", { unsigned: true }),
  cafesNearby: tinyint("cafes_nearby", { unsigned: true }),
  supermarketsNearby: tinyint("supermarkets_nearby", { unsigned: true }),
});

export const propertySchoolZones = mysqlTable(
  "property_school_zones",
  {
    propertySchoolZoneId: int("property_school_zone_id", { unsigned: true })
      .autoincrement()
      .primaryKey(),
    propertyId: int("property_id", { unsigned: true })
      .notNull()
      .references(() => properties.propertyId, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    type: mysqlEnum("type", ["Primary", "Intermediate", "Secondary"]).notNull(),
    distanceKm: decimal("distance_km", { precision: 5, scale: 2 }).notNull(),
    isInZone: boolean("is_in_zone").default(false).notNull(),
  },
  (table) => [index("idx_school_zones_property").on(table.propertyId)],
);

export const propertySources = mysqlTable(
  "property_sources",
  {
    propertySourceId: int("property_source_id", { unsigned: true }).autoincrement().primaryKey(),
    propertyId: int("property_id", { unsigned: true })
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
  demoDetails: one(propertyDemoDetails),
  images: many(propertyImages),
  sales: many(propertySales),
  schoolZones: many(propertySchoolZones),
  sources: many(propertySources),
}));
