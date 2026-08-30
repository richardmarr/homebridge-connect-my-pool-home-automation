"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectMyPoolHomeAutomationHomebridgePlatform = void 0;
const settings_1 = require("./settings");
const axios_1 = __importDefault(require("axios"));
const solarSystemDevice_1 = require("./devices/solarSystemDevice");
const solarSystemAccessory_1 = require("./accesories/solarSystemAccessory");
const channelDevice_1 = require("./devices/channelDevice");
const channelAccessory_1 = require("./accesories/channelAccessory");
const heaterDevice_1 = require("./devices/heaterDevice");
const heaterAccessory_1 = require("./accesories/heaterAccessory");
const favouriteDevice_1 = require("./devices/favouriteDevice");
const favouriteAccessory_1 = require("./accesories/favouriteAccessory");
const lightingZoneDevice_1 = require("./devices/lightingZoneDevice");
const lightingAccessory_1 = require("./accesories/lightingAccessory");
const favouriteVisibility_1 = require("./favouriteVisibility");
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class ConnectMyPoolHomeAutomationHomebridgePlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.hiddenFavouriteAccessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);
        axios_1.default.defaults.baseURL = settings_1.BASE_URL;
        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            // run the method to discover / register your devices as accessories
            this.discoverDevices();
        });
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    async configureAccessory(homekitAccessory) {
        this.log.info(`Restoring cached accessory ${homekitAccessory.displayName}`);
        try {
            const device = homekitAccessory.context.device;
            const poolStatus = homekitAccessory.context.status;
            if (device && device.deviceType === favouriteDevice_1.FavouriteDevice.type && !(0, favouriteVisibility_1.shouldExposeFavourites)(this.config)) {
                this.log.info(`Queuing hidden favourite accessory ${homekitAccessory.displayName} for removal`);
                this.hiddenFavouriteAccessories.push(homekitAccessory);
                return;
            }
            let accessory;
            if (device) {
                this.log.debug('Device', device);
                if (device.deviceType === heaterDevice_1.HeaterDevice.type) {
                    const heaterDevice = device;
                    accessory = new heaterAccessory_1.HeaterAccessory(this, homekitAccessory, heaterDevice, poolStatus);
                }
                else if (device.deviceType === solarSystemDevice_1.SolarSystemDevice.type) {
                    accessory = new solarSystemAccessory_1.SolarSystemAccessory(this, homekitAccessory, device, poolStatus);
                }
                else if (device.deviceType === channelDevice_1.ChannelDevice.type) {
                    const channelDevice = device;
                    accessory = new channelAccessory_1.ChannelAccessory(this, homekitAccessory, channelDevice, poolStatus);
                }
                else if (device.deviceType === lightingZoneDevice_1.LightingZoneDevice.type) {
                    accessory = new lightingAccessory_1.LightingAccessory(this, homekitAccessory, device, poolStatus);
                }
                else if (device.deviceType === favouriteDevice_1.FavouriteDevice.type) {
                    accessory = new favouriteAccessory_1.FavouriteAccessory(this, homekitAccessory, device, poolStatus);
                }
                if (accessory) {
                    this.accessories.push(accessory);
                }
            }
        }
        catch (error) {
            this.log.error(`Failed to restore cached accessory ${homekitAccessory.displayName}`, error);
        }
    }
    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        const devices = [];
        if (this.hiddenFavouriteAccessories.length > 0) {
            this.log.info(`Removing ${this.hiddenFavouriteAccessories.length} hidden favourite accessories`);
            this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, this.hiddenFavouriteAccessories);
            this.hiddenFavouriteAccessories.length = 0;
        }
        const poolConfig = await this.getPoolConfig();
        if (poolConfig) {
            if (poolConfig.has_heaters === true) {
                let i = 0;
                for (const heater of poolConfig.heaters) {
                    i++;
                    const device = new heaterDevice_1.HeaterDevice(heater, i, poolConfig.pool_spa_selection_enabled);
                    devices.push(device);
                }
            }
            if (poolConfig.has_solar_systems === true) {
                let i = 0;
                for (const solarsystem of poolConfig.solar_systems) {
                    i++;
                    const device = new solarSystemDevice_1.SolarSystemDevice(solarsystem, i);
                    devices.push(device);
                }
            }
            if (poolConfig.has_channels === true) {
                for (const channel of poolConfig.channels) {
                    const device = new channelDevice_1.ChannelDevice(channel, channel.name, channel.function);
                    devices.push(device);
                }
            }
            if (poolConfig.has_lighting_zones === true) {
                for (const lighting of poolConfig.lighting_zones) {
                    const device = new lightingZoneDevice_1.LightingZoneDevice(lighting, lighting.name);
                    devices.push(device);
                }
            }
            if (poolConfig.has_favourites === true && (0, favouriteVisibility_1.shouldExposeFavourites)(this.config)) {
                for (const favourite of poolConfig.favourites) {
                    const device = new favouriteDevice_1.FavouriteDevice(favourite, favourite.name);
                    devices.push(device);
                }
            }
            const poolStatus = await this.getPoolStatus();
            for (const device of devices) {
                // see if an accessory with the same uuid has already been registered and restored from
                // the cached devices we stored in the `configureAccessory` method above
                this.log.debug('Accessories:', this.accessories.length);
                const existingAccessory = this.accessories.find(accessory => accessory.device.deviceType === device.deviceType
                    && accessory.deviceName === device.deviceName);
                if (!existingAccessory && poolStatus) {
                    // create a new accessory
                    const uuid = this.api.hap.uuid.generate(`${device.deviceType}:${device.deviceTypeNumber}`);
                    const platformAccessory = new this.api.platformAccessory(device.deviceName, uuid, device.category);
                    let accessory;
                    if (device.deviceType === heaterDevice_1.HeaterDevice.type) {
                        accessory = new heaterAccessory_1.HeaterAccessory(this, platformAccessory, device, poolStatus);
                    }
                    else if (device.deviceType === solarSystemDevice_1.SolarSystemDevice.type) {
                        accessory = new solarSystemAccessory_1.SolarSystemAccessory(this, platformAccessory, device, poolStatus);
                    }
                    else if (device.deviceType === channelDevice_1.ChannelDevice.type) {
                        accessory = new channelAccessory_1.ChannelAccessory(this, platformAccessory, device, poolStatus);
                    }
                    else if (device.deviceType === lightingZoneDevice_1.LightingZoneDevice.type) {
                        accessory = new lightingAccessory_1.LightingAccessory(this, platformAccessory, device, poolStatus);
                    }
                    else if (device.deviceType === favouriteDevice_1.FavouriteDevice.type) {
                        accessory = new favouriteAccessory_1.FavouriteAccessory(this, platformAccessory, device, poolStatus);
                    }
                    if (accessory) {
                        // the accessory does not yet exist, so we need to create it
                        this.log.info('Adding new accessory:', device.deviceName);
                        this.accessories.push(accessory);
                        // link the accessory to your platform
                        this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [platformAccessory]);
                    }
                    else {
                        this.log.debug('Unable to add new accessory:', device.deviceName);
                    }
                }
                else {
                    this.log.debug('Restoring accessory:', device.deviceName);
                }
            }
        }
        this.poll(settings_1.API_INTERVAL);
    }
    poll(interval) {
        this.log.info('Poll PoolStatus');
        if (this.pollIntervalId) {
            clearInterval(this.pollIntervalId);
        }
        this.pollIntervalId = setInterval(async () => {
            const poolStatus = await this.getPoolStatus();
            if (poolStatus) {
                this.log.debug('PoolStatus', poolStatus);
                for (const accessory of this.accessories) {
                    await accessory.updateStatus(poolStatus);
                }
            }
        }, interval);
    }
    async setPoolAction(actionCode, deviceNumber, value = '', outputResponse = false, waitForExecution = true) {
        const payload = {
            'pool_api_code': this.config.apikey,
            'temperature_scale': settings_1.TemperatureScale.CELSIUS,
            'action_code': actionCode,
            'device_number': deviceNumber,
            'value': value,
            'wait_for_execution': waitForExecution,
        };
        this.log.debug('Set PoolAction', payload);
        const req = axios_1.default.post('poolaction', payload);
        const res = await req;
        const status = res.data;
        if (outputResponse) {
            this.log.debug('Set PoolAction Response', status);
        }
        if (status.failure_code) {
            this.log.error('Set PoolAction Failed', status);
            return undefined;
        }
        return status.execution_status === 1;
    }
    async getPoolStatus() {
        this.log.debug('getPoolStatus');
        const req = axios_1.default.post('poolstatus', {
            'pool_api_code': this.config.apikey,
            'temperature_scale': settings_1.TemperatureScale.CELSIUS,
        });
        const res = await req;
        const status = res.data;
        if (status.failure_code) {
            this.log.error('PoolStatus Failed', status);
            return undefined;
        }
        return status;
    }
    async getPoolConfig() {
        this.log.debug('getPoolConfig');
        const req = axios_1.default.post('poolconfig', {
            'pool_api_code': this.config.apikey,
        });
        const res = await req;
        return res.data;
    }
}
exports.ConnectMyPoolHomeAutomationHomebridgePlatform = ConnectMyPoolHomeAutomationHomebridgePlatform;
//# sourceMappingURL=platform.js.map