import { ChannelsMode } from './settings';
export interface ChannelModeDefinition {
    mode: ChannelsMode;
    name: string;
}
export declare const FILTER_PUMP_MODES: ChannelModeDefinition[];
export type ReadMode = () => Promise<number>;
export type CycleMode = () => Promise<boolean | undefined>;
export type Wait = (milliseconds: number) => Promise<void>;
export declare function cycleToChannelMode(targetMode: number, readMode: ReadMode, cycleMode: CycleMode, wait?: Wait, maximumCycles?: number, initialMode?: number): Promise<number>;
