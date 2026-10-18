const sites = ['RealEstate', 'OneRoof', 'Homes', 'TradeMe', 'QV', 'PropertyValue'];

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
