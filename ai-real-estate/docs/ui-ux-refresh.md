# Haven UI refresh

## Starting point and scope

- Branch: `ui/ux-improvements-latest`.
- Base: freshly fetched `origin/main`, commit `1771bcb` (PR #28).
- Baseline: 24 test files, 173 passing tests.
- Keep the horizontal filters above the property grid and the property page's gallery/two-column layout.
- Preserve search interpretation, filtering, data sources, account endpoints, saved homes, notes, commute destinations, finance tools, comparison context, chat history, and LIM upload.
- Earlier work based on stale local main is stashed and is not applied here.

## Design direction

A restrained Airbnb/Notion-inspired interface: warm white surfaces, readable charcoal text, a muted terracotta accent, light dividers, compact controls, and familiar icons. The photographs carry the listing grid. Typography and spacing establish hierarchy without adding panels around every piece of information.

Use the official shadcn components as the shared UI foundation. The project's configuration selects Radix primitives, the Nova style, Tailwind v4, and Lucide icons. The official shadcn skill is also installed in Codex.

## Decisions and rationale

### Homepage and filters

Remove marketing labels, repeated instructions, implementation/provider labels, fake confidence metrics, and redundant navigation links. Keep one useful page title and the natural-language search.

Keep location, maximum price, bedrooms, property type, and open-home access near the results. Put specialist conditions and custom ranges behind “More filters”. Collapsing those controls must not clear their values. Applied conditions remain visible and removable, so a hidden setting cannot silently explain missing results.

### Property cards and photos

Each card has one image, address, locality, essential dimensions, price, save, and compare controls. The card's content is a real link to its property page, supporting keyboards and opening in another tab. Save and compare are independent controls, avoiding nested buttons and accidental navigation.

Never display the first source photo or the primary listing image. Start with the second available source photo, then mix the remaining eligible photos consistently per property. Stable ordering avoids hydration differences and visual jumping. If no eligible photo exists, use a neutral placeholder rather than showing a prohibited image or another home's photo. Use the same selection rule in listings, saved-home previews, comparison, and the property gallery.

### Property pages

Keep the existing gallery and two-column structure. Remove the row of minor tabs. Put research tools into labelled accordions, keeping their functionality available without crowding the default view. Notes remain easy to reach.

Place school visibility controls with the map, followed by school details when enabled. Plot actual school coordinates; do not invent positions or change catchment calculations. Flood information is a concise factual note with expandable provenance and its existing limitations.

The gallery uses shadcn Dialog and Carousel: explicit navigation, keyboard controls, swipe support, an image count, Escape dismissal, and focus restoration. No automatic slideshow advances while the user is inspecting an image.

### Comparison

A persistent tray makes the selection visible while browsing and lets the user remove individual homes or clear the set. The comparison opens as a shadcn Dialog with a semantic table, property links, consistent units, horizontal scrolling on small screens, and a differences toggle. Missing data stays labelled as missing rather than becoming a misleading zero.

### Navigation and accounts

Use one shared navbar across discovery, property pages, and the workspace. Prioritize discovery, mortgage tools, saved homes, workspace, and authentication. Account forms use shadcn controls in a modal while retaining the existing authentication and workspace APIs. Keep loading, failed requests, and signed-in state distinguishable.

### Notes and chat

Use compact note forms and divider-separated entries instead of nested padded cards. Keep category selection, editing, deletion, account synchronization, and guest storage.

Compose chat with shadcn Message, Bubble, MessageScroller, InputGroup, Attachment, and Dialog. Preserve the existing message formatting, contextual suggestions, selected/saved property context, account history, request handling, and PDF upload. Let the message scroller own scroll behavior instead of forcing the viewport down after every response.

### Loading, mobile, and performance

Use shadcn Skeleton for route, listing, map, and account loading. Reserve image space to reduce layout movement, lazy-load listing photos, and dynamically load the map library. Keep navigation and main page structure visible while account state loads. Respect reduced-motion preferences. Let comparison tables scroll internally instead of widening the page.

## Verification

Behavior changes are introduced against failing interaction tests. Existing tests must be updated only where the user intentionally changed the interaction, preserving their underlying assertions about data and actions. Verify the build and type checks, then inspect the homepage, expanded filters, property gallery, account dialog, workspace, comparison, and chatbot at desktop and mobile sizes.

### Final results

- `npm test -- --reporter=dot`: 26 test files and 185 tests passed. The original baseline had 24 files and 173 tests; coverage now includes photo exclusion, direct card navigation, retained advanced filters, comparison, account dismissal, school visibility, gallery keyboard navigation, and browsing with chat open.
- `npm run build`: production build and TypeScript checks passed.
- `npm run lint`: no errors. One existing warning remains in the untouched `scripts/forsalecurrentproperties.js` script.
- `git diff --check`: passed.
- Browser checks covered the homepage, advanced filters, comparison, account dialog, property gallery, school map, and chat at desktop and mobile sizes. A live chat request completed and rendered its response without browser console errors.

The chat panel remains non-modal so people can keep selecting and comparing homes while chatting. Comparison scrolls inside its dialog on narrow screens. Gallery arrow keys also work when its navigation buttons have focus. Memoized map inputs prevent unrelated interactions from resetting the map.

Account and persistence behavior are covered by automated fixtures; no personal credentials were used during manual checks. The local preview runs at `http://localhost:3001` on branch `ui/ux-improvements-latest`, based on remote main commit `1771bcb6266458fcb53cd345d3b0babc7e52631b`.
