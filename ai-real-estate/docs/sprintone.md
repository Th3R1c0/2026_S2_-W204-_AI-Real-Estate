
tidy this up dont edit no change just tidy format:

As a user I want the AI chat to filter properties by architectural style so I find properties that meet my preferences

Add

Add

Dates

Checklist

Members

Attachment

Labels

Must Have

Tester: Lucas

Dev: Rico

Story Points: 21

Description

Edit

This feature enables users to query the platform using natural language via the AI chat interface to filter property listings based on specific architectural styles (e.g., Character, Modernist, Villa, Craftsman, Mid-Century).

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am on the AI chat search interface, when I submit a request asking for properties with a specific architectural style (e.g., "Show me Modernist houses"), then the system filters the listings and displays only properties tagged with that architectural style.

Given I am using the AI chat search interface, when I submit a prompt combining an architectural style and a location (e.g., "Find character Villas in Auckland"), then the system returns only properties that meet both the architectural style and location criteria.

Add an item

As a user preparing to make an offer, I want the AI to automatically identify and compile recent comparable sales (comps) in the immediate neighborhood, so that I can base my offer on hard data and recent market trends.

Add

Add

Dates

Checklist

Members

Attachment

Labels

Must Have

Tester: Rico

Dev: Lucas

Story Points: 34

Description

Edit

This feature uses the AI engine to query nearby property transactions, filtering by location, property size, and recent sale dates to generate an automated list of comparable sales (comps) for any target listing.

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am viewing a property listing, when I request comparable sales data, then the system automatically displays a compiled list of nearby properties sold within the last six months featuring similar specs and sale prices.

Given I am reviewing the generated list of comparable sales, when I adjust the filter parameters like radius or timeframe, then the system updates the comps list and recalculated market averages in real time.

Add an item

<div><br class="Apple-interchange-newline">As user i want to be able to search for properties using natural language so that i can find what im looking for without learning complicated search filters</div>

svg

As user i want to be able to search for properties using natural language so that i can find what im looking for without learning complicated search filters

svgAdd

svgAdd

svgDates

svgChecklist

svgMembers

svgAttachment

Labels

Must HaveTester: AlisterDev: LucasStory Points: 5INVESTsvg

svg

svg

Description

Edit

This implements a natural-language property search feature. Users can enter requests such as “a modern three-bedroom townhouse near the city under $900,000,” and the system interprets the request to display relevant property listings.

I Yes: The natural-language search can be developed separately from saved listings, notes, and property comparison features.
N Yes: The types of search terms and AI capabilities can be refined during development.
V Yes: Users can search in a familiar and convenient way without manually configuring several filters.
E Yes: An initial version can be estimated by limiting it to supported property attributes.
S Yes: A basic version supporting common property searches can fit within one sprint.
T Yes: Search queries can be tested against expected property results.

svg

svg

Attachments

Add

Files

svg

svg

Acceptance Checklist

Delete

0%

Given I enter a search containing a property type, location, and price range, when I submit the search, then the system identifies and applies those requirements.

svg

svg

svg

Given I enter an unclear or incomplete search request, when I submit it, then the system displays a helpful message or asks me to refine my search.

svg

svg

svg

Given no properties match my request, when the search is completed, then the system displays a message explaining that no matching listings were found.

svg

svg

svg

Add an item

As a buyer I want to be able to search and filter for things that are not usually easily searchable on the existing RE websites, such as architectural styles, property types, flood zones, building age, so that I can more easily find properties that might fit my requirements

Add

Add

Dates

Checklist

Members

Attachment

Labels

Must Have

Tester: Yasser

Dev: Praneel

Story Points: 21

Description

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am using the property search function, when I apply non-standard filter criteria such as architectural style, building age, or specific flood zone risk levels, then the system filters the database and returns only property listings matching those criteria.

Given I am viewing search results with applied custom filters, when I modify or add specialized criteria like property type or building age ranges, then the search results update dynamically to reflect the refined search parameters.

Add an item

As a user I want the AI chat to filter properties by property type (e.g. villa, townhouse, lifestyle block, etc) so that I can find properties suitable for me

Add

Add

Dates

Checklist

Members

Attachment

Labels

Must Have

Tester: Alister

Dev: Lucas

Story Points: 8

Description

Edit

This feature allows buyers to filter real estate listings through natural language interactions with the AI chat based on target property types such as villas, townhouses, apartments, or lifestyle blocks.

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am on the AI chat search interface, when I submit a request asking for a specific property type (e.g., "Show me lifestyle blocks"), then the system filters the listings and displays only properties categorized under that property type.

Given I am using the AI chat search interface, when I submit a prompt combining a property type and location parameters (e.g., "Find townhouses in Wellington"), then the system returns only properties that meet both the property type and location criteria.

Add an item

As a user, I want the UI layout to be well designed and modular so that I can navigate all the features and information without being overwhelmed.

Add

Add

Dates

Checklist

Members

Attachment

Labels

Must Have

Tester: Alister

Dev: Lucas

Story Points: 13

INVEST

Description

Edit

I - no: We need to have all the features locked in, or at least mocked up first.

