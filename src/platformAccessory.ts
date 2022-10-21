import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { temperatureToCCT, clamp, TBtoCCT, HSVtoRGB, RGBtoHSV, CCTtoTB } from './misc/utils';
import { AnimationAccessory, DEFAULT_ACCESSORY_COMMAND, DEFAULT_ACCESSORY_STATE, IAccessoryCommand, IAccessoryState, IColorHSV, IColorTB, IConfigOptions, IPartialAccessoryCommand, MagicHomeAccessory } from './misc/types';
// import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, IProtoDevice, IAnimationLoop, ICompleteResponse, mergeDeep, overwriteDeep, COMMAND_TYPE, COLOR_MASKS } from 'magichome-platform';
import { Logs } from './logs';

const WHITE_MODE = 'WHITE_MODE';
const COLOR_MODE = 'COLOR_MODE';
const RECENT_CONTROLLED_TIMEOUT_MS = 30 * 1000;
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {

  protected service: Service;
  protected readonly hap: HAP;

  protected adaptiveLightingService;
  protected newAccessoryCommand: IPartialAccessoryCommand = {};
  protected latestAccessoryCommand: IAccessoryCommand;

  public accessoryState: IAccessoryState;

  protected colorCommandMode: string = COLOR_MODE;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected deviceWriteStatus = 'ready';
  protected deviceReadStatus = 'ready';
  protected readRequestLevel = 0;

  protected recentlyControlled: boolean = false;
  protected currentlyAnimating: boolean = false;
  protected currentAnimator: AnimationAccessory = null;

  protected queue;
  protected slowQueueRetry = false;
  protected lastValue: number;
  lastHue: number;
  lastBrightness: number;
  waitingSendoff: boolean;
  resistOff: boolean;
  brightnessTimeout: NodeJS.Timeout;
  powerTimeout: NodeJS.Timeout;

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
    this.accessoryState = DEFAULT_ACCESSORY_STATE;
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
  setOn(value: CharacteristicValue) {
    this.powerTimeout = setTimeout(() => {
      if (!this.resistOff) {
        const partialAccessoryCommand: IPartialAccessoryCommand = { isOn: value as boolean, isPowerCommand: true };
        this.processAccessoryCommand(partialAccessoryCommand);
      }
    }, 100);
  }

  setHue(value: CharacteristicValue) {
    this.accessoryState.HSV.hue = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { hue: value as number } };

    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {

    this.accessoryState.HSV.saturation = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { saturation: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setBrightness(value: CharacteristicValue) {
    clearTimeout(this.brightnessTimeout)
    clearTimeout(this.powerTimeout)
    this.resistOff = true;
    this.brightnessTimeout = setTimeout(() => {
      this.resistOff = false;
    }, 100);

    this.accessoryState.HSV.value = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { value: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  // setColorTemperature(value: CharacteristicValue) {
  //   this.ColorCommandMode = CCT;
  //   const accessoryCommand: IAccessoryCommand = { colorTemperature: value as number };
  //   this.processAccessoryCommand(accessoryCommand);
  // }

  setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.warn(`Renaming device to ${name}`,);
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
    const { HSV: { hue }, TB: { temperature } } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);
    this.fetchAndUpdateState(2);
    return hue;
  }

  // getColorTemperature() {
  //   const { isOn, HSV: { hue, saturation }, brightness, colorTemperature } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

  //   this.fetchAndUpdateState(3);
  //   return colorTemperature;
  // }

  getBrightness() {
    const { HSV: { value }, TB: { brightness } } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    this.fetchAndUpdateState(2);
    return value;
  }

  /**  
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const { isOn } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    this.fetchAndUpdateState(2);
    return isOn;
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //

  //TODO, Severe! Bundle commands so that close consecutive changes in hue, sat, and brightness aren't sent as separate commands
  protected processAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand) {
    try {


      this.setRecentlyControlled();
      this.waitingSendoff = false;
      const sanitizedAcessoryCommand = this.completeAccessoryCommand(partialAccessoryCommand);
      if (partialAccessoryCommand.isPowerCommand) {
        this.controller.setOn(sanitizedAcessoryCommand.isOn);
      } else {
        const { deviceCommand, commandOptions } = this.accessoryCommandToDeviceCommand(sanitizedAcessoryCommand);
        this.sendCommand(deviceCommand, commandOptions, sanitizedAcessoryCommand);
      }
    } catch (error) {
      console.log('processAccessoryCommand: ', error)
    }
  }

  protected completeAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand): IAccessoryCommand {
    this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessoryState, '\n Received Command', this.newAccessoryCommand);
    const sanitizedAcessoryCommand: IAccessoryCommand = mergeDeep({}, partialAccessoryCommand, this.accessoryState);
    if (partialAccessoryCommand.hasOwnProperty('isOn') && !(partialAccessoryCommand.hasOwnProperty('HSV') || partialAccessoryCommand.hasOwnProperty('brightness'))) {
      sanitizedAcessoryCommand.isPowerCommand = true;
    }
    return sanitizedAcessoryCommand;
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): { deviceCommand: IDeviceCommand, commandOptions: ICommandOptions } {
    let { isOn, HSV: { hue, saturation, value }, TB } = accessoryCommand;
    const { temperature, brightness } = TB;


    if (Math.max(brightness, value) > 0) isOn = true;
    const commandOptions: ICommandOptions = { colorAssist: true, commandType: COMMAND_TYPE.COLOR_COMMAND, waitForResponse: true, maxRetries: 5, timeoutMS: 50 };

    let red, green, blue, warmWhite, coldWhite, colorMask = null;
    colorMask = COLOR_MASKS.BOTH

    if (saturation < 95) {
      ({ warmWhite, coldWhite } = TBtoCCT({ temperature: hue, brightness: value }));

      ({ red, green, blue } = HSVtoRGB({ hue, saturation: 100, value: this.lastValue }));
      if (saturation < 5) {
        red = 0, green = 0, blue = 0;
        colorMask = COLOR_MASKS.WHITE
      }

    } else {
      colorMask = COLOR_MASKS.COLOR;
      this.lastValue = value;
      ({ red, green, blue } = HSVtoRGB({ hue, saturation, value }));
      warmWhite = 0;
      coldWhite = 0;
    }

    const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, colorMask, CCT: { warmWhite, coldWhite } };
    return { deviceCommand, commandOptions };
  }

  protected sendCommand(deviceCommand: IDeviceCommand, commandOptions: ICommandOptions, accessoryCommand) {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);
    try {
      this.controller.setAllValues(deviceCommand, commandOptions).catch(e => {this.logs.warn(e)})
    } catch (error) {
      console.log(error)
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`);
  }



  protected async updateLocalState(requestLevel, deviceState) {

    if (!deviceState) deviceState = await this.controller.fetchState().then(res => res).catch(e => { this.logs.warn(e) });

    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    // this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
    const { HSV: { hue, saturation, value }, isOn, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(deviceState);
    let accessoryState: IAccessoryState;
    if (deviceState) {
      switch (requestLevel) {
        case 0:
          // accessoryState = { HSV: { value }, isOn };
          break;
        case 1:
          // accessoryState = { HSV: { hue, value }, isOn };
          break;
        case 2:
          accessoryState = { HSV: { hue, saturation, value }, isOn, TB: { brightness, temperature } };
          break;
        case 3:
          accessoryState = { HSV: { hue, saturation, value }, isOn, TB: { brightness, temperature } };
          break;
      }
      this.accessoryState = accessoryState;
      // console.log(accessoryState)
      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, accessoryState);
    }
  }

  updateHomekitState() {
    let { isOn, HSV: { hue, saturation, value }, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    this.service.updateCharacteristic(this.hap.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessoryState.HSV.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, value);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {
    if (!deviceState) throw 'device state not provided';
    let { RGB, CCT, isOn } = deviceState;
    const HSV: IColorHSV = RGBtoHSV(RGB);
    const TB: IColorTB = CCTtoTB(CCT);
    const accessoryState: IAccessoryState = { HSV, TB, isOn };
    return accessoryState;
  }

  initializeCharacteristics() {

    const cachedDeviceInformation = this.controller.getCachedDeviceInformation();
    const { deviceAPI: { hasBrightness, hasCCT, hasColor } } = cachedDeviceInformation;

    this.addAccessoryInformationCharacteristic();

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Lightbulb service to accessory.`);
    this.service = this.accessory.getService(this.hap.Service.Lightbulb) ?? this.accessory.addService(this.hap.Service.Lightbulb);

    if (hasColor) {
      this.addHueCharacteristic();
      this.addSaturationCharacteristic();
    }

    if (hasBrightness) {
      this.addBrightnessCharacteristic();
    }

    if (hasCCT) {
      // this.addColorTemperatureCharacteristic();
    }

    if (!hasBrightness) {
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Switch service to accessory.`);  //device is switch, register it as such
      this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch);
    }
    this.addOnCharacteristic();
    this.addConfiguredNameCharacteristic();
  }

  setupMisc() {

    // const localAccessoryOptions = new Map(Object.entries(this.config?.individualAccessoryOptions)).get(this.accessory.context.displayName?? "unknown");
    // const { colorOffSaturationLevel, colorWhiteSimultaniousSaturationLevel, logLevel } = Object.assign({}, this.config.globalAccessoryOptions, localAccessoryOptions);


    // this.colorWhiteSimultaniousSaturationLevel = colorWhiteSimultaniousSaturationLevel;
    // this.colorOffSaturationLevel = colorOffSaturationLevel;
    // this.logs = new Logs(this.hbLogger, logLevel ?? 3);

  }

  async fetchAndUpdateState(requestLevel) {
    try {
      this.readRequestLevel = requestLevel;
      await this.updateLocalState(this.readRequestLevel, null).catch(e => { console.log('fetchAndUpdateState ERROR', e) });
      this.updateHomekitState();
    } catch (error) {
      this.hbLogger.error(error);
    }
  }

  getController() {
    return this.controller;
  }

  addOnCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding On characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  addHueCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Hue characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Hue)
      .onSet(this.setHue.bind(this))
      .onGet(this.getHue.bind(this));
  }

  addSaturationCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Saturation characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this));
    // .onGet(this.CHANGE_ME.bind(this));

  }

  addBrightnessCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Brightness characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));
  }

  // addColorTemperatureCharacteristic() {
  //   this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Color Temperature characteristic to service.`);
  //   this.service.getCharacteristic(this.hap.Characteristic.ColorTemperature)
  //     .onSet(this.setColorTemperature.bind(this))
  //     .onGet(this.getColorTemperature.bind(this));

  //   if (this.api.versionGreaterOrEqual && this.api.versionGreaterOrEqual('1.3.0-beta.46')) {
  //     this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Adaptive Lighting service to accessory.`);
  //     this.adaptiveLightingService = new this.api.hap.AdaptiveLightingController(this.service);
  //     this.accessory.configureController(this.adaptiveLightingService);
  //   }
  // }

  addAccessoryInformationCharacteristic() {

    const {
      protoDevice: { uniqueId, modelNumber }, deviceMetaData: { controllerFirmwareVersion, controllerHardwareVersion } } = this.controller.getCachedDeviceInformation();
    // set accessory information
    this.accessory.getService(this.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'MagicHome')
      // .setCharacteristic(this.hap.Characteristic.SerialNumber, uniqueId)
      // .setCharacteristic(this.hap.Characteristic.Model, modelNumber)
      // .setCharacteristic(this.hap.Characteristic.HardwareRevision, controllerHardwareVersion?.toString(16) ?? 'unknown')
      // .setCharacteristic(this.hap.Characteristic.FirmwareRevision, controllerFirmwareVersion?.toString(16) ?? 'unknown ')
      .getCharacteristic(this.hap.Characteristic.Identify)
      .removeAllListeners(this.hap.CharacteristicEventTypes.SET)
      .removeAllListeners(this.hap.CharacteristicEventTypes.GET)
      .on(this.hap.CharacteristicEventTypes.SET, this.identifyLight.bind(this));       // SET - bind to the 'Identify` method below


    this.accessory.getService(this.hap.Service.AccessoryInformation)!
      .addOptionalCharacteristic(this.hap.Characteristic.ConfiguredName);

  }

  addConfiguredNameCharacteristic() {
    if (!this.service.testCharacteristic(this.hap.Characteristic.ConfiguredName)) {
      this.service.addCharacteristic(this.hap.Characteristic.ConfiguredName)
        .onSet(this.setConfiguredName.bind(this));
    } else {
      this.service.getCharacteristic(this.hap.Characteristic.ConfiguredName)
        .onSet(this.setConfiguredName.bind(this));
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Configured Name characteristic to service.`);

  }
  setRecentlyControlled() {
    this.recentlyControlled = true;
    setTimeout(() => {
      this.recentlyControlled = false;
    }, RECENT_CONTROLLED_TIMEOUT_MS);
  }

  public isReadyToAnimate() {
    return this.recentlyControlled;
  }





} // ZackneticMagichomePlatformAccessory class

