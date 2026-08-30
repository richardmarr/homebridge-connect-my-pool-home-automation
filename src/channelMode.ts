import { ChannelsMode } from './settings';

export interface ChannelModeDefinition {
  mode: ChannelsMode;
  name: string;
}

export const FILTER_PUMP_MODES: ChannelModeDefinition[] = [
  { mode: ChannelsMode.OFF, name: 'Off' },
  { mode: ChannelsMode.AUTO, name: 'Auto' },
  { mode: ChannelsMode.LOW_SPEED, name: 'Low' },
  { mode: ChannelsMode.MEDIUM_SPEED, name: 'Medium' },
  { mode: ChannelsMode.HIGH_SPEED, name: 'High' },
];

export type ReadMode = () => Promise<number>;
export type CycleMode = () => Promise<boolean | undefined>;
export type Wait = (milliseconds: number) => Promise<void>;

const defaultWait: Wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * ConnectMyPool only exposes a "cycle channel mode" action. Cycle at most once
 * through the six API mode values and verify the reported status after every
 * action so unsupported modes are skipped safely.
 */
export async function cycleToChannelMode(
  targetMode: number,
  readMode: ReadMode,
  cycleMode: CycleMode,
  wait: Wait = defaultWait,
  maximumCycles = 6,
  initialMode?: number,
): Promise<number> {
  // ConnectMyPool throttles ordinary status reads to once per minute. Use the
  // last polled mode when supplied so the first API call is the control action;
  // the API then permits the verification reads that follow that action.
  let currentMode = initialMode ?? await readMode();
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
