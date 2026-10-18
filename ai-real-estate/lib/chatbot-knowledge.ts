/**
 * Knowledge base containing all information about the Haven AI Real Estate application.
 * This is injected into the Gemini prompt as system context and used for local fallback Q&A.
 */

export const HAVEN_SYSTEM_KNOWLEDGE = `
You are the Haven AI Real Estate Assistant — a helpful, friendly, and knowledgeable concierge for the Haven property discovery platform in New Zealand.

### About Haven
- Haven is a state-of-the-art AI-powered property discovery platform designed specifically for the New Zealand housing market.
- It helps buyers, investors, and homeowners discover properties not just by bedrooms and price, but by lifestyle factors, architectural design, climate resilience, and financial feasibility.

### Key Features of Haven:
1. **AI Natural Language Search**:
   - Users can search in plain English (e.g. "Find me a 3-bedroom modernist townhouse in Auckland under $1.2M with low flood risk").
   - Haven's AI interprets the search into structured filters instantly.

2. **Specialized & Non-Standard Property Filters**:
   - **Architectural Styles**: Character, Contemporary, Craftsman, Mid-Century, and Modernist.
   - **Property Types**: Villa, Townhouse, House, Apartment, Lifestyle block, and Section.
   - **Flood Risk Levels**: Low, Moderate, and High, sourced from official council hazard zones and environmental models.
   - **Sunlight & Orientation**: Tracks estimated daily sunlight hours and filters for true North-facing orientation.
   - **Building Age**: Filters by decade and construction era (e.g. heritage pre-1940 vs contemporary).

3. **Commute & Transport Planner**:
   - Filter listings by commute travel time to key destinations (such as CBD, university, or hospitals).
   - Supports driving, public transit, cycling, and walking modes.

4. **School Zones & Walkability**:
   - Provides catchment information for primary, intermediate, and secondary schools.
   - Includes neighborhood walkability scores.

5. **Financial Tools**:
   - **Mortgage Repayment Calculator**: Lets buyers adjust purchase price, deposit amount/percentage, interest rate, and loan term in years to calculate estimated weekly or monthly repayments.
   - **Loan Comparison**: Compares multiple loan scenarios (fixed rates, floating rates, different deposit tiers) side by side.

6. **Comparable Sales (Comps)**:
   - Evaluates nearby recent property sales within the neighborhood to help buyers judge fair market value and formulate realistic offers.

7. **LIM (Land Information Memorandum) Summaries & Due Diligence**:
   - A LIM report is an official Auckland Council / local council document that details legal boundaries, building consents, zoning rules, rates, and natural hazards (flooding, instability).
   - Haven highlights key LIM findings and risk indicators for listings.

8. **Source Citations**:
   - All property details, flood classifications, and pricing history provide transparent citations from official data providers, LINZ, and council records.

9. **Saved Listings & Agent Inquiries**:
   - Bookmark favorite properties and receive alerts.
   - Send direct inquiry messages to listing agents or request private viewings.

### Response Style:
- Be concise, helpful, and polite.
- If asked about New Zealand real estate concepts (such as LIM reports, title types, council rates, or north-facing sunlight), provide clear, simple explanations.
- If asked how to use a feature on Haven, guide the user directly to the relevant part of the screen or tools.
`;

export type PropertyChatSummary = {
  id: string;
  address: string;
  suburb: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  landArea?: number;
  floorArea?: number;
  yearBuilt?: number;
  propertyType: string;
  architecturalStyle?: string;
  floodRisk?: string;
  orientation?: string;
  sunlightHours?: number;
};

export type PropertyChatContext = {
  savedProperties?: PropertyChatSummary[];
  comparedProperties?: PropertyChatSummary[];
};

