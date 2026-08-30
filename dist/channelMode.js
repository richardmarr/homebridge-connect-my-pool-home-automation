"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILTER_PUMP_MODES = void 0;
exports.cycleToChannelMode = cycleToChannelMode;
const settings_1 = require("./settings");

exports.FILTER_PUMP_MODES = [
    { mode: settings_1.ChannelsMode.OFF, name: 'Off' },
    { mode: settings_1.ChannelsMode.AUTO, name: 'Auto' },
    { mode: settings_1.ChannelsMode.LOW_SPEED, name: 'Low' },
    { mode: settings_1.ChannelsMode.MEDIUM_SPEED, name: 'Medium' },
    { mode: settings_1.ChannelsMode.HIGH_SPEED, name: 'High' },
];

const defaultWait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function cycleToChannelMode(targetMode, readMode, cycleMode, wait = defaultWait, maximumCycles = 6, initialMode) {
    // ConnectMyPool throttles ordinary status reads to once per minute. Use the
    // last polled mode when supplied so the first API call is the control action;
    // the API then permits the verification reads that follow that action.
    let currentMode = initialMode !== null && initialMode !== void 0 ? initialMode : await readMode();
    if (currentMode === targetMode) {
        return currentMode;
    }
    for (let cycle = 0; cycle < maximumCycles; cycle++) {
        const accepted = await cycleMode();
        if (!accepted) {
            throw new Error('ConnectMyPool rejected the channel mode change');
        }
        await wait(750);
        currentMode = await readMode();
        if (currentMode === targetMode) {
            return currentMode;
        }
    }
    throw new Error(`Unable to reach channel mode ${targetMode}; current mode is ${currentMode}`);
}
