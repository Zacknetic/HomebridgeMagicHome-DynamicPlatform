import type { Service, PlatformConfig, CharacteristicValue, HAP } from "homebridge";
import { HomebridgeMagichomeDynamicPlatform } from "./platform";
import { TBtoCCT, HSVtoRGB, RGBtoHSV, CCTtoTB } from "./misc/helpers/utils";
import type { IAccessoryCommand, IAccessoryState, IColorHSV, IColorTB, IPartialAccessoryCommand, HomebridgeAccessory } from "./misc/types/types";

import { DEFAULT_ACCESSORY_STATE } from "./misc/types/constants";

import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, mergeDeep, overwriteDeep, COMMAND_TYPE, COLOR_MASKS, ICompleteResponse } from "magichome-platform";
import { MHLogger } from "./misc/helpers/MHLogger";

export class HomebridgeMagichomeDynamicPlatformAccessory {
  protected service: Service;

  protected latestAccessoryCommand: IAccessoryCommand;
  protected sendStateDebounce: NodeJS.Timeout | null = null;
  protected fetchStateDebounce: NodeJS.Timeout | null = null;

  public accessoryState: IAccessoryState;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected recentlyControlled = false;
  protected currentlyAnimating = false;

  protected lastValue: number;
  public uuid: string;

  periodicScanTimeout: NodeJS.Timeout;

  backupAccessoryState: any;
  protected skipNextAccessoryStatusUpdate: boolean = false;
  CustomCharacteristics: any;
  UUID_CCT: string;
  resistOffFromBrightness: boolean;

  //=================================================
  // Start Constructor //

  constructor(protected readonly platform: HomebridgeMagichomeDynamicPlatform, public hbAccessory: HomebridgeAccessory, public controller: BaseController) {
    this.setupMisc();
    this.accessoryState = mergeDeep({}, DEFAULT_ACCESSORY_STATE);
    this.initializeCharacteristics();
    this.fetchDeviceState(2);
    this.lastValue = this.accessoryState.HSV.value;
    this.uuid = this.hbAccessory.UUID;
  }

  async setOn(value: CharacteristicValue) {
    if (this.resistOffFromBrightness) return;
    this.accessoryState.isOn = value as boolean;
    this.scheduleAccessoryCommand(true);
  }

