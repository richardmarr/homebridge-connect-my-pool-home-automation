import { Service, PlatformAccessory } from 'homebridge';
import { PoolAction } from '../action';
import { ChannelDevice } from '../devices/channelDevice';
import { ConnectMyPoolHomeAutomationHomebridgePlatform } from '../platform';
import { ChannelStatus, KeyValuePair, PoolStatus } from '../status';
import { Accessory } from './accessory';
import { IChannelConfigStatus } from '../configStatus';
import { ChannelConfig, ChannelConfigFunction } from '../config';
import { ChannelsMode } from '../settings';
import { cycleToChannelMode, FILTER_PUMP_MODES } from '../channelMode';

/**
 * A ConnectMyPool channel. Filter pumps expose their complete mode as grouped,
 * mutually-exclusive switches; other channel types retain the legacy switch
 * and contact-sensor presentation.
 */
export class ChannelAccessory extends Accessory {
  private stateOn = false;
  private stateContactOn = this.Characteristic.ContactSensorState.CONTACT_DETECTED;
  private stateName: string;
  private channelConfigStatus: IChannelConfigStatus;
  private channelService?: Service;
  private channelSensorService?: Service;
  private modeServices!: Map<number, Service>;
  private settingMode?: number;

  private readonly channelsModes: KeyValuePair[] = [];

  constructor(
    platform: ConnectMyPoolHomeAutomationHomebridgePlatform,
    accessory: PlatformAccessory,
    device: ChannelDevice,
    status: PoolStatus,
  ) {
    super(platform, accessory, device, status);
    this.stateName = this.deviceName;
    this.channelConfigStatus = this.getChannelsConfigStatus(status);

    this.channelsModes.push({ key: 0, value: 'Off' });
    this.channelsModes.push({ key: 1, value: 'Auto' });
    this.channelsModes.push({ key: 2, value: 'On' });
    this.channelsModes.push({ key: 3, value: 'Low Speed' });
    this.channelsModes.push({ key: 4, value: 'Medium Speed' });
    this.channelsModes.push({ key: 5, value: 'High Speed' });
  }

  protected setUpServices() {
    super.setUpServices();
    this.modeServices = new Map<number, Service>();

    if (this.isFilterPump()) {
      this.removeLegacyFilterPumpServices();
      this.createFilterPumpModeServices();
    } else {
      this.channelService = this.createChannelService();
      this.channelService.setPrimaryService(true);
      this.channelSensorService = this.createChannelSensorService();
    }

    super.updatePlatform();
  }

  private isFilterPump(): boolean {
    const config = (this.device as ChannelDevice).data as ChannelConfig;
    return config.function === ChannelConfigFunction.FilterPump;
  }

  private removeLegacyFilterPumpServices() {
    const legacySwitch = this.accessory.getServiceById(this.service.Switch, this.deviceType);
    const legacyContact = this.accessory.getServiceById(this.service.ContactSensor, this.deviceType);
    if (legacySwitch) {
      this.accessory.removeService(legacySwitch);
    }
    if (legacyContact) {
      this.accessory.removeService(legacyContact);
    }
  }

  private createFilterPumpModeServices() {
    let primaryService: Service | undefined;

    for (const definition of FILTER_PUMP_MODES) {
      const subtype = `${this.deviceType}-mode-${definition.mode}`;
      const modeService = this.accessory.getServiceById(this.service.Switch, subtype)
        || this.accessory.addService(this.service.Switch, definition.name, subtype);

      modeService.setCharacteristic(this.Characteristic.Name, definition.name);
      modeService.getCharacteristic(this.Characteristic.On)
        .onGet(() => this.getModeState(definition.mode))
        .onSet(value => this.setModeState(Boolean(value), definition.mode));

      this.modeServices.set(definition.mode, modeService);
      this.services.push(modeService);

      if (!primaryService) {
        primaryService = modeService;
        primaryService.setPrimaryService(true);
      } else {
        primaryService.addLinkedService(modeService);
      }
    }
  }

  protected createChannelService(): Service {
    this.log.debug('Creating %s service for accessory', this.deviceName);
    const zoneService = this.accessory.getServiceById(this.service.Switch, this.deviceType)
      || this.accessory.addService(this.service.Switch, this.deviceName, this.deviceType);
    zoneService.getCharacteristic(this.Characteristic.On)
      .onGet(this.getOnState.bind(this))
      .onSet(this.setOnState.bind(this));

    this.services.push(zoneService);
    return zoneService;
  }

