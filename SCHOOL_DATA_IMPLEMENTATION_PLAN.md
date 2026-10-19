# School Data Feature Implementation Plan

## Status

Implemented. The file-based importer and migrations must still be run against the application's database to populate real Education Counts data. No production/app database was modified during implementation. The per-school zone endpoint returns a Cloudflare HTTP 403 to Node in this environment, so the local bulk MapInfo download is the supported zone import path.

## Goal

Let users:

- See schools within **2.5 km** of a property, including each school's type and distance.
- See whether the property is within one or more school enrolment zones.
- Filter nearby schools by school type.
- Search for properties within a selected school's zone or within **2.5 km** of a selected school.

All spatial calculations must run in PostGIS. Do not display maps or school-zone polygons in the frontend. Do not display flood-risk maps either.

## Data sources and scope

Use the New Zealand Education Counts Schools Directory API documented at:

- <https://www.educationcounts.govt.nz/directories/school-directory-api>

The per-school endpoint exists for schools that have an enrolment scheme, but Node requests from this development environment are challenged by Cloudflare:

- `https://www.educationcounts.govt.nz/js-content/school-enrolment-zone-geo-data?school={SchoolID}`

Use the official bulk Enrolment Scheme Master MapInfo download instead:

- <https://www.educationcounts.govt.nz/__data/assets/file/0003/108606/Enrolmentschememaster.zip>
- Local extracted file inspected at `/Users/yasser/Downloads/Enrolmentschememaster`; contains 1,327 polygons for 1,291 schools.
- Use the current Auckland School_Id set from the Schools Directory API to filter the file, retaining only IDs marked with an enrolment scheme. Do not use the MapInfo `Office` value for regional selection.
- The file CRS is EPSG:2193; the importer reprojects selected polygons to EPSG:4326. Ignore `EffectiveDate` per user direction.
- Accept the Ministry's stated low spatial resolution and alignment limitations; clearly disclaim that property/zone matches may be inaccurate.

The directory API's current value for Auckland is `Regional_Council: "Auckland Region"`. Filter on that exact value. Retain only these school-directory fields:

- `School_Id`
- `Org_Name`
- `Org_Type`
- `Latitude`
- `Longitude`
- `Enrolment_Scheme`

For zones, retain only the directory-matched school identifier, the relevant zone name/type (`PolyName`, `INSTTYPE`), and polygon geometry needed for spatial matching. Do not persist unrelated MapInfo attributes or the `EffectiveDate`.

Keep every source `Org_Type` value for Auckland schools and present them with readable labels. Do not restrict school types to only primary, intermediate, and secondary.

## Existing application context

- The app already uses PostgreSQL, Drizzle, and PostGIS. Follow the existing flood-data importer and spatial-query patterns where applicable.
- `property_school_zones` currently represents seeded/demo per-property results (name, broad type, distance, and `is_in_zone`); it does not represent canonical schools or imported zone polygons. Replace or migrate this representation rather than treating those records as authoritative imported school data.
- Relevant existing schema references include `ai-real-estate/lib/db/schema.ts` and `backend/schema.SQL`.
- Flood data remains independent; retain the current no-map flood UI and do not expand flood scope as part of this work.

## Implementation phases

### 1. Verify source data and response geometry

- Verified the CKAN `datastore_search` API, resource ID `4b292323-9fcc-41f8-814b-3c7b19cf14b3`, field selection, offset pagination, the Auckland Region filter, and `Yes`/`No` enrolment-scheme values.
- Confirmed the current filtered directory contains 573 records and inspected a representative polygon response from the zone endpoint.
- Store the source `Org_Type` unchanged and use it as the readable UI label.

### 2. Design and migrate the database

- Added canonical `schools`, `school_zones`, and `school_data_sync` tables with PostGIS geography/geometry, spatial indexes, and sync counts/timestamp.
- Removed the old demo `property_school_zones` table and `school_zone_type` enum from the current Drizzle schema and SQL reference; a migration drops them. Seed logic no longer inserts synthetic school-zone rows.
- Updated Drizzle schema, PostgreSQL migrations, SQL reference, and property types.

