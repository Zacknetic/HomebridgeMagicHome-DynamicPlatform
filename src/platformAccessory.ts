import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, IConfigOptions, MagicHomeAccessory } from './misc/types';
import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, IProtoDevice, IAnimationLoop } from 'magichome-platform';

import { Logs } from './logs';

const CCT = 'CCT';
const HSL = 'HSL';
const BUFFER_MS = 0;
const FINAL_COMMAND_TIMEOUT = 100;
const QUEUE_INTERVAL = 150;

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {

  protected service: Service;
  protected readonly hap: HAP;

  protected adaptiveLightingService;
  protected newAccessoryCommand: IAccessoryCommand;
  protected latestDeviceCommand: IDeviceCommand;
  protected latestAccessoryCommand: IAccessoryCommand;

  protected ColorCommandMode = HSL;
  protected logs;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected deviceWriteStatus = 'ready';
  protected deviceReadStatus = 'ready';
  protected readRequestLevel = 0;

  protected queue;
  protected slowQueueRetry = false;
  latestDeviceState: IDeviceState;

  //=================================================
  // Start Constructor //

  constructor(
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    protected readonly controller: BaseController,
    protected readonly hbLogger: Logging,
  ) {

    this.setupMisc();

    this.controller = controller;
    this.hap = api.hap;
    this.api = api;
    this.config = config;
    this.initializeCharacteristics();
    this.fetchAndUpdateState(2);
  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //
  async setOn(value: CharacteristicValue) {
    const accessoryCommand: IAccessoryCommand = { isOn: value as boolean };
    this.processAccessoryCommand(accessoryCommand);
  }

  setHue(value: CharacteristicValue) {
    this.accessory.context.accessoryState.HSL.hue = value as number;
    this.ColorCommandMode = HSL;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { hue: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {

    this.accessory.context.accessoryState.HSL.saturation = value as number;

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { saturation: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue) {


    this.accessory.context.accessoryState.brightness = value as number;
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
    this.logs.warn('Renaming device to %o', name);
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

    const hue = this.accessory.context.accessoryState.HSL.hue;
    this.fetchAndUpdateState(2);
    return hue;

  }

  getColorTemperature() {

    const colorTemperature = this.accessory.context.accessoryState.colorTemperature;
    this.fetchAndUpdateState(3);
    return colorTemperature;
  }

  getBrightness() {
    const brightness = this.accessory.context.accessoryState.brightness;
    this.fetchAndUpdateState(2);
    return brightness;
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const isOn = this.accessory.context.accessoryState.isOn;
    this.fetchAndUpdateState(2);
    return isOn;
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //


  protected async processAccessoryCommand(accessoryCommand: IAccessoryCommand) {
    // for (const interval of this.intervals) {
    // this.controller.clearAnimations();
    //}

    const deviceWriteStatus = this.deviceWriteStatus;
    switch (deviceWriteStatus) {
      case 'ready':

        this.deviceWriteStatus = 'pending';
        await this.writeStateToDevice(accessoryCommand).then((msg) => {
          //error logging
        }).finally(() => {
          this.deviceWriteStatus = 'ready';
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
      return setTimeout(() => {
        this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessory.context.accessoryState, '\n Received Command', this.newAccessoryCommand);
        const sanitizedAcessoryCommand: IAccessoryCommand = _.merge({}, this.accessory.context.accessoryState, this.newAccessoryCommand);

        // eslint-disable-next-line no-prototype-builtins
        if (this.newAccessoryCommand.hasOwnProperty('isOn') && !(this.newAccessoryCommand.hasOwnProperty('HSL') || this.newAccessoryCommand.hasOwnProperty('brightness'))) {
          sanitizedAcessoryCommand.isPowerCommand = true;
        }
        resolve(this.prepareCommand(sanitizedAcessoryCommand));
      }, BUFFER_MS);
    });
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand, commandOptions: ICommandOptions) {
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);

    let response;
    if (!accessoryCommand.isPowerCommand) {
      response = await this.controller.setAllValues(deviceCommand, commandOptions);
    } else {
      response = await this.controller.setOn(deviceCommand.isOn, commandOptions);
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`, response);
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
      deviceState = await this.controller?.fetchState() ?? this.accessory.context.cachedDeviceInformation.deviceState;
    }
    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
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
      _.merge(this.accessory.context.accessoryState, accessoryState);

      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, this.accessory.context.accessoryState);
    } else {
      _.merge(this.accessory.context.accessoryState, { isOn: false });
    }
  }

  updateHomekitState() {
    this.service.updateCharacteristic(this.hap.Characteristic.On, this.accessory.context.accessoryState.isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, this.accessory.context.accessoryState.HSL.hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessory.context.accessoryState.HSL.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, this.accessory.context.accessoryState.brightness);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LEDState: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
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

  initializeCharacteristics() {

    let cachedDeviceInformation = this.controller?.getCachedDeviceInformation();
    if (cachedDeviceInformation) {
      this.accessory.context.cachedDeviceInformation = cachedDeviceInformation;
    } else {
      cachedDeviceInformation = this.accessory.context.cachedDeviceInformation;
    }

    const { deviceAPI: { hasBrightness, hasCCT, hasColor } } = cachedDeviceInformation;

    addAccessoryInformationCharacteristic(this);

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Lightbulb service to accessory.`);
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
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Switch service to accessory.`);  //device is switch, register it as such
      this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch);
    }
    addOnCharacteristic(this);
    addConfiguredNameCharacteristic(this);
  }

  setupMisc() {
    this.accessory.context.accessoryState = this.accessory.context.accessoryState ?? DefaultAccessoryCommand;

    const localAccessoryOptions = new Map(Object.entries(this.config?.individualAccessoryOptions)).get(this.accessory.context.displayName);
    const { colorOffSaturationLevel, colorWhiteSimultaniousSaturationLevel, logLevel } = _.merge({}, this.config.globalAccessoryOptions, localAccessoryOptions);


    this.colorWhiteSimultaniousSaturationLevel = colorWhiteSimultaniousSaturationLevel;
    this.colorOffSaturationLevel = colorOffSaturationLevel;
    this.logs = new Logs(this.hbLogger, logLevel ?? 3);

  }

  async fetchAndUpdateState(requestLevel) {
    switch (this.deviceReadStatus) {
      case ready:
        this.deviceReadStatus = pending;
        this.readRequestLevel = requestLevel;
        await this.updateLocalState(this.readRequestLevel, null);
        this.updateHomekitState();
        this.deviceReadStatus = ready;
        break;
      case pending:
        this.readRequestLevel = Math.max(requestLevel, this.readRequestLevel);
        break;
    }
  }

  getController() {
    return this.controller;
  }



} // ZackneticMagichomePlatformAccessory class