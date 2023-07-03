import type {
  API, Service, PlatformConfig, CharacteristicValue, Characteristic,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

import { clamp, TBtoCCT, HSVtoRGB, RGBtoHSV, CCTtoTB } from './misc/utils';
import { AnimationAccessory, DEFAULT_ACCESSORY_COMMAND, DEFAULT_ACCESSORY_STATE, IAccessoryCommand, IAccessoryState, IColorHSV, IColorTB, IConfigOptions, IPartialAccessoryCommand, MagicHomeAccessory } from './misc/types';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, IProtoDevice, IAnimationLoop, ICompleteResponse, mergeDeep, overwriteDeep, COMMAND_TYPE, COLOR_MASKS } from 'magichome-platform';
import { Logs } from './logs';

const RECENT_CONTROLLED_TIMEOUT_MS = 30 * 1000;




export class HomebridgeMagichomeDynamicPlatformAccessory {



  protected service: Service;
  protected readonly hap: HAP;

  protected adaptiveLightingService;
  protected newAccessoryCommand: IPartialAccessoryCommand = {};
  protected latestAccessoryCommand: IAccessoryCommand;

  public accessoryState: IAccessoryState;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected recentlyControlled = false;
  protected currentlyAnimating = false;

  protected queue;
  protected lastValue: number;
  public uuid: string;
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
  useBackupHSV: boolean;
  backupHSV: any;
  backupAccessoryState: any;
  protected skipNextAccessoryStatusUpdate: boolean = false;
  periodicScanTimeout: NodeJS.Timeout;
  CustomCharacteristics: any;
  UUID_CCT: string;
  testString: string;
  testInt = 0;
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
    this.UUID_CCT = 'a9a59a9f-9b8f-45d7-84b6-eeb848a8d05a';
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
    this.uuid = this.accessory.UUID;
    this.periodicScan();
  }

  protected second = true;
  //updated state every 10 seconds but only the isOn state
  async periodicScan() {
    // console.log('periodicScan: called', this.skipNextAccessoryStateUpdate)
    let onlyIsOn = [];
    while (!this.skipNextAccessoryStatusUpdate) {
      if (!this.second) onlyIsOn = ["isOn"];
      this.second = false;
      await this.fetchDeviceState(2, true, onlyIsOn);
      // console.log("periodicScan outside await", this.periodicScanTimeout)
      await new Promise((resolve) => setTimeout(resolve, 5000));
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

  // setHue2(value: CharacteristicValue) {
  //   this.testString = value as string;
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: setHue2: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: setHue2: ', value);
  //   }
  //   this.startResetTimeout();
  // }

  // setBrightness2(value: CharacteristicValue) {
  //   if (!this.isCountingTime) {
  //     this.isCountingTime = true;
  //     console.time('setters');
  //     console.timeLog('setters');
  //     console.log('setters: setBrightness2: ', value);
  //   } else {
  //     console.timeLog('setters');
  //     console.log('setters: setBrightness2: ', value);
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
  //   this.testInt++;
  //   clearTimeout(this.timeout);
  //   this.timeout = setTimeout(() => {
  //     this.service.updateCharacteristic(CustomHomeKitTypes.CCT, false);
  //     console.timeEnd('setters');
  //     console.log('reset setters boolean');
  //     this.isCountingTime = false;
  //   }, 3000);
  // }

  async setOn(value: CharacteristicValue) {
    this.powerTimeout = setTimeout(() => {
      if (!this.resistOff) {
        this.accessoryState.isOn = value as boolean;
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

  async setSaturation(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.HSV.saturation = value as number;
    // const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { saturation: value as number } };
    // this.processAccessoryCommand(partialAccessoryCommand);
  }

  async setValue(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.HSV.value = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { HSV: { value: value as number } };
    this.processAccessoryCommand(partialAccessoryCommand);

  }

  setColorTemperature(value: CharacteristicValue) {
    this.resistSetOnCommand()
    this.accessoryState.TB.temperature = value as number;
    const partialAccessoryCommand: IPartialAccessoryCommand = { TB: { temperature: value as number } };
    // console.log('set color temp', value)
    this.processAccessoryCommand(partialAccessoryCommand);
  }

  setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.warn(`Renaming device to ${name}`);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);
  }

  public addAssignedAnimation(animationName: string) {
    if (this.accessory.context.assignedAnimations.includes(animationName)) return;
    this.accessory.context.assignedAnimations.push(animationName);
    this.api.updatePlatformAccessories([this.accessory]);
  }

  public removeAssignedAnimation(_animationName: string) {
    this.accessory.context.assignedAnimations = this.accessory.context.assignedAnimations.filter((animationName) => {
      return animationName !== _animationName;
    });
  }

  public hasAssignedAnimation(animationName: string): boolean {
    return this.accessory.context.assignedAnimations.includes(animationName);
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
    return new Promise((resolve) => {
      setTimeout(async () => {
        const { HSV: { hue } } = this.accessoryState;
        resolve(hue);
      }, 50)
    });
  }

  getSaturation() {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const { HSV: { saturation } } = this.accessoryState;
        resolve(saturation);
      }, 50)
    });
  }

  getValue() {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const { HSV: { value } } = this.accessoryState;
        resolve(value);
      }, 50)
    });
  }

  getOn() {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const { isOn } = this.accessoryState;
        resolve(isOn);
      }, 100)
    });
  }

  getColorTemperature() {
    const { TB: { temperature } } = this.deviceStateToAccessoryState(this.controller.getLastOutboundState());
    this.fetchDeviceState(5);
    return temperature;
  }




  // logValue(valueType: string, value: any) {
  //   console.log(`${valueType} value: ${value}`);
  // }