  protected createChannelSensorService(): Service {
    this.log.debug('Creating %s sensor service for accessory', this.deviceName);
    const zoneService = this.accessory.getServiceById(this.service.ContactSensor, this.deviceType)
      || this.accessory.addService(this.service.ContactSensor, this.deviceName, this.deviceType);
    zoneService.getCharacteristic(this.Characteristic.ContactSensorState)
      .onGet(this.getContactSensorOnState.bind(this));
    zoneService.getCharacteristic(this.Characteristic.Name)
      .onGet(this.getNameState.bind(this));

    this.services.push(zoneService);
    return zoneService;
  }

  protected getChannelsConfigStatus(status: PoolStatus): IChannelConfigStatus {
    const currentDevice = this.device as ChannelDevice;
    const currentConfig = currentDevice.data as ChannelConfig;
    if (status) {
      const channelStatus = status.channels.find(h => h.channel_number === currentConfig.channel_number);
      const configStatus: IChannelConfigStatus = Object.assign(
        {},
        new ChannelStatus(currentConfig.channel_number, true, currentConfig.function),
        currentConfig,
        channelStatus,
      );
      this.debugLog('channelConfigStatus', configStatus);
      return configStatus;
    }

    const configStatus: IChannelConfigStatus = Object.assign(
      {},
      currentConfig,
      new ChannelStatus(currentConfig.channel_number, false, currentConfig.function),
    );
    this.debugLog('channelConfigStatus', configStatus);
    return configStatus;
  }

  setConfigStatus(status: PoolStatus) {
    this.channelConfigStatus = this.getChannelsConfigStatus(status);
  }

  async updateStatus(status: PoolStatus) {
    await super.updateStatus(status);

    if (this.isFilterPump()) {
      this.updateModeServices();
      return;
    }

    this.channelService?.getCharacteristic(this.Characteristic.On)
      .updateValue(this.getOnState());
    this.channelSensorService?.getCharacteristic(this.Characteristic.ContactSensorState)
      .updateValue(this.getContactSensorOnState());
    this.channelSensorService?.getCharacteristic(this.Characteristic.Name)
      .updateValue(this.getNameState());
  }

  private getModeState(mode: number): boolean {
    return this.channelConfigStatus.mode === mode;
  }

  private updateModeServices() {
    for (const [mode, service] of this.modeServices) {
      service.getCharacteristic(this.Characteristic.On)
        .updateValue(this.getModeState(mode));
    }
  }

  private async readCurrentMode(): Promise<number> {
    const status = await this.platform.getPoolStatus();
    if (!status) {
      throw new Error('Unable to read ConnectMyPool status');
    }
    this.accessory.context.status = status;
    this.setConfigStatus(status);
    return this.channelConfigStatus.mode;
  }

  private async setModeState(value: boolean, targetMode: number): Promise<void> {
    if (!value) {
      this.updateModeServices();
      return;
    }
    if (this.channelConfigStatus.mode === targetMode) {
      return;
    }
    if (this.settingMode !== undefined) {
      throw new Error(`Already changing pump mode to ${this.settingMode}`);
    }

    this.settingMode = targetMode;
    try {
      await cycleToChannelMode(
        targetMode,
        this.readCurrentMode.bind(this),
        () => this.platform.setPoolAction(PoolAction.CycleChanelMode, this.device.deviceTypeNumber),
      );
    } finally {
      this.settingMode = undefined;
      this.updateModeServices();
    }
  }

  getContactSensorOnState(): number {
    const value = this.getOnState()
      ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.Characteristic.ContactSensorState.CONTACT_DETECTED;
    this.debugLog('getContactSensorOnState', value);
    this.stateContactOn = value;
    return this.stateContactOn;
  }

  getOnState(): boolean {
    const value = this.channelConfigStatus.mode > ChannelsMode.AUTO;
    this.debugLog('getOnState', value);
    this.stateOn = value;
    return this.stateOn;
  }

  setOnState(value) {
    this.debugLog('setOnState', value);
    if (this.stateOn === value) {
      return;
    }
    this.stateOn = value;
    this.platform.setPoolAction(PoolAction.CycleChanelMode, this.device.deviceTypeNumber).then(res => {
      this.debugLog('setOnState Result', res);
    });
  }

  getNameState(): string {
    const value = !this.getOnState()
      ? this.deviceName
      : `${this.deviceName}-${this.channelsModes.find(kv => kv.key === this.channelConfigStatus.mode)?.value}`;
    this.debugLog('getNameState', value);
    this.stateName = value;
    return this.stateName;
  }
}
