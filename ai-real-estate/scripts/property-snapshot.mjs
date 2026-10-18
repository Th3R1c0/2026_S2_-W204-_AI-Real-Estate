import { JSDOM } from 'jsdom';

const sites = ['RealEstate', 'OneRoof', 'Homes', 'TradeMe', 'QV', 'PropertyValue'];

function sameHouse(actual, expected) {
  const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const expectedParts = expected.split(',');
  const actualParts = String(actual ?? '').split(',');
  return normalize(actualParts[0]) === normalize(expectedParts[0]) && (!expectedParts[1] || normalize(actualParts[1]).startsWith(normalize(expectedParts[1])));
}

function number(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.]/g,''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function imageList(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).filter(value => typeof value === 'string' && /^https:\/\//.test(value)))];
}

function currencyAmount(value) {
  const match = String(value || '').match(/\$([\d,.]+)\s*([KM])?/i);
  return match ? Number(match[1].replaceAll(',','')) * (match[2]?.toUpperCase() === 'M' ? 1_000_000 : match[2]?.toUpperCase() === 'K' ? 1_000 : 1) : null;
}

export function parseDirectSourcePage(site, html, expectedAddress) {
  const doc = new JSDOM(html).window.document;
  let address, facts = {}, estimate = {}, images = [], coordinates = null;
  if (site === 'Homes') {
    const script = doc.querySelector('#homes-app-state');
    const state = script && JSON.parse(script.textContent);
    const card = state && Object.values(state).map(item => item?.b?.card).find(Boolean);
    const p = card?.property_details;
    address = p?.address;
    if (p) {
      facts = {bedrooms:number(p.num_bedrooms),bathrooms:number(p.num_bathrooms),floorArea:number(p.floor_area),landArea:number(p.land_area),parkingSpaces:number(p.num_car_spaces),capitalValue:number(p.capital_value),landValue:number(p.land_value),improvementValue:number(p.improvement_value),ownershipType:p.ownership_type || null,legalDescription:p.legal_description || null,certificateOfTitle:p.certificate_of_title || null,decadeBuilt:p.decade_built || null,estimatedWeeklyRent:number(p.display_estimated_rental_lower_value_short),valuationDate:p.current_revision_date || null,isForSale:/\bNOT LISTED\b/i.test(doc.body.textContent) ? false : null};
      const money = value => value ? number(value) * (/M$/i.test(value) ? 1_000_000 : /K$/i.test(value) ? 1000 : 1) : null;
      estimate = {low:money(p.display_estimated_lower_value_short),medium:money(p.display_estimated_value_short),high:money(p.display_estimated_upper_value_short)};
      images = imageList([p.cover_image_url,...(p.listing_images || [])]);
      if (card.point) coordinates = {latitude:number(card.point.lat) && Number(card.point.lat),longitude:Number(card.point.long)};
    }
  } else if (site === 'PropertyValue') {
    const match = html.match(/window\.REDUX_DATA\s*=\s*(\{.*?\});?\s*<\/script>/s);
    const p = match && JSON.parse(match[1]).PropertyDetails;
    address = p?.location?.locallyFormattedAddress;
    if (p) {
      const lastSale = p.propertyTimeline?.find(item => item.type === 'sale');
      facts = {bedrooms:number(p.core?.beds),bathrooms:number(p.core?.baths),floorArea:number(p.additional?.floorArea),landArea:number(p.core?.landArea),parkingSpaces:number(p.core?.carSpaces),yearBuilt:number(p.additional?.yearBuilt),capitalValue:number(p.ratingValuation?.capitalValue),landValue:number(p.ratingValuation?.landValue),improvementValue:number(p.ratingValuation?.improvementValue),isForSale:p.isForSale === false ? false : p.isForSale === true ? true : null,valuationDate:p.ratingValuation?.valuationDate || null,lastSaleDate:lastSale?.date || null,lastSalePrice:currencyAmount(lastSale?.priceDescription),legalDescription:p.ratingValuation?.legalDescriptions?.[0] || null,roofMaterial:p.additional?.roofMaterial || null,wallMaterial:p.additional?.wallMaterial || null,zone:p.site?.zoneDescriptionLocal || null};
      const low = number(p.estimatedRange?.lowerBand), high = number(p.estimatedRange?.upperBand);
      estimate = {low,medium:low && high ? Math.round((low + high) / 2) : null,high};
      images = imageList((p.images?.propertyPhotoList || []).map(photo => photo.largePhotoUrl));
      if (p.location?.latitude) coordinates = {latitude:Number(p.location.latitude),longitude:Number(p.location.longitude)};
    }
  } else if (site === 'RealEstate' || site === 'OneRoof') {
    const schemas = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => { try { const item = JSON.parse(script.textContent); return Array.isArray(item) ? item : [item]; } catch { return []; } });
    const property = schemas.find(item => item['@type'] === 'SingleFamilyResidence');
    address = site === 'RealEstate' ? property?.name : `${property?.address?.streetAddress || ''}, ${expectedAddress.split(',')[1]?.trim() || ''}`;
    images = imageList(property?.image || []);
    facts = {floorArea:number(property?.floorSize?.value),bedrooms:number(property?.numberOfRooms)};
    if (property?.geo?.latitude) coordinates = {latitude:Number(property.geo.latitude),longitude:Number(property.geo.longitude)};
    if (site === 'RealEstate') {
      const values = html.match(/\\"estimatedValues\\":\[\{[^}]*?\\"valueLow\\":(\d+),\\"valueMid\\":(\d+),\\"valueHigh\\":(\d+)/);
      if (values) estimate = {low:Number(values[1]),medium:Number(values[2]),high:Number(values[3])};
      const unescaped = html.replace(/\\"/g,'"');
      for (const [field,key] of [['bathrooms','bathroomsTotalCount'],['landArea','landArea'],['parkingSpaces','parkingGarageCount'],['decadeBuilt','buildingAge']]) {
        const match = unescaped.match(new RegExp('"' + key + '":(\\d+)'));
        if (match) facts[field] = Number(match[1]);
      }
    } else {
      const text = doc.body.textContent || '';
      const match = text.match(/(\$[\d,.]+\s*[KM]?)OneRoof Estimate/i);
      if (match) estimate.medium = currencyAmount(match[1]);
      const band = text.match(/(\$[\d,.]+\s*[KM]?)Low[^$]{0,60}(\$[\d,.]+\s*[KM]?)RV\*?(\$[\d,.]+\s*[KM]?)High/i);
      if (band) { estimate.low = currencyAmount(band[1]); estimate.high = currencyAmount(band[3]); }
    }
  } else if (site === 'QV') {
    address = doc.title;
    const text = doc.body.textContent.replace(/\s+/g,' ');
    estimate.medium = currencyAmount(text.match(/QV:\s*(\$[\d,.]+\s*[KM]?)/i)?.[1]);
    facts = {
      bedrooms:number(text.match(/bedrooms\s+(\d+)/i)?.[1]),bathrooms:number(text.match(/bathrooms\s+(\d+)/i)?.[1]),
      floorArea:number(text.match(/floor area\s+([\d,.]+)\s*m²/i)?.[1]),landArea:number(text.match(/land\s+([\d,.]+)\s*m²/i)?.[1]),
      capitalValue:currencyAmount(text.match(/Capital value\s*(\$[\d,.]+)/i)?.[1]),
    };
  } else return {status:'unverified',reason:'No address-specific public data available'};
  if (!address) return {status:'unverified',reason:'No property address in public page'};
  if (!sameHouse(address,expectedAddress)) return {status:'wrong_address',pageAddress:address};
  return {status:'matched',pageAddress:address,estimate,facts,images,coordinates};
}

export function renderDirectReport(houses) {
  const sites = ['RealEstate','OneRoof','Homes','PropertyValue','QV','TradeMe'];
  const currency = value => Number.isFinite(value) ? '$' + value.toLocaleString('en-NZ') : '—';
  const rows = houses.map((house,index) => {
    const map = `https://www.openstreetmap.org/?mlat=${house.latitude}&mlon=${house.longitude}#map=17/${house.latitude}/${house.longitude}`;
    const sourceCards = sites.map(site => {
      const source = house.sources?.[site] || {status:'unavailable'};
      const facts = Object.entries(source.facts || {}).filter(([,value]) => value !== null && value !== '').map(([key,value]) => `<span>${escapeHtml(key)}: <b>${escapeHtml(value)}</b></span>`).join('');
      const photo = source.images?.[0];
      const link = safeLink(source.url);
      return `<div class="source"><div class="source-head"><strong>${site}</strong><em class="${escapeHtml(source.status)}">${escapeHtml(source.status)}</em></div>${source.status === 'matched' ? `<p>${currency(source.estimate?.medium)} <small>${source.estimate?.low ? currency(source.estimate.low) + '–' + currency(source.estimate.high) : ''}</small></p><div class="facts">${facts}</div>${photo ? `<a href="${escapeHtml(photo)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(photo)}" alt="${escapeHtml(house.address)} from ${site}" loading="lazy"></a><small>${source.images.length} photo URL(s)</small>` : ''}` : `<small>${escapeHtml(source.reason || 'No verified page data')}</small>`}${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ''}</div>`;
    }).join('');
    return `<article><header><div><small>${index + 1} / ${houses.length} · LINZ ${escapeHtml(house.addressId)}</small><h2>${escapeHtml(house.address)}</h2></div><a href="${escapeHtml(map)}" target="_blank" rel="noopener noreferrer">Open map ↗</a></header><p class="coords">${escapeHtml(house.latitude)}, ${escapeHtml(house.longitude)}</p><div class="grid">${sourceCards}</div></article>`;
  }).join('');
  const counts = sites.map(site => `<span><b>${houses.filter(house => house.sources?.[site]?.status === 'matched').length}</b> ${site}</span>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>50 Auckland houses — direct-source report</title><style>body{margin:0;background:#f4f7f5;color:#17332d;font:15px system-ui,sans-serif}*{box-sizing:border-box}main{max-width:1380px;margin:auto;padding:28px}.mast{background:#153e3b;color:white;padding:42px max(28px,calc((100vw - 1324px)/2))}.mast h1{font-size:clamp(28px,4vw,46px);margin:8px 0}.mast p{max-width:850px;line-height:1.6;color:#dcece5}.counts{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.counts span{background:white;border-radius:8px;padding:10px 14px}article{background:white;border:1px solid #d9e5df;border-radius:14px;margin:18px 0;padding:22px}article header{display:flex;justify-content:space-between;gap:15px;align-items:center}h2{margin:6px 0;font-size:22px}small,.coords{color:#667d75}a{color:#08705f;text-decoration:none}a:hover{text-decoration:underline}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px}.source{border:1px solid #e1e9e5;border-radius:10px;padding:12px;overflow:hidden}.source-head{display:flex;justify-content:space-between;gap:5px}.source-head em{font-size:11px;font-style:normal;border-radius:20px;background:#eff2f0;padding:3px 6px}.source-head em.matched{background:#d9f5e4;color:#116740}.source p{font-weight:750;font-size:20px;margin:12px 0}.source p small{font-size:12px;font-weight:400}.facts{font-size:12px;max-height:130px;overflow:auto}.facts span{display:block;margin:4px 0}.source img{width:100%;height:115px;object-fit:cover;border-radius:7px;margin:8px 0}.source>a:last-child{display:block;margin-top:8px;font-size:12px}.notes{line-height:1.6;color:#486259}</style></head><body><div class="mast"><small>ONE-TIME DIRECT WEBSITE SNAPSHOT</small><h1>50 real Auckland houses</h1><p>Each address and map point was verified with LINZ NZ Addresses. Property facts, estimates and photo URLs below were read from the named websites directly. Missing and mismatched data stays marked. These are estimates, not asking prices or current listings.</p></div><main><div class="counts"><span><b>${houses.length}</b> houses</span>${counts}</div><p class="notes">The source URLs were discovered during earlier research, then each public page was fetched directly and its displayed address checked against the LINZ address. Trade Me's public page did not expose address-specific data. Third-party photos remain linked to their sources; permission is needed before publishing copies.</p>${rows}</main></body></html>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
}

export function matchAddress(address, url) {
  const street = address.split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes('/' + street + '/') || path.endsWith('/' + street) || path.includes('/' + street + '-')) return true;
  const number = street.match(/^\d+[a-z]?/);
  if (number && /\/\d+[a-z]?-[a-z0-9-]+(?:road|street|avenue|drive|lane|place|crescent|terrace|parade|way|close|court|rise|grove|highway)(?:\/|-|$)/.test(path)) return false;
  return null;
}

export function matchTitleAddress(address, title) {
  const [street, suburb] = address.split(',').map(x => x.trim().toLowerCase());
  return title.toLowerCase().startsWith(street + ', ' + suburb + ' ');
}

export function linzFeatureForAddress(address, features) {
  const feature = features.find(f => f.attributes?.full_address?.toLowerCase() === address.toLowerCase() && f.attributes?.address_lifecycle === 'Current');
  if (!feature || !Number.isFinite(feature.geometry?.x) || !Number.isFinite(feature.geometry?.y)) return null;
  return {addressId:feature.attributes.address_id,latitude:feature.geometry.y,longitude:feature.geometry.x};
}

export function cleanEstimate(value) {
  return typeof value === 'string' && /^\$[\d,.]+\s*[KMB]?$/i.test(value.trim()) ? value.trim() : null;
}

export function sourceFromResponses(address, lookup, scraped) {
  if (!lookup?.url || !safeLink(lookup.url)) return {status:'unavailable'};
  const match = matchAddress(address, lookup.url);
  if (match === false) return {status:'wrong_address',url:lookup.url};
  const estimate = scraped?.estimatedValues ? Object.fromEntries(['low','medium','high'].map(key => [key, cleanEstimate(scraped.estimatedValues[key])])) : undefined;
  const data = lookup.data ? Object.fromEntries(['lastSold','capitalValue','landValue','improvementValue','valuationDate'].filter(key => typeof lookup.data[key] === 'string' && !/^(N\/A|Not Found on Page|Error)$/i.test(lookup.data[key])).map(key => [key, lookup.data[key]])) : undefined;
  return {status:match === true ? 'matched' : 'unverified',url:lookup.url,...(estimate && {estimate}),...(data && {data})};
}

export function parseCsvRow(line) {
  const result = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { result.push(field); field = ''; }
    else field += c;
  }
  result.push(field);
  return result;
}

export function candidatesFromCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const keys = parseCsvRow(lines.shift());
  const seen = new Set(), result = [];
  for (const line of lines) {
    const cells = parseCsvRow(line);
    const row = Object.fromEntries(keys.map((key, i) => [key, cells[i]]));
    const suburb = row.Suburbs?.trim();
    const raw = row.Address?.replace(/, Auckland$/i, '').trim();
    if (!suburb || !raw?.toLowerCase().endsWith(suburb.toLowerCase())) continue;
    const street = raw.slice(0, -suburb.length).trim();
    if (!/^\d+[a-z]?\s+\S/i.test(street) || street.includes('/')) continue;
    const address = street + ', ' + suburb + ', Auckland';
    if (seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    result.push({
      address,
      bedrooms: Number(row.Bedrooms) || null,
      bathrooms: Number(row.Bathrooms) || null,
      landArea: Number(row['Land area']) || null,
      historicalCv: Number(row.CV) || null,
    });
  }
  return result;
}

const statusText = {matched:'Matched',wrong_address:'Wrong address',unverified:'Unverified',unavailable:'Unavailable',error:'Error'};
function money(value) { return Number.isFinite(value) ? '$' + value.toLocaleString('en-NZ') : '—'; }
function sourceCell(source = {status:'unavailable'}) {
  const status = statusText[source.status] ?? 'Unavailable';
  const value = source.status === 'matched' ? source.estimate?.medium ?? source.data?.capitalValue ?? null : null;
  const facts = source.status === 'matched' ? [
    source.estimate?.low && 'Low ' + source.estimate.low,
    source.estimate?.high && 'High ' + source.estimate.high,
    source.data?.capitalValue && 'CV ' + source.data.capitalValue,
    source.data?.lastSold,
  ].filter(Boolean) : [];
  const link = safeLink(source.url);
  return '<td><span class="state ' + escapeHtml(source.status) + '">' + status + '</span><strong>' + escapeHtml(value || '—') + '</strong>' + facts.map(f => '<small>' + escapeHtml(f) + '</small>').join('') + (link ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Source ↗</a>' : '') + '</td>';
}

export function renderReport(houses) {
  const counts = Object.fromEntries(sites.map(site => [site, houses.filter(h => h.sources?.[site]?.status === 'matched').length]));
  const rows = houses.map((house, index) => '<tr><th scope="row"><span class="rownum">' + (index + 1) + '</span><strong>' + escapeHtml(house.address) + '</strong><small>LINZ address ID ' + escapeHtml(house.addressId ?? 'unverified') + '</small></th><td>' + escapeHtml(house.bedrooms ?? '—') + ' bed · ' + escapeHtml(house.bathrooms ?? '—') + ' bath<br>' + escapeHtml(house.landArea ?? '—') + ' m²<br><small>Historical CV ' + money(house.historicalCv) + '</small></td>' + sites.map(site => sourceCell(house.sources?.[site])).join('') + '</tr>').join('\n');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auckland property source snapshot</title><style>' +
  ':root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#152d2b;background:#f4f7f5}*{box-sizing:border-box}body{margin:0}header{padding:48px max(28px,4vw);background:#153e3b;color:white}h1{margin:0 0 12px;font-size:clamp(28px,4vw,48px)}header p{max-width:840px;line-height:1.6;color:#d6e9e2}.meta{font-size:14px}main{padding:32px max(16px,4vw)}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin-bottom:24px}.metric{padding:18px;background:white;border:1px solid #dce8e2;border-radius:14px}.metric strong{display:block;font-size:28px}.metric span{font-size:13px;color:#536d66}.table-wrap{overflow:auto;background:white;border:1px solid #dce8e2;border-radius:14px}table{border-collapse:collapse;min-width:1450px;width:100%}th,td{border-bottom:1px solid #e3ebe7;padding:15px;text-align:left;vertical-align:top}thead th{position:sticky;top:0;background:#e9f2ee;z-index:1;font-size:13px}tbody th{min-width:255px}tbody tr:hover{background:#f8fbf9}td{min-width:145px;font-size:13px}td strong{display:block;margin:9px 0;font-size:16px}.rownum{display:inline-block;color:#397d70;margin-right:9px}small{display:block;color:#667d75;margin-top:5px}a{color:#0b6b5c;text-decoration:none}a:hover{text-decoration:underline}.state{display:inline-block;padding:4px 8px;border-radius:100px;background:#ebeff0;color:#536368;font-size:11px;font-weight:700}.state.matched{background:#d9f4e6;color:#146b44}.state.wrong_address,.state.error{background:#ffe2dc;color:#973d2b}.state.unverified{background:#fff0c8;color:#785e12}.notes{max-width:900px;line-height:1.6;color:#435e56;margin-top:26px}' +
  '</style></head><body><header><div class="meta">ONE-TIME RESEARCH SNAPSHOT · ' + escapeHtml(new Date().toISOString().slice(0,10)) + '</div><h1>50 Auckland homes: source report</h1><p>Real addresses verified against LINZ. Values are point-in-time website estimates, not sale prices or current listings. Each website match was checked against the address; unmatched and opaque links are marked clearly.</p></header><main><section class="summary"><div class="metric"><strong>' + houses.length + '</strong><span>LINZ-verified addresses</span></div>' + sites.map(site=>'<div class="metric"><strong>' + counts[site] + '</strong><span>' + site + ' matched</span></div>').join('') + '</section><div class="table-wrap"><table><thead><tr><th>Verified address</th><th>Older research data</th>' + sites.map(site=>'<th>' + site + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div><div class="notes"><p><strong>Reading the report:</strong> “Matched” means the URL or QV page title contains the same street address. “Unverified” means the site returned an opaque URL that this automated check cannot confirm. “Wrong address” means the returned URL names a different address. Missing estimates remain blank.</p><p>The bedroom, bathroom, land-area and historical CV columns come from a <a href="https://github.com/Sakyawira/auckland-house-prices">2020 research repository</a>. Its figures may be outdated and its reuse licence needs confirmation before publication. LINZ address data: <a href="https://data.linz.govt.nz/layer/123113-nz-addresses/">© Land Information New Zealand, CC BY 4.0</a>. This report contains no third-party property photographs.</p><h2>Collection method</h2><p>One-time snapshot: select candidates from the 2020 Auckland research dataset, verify each full address and coordinate against current LINZ records, request six PropValues URL lookups per address, then request available value endpoints only after an address match. QV numeric links were checked against their public page titles. Its PropertyValue mid value is calculated from the low and high values. PropValues response diagnostics identified Cheerio for HTML sources and a JSON platform API for RealEstate. Trade Me links remained opaque and were not assigned a value. No automatic refresh is configured.</p></div></main></body></html>';
}
