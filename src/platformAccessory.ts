import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { clamp, TBtoCCT, HSVtoRGB, RGBtoHSV, CCTtoTB } from './misc/utils';
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

  protected recentlyControlled = false;
  protected currentlyAnimating = false;
  protected currentAnimator: AnimationAccessory = null;

  protected queue;
  protected lastValue: number;
  lastHue: number;
  lastBrightness: number;
  waitingSendoff: boolean;
  resistOff: boolean;
  HSVTimeout: NodeJS.Timeout;
  powerTimeout: NodeJS.Timeout;
  isCountingTime: boolean;
  timeout: NodeJS.Timeout;
  processAccessoryCommandTimeout: NodeJS.Timeout;
  service2: any;

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
    this.accessoryState = mergeDeep({}, DEFAULT_ACCESSORY_STATE);
    this.logs = logs;
    this.controller = controller;
    this.hap = api.hap;
    this.api = api;
    this.config = config;
    this.initializeCharacteristics();
    this.fetchDeviceState(2);
    this.isCountingTime = false;
    this.lastValue = this.accessoryState.HSV.value;
    this.periodicScan();
  }

  async periodicScan() {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000,
      ));
      this.fetchDeviceState(2, true);
    }
  }

  // setOn(value: CharacteristicValue) {
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: isOn: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: isOn: ', value);
  //   }
  //   this.startResetTimeout();
  // }

  // setHue(value: CharacteristicValue) {
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: setHue: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: setHue: ', value);
  //   }
  //   this.startResetTimeout();
  // }

  // setSaturation(value: CharacteristicValue) {
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: setSaturation: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: setSaturation: ', value);
  //   }
  //   this.startResetTimeout();
  // }

  // setValue(value: CharacteristicValue) {
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: setValue: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: setValue: ', value);
  //   }
  //   this.startResetTimeout();
  // }

  // startResetTimeout() {
  //   clearTimeout(this.timeout);
  //   this.timeout = setTimeout(() => {
  //     console.timeEnd('setters');
  //     console.log('reset setters boolean');
  //     this.isCountingTime = false;
  //   }, 3000);
  // }

  setOn(value: CharacteristicValue) {
    this.powerTimeout = setTimeout(() => {
      if (!this.resistOff) {
        const partialAccessoryCommand: IPartialAccessoryCommand = { isOn: value as boolean, isPowerCommand: true };
        this.processAccessoryCommand(partialAccessoryCommand);
      }
    }, 20);
  }

  setHue(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.HSV.hue = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { hue: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.HSV.saturation = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { saturation: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setValue(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.HSV.value = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { value: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  // setBrightness2(value: CharacteristicValue) {
  //   this.resistSetOnCommand()
  //   this.accessoryState.TB.brightness = value as number;
  //   const partialAccessoryCommand: IPartialAccessoryCommand = { TB: { brightness: value as number } };
  //   this.processAccessoryCommand(partialAccessoryCommand);
  // }

  setColorTemperature(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.TB.temperature = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { TB: { temperature: value as number } };
    console.log('set color temp', value)
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.warn(`Renaming device to ${name}`);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);
  }

  resistSetOnCommand() {
    this.resistOff = true;
    clearTimeout(this.HSVTimeout);
    clearTimeout(this.powerTimeout);
    this.HSVTimeout = setTimeout(() => {
      this.resistOff = false;
    }, 50);
  }

  identifyLight() {
    this.flashEffect();
  }

  getHue() {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const { HSV: { hue }, TB: { temperature } } = await this.fetchDeviceState(5, false);
          this.logValue('getHue', hue);
          resolve(hue);
        } catch (error) {
          console.log('getHue Error: ', error)

        }
      }, 50)
    });
  }

  getSaturation() {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const { HSV: { saturation }, TB: { temperature } } = await this.fetchDeviceState(5, false);
          this.logValue('getSaturation', saturation);
          resolve(saturation);
        } catch (error) {
          console.log('getSaturation Error: ', error)

        }
      }, 50)
    });
  }

  getValue() {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const { HSV: { value }, TB: { temperature } } = await this.fetchDeviceState(5, false);
          this.logValue('getValue', value);
          resolve(value);
        } catch (error) {
          console.log('getValue Error: ', error)

        }
      }, 50)
    });
  }

  getOn() {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const { isOn } = await this.fetchDeviceState(5, false);
          this.logValue('isOn', isOn);
          resolve(isOn);
        } catch (error) {
          console.log('isOn Error: ', error)
        }
      }, 50)
    });
  }

  // getBrightness2() {

  //   const { HSV: { value }, TB: { brightness } } = this.deviceStateToAccessoryState(this.controller.getLastOutboundState());
  //   console.log(this.controller.getLastOutboundState())
  //   this.fetchAndUpdateState(5);
  //   return value;
  // }

  getColorTemperature() {
    const { HSV: { hue }, TB: { temperature } } = this.deviceStateToAccessoryState(this.controller.getLastOutboundState());
    this.fetchDeviceState(5);
    return temperature;
  }




  logValue(valueType: string, value: any) {
    console.log(`${valueType} value: ${value}`);
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //

  //TODO, Severe! Bundle commands so that close consecutive changes in hue, sat, and brightness aren't sent as separate commands
  protected processAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand) {
    if (this.waitingSendoff) {
      return;
    }
    try {
      this.setRecentlyControlled();
      this.waitingSendoff = true;
      this.processAccessoryCommandTimeout = setTimeout(() => {
        this.waitingSendoff = false;
        const sanitizedAcessoryCommand = this.completeAccessoryCommand(partialAccessoryCommand);
        if (partialAccessoryCommand.isPowerCommand) {
          this.controller.setOn(sanitizedAcessoryCommand.isOn);
        } else {
          const { deviceCommand, commandOptions } = this.accessoryCommandToDeviceCommand(sanitizedAcessoryCommand);
          console.log(deviceCommand)
          this.sendCommand(deviceCommand, commandOptions, sanitizedAcessoryCommand);
        }
      }, 10);
    } catch (error) {
      console.log('processAccessoryCommand: ', error);
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
    if (Math.max(brightness, value) > 0) {
      isOn = true;
    }
    const commandOptions: ICommandOptions = { colorAssist: false, commandType: COMMAND_TYPE.COLOR_COMMAND, waitForResponse: true, maxRetries: 5, timeoutMS: 50 };

    let red, green, blue, warmWhite, coldWhite, colorMask = null;
    colorMask = COLOR_MASKS.BOTH;
    if (this.controller.getCachedDeviceInformation().deviceAPI.simultaneousCCT) {
      ({ warmWhite, coldWhite } = TBtoCCT({ temperature, brightness }));
      ({ red, green, blue } = HSVtoRGB({ hue, saturation: 100, value }));
    } else {
      if (saturation < 95) {

        ({ warmWhite, coldWhite } = TBtoCCT({ temperature: hue + 140, brightness: value }));
        ({ red, green, blue } = HSVtoRGB({ hue, saturation: 100, value: this.lastValue }));
        console.log(red, green, blue, warmWhite, coldWhite)
        if (saturation < 5) {
          this.lastValue = value;
          red = 0, green = 0, blue = 0;
          colorMask = COLOR_MASKS.WHITE;
        }

      } else {
        colorMask = COLOR_MASKS.COLOR;
        this.lastValue = value;
        ({ red, green, blue } = HSVtoRGB({ hue, saturation, value }));
        warmWhite = 0;
        coldWhite = 0;
      }
    }


    const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, colorMask, CCT: { warmWhite, coldWhite } };
    return { deviceCommand, commandOptions };
  }

  protected sendCommand(deviceCommand: IDeviceCommand, commandOptions: ICommandOptions, accessoryCommand) {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);
    try {
      this.controller.setAllValues(deviceCommand, commandOptions);
    } catch (error) {
      console.log("sendCommand ERROR: ", error);
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`);
  }

  updateStateHomekitCharacteristic(deviceState: IDeviceState) {
    console.log(deviceState)
    const { isOn, HSV: { hue, saturation, value }, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(deviceState);
    console.log(isOn, hue, saturation, value, brightness, temperature)
    this.service.updateCharacteristic(this.hap.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessoryState.HSV.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, value);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {
    if (!deviceState) {
      throw 'device state not provided';
    }
    const { RGB, CCT, isOn } = deviceState;
    const { red, green, blue } = RGB;
    const { deviceAPI: { hasBrightness, hasCCT, hasColor, simultaneousCCT } } = this.controller.getCachedDeviceInformation();

    let TB: IColorTB;
    let HSV: IColorHSV;

    HSV = RGBtoHSV(RGB);
    TB = CCTtoTB(CCT);
    if (!simultaneousCCT) {
      if (Math.max(red, green, blue) <= 0) {
        HSV = { hue: 5, saturation: 4, value: TB.brightness }
      }
    }
    const accessoryState: IAccessoryState = { HSV, TB, isOn };
    return accessoryState;
  }

  initializeCharacteristics() {

    const { deviceAPI: { hasBrightness, hasCCT, hasColor, simultaneousCCT } } = this.controller.getCachedDeviceInformation();

    this.addAccessoryInformationCharacteristic();

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Lightbulb service to accessory.`);
    this.service = this.accessory.getService(this.hap.Service.Lightbulb) ?? this.accessory.addService(this.hap.Service.Lightbulb);
    // if (simultaneousCCT) {
    //   this.service2 = this.accessory.getService('Light Bulb 1') ?? this.accessory.addService(this.hap.Service.Lightbulb, 'Light Bulb 1', 'subtype1');
    // }

    if (hasColor) {
      this.addHueCharacteristic();
      this.addSaturationCharacteristic();
    }

    if (hasBrightness) {
      this.addBrightnessCharacteristic();
    }

    if (simultaneousCCT) {
      this.addColorTemperatureCharacteristic();
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

  public async fetchDeviceState(attempts = 1, updateHomekit = false) {
    let deviceState: IDeviceState;
    let accessoryState: IAccessoryState;
    try {
      deviceState = await this.controller.fetchState();
      accessoryState = this.deviceStateToAccessoryState(deviceState);
      this.accessoryState = accessoryState;
      if (updateHomekit) {
        this.updateStateHomekitCharacteristic(deviceState);
      }
    } catch (error) {
      console.log("fetchDeviceState ERROR: ", error);
      if (attempts > 0) {
        setTimeout(() => {
          this.fetchDeviceState(attempts - 1), updateHomekit;
        }, 500);
      } else {
        this.hbLogger.error(`Failed to fetch and update state for ${this.accessory.displayName}: ${error}`);
      }
    }
    if (!deviceState) {
      return this.accessoryState;
    }
    return accessoryState;
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
      .onSet(this.setSaturation.bind(this))
      .onGet(this.getSaturation.bind(this));

  }

  addBrightnessCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Brightness characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Brightness)
      .onSet(this.setValue.bind(this))
      .onGet(this.getValue.bind(this));

    if (this.controller.getCachedDeviceInformation().deviceAPI.simultaneousCCT) {
      // this.service2.getCharacteristic(this.hap.Characteristic.Brightness)
      //   // .onSet(this.setBrightness2.bind(this))
      //   .onGet(this.getBrightness2.bind(this));
    }
  }

  addColorTemperatureCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Color Temperature characteristic to service.`);
    // this.service2.getCharacteristic(this.hap.Characteristic.ColorTemperature)
    //   // .onSet(this.setColorTemperature.bind(this))
    //   .onGet(this.getColorTemperature.bind(this));

    if (this.api.versionGreaterOrEqual && this.api.versionGreaterOrEqual('1.3.0-beta.46')) {
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Adaptive Lighting service to accessory.`);
      // this.adaptiveLightingService = new this.api.hap.AdaptiveLightingController(this.service2);
      // this.accessory.configureController(this.adaptiveLightingService);
    }
  }

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

