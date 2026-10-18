import { test } from 'vitest';
import assert from 'node:assert/strict';
import { matchAddress, matchTitleAddress, cleanEstimate, renderReport, renderDirectReport, parseCsvRow, candidatesFromCsv, sourceFromResponses, linzFeatureForAddress, parseDirectSourcePage } from '../scripts/property-snapshot.mjs';

test('rejects a source URL for a different street number', () => {
  assert.equal(matchAddress('54 Kelmarna Avenue, Ponsonby, Auckland', 'https://www.oneroof.co.nz/property/auckland/ponsonby/39-kelmarna-avenue/6GGdS'), false);
  assert.equal(matchAddress('54 Kelmarna Avenue, Ponsonby, Auckland', 'https://homes.co.nz/address/auckland/ponsonby/54-kelmarna-avenue/eVMOX'), true);
  assert.equal(matchAddress('54 Kelmarna Avenue, Ponsonby, Auckland', 'https://www.trademe.co.nz/a/property/insights/profile/9b6d3fa3-c3dd-4812-b7ff-50edb911b056'), null);
  assert.equal(matchAddress('13 Sandringham Road, Mount Eden, Auckland', 'https://www.trademe.co.nz/a/property/insights/profile/60509233-4a0b-498a-b39c-61f0495fc858'), null);
});

test('does not turn missing or error estimates into numeric values', () => {
  assert.equal(cleanEstimate('N/A'), null);
  assert.equal(cleanEstimate('Error'), null);
  assert.equal(cleanEstimate('$2.97M'), '$2.97M');
});

