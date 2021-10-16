import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, IConfigOptions, MagicHomeAccessory } from './misc/types';
import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, DeviceWriteStatus, IProtoDevice } from 'magichome-platform';
import { _ } from 'lodash';
import Queue from 'queue-promise';
import { Logs } from './logs';

const { ready, pending, busy } = DeviceWriteStatus;
const CCT = 'CCT';
const HSL = 'HSL';
const BUFFER_MS = 20;
const FINAL_COMMAND_TIMEOUT = 100;
const QUEUE_INTERVAL = 150;

const SLOW_COMMAND_OPTIONS: ICommandOptions = { verifyRetries: 20, bufferMS: 10, timeoutMS: 2000 };
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

  protected lastAccessoryCommand: IAccessoryCommand = DefaultAccessoryCommand;

  protected ColorCommandMode = HSL;
  protected readonly hap: HAP;
  protected logs;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected accessoryState: IAccessoryState = DefaultAccessoryCommand;
  protected accessoryStateTemporary: IAccessoryState;
  protected deviceWriteStatus = ready;
  protected queue;
  protected deviceAPI: { hasBrightness, hasCCT };
  protected slowQueueRetry = false;
  latestDeviceState: IDeviceState;

  //=================================================
  // Start Constructor //

  constructor(
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    protected readonly controller: BaseController,
    protected readonly logging: Logging,
  ) {


    this.setupMisc();


    this.controller = controller;
    this.hap = api.hap;
    this.api = api;
    this.config = config;
    this.setupCommandQueue();
    this.initializeCharacteristics();
    this.fetchAndUpdateState(2);
  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //
  async setOn(value: CharacteristicValue) {
    this.lastAccessoryCommand.isOn = value as boolean;
    const accessoryCommand: IAccessoryCommand = { isOn: value as boolean };
    this.processAccessoryCommand(accessoryCommand);
  }

  setHue(value: CharacteristicValue) {
    this.accessoryState.HSL.hue = value as number;
    this.ColorCommandMode = HSL;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { hue: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {

    this.accessoryState.HSL.saturation = value as number;

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { saturation: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue) {


    this.accessoryState.brightness = value as number;
    const accessoryCommand: IAccessoryCommand = { isOn: true, brightness: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setColorTemperature(value: CharacteristicValue) {

    this.ColorCommandMode = CCT;
    const accessoryCommand: IAccessoryCommand = { colorTemperature: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.debug('Renaming device to %o', name);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);
  }

  identifyLight() {

    this.flashEffect();
  }

  //=================================================
  // End Setters //

  //=================================================
  // Start Getters //

  getHue() {

    const hue = this.accessoryState.HSL.hue;
    this.fetchAndUpdateState(2);
    return hue;

  }

  getColorTemperature() {

    const colorTemperature = this.accessoryState.colorTemperature;
    this.fetchAndUpdateState(3);
    return colorTemperature;
  }

  getBrightness() {

    const brightness = this.accessoryState.brightness;
    this.fetchAndUpdateState(2);
    return brightness;
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const isOn = this.accessoryState.isOn;
    this.fetchAndUpdateState(2);
    return isOn;
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
        this.logs.debug(this.accessory.context.displayName, '\nthis.accessoryState: ', this.accessoryState, '\n this.newAccessoryCommand: ', this.newAccessoryCommand);
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

  protected async prepareCommand(accessoryCommand: IAccessoryCommand, options: ICommandOptions = MEDIUM_COMMAND_OPTIONS) {
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    this.latestDeviceCommand = deviceCommand;
    this.latestAccessoryCommand = accessoryCommand;
    let deviceState: IDeviceState;

    this.queue.enqueue(async () => {

      if (this.queue.size > 0) {
        this.slowQueueRetry = true;
        options = FAST_COMMAND_OPTIONS;
      }

      if (!(this.slowQueueRetry && this.queue.size < 1)) {

        if (!accessoryCommand.isPowerCommand) {
          this.latestDeviceState = await this.controller.setAllValues(deviceCommand, options);
        } else {
          this.latestDeviceState = await this.controller.setOn(deviceCommand.isOn, options);
        }
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
    this.latestDeviceCommand = deviceState.LED;
    //this.logs.warn(deviceState);
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
      _.merge(this.accessoryState, accessoryState);

      this.accessory.context.cachedAccessoryState = this.accessoryState;
      this.logs.debug(this.accessory.displayName, ': FINAL STATE', this.accessoryState);
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
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (coldWhite / 255));
      } else {
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (warmWhite / 255));
      }
    }

    const accessoryState: IAccessoryState = { HSL: { hue, saturation, luminance }, isOn, colorTemperature: 140, brightness };
    return accessoryState;
  }

  setupCommandQueue() {
    let deviceState;
    this.queue = new Queue({
      concurrent: 1,
      interval: QUEUE_INTERVAL,
    });

    let timeout;

    this.queue.on('start', () => {
      clearTimeout(timeout);
    });

    this.queue.on('end', async () => {

      if (!_.isEqual(_.omit(this.latestDeviceState?.LED ?? {}, ['colorMask']), _.omit(this.latestDeviceCommand, ['colorMask']))) {
        if (this.slowQueueRetry) {
          timeout = setTimeout(async () => {
            this.logs.trace(this.accessory.displayName, ': FINAL WRITE', this.latestDeviceCommand);
            this.slowQueueRetry = false;
            await this.prepareCommand(this.latestAccessoryCommand, SLOW_COMMAND_OPTIONS);
            this.updateLocalState(0, null);

          }, FINAL_COMMAND_TIMEOUT);
        }
        deviceState = null;
      }
    });

    this.queue.on('resolve', _deviceState => {
      deviceState = _deviceState;
    });
    this.queue.on('reject', error => {
      this.logs.error(error);
    });
  }

  initializeCharacteristics() {

    const { deviceAPI: { hasBrightness, hasCCT, hasColor } } = this.controller?.getCachedDeviceInformation() ?? this.accessory.context;

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

  setupMisc() {
    this.accessoryState = this.accessory.context.cachedAccessoryState ?? DefaultAccessoryCommand;

    const localAccessoryOptions = new Map(Object.entries(this.config?.individualAccessoryOptions)).get(this.accessory.context.displayName);
    const { colorOffSaturationLevel, colorWhiteSimultaniousSaturationLevel, logLevel } = _.merge({}, this.config.globalAccessoryOptions, localAccessoryOptions);


    this.colorWhiteSimultaniousSaturationLevel = colorWhiteSimultaniousSaturationLevel;
    this.colorOffSaturationLevel = colorOffSaturationLevel;
    this.logs = new Logs(this.logging, logLevel ?? 3);

  }


  async fetchAndUpdateState(requestLevel) {
    await this.updateLocalState(requestLevel, null);
    this.updateHomekitState();
  }

} // ZackneticMagichomePlatformAccessory class