export function formatPropertiesContext(context?: PropertyChatContext): string {
  if (!context) return "";
  const parts: string[] = [];

  if (context.comparedProperties && context.comparedProperties.length > 0) {
    parts.push("### User's Currently Compared Properties (Active Side-by-Side Comparison):");
    context.comparedProperties.forEach((p, idx) => {
      const details = [
        `Price: $${p.price.toLocaleString()}`,
        `${p.bedrooms} beds, ${p.bathrooms} baths`,
        p.landArea ? `${p.landArea}m² land` : null,
        p.floorArea ? `${p.floorArea}m² floor` : null,
        `Type: ${p.propertyType}`,
        p.architecturalStyle ? `Style: ${p.architecturalStyle}` : null,
        p.yearBuilt ? `Built: ${p.yearBuilt}` : null,
        p.floodRisk ? `Flood Risk: ${p.floodRisk}` : null,
        p.sunlightHours !== undefined ? `Sunlight: ${p.sunlightHours} hrs` : null,
        p.orientation ? `Facing: ${p.orientation}` : null,
      ].filter(Boolean).join(" | ");

      parts.push(`${idx + 1}. **${p.address}, ${p.suburb}, ${p.city}** — ${details}`);
    });
  }

  if (context.savedProperties && context.savedProperties.length > 0) {
    parts.push("### User's Saved Properties (Favorites / Shortlist):");
    context.savedProperties.forEach((p, idx) => {
      const details = [
        `Price: $${p.price.toLocaleString()}`,
        `${p.bedrooms} beds, ${p.bathrooms} baths`,
        p.propertyType,
        p.architecturalStyle ? `Style: ${p.architecturalStyle}` : null,
        p.floodRisk ? `Flood Risk: ${p.floodRisk}` : null,
        p.sunlightHours !== undefined ? `Sunlight: ${p.sunlightHours} hrs` : null,
      ].filter(Boolean).join(" | ");

      parts.push(`${idx + 1}. **${p.address}, ${p.suburb}, ${p.city}** — ${details}`);
    });
  }

  if (parts.length > 0) {
    parts.push(
      "Instructions for user properties:\n" +
      "- The user has explicitly selected or saved the above listings in Haven.\n" +
      "- When asked about their compared or saved properties, or when helping them think about their search campaign or which home to choose, refer to these specific listings and their attributes in detail.\n" +
      "- Help them weigh trade-offs (e.g. price vs flood risk vs sunlight vs architectural style), organize their thinking, and plan their next steps in their buying campaign."
    );
  }

  return parts.join("\n\n");
}

export type KnowledgeTopic = {
  keywords: string[];
  reply: string;
};

export const LOCAL_KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    keywords: ["what is haven", "about haven", "who are you", "what can you do", "help me"],
    reply:
      "Haven is an AI-powered property discovery platform for New Zealand. You can search using natural language, filter by architectural styles (like Villas or Modernist homes), check flood risk levels and sunlight hours, calculate mortgage repayments, and plan commutes to work or school.",
  },
  {
    keywords: ["lim", "lim report", "land information memorandum"],
    reply:
      "A LIM (Land Information Memorandum) is an official council report in New Zealand. It contains essential details about a property, including building consents, code compliance certificates, zoning rules, council rates, and natural hazards like flood zones or land instability.",
  },
  {
    keywords: ["mortgage", "calculator", "repayments", "interest", "deposit"],
    reply:
      "Haven includes an interactive Mortgage Calculator and Loan Comparison tool. You can adjust your property price, deposit percentage, interest rate, and loan term to see estimated monthly or weekly repayments, or compare different loan packages side by side.",
  },
  {
    keywords: ["architectural", "architecture", "style", "styles", "character", "modernist", "villa"],
    reply:
      "Haven allows filtering by architectural styles that traditional property websites don't easily support. You can filter for Character, Contemporary, Craftsman, Mid-Century, and Modernist homes, as well as specific property types like Villas and Townhouses.",
  },
  {
    keywords: ["flood", "flood risk", "flooding", "hazards"],
    reply:
      "We classify properties into Low, Moderate, and High flood risk based on council hazard maps and environmental models, helping you assess overland flow paths and climate resilience before making an offer.",
  },
  {
    keywords: ["sunlight", "sun", "north", "north-facing", "orientation"],
    reply:
      "In New Zealand, North-facing homes capture the most all-day sun. Haven calculates estimated daily sunlight hours and lets you filter exclusively for north-facing properties to maximize warmth and natural light.",
  },
  {
    keywords: ["commute", "travel time", "distance", "transit"],
    reply:
      "Our Commute Planner lets you set your workplace, university, or daily destinations and filters properties within your desired travel time via driving, public transit, cycling, or walking.",
  },
  {
    keywords: ["school", "school zone", "walkability"],
    reply:
      "You can view school zone catchments (primary, intermediate, secondary) for every property, as well as neighborhood walkability scores so you know how convenient daily errands will be.",
  },
  {
    keywords: ["comps", "comparable", "comparable sales", "valuation"],
    reply:
      "Haven provides recent comparable sales (comps) in the immediate area with sale dates and prices, giving you hard market data to help decide on a fair offer price.",
  },
  {
    keywords: ["agent", "contact", "inquiry", "viewing"],
    reply:
      "You can view listing agent credentials and submit an inquiry or schedule a viewing directly from the property details modal.",
  },
];

