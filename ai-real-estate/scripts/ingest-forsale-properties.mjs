import { readFile, writeFile } from 'node:fs/promises';
import { parseDirectSourcePage, linzFeatureForAddress } from './property-snapshot.mjs';

const SITES = [
  ['RealEstate', 'realestate'],
  ['Homes', 'homes'],
  ['TradeMe', 'trademe'],
  ['QV', 'qv'],
  ['PropertyValue', 'propertyvalue']
];

const LINZ_ENDPOINT = 'https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query';

function cleanPriceNumber(val) {
  if (!val) return null;
  const num = Number(String(val).replace(/[^\d.]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseTitle(title) {
  const lines = title.split('\n').map(l => l.trim()).filter(Boolean);
  let saleMethod = '';
  let address = '';
  let beds = null, baths = null, cars = null;
  const numStack = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (/^\d+$/.test(l)) {
      numStack.unshift(Number(l));
    } else {
      if (!address) {
        address = l;
      } else if (!saleMethod && l !== 'view more' && !l.startsWith('Open Home')) {
        saleMethod = l;
      }
    }
  }

  if (numStack.length >= 3) {
    [beds, baths, cars] = numStack;
  } else if (numStack.length === 2) {
    [beds, baths] = numStack;
  } else if (numStack.length === 1) {
    [beds] = numStack;
  }

  return { saleMethod, address, beds, baths, cars };
}

function parseOneRoofPage(html, item, parsedTitle) {
  // 1. JSON-LD
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(m => {
    try { return JSON.parse(m[1]); } catch { return null; }
  }).find(j => j && (j['@type'] === 'SingleFamilyResidence' || j['@type'] === 'Apartment' || j['@type'] === 'Place' || j['geo']));

  const images = (jsonLd?.image || []).filter(url => typeof url === 'string' && url.startsWith('http'));
  const geo = jsonLd?.geo ? {
    latitude: Number(jsonLd.geo.latitude),
    longitude: Number(jsonLd.geo.longitude)
  } : null;

  // 2. RSC Next.js App Router chunks
  let rscDetails = {};
  const rscMatches = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
  for (const m of rscMatches) {
    const lines = m[1].split('\\n');
    for (const l of lines) {
      if (l.includes('propertyId')) {
        const colonIdx = l.indexOf(':');
        if (colonIdx > 0) {
          const jsonStr = l.slice(colonIdx + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          try {
            const obj = JSON.parse(jsonStr);
            if (obj && typeof obj === 'object') {
              rscDetails = { ...rscDetails, ...obj };
            }
          } catch {}
        }
      }
    }
  }

  // 3. Fallbacks from regex
  const rvMatch = html.match(/RV(?:\s*reassessment)?:\s*\$([\d,]+)/i) || html.match(/Capital Value:\s*\$([\d,]+)/i);
  const capitalValue = rscDetails.capitalValue ? Number(rscDetails.capitalValue) : rvMatch ? cleanPriceNumber(rvMatch[1]) : null;

  const estMatch = html.match(/\$([\d,.]+)\s*[KM]?\s*OneRoof Estimate/i) || html.match(/OneRoof Estimate\s*:\s*\$([\d,.]+)/i);
  const estimate = estMatch ? cleanPriceNumber(estMatch[1]) : null;

  return {
    url: item.url,
    address: rscDetails.address || parsedTitle.address,
    street: rscDetails.street,
    suburb: rscDetails.suburb,
    district: rscDetails.district,
    region: rscDetails.region,
    latitude: geo?.latitude || (rscDetails.lat ? Number(rscDetails.lat) : null),
    longitude: geo?.longitude || (rscDetails.lng ? Number(rscDetails.lng) : null),
    bedrooms: rscDetails.bedrooms ?? parsedTitle.beds,
    bathrooms: rscDetails.bathrooms ?? parsedTitle.baths,
    carspaces: rscDetails.carspaces ?? parsedTitle.cars,
    floorArea: rscDetails.floorArea ? Number(rscDetails.floorArea) : null,
    landArea: rscDetails.landArea ? Number(rscDetails.landArea) : null,
    propertyType: rscDetails.type || 'House',
    teaser: rscDetails.teaser || jsonLd?.name || '',
    description: jsonLd?.description || '',
    heroCover: rscDetails.heroCover || images[0],
    images,
    capitalValue,
    estimate,
    saleMethod: parsedTitle.saleMethod
  };
}

async function verifyWithLinz(address) {
  try {
    const street = address.split(',')[0].trim().replace(/^lot\s+\d+\/?/i, '').trim();
    const where = `full_address LIKE '${street.replaceAll("'", "''")}%'`;
    const params = new URLSearchParams({
      where,
      outFields: 'address_id,full_address,address_lifecycle,suburb_locality,town_city',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json'
    });
    const res = await fetch(LINZ_ENDPOINT + '?' + params, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;
    const feat = data.features[0];
    return {
      addressId: feat.attributes.address_id,
      fullAddress: feat.attributes.full_address,
      latitude: feat.geometry.y,
      longitude: feat.geometry.x,
      suburb: feat.attributes.suburb_locality,
      city: feat.attributes.town_city
    };
  } catch (err) {
    return null;
  }
}

async function fetchPropValuesSources(address) {
  const sources = {};
  for (const [name, slug] of SITES) {
    try {
      const res = await fetch(`https://www.propvalues.nz/api/get-${slug}-url`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          sources[name] = { status: 'matched', url: data.url };
        } else {
          sources[name] = { status: 'unavailable', reason: data.error || 'No matching page' };
        }
      } else {
        sources[name] = { status: 'unavailable', reason: `HTTP ${res.status}` };
      }
    } catch (e) {
      sources[name] = { status: 'unavailable', reason: e.message };
    }
  }
  return sources;
}

async function fetchHomesDetails(homesUrl, expectedAddress) {
  try {
    const res = await fetch(homesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseDirectSourcePage('Homes', html, expectedAddress);
  } catch (err) {
    return null;
  }
}

async function run() {
  const raw = JSON.parse(await readFile(new URL('./forsalecurrentproperties.js', import.meta.url), 'utf8'));
  console.log(`Loaded ${raw.length} raw properties.`);

  // Deduplicate by URL
  const seenUrls = new Set();
  const items = [];
  for (const item of raw) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      items.push(item);
    }
  }
  console.log(`Processing ${items.length} unique properties...`);

  const results = [];
  const concurrency = 4;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item, bIdx) => {
      const idx = i + bIdx + 1;
      const parsedTitle = parseTitle(item.title);
      console.log(`[${idx}/${items.length}] Fetching OneRoof: ${parsedTitle.address}`);

      let oneRoofData = null;
      try {
        const res = await fetch(item.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
          const html = await res.text();
          oneRoofData = parseOneRoofPage(html, item, parsedTitle);
        }
      } catch (err) {
        console.warn(`[${idx}] OneRoof fetch error:`, err.message);
      }

      if (!oneRoofData) {
        oneRoofData = {
          url: item.url,
          address: parsedTitle.address,
          saleMethod: parsedTitle.saleMethod,
          bedrooms: parsedTitle.beds,
          bathrooms: parsedTitle.baths,
          carspaces: parsedTitle.cars,
          images: [],
          capitalValue: null,
          estimate: null
        };
      }

      // Query LINZ
      console.log(`[${idx}] Querying LINZ for: ${parsedTitle.address}`);
      const linz = await verifyWithLinz(parsedTitle.address);

      // Query PropValues
      console.log(`[${idx}] Querying PropValues for: ${parsedTitle.address}`);
      const propValuesSources = await fetchPropValuesSources(parsedTitle.address);

      // If Homes matched, fetch Homes page details
      let homesDetails = null;
      if (propValuesSources.Homes?.status === 'matched' && propValuesSources.Homes.url) {
        console.log(`[${idx}] Parsing Homes.co.nz page...`);
        homesDetails = await fetchHomesDetails(propValuesSources.Homes.url, parsedTitle.address);
      }

      return {
        index: idx,
        item,
        parsedTitle,
        oneRoofData,
        linz,
        propValuesSources,
        homesDetails
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    console.log(`Completed batch ${Math.min(i + concurrency, items.length)}/${items.length}`);
  }

  console.log(`\nSuccessfully ingested all ${results.length} properties!`);
  await writeFile(new URL('../reports/forsale-raw-harvest.json', import.meta.url), JSON.stringify(results, null, 2));
  console.log('Saved raw harvest to reports/forsale-raw-harvest.json');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
