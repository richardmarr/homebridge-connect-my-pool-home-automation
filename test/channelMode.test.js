"use strict";

const assert = require('node:assert/strict');
const { cycleToChannelMode, FILTER_PUMP_MODES } = require('../dist/channelMode');

const noWait = async () => undefined;

async function run() {
  assert.deepEqual(
    FILTER_PUMP_MODES.map(({ mode, name }) => [mode, name]),
    [[0, 'Off'], [1, 'Auto'], [3, 'Low'], [4, 'Medium'], [5, 'High']],
  );

  let current = 3;
  let cycles = 0;
  assert.equal(await cycleToChannelMode(3, async () => current, async () => {
    cycles++;
    return true;
  }, noWait), 3);
  assert.equal(cycles, 0);

  const allModes = [0, 1, 2, 3, 4, 5];
  current = 0;
  cycles = 0;
  assert.equal(await cycleToChannelMode(4, async () => current, async () => {
    current = allModes[(allModes.indexOf(current) + 1) % allModes.length];
    cycles++;
    return true;
  }, noWait), 4);
  assert.equal(cycles, 4);

  const variablePumpModes = [0, 1, 3, 4, 5];
  current = 1;
  assert.equal(await cycleToChannelMode(5, async () => current, async () => {
    current = variablePumpModes[(variablePumpModes.indexOf(current) + 1) % variablePumpModes.length];
    return true;
  }, noWait), 5);

  await assert.rejects(
    cycleToChannelMode(5, async () => 0, async () => false, noWait),
    /rejected/,
  );

  current = 0;
  await assert.rejects(
    cycleToChannelMode(2, async () => current, async () => {
      current = variablePumpModes[(variablePumpModes.indexOf(current) + 1) % variablePumpModes.length];
      return true;
    }, noWait),
    /Unable to reach channel mode 2/,
  );

  console.log('channelMode tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