<<<<<<< Updated upstream
=======
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
    await this.updateLocalState(this.readRequestLevel, null).catch(e => { console.log('fetchAndUpdateState ERROR', e) });

    const { deviceState } = await this.controller.getCachedDeviceInformation();
    const { isOn } = this.deviceStateToAccessoryState(deviceState);

    this.fetchAndUpdateState(2);
    return isOn;
  }

>>>>>>> Stashed changes
  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //

<<<<<<< Updated upstream
  protected processAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand) {
    if (this.waitingSendoff) {
      return;
    }
    try {
      this.setRecentlyControlled();
      this.waitingSendoff = true;
      this.skipNextStatusUpdate();
      setTimeout(() => {
        this.waitingSendoff = false;
        const sanitizedAcessoryCommand = this.completeAccessoryCommand(partialAccessoryCommand);
        if (partialAccessoryCommand.isPowerCommand) {
          this.controller.setOn(sanitizedAcessoryCommand.isOn);
        } else {
          const { deviceCommand, commandOptions } = this.accessoryCommandToDeviceCommand(sanitizedAcessoryCommand);
          this.sendCommand(deviceCommand, commandOptions, sanitizedAcessoryCommand);
        }
      }, 50);
=======
  //TODO, Severe! Bundle commands so that close consecutive changes in hue, sat, and brightness aren't sent as separate commands
  protected async processAccessoryCommand(partialAccessoryCommand: IPartialAccessoryCommand) {
    try {
      this.setRecentlyControlled();
      this.waitingSendoff = false;
      const sanitizedAcessoryCommand = this.completeAccessoryCommand(partialAccessoryCommand);
      if (partialAccessoryCommand.isPowerCommand) {
        await this.controller.setOn(sanitizedAcessoryCommand.isOn);
      } else {
        const { deviceCommand, commandOptions } = this.accessoryCommandToDeviceCommand(sanitizedAcessoryCommand);
        await this.sendCommand(deviceCommand, commandOptions, sanitizedAcessoryCommand);
      }
>>>>>>> Stashed changes
    } catch (error) {
      // console.log('processAccessoryCommand: ', error);
    }
  }

  protected async skipNextStatusUpdate() {
    if (this.skipNextAccessoryStatusUpdate) return;
    this.skipNextAccessoryStatusUpdate = true;
    clearTimeout(this.periodicScanTimeout);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setTimeout(() => {
      this.skipNextAccessoryStatusUpdate = false;
      this.periodicScan()
    }, 550);
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
    const sanitizedAcessoryCommand: IAccessoryCommand = mergeDeep({}, partialAccessoryCommand, this.accessoryState);
    if (partialAccessoryCommand.hasOwnProperty('isOn') && !(partialAccessoryCommand.hasOwnProperty('HSV') || partialAccessoryCommand.hasOwnProperty('brightness'))) {
      sanitizedAcessoryCommand.isPowerCommand = true;
    }
    return sanitizedAcessoryCommand;
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): { deviceCommand: IDeviceCommand, commandOptions: ICommandOptions } {

    let { isOn, HSV: { hue, saturation, value }, TB } = accessoryCommand;
    const { brightness } = TB;
    isOn = (Math.max(brightness, value) > 0);

    const commandOptions: ICommandOptions = { colorAssist: true, commandType: COMMAND_TYPE.COLOR_COMMAND, waitForResponse: true, maxRetries: 5, timeoutMS: 50 };

    let red, green, blue, warmWhite, coldWhite, colorMask = null;
    colorMask = COLOR_MASKS.BOTH;

    if (saturation < 95) {

      ({ warmWhite, coldWhite } = TBtoCCT({ temperature: hue + 140, brightness: value }));
      ({ red, green, blue } = HSVtoRGB({ hue, saturation: 100, value: this.lastValue }));

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

    const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, colorMask, CCT: { warmWhite, coldWhite } };
    return { deviceCommand, commandOptions };
  }

  setBackupHSV(HSV) {
    this.backupHSV = HSV;
    this.useBackupHSV = true;
  }

  getBackupHSV(reset = false) {
    if (reset)
      this.useBackupHSV = false;
    return this.backupHSV;
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

  protected sendCommand(deviceCommand: IDeviceCommand, commandOptions: ICommandOptions, accessoryCommand) {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);
    try {
<<<<<<< Updated upstream
      this.controller.setAllValues(deviceCommand, commandOptions);
=======
      this.controller.setAllValues(deviceCommand, commandOptions).catch(e => { this.logs.warn(e) })
>>>>>>> Stashed changes
    } catch (error) {
      // console.log("sendCommand ERROR: ", error);
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`);
  }

<<<<<<< Updated upstream
  updateStateHomekitCharacteristic() {
    if (this.waitingSendoff) return;
    // console.log(deviceState)
    // const { isOn, HSV: { hue, saturation, value }, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(deviceState);
    // console.log(isOn, hue, saturation, value, brightness, temperature)
    const { isOn, HSV: { hue, saturation, value }, TB: { brightness, temperature } } = this.accessoryState;
=======


  protected async updateLocalState(requestLevel, deviceState) {

    if (!deviceState) deviceState = await this.controller.fetchState().then(res => res).catch(e => { this.logs.warn(e) });

    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    // this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
    const { HSV: { hue, saturation, value }, isOn, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(deviceState);
    let accessoryState: IAccessoryState;
    if (deviceState) {
      accessoryState = { HSV: { hue, saturation, value }, isOn, TB: { brightness, temperature } };
      this.accessoryState = accessoryState;
      // console.log(accessoryState)
      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, accessoryState);
    }
  }

  updateHomekitState() {
    let { isOn, HSV: { hue, saturation, value }, TB: { brightness, temperature } } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);
>>>>>>> Stashed changes

    this.service.updateCharacteristic(this.hap.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, value);
  }

  public async fetchDeviceState(attempts = 1, updateHomekit = false, restrictedToCharacteristics: string[] = []) {
    let deviceState: IDeviceState;
    let accessoryState: IAccessoryState;
    try {
      deviceState = await this.controller.fetchStateRGB();
      accessoryState = this.deviceStateToAccessoryState(deviceState, restrictedToCharacteristics);
      overwriteDeep(this.accessoryState, accessoryState)
      // if (updateHomekit) {
      this.updateStateHomekitCharacteristic();
      // }
    } catch (error) {
      // console.log("fetchDeviceState ERROR: ", error);
      if (attempts > 0) {
        setTimeout(() => {
          this.fetchDeviceState(attempts - 1, updateHomekit, restrictedToCharacteristics);
        }, 500);
      } else {
        this.hbLogger.warn(`Failed to fetch and update state for ${this.accessory.context.displayName}: ${error}`);
      }
    }
    if (!deviceState) {
      this.hbLogger.warn(`Failed to fetch and update state for ${this.accessory.context.displayName}`);
    }
  }

  deviceStateToAccessoryState(deviceState: IDeviceState, restrictedToCharacteristics: string[] = []): IAccessoryState {
    if (!deviceState) {
      // throw 'device state not provided';
    }
    const { RGB, CCT, isOn } = deviceState;
    const { red, green, blue } = RGB;
    const { deviceAPI: { hasBrightness, hasCCT, hasColor, simultaneousCCT } } = this.controller.getCachedDeviceInformation();

    let HSV: IColorHSV = RGBtoHSV(RGB);
    let TB: IColorTB = CCTtoTB(CCT);
    // if (!simultaneousCCT) {
    if (Math.max(red, green, blue) <= 0) {
      HSV = { hue: 5, saturation: 4, value: TB.brightness }
    }
    // }

    let accessoryState = { isOn: null, HSV: { hue: null, saturation: null, value: null }, TB: { brightness: null, temperature: null } };

    if (restrictedToCharacteristics.includes('isOn') || restrictedToCharacteristics.includes('Hue') || restrictedToCharacteristics.includes('Value')) {
      if (restrictedToCharacteristics.includes('isOn')) accessoryState.isOn = isOn;
      if (restrictedToCharacteristics.includes('Hue')) accessoryState.HSV.hue = HSV.hue;
      if (restrictedToCharacteristics.includes('Value')) accessoryState.HSV.value = HSV.value;
      mergeDeep(accessoryState, this.accessoryState)
    } else accessoryState = { HSV, TB, isOn }
    if (accessoryState.HSV.value < 1) { accessoryState.HSV.value = TB.brightness }
    return accessoryState;
  }


  initializeCharacteristics() {

    const { deviceAPI: { hasBrightness, hasCCT, hasColor, simultaneousCCT } } = this.controller.getCachedDeviceInformation();

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

<<<<<<< Updated upstream

=======
  async fetchAndUpdateState(requestLevel) {
    try {
      this.readRequestLevel = requestLevel;
      await this.updateLocalState(this.readRequestLevel, null).catch(e => { console.log('fetchAndUpdateState ERROR', e) });
      // this.updateHomekitState();
    } catch (error) {
      this.hbLogger.error(error);
    }
  }
>>>>>>> Stashed changes

  getController() {
    return this.controller;
  }

  addOnCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding On characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.On)
      .onSet(this.setOn.bind(this))
      // .onGet(this.getOn.bind(this));
  }

  addHueCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Hue characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Hue)
      .onSet(this.setHue.bind(this))
    // .onGet(this.getHue.bind(this));
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
<<<<<<< Updated upstream
      .onSet(this.setValue.bind(this))
      .onGet(this.getValue.bind(this));

    if (this.controller.getCachedDeviceInformation().deviceAPI.simultaneousCCT) {
      // console.log('adding CCT');
      // this.service.getCharacteristic(CustomHomeKitTypes.CCT)
      //   // this.service2.getCharacteristic(this.hap.Characteristic.Brightness)
      //   .onSet(this.setHue2.bind(this));
        // .onGet(this.getHue2.bind(this));
      // this.service.getCharacteristic(this.CustomCharacteristics.CCT)
      //   // this.service2.getCharacteristic(this.hap.Characteristic.Brightness)
      //   .onSet(this.setBrightness2.bind(this))
      //   // .onGet(this.getBrightness2.bind(this));
    }
=======
      .onSet(this.setBrightness.bind(this))
    // .onGet(this.getBrightness.bind(this));
>>>>>>> Stashed changes
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

  

} // ZackneticMagichomePlatformAccessory class

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
