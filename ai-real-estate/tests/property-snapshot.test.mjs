import { test } from 'vitest';
import assert from 'node:assert/strict';
import { matchAddress, matchTitleAddress, cleanEstimate, renderReport, parseCsvRow, candidatesFromCsv, sourceFromResponses, linzFeatureForAddress } from '../scripts/property-snapshot.mjs';

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
