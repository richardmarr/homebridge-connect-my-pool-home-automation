"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelAccessory = void 0;
const action_1 = require("../action");
const status_1 = require("../status");
const accessory_1 = require("./accessory");
const config_1 = require("../config");
const settings_1 = require("../settings");
const channelMode_1 = require("../channelMode");

class ChannelAccessory extends accessory_1.Accessory {
    constructor(platform, accessory, device, status) {
        super(platform, accessory, device, status);
        this.stateOn = false;
        this.stateContactOn = this.Characteristic.ContactSensorState.CONTACT_DETECTED;
        this.channelsModes = [];
        this.stateName = this.deviceName;
        this.channelConfigStatus = this.getChannelsConfigStatus(status);
        this.channelsModes.push({ key: 0, value: 'Off' });
        this.channelsModes.push({ key: 1, value: 'Auto' });
        this.channelsModes.push({ key: 2, value: 'On' });
        this.channelsModes.push({ key: 3, value: 'Low Speed' });
        this.channelsModes.push({ key: 4, value: 'Medium Speed' });
        this.channelsModes.push({ key: 5, value: 'High Speed' });
    }
    setUpServices() {
        super.setUpServices();
        this.modeServices = new Map();
        if (this.isFilterPump()) {
            this.removeLegacyFilterPumpServices();
            this.createFilterPumpModeServices();
        }
        else {
            this.channelService = this.createChannelService();
            this.channelService.setPrimaryService(true);
            this.channelSensorService = this.createChannelSensorService();
        }
        super.updatePlatform();
    }
    isFilterPump() {
        const config = this.device.data;
        return config.function === config_1.ChannelConfigFunction.FilterPump;
    }
    removeLegacyFilterPumpServices() {
        const legacySwitch = this.accessory.getServiceById(this.service.Switch, this.deviceType);
        const legacyContact = this.accessory.getServiceById(this.service.ContactSensor, this.deviceType);
        if (legacySwitch) {
            this.accessory.removeService(legacySwitch);
        }
        if (legacyContact) {
            this.accessory.removeService(legacyContact);
        }
    }
    createFilterPumpModeServices() {
        let primaryService;
        for (const definition of channelMode_1.FILTER_PUMP_MODES) {
            const subtype = `${this.deviceType}-mode-${definition.mode}`;
            const modeService = this.accessory.getServiceById(this.service.Switch, subtype)
                || this.accessory.addService(this.service.Switch, definition.name, subtype);
            modeService.setCharacteristic(this.Characteristic.Name, definition.name);
            // Modern versions of Apple Home use ConfiguredName when presenting
            // multiple services contained in one accessory. Without it, all five
            // switches inherit the accessory name ("Filter Pump").
            modeService.setCharacteristic(this.Characteristic.ConfiguredName, definition.name);
            modeService.getCharacteristic(this.Characteristic.On)
                .onGet(() => this.getModeState(definition.mode))
                .onSet(value => this.setModeState(Boolean(value), definition.mode));
            this.modeServices.set(definition.mode, modeService);
            this.services.push(modeService);
            if (!primaryService) {
                primaryService = modeService;
                primaryService.setPrimaryService(true);
            }
            else {
                primaryService.addLinkedService(modeService);
            }
        }
    }
    createChannelService() {
        this.log.debug('Creating %s service for accessory', this.deviceName);
        const zoneService = this.accessory.getServiceById(this.service.Switch, this.deviceType)
            || this.accessory.addService(this.service.Switch, this.deviceName, this.deviceType);
        zoneService.getCharacteristic(this.Characteristic.On)
            .onGet(this.getOnState.bind(this))
            .onSet(this.setOnState.bind(this));
        this.services.push(zoneService);
        return zoneService;
    }
    createChannelSensorService() {
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
    getChannelsConfigStatus(status) {
        const currentDevice = this.device;
        const currentConfig = currentDevice.data;
        if (status) {
            const channelStatus = status.channels.find(h => h.channel_number === currentConfig.channel_number);
            const configStatus = Object.assign({}, new status_1.ChannelStatus(currentConfig.channel_number, true, currentConfig.function), currentConfig, channelStatus);
            this.debugLog('channelConfigStatus', configStatus);
            return configStatus;
        }
        const configStatus = Object.assign({}, currentConfig, new status_1.ChannelStatus(currentConfig.channel_number, false, currentConfig.function));
        this.debugLog('channelConfigStatus', configStatus);
        return configStatus;
    }
    setConfigStatus(status) {
        this.channelConfigStatus = this.getChannelsConfigStatus(status);
    }
    async updateStatus(status) {
        var _a, _b, _c;
        await super.updateStatus(status);
        if (this.isFilterPump()) {
            this.updateModeServices();
            return;
        }
        (_a = this.channelService) === null || _a === void 0 ? void 0 : _a.getCharacteristic(this.Characteristic.On).updateValue(this.getOnState());
        (_b = this.channelSensorService) === null || _b === void 0 ? void 0 : _b.getCharacteristic(this.Characteristic.ContactSensorState).updateValue(this.getContactSensorOnState());
        (_c = this.channelSensorService) === null || _c === void 0 ? void 0 : _c.getCharacteristic(this.Characteristic.Name).updateValue(this.getNameState());
    }
    getModeState(mode) {
        return this.channelConfigStatus.mode === mode;
    }
    updateModeServices() {
        for (const [mode, service] of this.modeServices) {
            service.getCharacteristic(this.Characteristic.On).updateValue(this.getModeState(mode));
        }
    }
    async readCurrentMode() {
        const status = await this.platform.getPoolStatus();
        if (!status) {
            throw new Error('Unable to read ConnectMyPool status');
        }
        this.accessory.context.status = status;
        this.setConfigStatus(status);
        return this.channelConfigStatus.mode;
    }
    async setModeState(value, targetMode) {
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
            await (0, channelMode_1.cycleToChannelMode)(targetMode, this.readCurrentMode.bind(this), () => this.platform.setPoolAction(action_1.PoolAction.CycleChanelMode, this.device.deviceTypeNumber), undefined, 6, this.channelConfigStatus.mode);
        }
        finally {
            this.settingMode = undefined;
            this.updateModeServices();
        }
    }
    getContactSensorOnState() {
        const value = this.getOnState()
            ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
            : this.Characteristic.ContactSensorState.CONTACT_DETECTED;
        this.debugLog('getContactSensorOnState', value);
        this.stateContactOn = value;
        return this.stateContactOn;
    }
    getOnState() {
        const value = this.channelConfigStatus.mode > settings_1.ChannelsMode.AUTO;
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
        this.platform.setPoolAction(action_1.PoolAction.CycleChanelMode, this.device.deviceTypeNumber).then(res => {
            this.debugLog('setOnState Result', res);
        });
    }
    getNameState() {
        var _a;
        const value = !this.getOnState()
            ? this.deviceName
            : `${this.deviceName}-${(_a = this.channelsModes.find(kv => kv.key === this.channelConfigStatus.mode)) === null || _a === void 0 ? void 0 : _a.value}`;
        this.debugLog('getNameState', value);
        this.stateName = value;
        return this.stateName;
    }
}
exports.ChannelAccessory = ChannelAccessory;
