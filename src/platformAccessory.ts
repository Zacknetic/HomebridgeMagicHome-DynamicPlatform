import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP,
} from 'homebridge';

import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, MagicHomeAccessory } from './misc/types';
import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, DeviceWriteStatus, IProtoDevice } from 'magichome-platform';
import { _ } from 'lodash';
import Queue from 'queue-promise';
import { getLogs } from './logs';

const { ready, pending, busy } = DeviceWriteStatus;
const CCT = 'CCT';
const HSL = 'HSL';

const BUFFER_MS = 20;
const FINAL_COMMAND_TIMEOUT = 100;
const QUEUE_INTERVAL = 150;

const SLOW_COMMAND_OPTIONS: ICommandOptions = { verifyRetries: 10, bufferMS: 10, timeoutMS: 1000 };
const MEDIUM_COMMAND_OPTIONS: ICommandOptions = { verifyRetries: 10, bufferMS: 10, timeoutMS: 200 };
const FAST_COMMAND_OPTIONS: ICommandOptions = { verifyRetries: 0, bufferMS: 0, timeoutMS: 20 };

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {

  protected service: Service;

  protected adaptiveLightingService;

  protected newAccessoryCommand: IAccessoryCommand;
  protected latestDeviceCommand: IDeviceCommand;
  protected latestAccessoryCommand: IAccessoryCommand;

  protected ColorCommandMode = HSL;
  protected readonly hap: HAP;
  protected logs = getLogs();


  protected colorWhiteThreshold;
  protected colorWhiteThresholdSimultaniousDevices;
  protected colorOffThresholdSimultaniousDevices;
  protected simultaniousDevicesColorWhite;

  protected accessoryState: IAccessoryState = DefaultAccessoryCommand;
  protected accessoryStateTemporary: IAccessoryState;
  protected deviceWriteStatus = ready;
  protected queue;
  protected deviceAPI: { hasBrightness, hasCCT };
  protected slowQueueRetry = false;

  //=================================================
  // Start Constructor //

  constructor(
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    protected readonly controller: BaseController,
  ) {

    this.colorWhiteThreshold = this.config.whiteEffects.colorWhiteThreshold;
    this.colorWhiteThresholdSimultaniousDevices = this.config.whiteEffects.colorWhiteThresholdSimultaniousDevices;
    this.colorOffThresholdSimultaniousDevices = this.config.whiteEffects.colorOffThresholdSimultaniousDevices;
    this.simultaniousDevicesColorWhite = this.config.whiteEffects.simultaniousDevicesColorWhite;

    this.accessoryState = this.accessory.context.cachedAccessoryState || DefaultAccessoryCommand;

    this.controller = controller;
    this.hap = api.hap;
    this.api = api;
    this.setupCommandQueue();
    this.initializeCharacteristics();
    this.fetchAndUpdateState(2);
  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //

  async setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    callback(null);

    const accessoryCommand: IAccessoryCommand = { isOn: value as boolean };
    this.processAccessoryCommand(accessoryCommand);
  }

  setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    callback(null);
    this.accessoryState.HSL.hue = value as number;

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { hue: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    callback(null);
    this.accessoryState.HSL.saturation = value as number;

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { saturation: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    callback(null);

    this.accessoryState.brightness = value as number;
    const accessoryCommand: IAccessoryCommand = { isOn: true, brightness: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.ColorCommandMode = CCT;
    callback(null);
    const accessoryCommand: IAccessoryCommand = { colorTemperature: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setConfiguredName(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    const name: string = value.toString();
    this.logs.debug('Renaming device to %o', name);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);

    callback(null);
  }

  identifyLight() {

    this.flashEffect();
  }

  //=================================================
  // End Setters //

  //=================================================
  // Start Getters //

  getHue(callback: CharacteristicGetCallback) {

    const hue = this.accessoryState.HSL.hue;
    callback(null, hue);

    this.fetchAndUpdateState(2);
  }

  getColorTemperature(callback: CharacteristicGetCallback) {

    const colorTemperature = this.accessoryState.colorTemperature;
    callback(null, colorTemperature);  //immediately return cached state to prevent laggy HomeKit UI
    this.fetchAndUpdateState(3);
  }

  getBrightness(callback: CharacteristicGetCallback) {

    const brightness = this.accessoryState.brightness;
    callback(null, brightness); //immediately return cached state to prevent laggy HomeKit UI
    this.fetchAndUpdateState(2);
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  getOn(callback: CharacteristicGetCallback) {

    const isOn = this.accessoryState.isOn;
    callback(null, isOn); //immediately return cached state to prevent laggy HomeKit UI
    this.fetchAndUpdateState(2);
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //


  protected async processAccessoryCommand(accessoryCommand: IAccessoryCommand) {
    const deviceWriteStatus = this.deviceWriteStatus;
    this.logs.trace(this.deviceWriteStatus);
    switch (deviceWriteStatus) {
      case ready:

        this.deviceWriteStatus = pending;
        await this.writeStateToDevice(accessoryCommand).then((msg) => {
          //error logging
        }).finally(() => {
          this.deviceWriteStatus = ready;
        });
        break;

      case pending:
        _.merge(this.newAccessoryCommand, accessoryCommand);
        break;
    }
  }

  protected async writeStateToDevice(accessoryCommand: IAccessoryCommand): Promise<unknown> {
    this.newAccessoryCommand = accessoryCommand;
    return new Promise<unknown>((resolve, reject) => {
      this.logs.trace(this.ColorCommandMode);
      return setTimeout(() => {
        this.logs.trace(this.accessory.context.displayName, '\nthis.accessoryState: ', this.accessoryState, '\n this.newAccessoryCommand: ', this.newAccessoryCommand);
        const sanitizedAcessoryCommand: IAccessoryCommand = _.merge({}, this.accessoryState, this.newAccessoryCommand);
        
        // eslint-disable-next-line no-prototype-builtins
        if (this.newAccessoryCommand.hasOwnProperty('isOn') && !(this.newAccessoryCommand.hasOwnProperty('HSL') || this.newAccessoryCommand.hasOwnProperty('brightness'))) {
          sanitizedAcessoryCommand.isPowerCommand = true;
        }

        this.logs.trace('\nSanatizedCommand: ', sanitizedAcessoryCommand);

        this.deviceWriteStatus = ready;

        return this.prepareCommand(sanitizedAcessoryCommand);
      }, BUFFER_MS);
    });
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand) {
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    this.latestDeviceCommand = deviceCommand;
    this.latestAccessoryCommand = accessoryCommand;
    this.queue.enqueue(async () => {
      let options: ICommandOptions = MEDIUM_COMMAND_OPTIONS;
      //this.accessoryState = Object.assign(accessoryCommand);
      //this.logs.warn(deviceCommand);

      if (this.queue.size > 0) {
        this.slowQueueRetry = true;
        options = FAST_COMMAND_OPTIONS;
      }

      if (!(this.slowQueueRetry && this.queue.size < 1)) {
        let deviceState: IDeviceState;

        if (!accessoryCommand.isPowerCommand) {
          deviceState = await this.controller.setAllValues(deviceCommand, options);
        } else {
          deviceState = await this.controller.setOn(deviceCommand.isOn, options);
        }

        this.updateLocalState(0, deviceState);
        return deviceState;
      }
    });

  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {
    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;

    const RGB = convertHSLtoRGB(HSL);
    RGB.red = Math.round((RGB.red / 100) * brightness);
    RGB.green = Math.round((RGB.green / 100) * brightness);
    RGB.blue = Math.round((RGB.blue / 100) * brightness);

    const deviceCommand: IDeviceCommand = { isOn, RGB };
    return deviceCommand;
  }

  protected async updateLocalState(requestLevel, deviceState) {
    if (!deviceState) {
      deviceState = await this.controller.fetchState();
    }

    const { HSL: { hue, saturation, luminance }, colorTemperature, brightness, isOn } = this.deviceStateToAccessoryState(deviceState);
    let accessoryState: IAccessoryState;
    if (deviceState) {
      switch (requestLevel) {
        case 0:
          accessoryState = { HSL: { luminance }, isOn };
          break;
        case 1:
          accessoryState = { HSL: { hue, luminance }, isOn };
          break;
        case 2:
          accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
          break;
        case 3:
          accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness, colorTemperature };
          break;
      }
      // if (deviceState && deviceState.LED.isOn) {
      _.merge(this.accessoryState, accessoryState);
      // }
      this.accessory.context.cachedAccessoryState = this.accessoryState;
      this.logs.trace(this.accessory.displayName, ': FINAL STATE', this.accessoryState);
    } else {
      _.merge(this.accessoryState, { isOn: false });
    }
  }

  updateHomekitState() {
    this.service.updateCharacteristic(this.hap.Characteristic.On, this.accessoryState.isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, this.accessoryState.HSL.hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessoryState.HSL.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, this.accessoryState.brightness);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LED: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
    // eslint-disable-next-line prefer-const
    let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
    let brightness = 0;

    if (luminance > 0 && isOn) {
      brightness = luminance * 2;
    } else if (isOn) {
      brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
      if (warmWhite > coldWhite) {
        saturation = this.colorWhiteThreshold - (this.colorWhiteThreshold * (coldWhite / 255));
      } else {
        saturation = this.colorWhiteThreshold - (this.colorWhiteThreshold * (warmWhite / 255));
      }
    }

    const accessoryState: IAccessoryState = { HSL: { hue, saturation, luminance }, isOn, colorTemperature: 140, brightness };
    return accessoryState;
  }

  setupCommandQueue() {
    this.queue = new Queue({
      concurrent: 1,
      interval: QUEUE_INTERVAL,
    });

    let timeout;

    this.queue.on('start', () => {
      clearTimeout(timeout);
    });

    this.queue.on('end', async () => {
      if (this.slowQueueRetry) {
        timeout = setTimeout(async () => {
          this.logs.trace(this.accessory.displayName, ': FINAL WRITE', this.latestDeviceCommand);
          let deviceState: IDeviceState;


          if (!this.latestAccessoryCommand.isPowerCommand) {
            deviceState = await this.controller.setAllValues(this.latestDeviceCommand, SLOW_COMMAND_OPTIONS);
          } else {
            deviceState = await this.controller.setOn(this.latestDeviceCommand.isOn, SLOW_COMMAND_OPTIONS);
          }

          this.slowQueueRetry = false;
          this.updateLocalState(0, deviceState);
          this.updateHomekitState();
        }, FINAL_COMMAND_TIMEOUT);
      }

    });

    this.queue.on('resolve', data => {/** */ });
    this.queue.on('reject', error => {/** */ });
  }

  initializeCharacteristics() {

    const { deviceAPI: { hasBrightness, hasCCT, hasColor } } = this.controller.getCachedDeviceInformation();

    addAccessoryInformationCharacteristic(this);

    this.logs.trace('Adding Lightbulb service to accessory.');
    this.service = this.accessory.getService(this.hap.Service.Lightbulb) ?? this.accessory.addService(this.hap.Service.Lightbulb);

    if (hasColor) {
      addHueCharacteristic(this);
      addSaturationCharacteristic(this);
    }

    if (hasBrightness) {
      addBrightnessCharacteristic(this);
    }

    if (hasCCT) {
      addColorTemperatureCharacteristic(this);
    }

    if (!hasBrightness) {
      this.logs.trace('Adding Switch service to accessory.');  //device is switch, register it as such
      this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch);
    }
    addOnCharacteristic(this);
    addConfiguredNameCharacteristic(this);
  }

  async fetchAndUpdateState(requestLevel) {
    await this.updateLocalState(requestLevel, null);
    this.updateHomekitState();
  }

} // ZackneticMagichomePlatformAccessory class