  async resistOff() {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Resisting Off`);
    this.resistOffFromBrightness = true;

    await sleep(500);
    this.resistOffFromBrightness = false;
  }

  setHue(value: CharacteristicValue) {
    this.accessoryState.HSV.hue = value as number;
    this.scheduleAccessoryCommand();
  }

  setSaturation(value: CharacteristicValue) {
    this.accessoryState.HSV.saturation = value as number;
    this.scheduleAccessoryCommand();
  }

  setValue(value: CharacteristicValue) {
    this.accessoryState.HSV.value = value as number;
    this.resistOff();
    this.scheduleAccessoryCommand();
  }

  setColorTemperature(value: CharacteristicValue) {
    this.accessoryState.TB.temperature = value as number;
    this.scheduleAccessoryCommand();
  }

  private scheduleAccessoryCommand(isPowerCommand: boolean = false) {
    if (this.sendStateDebounce) {
      clearTimeout(this.sendStateDebounce);
    }

    this.sendStateDebounce = setTimeout(() => {
      const partialAccessoryCommand: IPartialAccessoryCommand = mergeDeep({}, this.accessoryState, { isPowerCommand },);
      this.processAccessoryCommand(partialAccessoryCommand);
    }, 10); // 100 milliseconds debounce time
  }

  private scheduleFetchDeviceState() {
    if (this.fetchStateDebounce) {
      clearTimeout(this.fetchStateDebounce);
    }

    this.fetchStateDebounce = setTimeout(() => {
      this.fetchDeviceState(2);
    }, 100); // 100 milliseconds debounce time
  }

  setConfiguredName(value: CharacteristicValue) {
    const name: string = value.toString();
    // this.logs.warn(`Renaming device to ${name}`);
    this.hbAccessory.context.displayName = name;
    this.platform.api.updatePlatformAccessories([this.hbAccessory]);
  }

  identifyLight() {
    this.flashEffect();
  }

  async getHue() {
    const {
      HSV: { hue },
    } = this.accessoryState;
    this.scheduleFetchDeviceState();

    return hue;
  }

  async getSaturation() {
    const {
      HSV: { saturation },
    } = this.accessoryState;
    this.scheduleFetchDeviceState();
    return saturation;
  }

  async getValue() {
    const {
      HSV: { value },
    } = this.accessoryState;
    this.scheduleFetchDeviceState();

    return value;
  }

  async getOn() {
    const { isOn } = this.accessoryState;
    this.scheduleFetchDeviceState();

    return isOn;
  }

  // getColorTemperature() {
  //   const {
  //     TB: { temperature }
  //   } = this.deviceStateToAccessoryState(this.controller.getLastOutboundState());
  //   this.fetchDeviceState(5);
  //   return temperature;
  // }

  flashEffect() {
    //
  } //flashEffect

  protected async processAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand) {
    console.log(this.hbAccessory.context.isOnline);
    if (this.hbAccessory.context.isOnline === false) {
      this.accessoryState.isOn = false;
      this.updateStateHomekitCharacteristic();
      return;
    }
    mergeDeep(this.accessoryState, partialAccessoryCommand);
    try {
      const sanitizedAcessoryCommand = this.completeAccessoryCommand(partialAccessoryCommand);
      if (partialAccessoryCommand.isPowerCommand) {
        const response = await this.controller.setOn(sanitizedAcessoryCommand.isOn);
        MHLogger.trace(`[${this.hbAccessory.context.displayName}] - Response from Device:`, response);
      } else {
        const { deviceCommand, commandOptions } = this.accessoryCommandToDeviceCommand(sanitizedAcessoryCommand);
        await this.sendCommand(deviceCommand, commandOptions);
      }
    } catch (error) {
      MHLogger.trace(`[${this.hbAccessory.context.displayName}] - Error processing accessory command:`, error);
    }
  }

  public setBackupAccessoryState() {
    this.backupAccessoryState = mergeDeep({}, this.accessoryState);
  }

  public restoreBackupAccessoryState() {
    if (this.backupAccessoryState) {
      this.processAccessoryCommand(this.backupAccessoryState);
      this.updateStateHomekitCharacteristic();
    }
  }

  protected completeAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand): IAccessoryCommand {
    // this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessoryState, '\n Received Command', this.newAccessoryCommand);
    const sanitizedAcessoryCommand: IAccessoryCommand = mergeDeep({}, this.accessoryState, partialAccessoryCommand);
    if (partialAccessoryCommand.hasOwnProperty("isOn") && !(partialAccessoryCommand.hasOwnProperty("HSV") || partialAccessoryCommand.hasOwnProperty("brightness"))) {
      sanitizedAcessoryCommand.isPowerCommand = true;
    }
    return sanitizedAcessoryCommand;
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): {
    deviceCommand: IDeviceCommand;
    commandOptions: ICommandOptions;
  } {
    let {
      isOn,
      HSV: { hue, saturation, value },
      TB,
    } = accessoryCommand;

    isOn = Math.max(value) > 0;

    const commandOptions: ICommandOptions = {
      colorAssist: true,
      commandType: COMMAND_TYPE.COLOR_COMMAND,
      waitForResponse: true,
      maxRetries: 5,
      timeoutMS: 50,
    };

    let red,
      green,
      blue,
      warmWhite,
      coldWhite,
      colorMask = null;
    colorMask = COLOR_MASKS.BOTH;

    ({ warmWhite, coldWhite } = TBtoCCT({
      temperature: hue + 140,
      brightness: value,
    }));
    ({ red, green, blue } = HSVtoRGB({ hue, saturation, value }));

    if (saturation >= 95) {
      colorMask = COLOR_MASKS.COLOR;
      warmWhite = 0;
      coldWhite = 0;
    } else if (this.controller.getCachedDeviceInformation().deviceAPI.byteOrder.length === 3) {
      const slowlyScaledSaturation: number = Math.pow(saturation / 100, 0.15) * 100;
      ({ red, green, blue } = HSVtoRGB({ hue, saturation: slowlyScaledSaturation, value }));
      colorMask = COLOR_MASKS.COLOR;
    } else {
      ({ warmWhite, coldWhite } = TBtoCCT({
        temperature: hue + 140,
        brightness: value,
      }));
      ({ red, green, blue } = HSVtoRGB({
        hue,
        saturation: 100,
        value: this.lastValue,
      }));

      if (saturation < 5) {
        this.lastValue = value;
        (red = 0), (green = 0), (blue = 0);
        colorMask = COLOR_MASKS.WHITE;
      }
    }

    const deviceCommand: IDeviceCommand = {
      isOn,
      RGB: { red, green, blue },
      colorMask,
      CCT: { warmWhite, coldWhite },
    };
    return { deviceCommand, commandOptions };
  }

  setBackupHSV(HSV) {
    // this.backupHSV = HSV;
    // this.useBackupHSV = true;
  }

  getBackupHSV(reset = false) {
    // if (reset) this.useBackupHSV = false;
    // return this.backupHSV;
  }

  protected async sendCommand(deviceCommand: IDeviceCommand, commandOptions: ICommandOptions) {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);

    try {
      const response:ICompleteResponse = await this.controller.setAllValues(deviceCommand, commandOptions);
      MHLogger.trace(`[sendCommand][${this.hbAccessory.context.displayName}] - Response from Device:`, response);
    } catch (error) {
      MHLogger.trace(`[sendCommand][${this.hbAccessory.context.displayName}] - Error from device:`, error);
    }
  }

  updateStateHomekitCharacteristic() {
    const {
      isOn,
      HSV: { hue, saturation, value },
      TB: { brightness, temperature },
    } = this.accessoryState;
    this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, saturation);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, value);
  }

  public async fetchDeviceState(attempts = 1, restrictedToCharacteristics: string[] = []) {
    if (this.hbAccessory.context.isOnline === false) {
      this.accessoryState.isOn = false;
      this.updateStateHomekitCharacteristic();
      return;
    }
    let deviceState: IDeviceState;
    let accessoryState: IAccessoryState;

    try {
      deviceState = await this.controller.fetchStateRGB();
      accessoryState = this.deviceStateToAccessoryState(deviceState, restrictedToCharacteristics);
      mergeDeep(this.accessoryState, accessoryState);
    } catch (error) {
      if (attempts > 0) {
        // Introduce a delay using setTimeout and a Promise
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Retry fetching the device state by calling the method recursively
        return await this.fetchDeviceState(attempts - 1, restrictedToCharacteristics);
      } else {
        this.accessoryState.isOn = false;
        MHLogger.trace(`Failed to fetch and update state for ${this.hbAccessory.context.displayName}: ${error}`);
      }
    }
    this.updateStateHomekitCharacteristic();
  }

  deviceStateToAccessoryState(deviceState: IDeviceState, restrictedToCharacteristics: string[] = []): IAccessoryState {
    const { RGB, CCT, isOn } = deviceState;
    const { red, green, blue } = RGB;

    let HSV: IColorHSV = RGBtoHSV(RGB);
    let TB: IColorTB = CCTtoTB(CCT);
    if (Math.max(red, green, blue) <= 0) {
      HSV = { hue: 5, saturation: 4, value: TB.brightness };
    }

    let accessoryState = {
      isOn: null,
      HSV: { hue: null, saturation: null, value: null },
      TB: { brightness: null, temperature: null },
    };

    if (restrictedToCharacteristics.includes("isOn") || restrictedToCharacteristics.includes("Hue") || restrictedToCharacteristics.includes("Value")) {
      if (restrictedToCharacteristics.includes("isOn")) accessoryState.isOn = isOn;
      if (restrictedToCharacteristics.includes("Hue")) accessoryState.HSV.hue = HSV.hue;
      if (restrictedToCharacteristics.includes("Value")) accessoryState.HSV.value = HSV.value;
      mergeDeep(accessoryState, this.accessoryState);
    } else accessoryState = { HSV, TB, isOn };
    if (accessoryState.HSV.value < 1) {
      accessoryState.HSV.value = TB.brightness;
    }
    return accessoryState;
  }

  initializeCharacteristics() {
    const {
      deviceAPI: { hasBrightness, hasCCT, hasColor, simultaneousCCT },
    } = this.controller.getCachedDeviceInformation();

    this.addAccessoryInformationCharacteristic();

    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Lightbulb service to accessory.`);
    this.service = this.hbAccessory.getService(this.platform.Service.Lightbulb) || this.hbAccessory.addService(this.platform.Service.Lightbulb);

