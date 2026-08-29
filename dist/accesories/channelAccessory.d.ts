import { Service, PlatformAccessory } from 'homebridge';
import { ChannelDevice } from '../devices/channelDevice';
import { ConnectMyPoolHomeAutomationHomebridgePlatform } from '../platform';
import { PoolStatus } from '../status';
import { Accessory } from './accessory';
import { IChannelConfigStatus } from '../configStatus';
/**
 * Channel Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class ChannelAccessory extends Accessory {
    private stateOn;
    private stateContactOn;
    private stateName;
    private channelConfigStatus;
    private readonly channelsModes;
    constructor(platform: ConnectMyPoolHomeAutomationHomebridgePlatform, accessory: PlatformAccessory, device: ChannelDevice, status: PoolStatus);
    protected setUpServices(): void;
    protected createChannelServices(): Service;
    protected createChannelSensorService(): Service;
    protected getChannelsConfigStatus(status: PoolStatus): IChannelConfigStatus;
    setConfigStatus(status: PoolStatus): void;
    updateStatus(status: PoolStatus): Promise<void>;
    getContactSensorOnState(): number;
    getOnState(): boolean;
    setOnState(value: any): void;
    getNameState(): string;
}
//# sourceMappingURL=channelAccessory.d.ts.map