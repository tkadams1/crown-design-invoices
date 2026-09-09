// One check: the money math, run against the line items in example_invoice.txt.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./Invoice Maker.html', import.meta.url), 'utf8');
const src = html.match(/<script id="lib">([\s\S]*?)<\/script>/)[1];
const { toCents, fmt, totals, needsGeo } = new Function(src + '; return { toCents, fmt, totals, needsGeo };')();

assert.equal(toCents('$ 6,743.00'), 674300);
assert.equal(toCents('650'), 65000);
assert.equal(toCents('-0-'), 0);
assert.equal(toCents(''), 0);
assert.equal(toCents('abc'), 0);
assert.equal(fmt(3520253), '$35,202.53');
assert.equal(fmt(0), '$0.00');

// example_invoice.txt line items. Hand-written total says 29,103.00 but the items actually sum to 29,093.00.
const amounts = [
  650, 300, 1600, 420, 1000, 100, 30, 900, 750,   // 1. master bath
  400, '-0-', 2220, 1120, 150, 200, 50,           // 2. hall bath
  4900, 600, 30, 300,                             // 3. painting
  1100, 560, 1400,                                // 4. drywall
  700, 960, 200,                                  // 5. base trim
  650, 200, 160,                                  // 6. den
  '$ 6,743.00',                                   // 7. flooring
  400, 300,                                       // 8. final
];
const inv = { sections: [{ items: amounts.map(a => ({ amount: String(a) })) }], overheadPct: '10', profitPct: '10' };
const t = totals(inv);
assert.equal(t.cost, 2909300);
assert.equal(t.overhead, 290930);
assert.equal(t.sub, 3200230);
assert.equal(t.profit, 320023);   // 10% of the subtotal, not of the cost
assert.equal(t.final, 3520253);

// zero percentages
assert.deepEqual(totals({ sections: [{ items: [{ amount: '100' }] }], overheadPct: '', profitPct: '0' }), { cost: 10000, overhead: 0, sub: 10000, profit: 0, final: 10000 });

// map lookups: only addresses that have not been looked up yet, misses included
assert.equal(needsGeo({ address: '' }), false);
assert.equal(needsGeo({ address: ' 12 Main St\nSpringfield ' }), true);
assert.equal(needsGeo({ address: ' 12 Main St\nSpringfield ', geo: { q: '12 Main St Springfield', lat: 1, lon: 2, src: 'census' } }), false);
assert.equal(needsGeo({ address: '12 Main St Springfield', geo: { q: '12 Main St Springfield', lat: 1, lon: 2 } }), true);   // located by the old service: look it up again
assert.equal(needsGeo({ address: '12 Main St Springfield', geo: { q: '12 Main St Springfield', src: 'census' } }), false);   // a miss is not retried
assert.equal(needsGeo({ address: '13 Main St Springfield', geo: { q: '12 Main St Springfield', lat: 1, lon: 2, src: 'census' } }), true);   // address changed

console.log('ok');