    if (hasColor) {
      this.addHueCharacteristic();
      this.addSaturationCharacteristic();
    }

    if (hasBrightness) {
      this.addBrightnessCharacteristic();
    }

    // if (simultaneousCCT) {
    //   this.addColorTemperatureCharacteristic();
    // }

    if (!hasBrightness) {
      // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Switch service to accessory.`); //device is switch, register it as such
      this.service = this.hbAccessory.getService(this.platform.Service.Switch) ?? this.hbAccessory.addService(this.platform.Service.Switch);
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

  getController() {
    return this.controller;
  }

  addOnCharacteristic() {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding On characteristic to service.`);
    this.service.getCharacteristic(this.platform.Characteristic.On).onSet((value) => {
      this.setOn(value);
    });
    // .onGet(this.getOn.bind(this));
  }

  addHueCharacteristic() {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Hue characteristic to service.`);
    this.service
      .getCharacteristic(this.platform.Characteristic.Hue)
      .onSet((value) => {
        this.setHue(value);
      })
      .onGet(this.getHue.bind(this));
  }

  addSaturationCharacteristic() {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Saturation characteristic to service.`);
    this.service.testCharacteristic(this.platform.Characteristic.Saturation);
    this.service
      .getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet((value) => {
        this.setSaturation(value);
      })
      .onGet(this.getSaturation.bind(this));
  }

  addBrightnessCharacteristic() {
    // this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Brightness characteristic to service.`);
    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet((value) => {
        this.setValue(value);
      })
      .onGet(this.getValue.bind(this));

