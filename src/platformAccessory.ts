import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';


import { cctToWhiteTemperature, clamp, HSVtoRGB, RGBtoHSV, whiteTemperatureToCCT } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, IConfigOptions, MagicHomeAccessory } from './misc/types';
// import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, IProtoDevice, IAnimationLoop, ICompleteResponse, mergeDeep, overwriteDeep, COMMAND_TYPE } from 'magichome-platform';
import { Logs } from './logs';

const CCT = 'CCT';
const HSV = 'HSV';
const DEFAULT_ACCESSORY_STATE: IAccessoryState = { isOn: false, HSV: { hue: 0, saturation: 0, value: 0 }, brightness: 0 };
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
  protected latestAccessoryCommand: IAccessoryCommand;

  public accessoryState: IAccessoryState;

  protected colorCommandMode = HSV;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected deviceWriteStatus = 'ready';
  protected deviceReadStatus = 'ready';
  protected readRequestLevel = 0;

  protected queue;
  protected slowQueueRetry = false;

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
  async setOn(value: CharacteristicValue) {
    const accessoryCommand: IAccessoryCommand = { isOn: value as boolean };
    this.processAccessoryCommand(accessoryCommand);
  }

  setHue(value: CharacteristicValue) {

    this.accessoryState.HSV.hue = value as number;
    this.colorCommandMode = HSV;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSV: { hue: value as number, saturation: null, value: null } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {

    this.accessoryState.HSV.saturation = value as number;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSV: { hue: null, saturation: value as number, value: null } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue) {

    this.accessoryState.HSV.value = value as number;
    this.accessoryState.brightness = value as number;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSV: { hue: null, saturation: null, value: value as number } };
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
    console.log(this.accessory.context.displayName)
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
    const { isOn, HSV: { hue, saturation } } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    // this.fetchAndUpdateState(2);
    return hue;

  }

  getColorTemperature() {
    const { isOn, HSV: { hue, saturation }, brightness, colorTemperature } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState)

    this.fetchAndUpdateState(3);
    return colorTemperature;
  }

  getBrightness() {
    const { isOn, HSV: { hue, saturation, value }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    // this.fetchAndUpdateState(2);
    return brightness;
  }

  /**  
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const { isOn, HSV: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);

    this.fetchAndUpdateState(2);
    return isOn;
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //


  protected async processAccessoryCommand(accessoryCommand: IAccessoryCommand) {

    const ret = await this.prepareCommand(accessoryCommand).catch(e => { console.log(e) });
    console.log('return value: ', ret)
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand): Promise<ICompleteResponse> {

    this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessoryState, '\n Received Command', this.newAccessoryCommand);
    const sanitizedAcessoryCommand: IAccessoryCommand = mergeDeep({}, accessoryCommand, this.accessoryState);
    // console.log(accessoryCommand)
    // console.log(sanitizedAcessoryCommand)
    if (accessoryCommand.hasOwnProperty('isOn') && !(accessoryCommand.hasOwnProperty('HSV') || accessoryCommand.hasOwnProperty('brightness'))) {
      sanitizedAcessoryCommand.isPowerCommand = true;
    }
    const completeResponse: ICompleteResponse = await this.sendCommand(sanitizedAcessoryCommand, { colorAssist: false, commandType: COMMAND_TYPE.COLOR_COMMAND, waitForResponse: true, maxRetries: 5, timeoutMS: 50 });
    return completeResponse;

  }

  protected async sendCommand(accessoryCommand: IAccessoryCommand, commandOptions: ICommandOptions): Promise<ICompleteResponse> {
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);

    let response;
    if (!accessoryCommand.isPowerCommand) response = await this.controller.setAllValues(deviceCommand, commandOptions);
    else response = await this.controller.setOn(deviceCommand.isOn);

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`, response);
    return response;
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {
    const { isOn, HSV, colorTemperature, brightness } = accessoryCommand;

    const RGB = HSVtoRGB(HSV);

    const deviceCommand: IDeviceCommand = { isOn, RGB, colorMask: 0xF0, CCT: { warmWhite: 0, coldWhite: 0 } };
    return deviceCommand;
  }

  protected async updateLocalState(requestLevel, deviceState) {

    if (!deviceState) {
      deviceState = await this.controller.fetchState();
      console.log(deviceState)
    }
    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    // this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
    const { HSV: { hue, saturation, value }, colorTemperature, brightness, isOn } = this.deviceStateToAccessoryState(deviceState);
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
          accessoryState = { HSV: { hue, saturation, value }, isOn, brightness };
          break;
        case 3:
          accessoryState = { HSV: { hue, saturation, value }, isOn, brightness, colorTemperature };
          break;
      }

      this.accessoryState = accessoryState;
      // console.log(accessoryState)



      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, accessoryState);
    }


  }

  updateHomekitState() {
    const { isOn, HSV: { hue, saturation }, brightness } = this.deviceStateToAccessoryState(this.controller.getCachedDeviceInformation().deviceState);
    this.service.updateCharacteristic(this.hap.Characteristic.On, isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, brightness);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { RGB, CCT: { coldWhite, warmWhite }, isOn } = deviceState;
    //TODO - REPLACE HSV WITH HSV
    // eslint-disable-next-line prefer-const
    let { hue, saturation, value } = RGBtoHSV(RGB);
    let brightness = 0;

    if (value > 0) {
      brightness = value;
    }
    // else if (isOn) {
    //   brightness = clamp(Math.max(coldWhite, warmWhite) / 2.55, 0, 100);
    //   if (warmWhite > coldWhite) {
    //     saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (coldWhite / 255));
    //   } else {
    //     saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (warmWhite / 255));
    //   }
    // }

    const accessoryState: IAccessoryState = { HSV: { hue, saturation, value }, isOn, colorTemperature: 140, brightness };
    return accessoryState;
  }

  initializeCharacteristics() {

    const cachedDeviceInformation = this.controller.getCachedDeviceInformation();
    // if (cachedDeviceInformation) {
    //   this.accessory.context.accessoryState = accessoryState;
    // } else {
    //   cachedDeviceInformation = this.accessory.context.cachedDeviceInformation;
    // }
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
      await this.updateLocalState(this.readRequestLevel, null);
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

  removeSaturationCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Saturation characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.Saturation)
      .removeAllListeners(this.hap.CharacteristicEventTypes.SET)
      .removeAllListeners(this.hap.CharacteristicEventTypes.GET);

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

    // const {
    //   protoDevice: { uniqueId, modelNumber },
    //   deviceState: { controllerFirmwareVersion, controllerHardwareVersion },
    // } = this.accessory.context.cachedDeviceInformation;
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


  /*
    // Add the garage door service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.GarageDoorOpener) ||
      this.accessory.addService(this.hapServ.GarageDoorOpener)
	
    // Add some extra Eve characteristics
    if (!this.service.testCharacteristic(this.eveChar.LastActivation)) {
      this.service.addCharacteristic(this.eveChar.LastActivation)
    }
    if (!this.service.testCharacteristic(this.eveChar.ResetTotal)) {
      this.service.addCharacteristic(this.eveChar.ResetTotal)
    }
    if (!this.service.testCharacteristic(this.eveChar.TimesOpened)) {
      this.service.addCharacteristic(this.eveChar.TimesOpened)
    }
	
    // Add the set handler to the garage door target state characteristic
    this.service
      .getCharacteristic(this.hapChar.TargetDoorState)
      .onSet(value => this.internalTargetUpdate(value))
    this.cacheTarget = this.service.getCharacteristic(this.hapChar.TargetDoorState).value
    this.cacheCurrent = this.service.getCharacteristic(this.hapChar.CurrentDoorState).value
	
    // Add the set handler to the garage door reset total characteristic
    this.service.getCharacteristic(this.eveChar.ResetTotal).onSet(value => {
      this.service.updateCharacteristic(this.eveChar.TimesOpened, 0)
    })
	
    // Update the obstruction detected to false on plugin load
    this.service.updateCharacteristic(this.hapChar.ObstructionDetected, false)
	
    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('door', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })
    */



} // ZackneticMagichomePlatformAccessory class