N - no: The whole point of the app is ease of use.

V - yes: Defines the entire project.

E - no: There will be many redesigns after rounds of user testing, and features are added and refined. Will never truly be finished anyway

S - no: not technical, but touches on every other aspect of the project.

T - yes: User testing and research can be done, and design changes can viewed as soon as implemented. Is ultimately opinion though.

Show more

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am navigating the platform on any device size, when I access various features and information panels, then the system presents a clean, modular UI layout with collapsible sections and intuitive navigation controls.

Given I am viewing a feature-rich screen like the property details page, when I interact with different modular cards or tab headers, then the layout dynamically adjusts to show relevant content without cluttering the screen or causing visual overload.

Add an item

Sprint One Done [NNO12]svg

svg

svg

svg

Remove cover

svg

svg

As a property buyer, I want to filter properties by type so that I can quickly find specific properties such as villas, townhouses, apartments, sections, and lifestyle blocks

svgAdd

svgAdd

svgDates

svgChecklist

svgMembers

svgAttachment

Labels

Should HaveTester: PraneelDev: AlisterStory Points: 34INVESTsvg

svg

svg

Description

Edit

This implements a property type filtering feature. Users can select one or more property types and view only listings that match their selected criteria. Users can also clear the filters to return to the complete list of properties.

I  Yes: The property-type filter can be developed independently of most other search features.
N  Yes: The available property types and filtering behaviour can be adjusted during development.
V  Yes: Users can reduce irrelevant results and find suitable properties faster.
E  Yes: The feature has clear requirements and can be reasonably estimated.
S  Yes: A basic property-type filter can be completed within one sprint.
T  Yes: The displayed results can be tested against the selected property types.

Effort: Will be quite technical, either by pulling form data from an API, or categorisation by an AI model. However, we can use AI to figure it out.

svg

svg

Attachments

Add

Files

svg

svg

Acceptance Checklist

Delete

0%

Given I am viewing the property listings page, when I select Villa from the property-type filter, then only villa listings are displayed.

svg

svg

svg

Given I have selected a property-type filter, when I clear the filter, then all available property listings are displayed again.

svg

svg

svg

Given no properties match my selected property type, when the results are loaded, then a message is displayed explaining that no matching properties were found.

svg

svg

svg

Add an item

As a user, I want to see property info displayed side by side so that I can easily compare them against each other.

Add

Add

Dates

Checklist

Members

Attachment

Labels

Should Have

Tester: Lucas

Dev: Yasser

Story Points: 5

Description

Add a more detailed description…

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am browsing property search results or saved listings, when I select two or more properties using the compare option and open the comparison view, then the system displays a side-by-side layout presenting key details like price, bedroom counts, and land size in parallel columns.

Given I am viewing properties in the side-by-side comparison view, when I toggle the option to highlight differences or remove a property column, then the layout dynamically updates to visually emphasize conflicting attributes or remove the selected property.

Add an item

As a user, I want to search by sunlight exposure or north-facing homes.

Add

Add

Dates

Checklist

Members

Attachment

Labels

Should Have

Tester: Rico

Dev: Praneel

Story Points: 89

Description

Edit

may want to setup solar panels in the future or later customise their exterior to their liking and this can have a affect on how it turns out

Attachments

Add

Files

Acceptance Test

Delete

0%

Given I am on the property search page, when I apply the filter for north-facing orientation, then the search results update to show only properties with a primary northern aspect.

Given I am viewing a listing detail page, when I navigate to the sunlight analysis section, then the system displays an estimated daily sunlight exposure score based on building orientation and site topography.

Add an item

Sprint One Done [NNO12]

Remove cover

As a property buyer, I want to calculate estimated mortgage repayments based on my deposit, interest rates, and loan terms so that I can quickly assess whether a property is within my budget.

Add

Add

Dates

Checklist

Members

Attachment

Labels

Should Have

Tester: Rico

Dev: Praneel

Story Points: 34

INVEST

Description

Edit

This implements an interactive financial tool on the property details page that allows users to adjust deposit amounts and interest rates in real time.

I - yes: The repayment calculator logic operates independently of property filtering, LIM reports, or listing history.

N - yes: Default parameters like interest rates, loan terms, or deposit percentages can be adjusted based on team discussion.

V - yes: Users receive immediate financial clarity while viewing a property without having to leave the app to use an external calculator.

E - yes: The story can be estimated accurately since it relies on standard mathematical financial formulas.

S - yes: It is a small mathematical feature that fits comfortably within one sprint.

T - yes: The feature can be tested by passing specific deposit amounts and interest rates and verifying that the calculated monthly repayment is correct.

Show more

Attachments

Add

Files

Acceptance Test

Delete

0%

Default Calculation Display: Given that I am viewing a property listed for $800,000, when the mortgage calculator loads, then it should automatically display a monthly repayment estimate based on a default 20% deposit and current interest rate.

Dynamic Parameter Adjustment: Given that I am using the mortgage calculator, when I adjust the deposit slider or interest rate input, then the calculated monthly repayment figure should update dynamically in real time.

Add an item

Sprint One Done [NNO12]

Remove cover