test('report escapes untrusted source text and shows all source outcomes', () => {
  const html = renderReport([{address:'1 Test Road, Auckland', addressId:123, sources:{Homes:{status:'matched',url:'https://homes.co.nz/test',estimate:{medium:'$1M'}},OneRoof:{status:'wrong_address',url:'https://oneroof.co.nz/other'},QV:{status:'unavailable'}}}]);
  assert.match(html, /1 Test Road/);
  assert.match(html, /Wrong address/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(renderReport([{address:'<script>alert(1)</script>',addressId:1,sources:{}}]), /<script>/);
});

test('report retains the source range and sale facts without presenting them as a listing price', () => {
  const html = renderReport([{address:'1 Test Road, Auckland',addressId:123,sources:{PropertyValue:{status:'matched',url:'https://www.propertyvalue.co.nz/auckland/1-test-road',estimate:{low:'$800K',medium:'$900K',high:'$1.00M'},data:{capitalValue:'$850,000',lastSold:'Last Sold for $760,000'}}}}]);
  assert.match(html, /\$800K/);
  assert.match(html, /\$1.00M/);
  assert.match(html, /\$850,000/);
  assert.match(html, /Last Sold for \$760,000/);
});

test('reads quoted CSV addresses and excludes units and duplicates from candidates', () => {
  assert.deepEqual(parseCsvRow('1,3,"54 Kelmarna Avenue Ponsonby, Auckland",531'), ['1','3','54 Kelmarna Avenue Ponsonby, Auckland','531']);
  const csv = ',Bedrooms,Bathrooms,Address,Land area,CV,Latitude,Longitude,Suburbs\n0,3,1,"54 Kelmarna Avenue Ponsonby, Auckland",531,2525000,-36.84,174.73,Ponsonby\n1,3,1,"54 Kelmarna Avenue Ponsonby, Auckland",531,2525000,-36.84,174.73,Ponsonby\n2,2,1,"1/4 Test Road Ponsonby, Auckland",50,700000,-36.84,174.73,Ponsonby';
  assert.deepEqual(candidatesFromCsv(csv), [{address:'54 Kelmarna Avenue, Ponsonby, Auckland', bedrooms:3,bathrooms:1,landArea:531,historicalCv:2525000}]);
});

test('drops scraped values when the matched page belongs to another property', () => {
  const result = sourceFromResponses('54 Kelmarna Avenue, Ponsonby, Auckland', {url:'https://www.oneroof.co.nz/property/auckland/ponsonby/39-kelmarna-avenue/6GGdS'}, {estimatedValues:{low:'$2M',medium:'$3M',high:'$4M'}});
  assert.deepEqual(result, {status:'wrong_address',url:'https://www.oneroof.co.nz/property/auckland/ponsonby/39-kelmarna-avenue/6GGdS'});
});

test('ignores placeholder sale text from PropertyValue', () => {
  const result = sourceFromResponses('54 Kelmarna Avenue, Ponsonby, Auckland',{url:'https://www.propertyvalue.co.nz/54-kelmarna-avenue',data:{lastSold:'Not Found on Page',capitalValue:'$3,000,000'}});
  assert.deepEqual(result.data,{capitalValue:'$3,000,000'});
});

test('requires the full street number when verifying an opaque QV page by title', () => {
  assert.equal(matchTitleAddress('39a Keegan Drive, Massey, Auckland','39 Keegan Drive, Massey - QV'), false);
  assert.equal(matchTitleAddress('54 Kelmarna Avenue, Ponsonby, Auckland','54 Kelmarna Avenue, Ponsonby - QV'), true);
});

test('uses the official LINZ point only for an exact current address match', () => {
  const feature={attributes:{address_id:1590347,full_address:'54 Kelmarna Avenue, Ponsonby, Auckland',address_lifecycle:'Current'},geometry:{x:174.73436,y:-36.84924}};
  assert.deepEqual(linzFeatureForAddress('54 Kelmarna Avenue, Ponsonby, Auckland',[feature]),{addressId:1590347,latitude:-36.84924,longitude:174.73436});
  assert.equal(linzFeatureForAddress('39 Kelmarna Avenue, Ponsonby, Auckland',[feature]),null);
});

test('direct Homes page yields facts and photos only for the requested address', () => {
  const card={property_details:{address:'1 Test Road, Auckland',num_bedrooms:3,num_bathrooms:2,floor_area:120,land_area:400,cover_image_url:'https://example.com/house.jpg',display_estimated_value_short:'900K',capital_value:850000,ownership_type:'Freehold'},point:{lat:-36.8,long:174.7}};
  const html=`<script id="homes-app-state" type="application/json">${JSON.stringify({one:{b:{card}}})}</script>`;
  assert.equal(parseDirectSourcePage('Homes',html,'1 Test Road, Auckland').facts.bedrooms,3);
  assert.equal(parseDirectSourcePage('Homes',html,'1 Test Road, Auckland').images[0],'https://example.com/house.jpg');
  assert.equal(parseDirectSourcePage('Homes',html,'2 Test Road, Auckland').status,'wrong_address');
});

test('Homes listing status is false only when the page says not listed', () => {
  const card={property_details:{address:'1 Test Road, Auckland'}};
  const html=`<script id="homes-app-state" type="application/json">${JSON.stringify({one:{b:{card}}})}</script><div>NOT LISTED</div>`;
  assert.equal(parseDirectSourcePage('Homes',html,'1 Test Road, Auckland').facts.isForSale,false);
});

test('direct OneRoof and QV pages expose their displayed estimates', () => {
  const schema={'@type':'SingleFamilyResidence',address:{streetAddress:'1 Test Road'},image:[]};
  const oneRoof=`<script type="application/ld+json">${JSON.stringify(schema)}</script><body>$800KLow$900KRV*$1MHigh$950KOneRoof Estimate</body>`;
  assert.equal(parseDirectSourcePage('OneRoof',oneRoof,'1 Test Road, Auckland').estimate.medium,950000);
  const qv='<title>1 Test Road, Auckland - QV</title><body>QV: $1,010,000 QV\'s estimated market value bedrooms 3 bathrooms 2 floor area 100m² land 500 m²</body>';
  assert.equal(parseDirectSourcePage('QV',qv,'1 Test Road, Auckland').estimate.medium,1010000);
});

test('direct page address match rejects a street number embedded inside another', () => {
  const card={property_details:{address:'24 Fairholme Avenue, Epsom, Auckland'}};
  const html=`<script id="homes-app-state" type="application/json">${JSON.stringify({one:{b:{card}}})}</script>`;
  assert.equal(parseDirectSourcePage('Homes',html,'4 Fairholme Avenue, Epsom, Auckland').status,'wrong_address');
});

test('direct PropertyValue page supplies valuation and sale status', () => {
  const data={PropertyDetails:{location:{locallyFormattedAddress:'1 Test Road, Auckland, 1010'},core:{beds:3,baths:1,landArea:400},additional:{floorArea:95,yearBuilt:'1980',roofMaterial:'Tile'},estimatedRange:{lowerBand:800000,upperBand:900000},ratingValuation:{capitalValue:'850000',legalDescriptions:['Lot 1 DP 2']},propertyTimeline:[{type:'sale',date:'01/01/2020',priceDescription:'$700,000'}],images:{propertyPhotoList:[{largePhotoUrl:'https://example.com/a.jpg'}]},isForSale:false}};
  const html=`<script>window.REDUX_DATA = ${JSON.stringify(data)};</script>`;
  const source=parseDirectSourcePage('PropertyValue',html,'1 Test Road, Auckland');
  assert.equal(source.status,'matched');
  assert.equal(source.estimate.medium,850000);
  assert.equal(source.facts.isForSale,false);
  assert.equal(source.facts.lastSalePrice,700000);
  assert.equal(source.facts.legalDescription,'Lot 1 DP 2');
  assert.equal(source.images[0],'https://example.com/a.jpg');
});

test('direct report shows source facts, photo and map without trusting page text', () => {
  const html = renderDirectReport([{addressId:1,address:'1 <script> Road, Auckland',latitude:-36.8,longitude:174.7,sources:{Homes:{status:'matched',url:'https://homes.co.nz/one',estimate:{medium:900000},facts:{bedrooms:3},images:['https://example.com/house.jpg']}}}]);
  assert.match(html,/900,000/);
  assert.match(html,/Open map/);
  assert.match(html,/house.jpg/);
  assert.doesNotMatch(html,/<script>/);
});