export function findLocalKnowledgeAnswer(query: string, context?: PropertyChatContext): string {
  const normalized = query.toLowerCase().trim();

  // 1. Direct questions about compared homes
  if (
    normalized.includes("compare") ||
    normalized.includes("comparison") ||
    normalized.includes("selected home") ||
    normalized.includes("difference")
  ) {
    const compared = context?.comparedProperties ?? [];
    if (compared.length >= 2) {
      const summaryList = compared
        .map(
          (p, i) =>
            `${i + 1}. **${p.address}** (${p.suburb}): $${p.price.toLocaleString()} — ${p.bedrooms} beds, ${p.bathrooms} baths, ${p.propertyType}${p.architecturalStyle ? ` (${p.architecturalStyle})` : ""}, Flood Risk: ${p.floodRisk ?? "N/A"}, Sunlight: ${p.sunlightHours ?? "N/A"} hrs`,
        )
        .join("\n");

      const cheapest = [...compared].sort((a, b) => a.price - b.price)[0];
      const highestSun = [...compared].sort((a, b) => (b.sunlightHours ?? 0) - (a.sunlightHours ?? 0))[0];

      return `Here is a side-by-side comparison of your ${compared.length} selected homes:\n\n${summaryList}\n\nKey Insights:\n- Best Price Value: **${cheapest.address}** at $${cheapest.price.toLocaleString()}\n- Maximum Natural Light: **${highestSun.address}** with ${highestSun.sunlightHours ?? "N/A"} daily sunlight hours\n\nNext Step: Consider ordering a LIM report and checking school zones before attending weekend open homes.`;
    }

    if (compared.length === 1) {
      return `You currently have 1 property selected for comparison: **${compared[0].address}** ($${compared[0].price.toLocaleString()}, ${compared[0].bedrooms} beds). Please tick the 'Compare' checkbox on at least one more listing to view a full side-by-side analysis!`;
    }

    return "You don't have any properties currently selected for comparison. You can tick the 'Compare' checkbox on 2 or more listings in the explorer, and I'll analyze their pricing, flood risks, and specs side by side!";
  }

  // 2. Direct questions about saved shortlist
  if (
    normalized.includes("saved") ||
    normalized.includes("shortlist") ||
    normalized.includes("favorite") ||
    normalized.includes("bookmarked")
  ) {
    const saved = context?.savedProperties ?? [];
    if (saved.length > 0) {
      const savedList = saved
        .map(
          (p, i) =>
            `${i + 1}. **${p.address}** (${p.suburb}) — $${p.price.toLocaleString()} | ${p.bedrooms} beds | ${p.propertyType}${p.architecturalStyle ? ` (${p.architecturalStyle})` : ""} | Flood Risk: ${p.floodRisk ?? "N/A"}`,
        )
        .join("\n");

      return `You have ${saved.length} property saved to your shortlist:\n\n${savedList}\n\nWould you like me to help calculate mortgage repayments or organize viewing priorities for these homes?`;
    }

    return "You don't have any saved listings in your shortlist yet. Click the heart icon on any property card to save it for quick review!";
  }

  // 3. Search campaign & strategy advice
  if (
    normalized.includes("campaign") ||
    normalized.includes("strategy") ||
    normalized.includes("organise") ||
    normalized.includes("organize") ||
    normalized.includes("help me think") ||
    normalized.includes("plan my search")
  ) {
    const savedCount = context?.savedProperties?.length ?? 0;
    const comparedCount = context?.comparedProperties?.length ?? 0;

    let contextualAdvice = "";
    if (savedCount > 0 || comparedCount > 0) {
      contextualAdvice = `Based on your ${savedCount} saved home(s) and ${comparedCount} compared listing(s), here is how to organize your campaign:\n\n`;
    } else {
      contextualAdvice = "Here is a structured campaign framework to organize your New Zealand home search:\n\n";
    }

    return `${contextualAdvice}1. **Define Your Criteria**: Lock in your top non-negotiables (bedrooms, school zones, and maximum commute time).\n2. **Evaluate Climate & Hazards**: Filter for Low/Moderate flood risks and North-facing orientation for warmth.\n3. **Financial Feasibility**: Use Haven's Mortgage Calculator to check your repayments against current interest rates.\n4. **Conduct Due Diligence**: For serious contenders, request the LIM report, verify title type, and inspect recent comparable sales (comps) in the suburb.\n5. **Inspect & Inquire**: Contact listing agents directly through Haven to arrange private viewings or confirm auction dates.`;
  }

  // 4. Check standard knowledge topics
  for (const topic of LOCAL_KNOWLEDGE_TOPICS) {
    if (topic.keywords.some((kw) => normalized.includes(kw))) {
      return topic.reply;
    }
  }

  return "I'm the Haven AI Assistant! I can help you search for New Zealand properties by architectural style, flood risk, or sunlight, answer questions about LIM reports and buying processes, or help you use our mortgage and commute calculators. What would you like to know?";
}
