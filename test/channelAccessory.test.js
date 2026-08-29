"use strict";

const assert = require('node:assert/strict');
const { ChannelAccessory } = require('../dist/accesories/channelAccessory');

class MockCharacteristic {
  onGet(handler) {
    this.getter = handler;
    return this;
  }

  onSet(handler) {
    this.setter = handler;
    return this;
  }

  updateValue(value) {
    this.value = value;
    return this;
  }
}

class MockService {
  constructor(type, name, subtype) {
    this.type = type;
    this.name = name;
    this.subtype = subtype;
    this.characteristics = new Map();
    this.linked = [];
  }

  getCharacteristic(characteristic) {
    if (!this.characteristics.has(characteristic)) {
      this.characteristics.set(characteristic, new MockCharacteristic());
    }
    return this.characteristics.get(characteristic);
  }

  setCharacteristic(characteristic, value) {
    this.getCharacteristic(characteristic).value = value;
    return this;
  }

  updateCharacteristic(characteristic, value) {
    return this.setCharacteristic(characteristic, value);
  }

  setPrimaryService(value) {
    this.primary = value;
    return this;
  }

  addLinkedService(service) {
    this.linked.push(service);
  }
}

class MockAccessory {
  constructor(serviceTypes, includeLegacy = false) {
    this.context = {};
    this.services = [new MockService(serviceTypes.AccessoryInformation, 'Information')];
    if (includeLegacy) {
      this.services.push(new MockService(serviceTypes.Switch, 'Filter Pump', 'Channel'));
      this.services.push(new MockService(serviceTypes.ContactSensor, 'Filter Pump', 'Channel'));
    }
  }

  getService(type) {
    return this.services.find(service => service.type === type);
  }

  getServiceById(type, subtype) {
    return this.services.find(service => service.type === type && service.subtype === subtype);
  }

  addService(type, name, subtype) {
    const service = new MockService(type, name, subtype);
    this.services.push(service);
    return service;
  }

  removeService(service) {
    this.services = this.services.filter(candidate => candidate !== service);
  }
}

function createPlatform() {
  const Service = {
    AccessoryInformation: 'AccessoryInformation',
    Switch: 'Switch',
    ContactSensor: 'ContactSensor',
  };
  const Characteristic = {
    Name: 'Name',
    Manufacturer: 'Manufacturer',
    Model: 'Model',
    SerialNumber: 'SerialNumber',
    On: 'On',
    ContactSensorState: {
      CONTACT_DETECTED: 0,
      CONTACT_NOT_DETECTED: 1,
    },
  };
  return {
    Service,
    Characteristic,
    log: { debug() {}, error() {}, info() {} },
    api: {
      hap: { Characteristic },
      updatePlatformAccessories() {},
    },
    async setPoolAction() { return true; },
    async getPoolStatus() { throw new Error('not expected in this test'); },
  };
}

function createDevice(name, channelNumber, channelFunction) {
  return {
    deviceName: name,
    deviceType: 'Channel',
    deviceTypeNumber: channelNumber,
    data: {
      channel_number: channelNumber,
      function: channelFunction,
      name,
    },
  };
}

function createStatus(channelNumber, mode) {
  return { channels: [{ channel_number: channelNumber, mode }] };
}

const platform = createPlatform();
const filterAccessory = new MockAccessory(platform.Service, true);
new ChannelAccessory(platform, filterAccessory, createDevice('Filter Pump', 0, 1), createStatus(0, 1));

const filterServices = filterAccessory.services.filter(service => service.type === platform.Service.Switch);
assert.deepEqual(filterServices.map(service => service.name), ['Off', 'Auto', 'Low', 'Medium', 'High']);
assert.equal(filterAccessory.services.some(service => service.type === platform.Service.ContactSensor), false);
assert.equal(filterServices[0].primary, true);
assert.equal(filterServices[0].linked.length, 4);

for (const service of filterServices) {
  const expected = service.name === 'Auto';
  assert.equal(service.getCharacteristic(platform.Characteristic.On).getter(), expected);
}

const cleaningAccessory = new MockAccessory(platform.Service);
new ChannelAccessory(platform, cleaningAccessory, createDevice('Cleaning', 1, 2), createStatus(1, 2));
assert.equal(cleaningAccessory.services.filter(service => service.type === platform.Service.Switch).length, 1);
assert.equal(cleaningAccessory.services.filter(service => service.type === platform.Service.ContactSensor).length, 1);

console.log('channelAccessory tests passed');
