'use strict';
const assert = require('node:assert/strict');
const E = require('../assets/engine.js');

for (const type of Object.keys(E.TYPE_CONFIG)) {
  const suggestions = E.buildSuggestions(type, {asset:'Allgemein',purpose:'Allgemeine Tätigkeit',sourceText:''}, null);
  for (const [key, title] of E.TYPE_CONFIG[type].sections) assert.ok(suggestions[key].length >= 5, `${type} / ${title}: weniger als 5 Vorschläge`);
}

const parsed = E.parseSdb('ABSCHNITT 2 Signalwort: Gefahr GHS02 GHS07 H225 Flüssigkeit und Dampf leicht entzündbar. H319 Verursacht schwere Augenreizung. P305+P351+P338 Bei Kontakt mit den Augen mit Wasser spülen.');
assert.equal(parsed.ok, true);
assert.deepEqual(parsed.pictograms.sort(), ['GHS02','GHS07']);
assert.equal(parsed.signalWord, 'Gefahr');
assert.ok(parsed.codes.includes('P305+P351+P338'));

const oil = E.buildSuggestions('Gefahrstoff', {asset:'Schmieröl',purpose:'Kette ölen',sourceText:''}, null);
assert.ok(oil.emergency.some(x => /Bindemittel/.test(x)));
assert.ok(oil.disposal.some(x => /Bindemittel/.test(x)));

const empty = E.emptySelected('PSA');
assert.equal(E.completeness('PSA', empty).complete, false);
console.log('engine.test.js: alle Tests bestanden');