    if (this.controller.getCachedDeviceInformation().deviceAPI.simultaneousCCT) {
      // console.log('adding CCT');
      // this.service.getCharacteristic(CustomHomeKitTypes.CCT)
      //   // this.service2.getCharacteristic(this.platform.Characteristic.Brightness)
      //   .onSet(this.setHue2.bind(this));
      // .onGet(this.getHue2.bind(this));
      // this.service.getCharacteristic(this.CustomCharacteristics.CCT)
      //   // this.service2.getCharacteristic(this.platform.Characteristic.Brightness)
      //   .onSet(this.setBrightness2.bind(this))
      //   // .onGet(this.getBrightness2.bind(this));
    }
  }

  addColorTemperatureCharacteristic() {
    // this.logs.trace(
    //   `[Trace] [${this.accessory.context.displayName}] - Adding Color Temperature characteristic to service.`
    // );
    // this.service2.getCharacteristic(this.platform.Characteristic.ColorTemperature)
    //   // .onSet(this.setColorTemperature.bind(this))
    //   .onGet(this.getColorTemperature.bind(this));

    if (this.platform.api.versionGreaterOrEqual && this.platform.api.versionGreaterOrEqual("1.3.0-beta.46")) {
      // this.logs.trace(
      //   `[Trace] [${this.accessory.context.displayName}] - Adding Adaptive Lighting service to accessory.`
      // );
      // this.adaptiveLightingService = new this.api.hap.AdaptiveLightingController(this.service2);
      // this.accessory.configureController(this.adaptiveLightingService);
    }
  }

  addAccessoryInformationCharacteristic() {
    const {
      protoDevice: { uniqueId, modelNumber },
      deviceMetaData: { controllerFirmwareVersion, controllerHardwareVersion },
    } = this.controller.getCachedDeviceInformation();
    // set accessory information
    this.hbAccessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "MagicHome")
      .setCharacteristic(this.platform.Characteristic.SerialNumber, uniqueId)
      .setCharacteristic(this.platform.Characteristic.Model, modelNumber)
      .setCharacteristic(this.platform.Characteristic.HardwareRevision, controllerHardwareVersion?.toString(16) ?? "unknown")
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, controllerFirmwareVersion?.toString(16) ?? "unknown ")
      .getCharacteristic(this.platform.Characteristic.Identify)
      .removeAllListeners(this.platform.api.hap.CharacteristicEventTypes.SET)
      .removeAllListeners(this.platform.api.hap.CharacteristicEventTypes.GET)
      .on(this.platform.api.hap.CharacteristicEventTypes.SET, this.identifyLight.bind(this)); // SET - bind to the 'Identify` method below

    this.hbAccessory.getService(this.platform.Service.AccessoryInformation)!.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
  }

  addConfiguredNameCharacteristic() {
    if (!this.service.testCharacteristic(this.platform.Characteristic.ConfiguredName)) {
      this.service.addCharacteristic(this.platform.Characteristic.ConfiguredName).onSet(this.setConfiguredName.bind(this));
    } else {
      this.service.getCharacteristic(this.platform.Characteristic.ConfiguredName).onSet(this.setConfiguredName.bind(this));
    }
    // this.logs.trace(
    //   `[Trace] [${this.accessory.context.displayName}] - Adding Configured Name characteristic to service.`
    // );
  }
} // ZackneticMagichomePlatformAccessory class

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