### 3. Implement a repeatable import command

- Added `npm run db:sync-school-data`, a manual developer-run command that is not invoked at application startup.
- Added `npm run db:sync-school-data-file -- <MapInfo .TAB file or extracted folder> [--dry-run]`. It imports Auckland-filtered, whitelisted directory fields and filters MapInfo features by the current directory school IDs marked as having an enrolment scheme.
- GDAL `ogr2ogr` converts the MapInfo features to GeoJSON, promotes polygons to multipolygons, and reprojects EPSG:2193 to EPSG:4326. The importer ignores `EffectiveDate` and `Office`, retains only school ID/name/type and geometry, and stages everything before transactional replacement.
- `--dry-run` fetches the current directory and validates/counts selected file features without connecting to or modifying the database.
- `npm run db:export-school-data-sql -- <MapInfo .TAB file or extracted folder> --export-sql <output.sql>` creates a portable SQL handoff with Auckland school rows, matched zones, and sync metadata. It requires no PostgreSQL connection; the recipient applies it after installing PostGIS and running app migrations.
- The original per-school API importer remains, but its zone requests are blocked by Cloudflare's challenge (HTTP 403) in this environment. Use the local bulk-file importer.
- Dry-run validation against the downloaded 2 October 2026 file found 573 Auckland schools, 393 with an enrolment scheme, and 391 zone polygons for 387 schools; six scheme schools had no polygon in the file.
- The importer handles paginated responses, bounded concurrent zone requests, retries transient API failures, validates records, stages data, and replaces imported rows and sync metadata in a transaction.
- No automatic schedule is enabled.

### 4. Add PostGIS-backed property data

- Property reads use PostGIS `ST_DWithin`/`ST_Distance` on school geography points and `ST_Covers` on zone polygons.
- Nearby-school results are limited to **2,500 metres**. School IDs, names, source types, distance, scheme/geometry status, and containing-zone details are returned to the app.
- A `school_data_sync` row distinguishes not-imported data from successfully imported empty matches.
- The frontend/search filters consume these PostGIS results; they do not compute distance or point-in-polygon matches.

### 5. Add details UI and search

- Property details list nearby schools with type/distance, a type filter, and the school's mapped zone-membership state; containing zones are listed separately. The UI discloses the Ministry's stated resolution/alignment limitations and warns the result may be inaccurate.
- Added search filters for nearby-school type and for properties inside a selected school's zone or within 2.5 km of a selected school. Selectors use School_Id.
- Zone searches only offer schools with imported zone geometry. Data states distinguish unavailable zone geometry from an outside-zone result.
- The frontend shows no school-zone or flood-risk maps.

### 6. Validate, test, and document

- Added tests for Auckland filtering, allowed fields, pagination, scheme-only geometry requests, invalid records, type/radius/zone filters, and property UI.
- Applied all migrations to a disposable PostgreSQL/PostGIS database. Exercised the importer with fixture data, radius checks inside/outside 2,500 m, zone containment/boundary checks, and property loading.
- Updated README with provenance, import command, field scope, and no-map behavior.
- The portable SQL export is generated at `/Users/yasser/Downloads/auckland-school-data.sql` for handoff. It was applied and verified in a disposable PostgreSQL/PostGIS database: 573 school rows, 391 zones, all at SRID 4326, and no invalid geometries. No application database has been changed by this implementation.

## Acceptance criteria

- Only Auckland-region schools are imported, and only the listed school-directory fields are persisted.
- Zone geometry is imported only for schools with an enrolment scheme; unrelated endpoint data is not stored.
- Property details show nearby schools only within **2.5 km**, with type and distance, and show any containing zones.
- Users can filter nearby schools by all available Auckland source types.
- Users can search for properties in a selected school's zone or within **2.5 km** of a selected school.
- PostGIS performs the distance and zone-membership calculations.
- Import state is explicit; incomplete or failed imports are not shown as successful empty results.
- No map is shown for school zones or flood risk.
