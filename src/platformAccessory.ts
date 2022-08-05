import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, IConfigOptions, MagicHomeAccessory } from './misc/types';
import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, IProtoDevice, IAnimationLoop, ICompleteResponse } from 'magichome-platform';

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
    protected readonly logs,
  ) {

    this.setupMisc();
    this.logs = logs;
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

  // setColorTemperature(value: CharacteristicValue) {

  //   this.ColorCommandMode = CCT;
  //   const accessoryCommand: IAccessoryCommand = { colorTemperature: value as number };
  //   this.processAccessoryCommand(accessoryCommand);
  // }

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
    const { isOn, HSL: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

    this.fetchAndUpdateState(2);
    return hue;

  }

  // getColorTemperature() {
  //   const { isOn, HSL: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

  //   const colorTemperature = this.accessory.context.accessoryState.colorTemperature;
  //   this.fetchAndUpdateState(3);
  //   return colorTemperature;
  // }

  getBrightness() {
    const { isOn, HSL: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

    this.fetchAndUpdateState(2);
    return brightness;
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const { isOn, HSL: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

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

    await this.prepareCommand(accessoryCommand);
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand): Promise<ICompleteResponse> {
    try {


      this.newAccessoryCommand = accessoryCommand;

      this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessory.context.accessoryState, '\n Received Command', this.newAccessoryCommand);
      const sanitizedAcessoryCommand: IAccessoryCommand = Object.assign({}, this.accessory.context.accessoryState, this.newAccessoryCommand);

      // eslint-disable-next-line no-prototype-builtins
      if (this.newAccessoryCommand.hasOwnProperty('isOn') && !(this.newAccessoryCommand.hasOwnProperty('HSL') || this.newAccessoryCommand.hasOwnProperty('brightness'))) {
        sanitizedAcessoryCommand.isPowerCommand = true;
      }
      const completeResponse: ICompleteResponse = await this.sendCommand(sanitizedAcessoryCommand);
      return completeResponse;
    } catch (error) {

    }
  }

  protected async sendCommand(accessoryCommand: IAccessoryCommand, commandOptions?: ICommandOptions): Promise<ICompleteResponse> {
    try {


      const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);

      let response;
      if (!accessoryCommand.isPowerCommand) {
        response = await this.controller.setAllValues(deviceCommand, commandOptions);
      } else {
        response = await this.controller.setOn(deviceCommand.isOn, commandOptions);
      }
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`, response);
      return response;
    } catch (error) {

    }
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {
    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;

    const RGB = convertHSLtoRGB(HSL);
    RGB.red = Math.round((RGB.red / 100) * brightness);
    RGB.green = Math.round((RGB.green / 100) * brightness);
    RGB.blue = Math.round((RGB.blue / 100) * brightness);


    const deviceCommand: IDeviceCommand = { isOn, RGB, colorMask: 0xF0, CCT: { warmWhite: 0, coldWhite: 0 } };
    return deviceCommand;
  }

  protected async updateLocalState(requestLevel, deviceState) {
    if (!deviceState) {
      deviceState = await this.controller?.fetchState() 
      // ?? this.accessory.context.cachedDeviceInformation.deviceState;
    }
    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    // this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
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

      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, accessoryState);
    }
  }

  updateHomekitState() {
    const { isOn, HSL: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)
    this.service.updateCharacteristic(this.hap.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, brightness);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { RGB, CCT: { coldWhite, warmWhite }, isOn } = deviceState;
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
      // this.accessory.context.cachedDeviceInformation = cachedDeviceInformation;
    } else {
      // cachedDeviceInformation = this.accessory.context.cachedDeviceInformation;
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
      // addColorTemperatureCharacteristic(this);
    }

    if (!hasBrightness) {
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Switch service to accessory.`);  //device is switch, register it as such
      this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch);
    }
    addOnCharacteristic(this);
    addConfiguredNameCharacteristic(this);
  }

  setupMisc() {
    // this.accessory.context.accessoryState = this.accessory.context.accessoryState ?? DefaultAccessoryCommand;

    // const localAccessoryOptions = new Map(Object.entries(this.config?.individualAccessoryOptions)).get(this.accessory.context.displayName?? "unknown");
    // const { colorOffSaturationLevel, colorWhiteSimultaniousSaturationLevel, logLevel } = Object.assign({}, this.config.globalAccessoryOptions, localAccessoryOptions);


    // this.colorWhiteSimultaniousSaturationLevel = colorWhiteSimultaniousSaturationLevel;
    // this.colorOffSaturationLevel = colorOffSaturationLevel;
    // this.logs = new Logs(this.hbLogger, logLevel ?? 3);

  }

  async fetchAndUpdateState(requestLevel) {
    try {


      this.readRequestLevel = requestLevel;
      await this.updateLocalState(this.readRequestLevel, null);
      this.updateHomekitState();

    } catch (error) {

    }
  }

  getController() {
    return this.controller;
  }



} // ZackneticMagichomePlatformAccessory class