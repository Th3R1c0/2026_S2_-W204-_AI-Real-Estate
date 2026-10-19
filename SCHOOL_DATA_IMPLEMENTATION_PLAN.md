# School Data Feature Implementation Plan

## Status

Planning only. No implementation has been started.

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

Use the enrolment-zone endpoint for schools that have an enrolment scheme:

- `https://www.educationcounts.govt.nz/js-content/school-enrolment-zone-geo-data?school={SchoolID}`

Import only schools whose `Regional_Council` is Auckland. Retain only these school-directory fields:

- `School_Id`
- `Org_Name`
- `Org_Type`
- `Latitude`
- `Longitude`
- `Enrolment_Scheme`

For zone responses, retain only the school identifier, the relevant zone name/type (`PolyName`, `INSTTYPE`), and the polygon geometry needed for spatial matching. Do not persist unrelated directory or zone-response data.

Keep every source `Org_Type` value for Auckland schools and present them with readable labels. Do not restrict school types to only primary, intermediate, and secondary.

## Existing application context

- The app already uses PostgreSQL, Drizzle, and PostGIS. Follow the existing flood-data importer and spatial-query patterns where applicable.
- `property_school_zones` currently represents seeded/demo per-property results (name, broad type, distance, and `is_in_zone`); it does not represent canonical schools or imported zone polygons. Replace or migrate this representation rather than treating those records as authoritative imported school data.
- Relevant existing schema references include `ai-real-estate/lib/db/schema.ts` and `backend/schema.SQL`.
- Flood data remains independent; retain the current no-map flood UI and do not expand flood scope as part of this work.

## Implementation phases

### 1. Verify source data and response geometry

- Confirm the directory API's request format, pagination, field names, Auckland `Regional_Council` value, and how `Enrolment_Scheme` indicates an available zone.
- Inspect representative zone endpoint responses, including geometry type, coordinate reference system, empty responses, and schools with no valid geometry.
- Confirm the source's `Org_Type` values and create display labels without discarding or rewriting their stored source values.

### 2. Design and migrate the database

- Add a canonical schools table keyed by source `School_Id`, with only the requested directory fields and a PostGIS point built from valid coordinates.
- Add a school-zone table keyed to the school, storing the relevant zone name/type and valid polygon or multipolygon geometry in a consistent SRID.
- Add spatial indexes for school locations and zone geometries, and ordinary indexes/constraints for school IDs and joins as useful.
- Add import metadata sufficient to distinguish never-imported/partial data from a successfully completed import.
- Update the Drizzle schema, SQL reference, PostgreSQL migration(s), and types.
- Remove or migrate the demo `property_school_zones` representation and any seed behavior that would conflict with imported records. Preserve unrelated demo metadata.

### 3. Implement a repeatable import command

- Add a developer-run script, following the established flood import convention. Do not fetch data on app startup.
- Fetch and validate all Auckland directory records, then retrieve zone geometry only for schools with an enrolment scheme.
- Handle pagination, request failures, invalid coordinates, empty or invalid geometries, and API throttling explicitly. Report actionable errors and counts.
- Make imports repeatable and safe: stage/validate fetched data, then update canonical records and import status transactionally so a failed run does not present partial data as complete.
- Store no fields beyond the approved directory and zone data.
- Document the command and prerequisites. Do not enable an automatic schedule in this phase.

### 4. Add PostGIS-backed property data

- Return nearby Auckland schools within a fixed **2,500 metres** of each property and calculate distances in PostGIS.
- Use the spatially indexed school point column with a metric-safe query (for example, `geography` with `ST_DWithin` and `ST_Distance`, or a suitable projected geometry).
- Determine zone membership in PostGIS using a boundary-inclusive predicate such as `ST_Covers`, so a property on a zone boundary is not accidentally excluded.
- Return stable school IDs, names, original school types, distances, and zone membership/zone metadata to the application.
- Distinguish data-not-imported from a successful query with no nearby schools or no containing zones.
- Ensure query behavior is consistent for property details, filters, and search. Do not implement frontend distance or point-in-polygon calculations.

### 5. Add details UI and search

- In property details, list schools within 2.5 km with source school type and distance; support filtering this list by type.
- Show which school zones contain the property, with school identity and zone type where available.
- Add school selection/search controls for:
  - properties within the selected school's enrolment zone;
  - properties within 2.5 km of the selected school.
- Use school IDs for selection and matching; names are display/search text, not spatial join keys.
- Keep the interface text/list based. Do not render school maps, flood maps, or hazard polygons.

### 6. Validate, test, and document

- Unit-test source-field filtering, Auckland-only selection, type labels, and import validation.
- Test importer pagination, zoned and unzoned schools, invalid data, API failures, repeat imports, and transactional failure behavior.
- Test PostGIS results for schools just inside/outside 2.5 km, distance values, zone interiors, boundaries, exteriors, and properties with multiple/no zones.
- Test type filtering and both selected-school search modes, including imported/not-imported states.
- Apply migrations and exercise queries against a disposable PostgreSQL database with PostGIS enabled.
- Run focused tests, lint, type-check, and production build.
- Update the README with data provenance, import/setup instructions, field scope, and the no-map behavior.

## Acceptance criteria

- Only Auckland-region schools are imported, and only the listed school-directory fields are persisted.
- Zone geometry is imported only for schools with an enrolment scheme; unrelated endpoint data is not stored.
- Property details show nearby schools only within **2.5 km**, with type and distance, and show any containing zones.
- Users can filter nearby schools by all available Auckland source types.
- Users can search for properties in a selected school's zone or within **2.5 km** of a selected school.
- PostGIS performs the distance and zone-membership calculations.
- Import state is explicit; incomplete or failed imports are not shown as successful empty results.
- No map is shown for school zones or flood risk.
