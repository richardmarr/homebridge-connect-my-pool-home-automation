"use strict";

const assert = require('node:assert/strict');
const { shouldExposeFavourites } = require('../dist/favouriteVisibility');

assert.equal(shouldExposeFavourites({}), true);
assert.equal(shouldExposeFavourites({ hideFavourites: false }), true);
assert.equal(shouldExposeFavourites({ hideFavourites: true }), false);

console.log('favourite visibility tests passed');
