import { API, CharacteristicEventTypes } from 'homebridge';
import type {
  Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP,
} from 'homebridge';
import { clamp, convertHSLtoRGB, convertMiredColorTemperatureToHueSat, convertRGBtoHSL } from './magichome-interface/utils';
import { getLogs } from './logs';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, MagicHomeAccessory } from './magichome-interface/types';
import * as types from './magichome-interface/types';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, DeviceWriteStatus, IDeviceAPI, IProtoDevice } from 'magichome-platform';
import { _ } from 'lodash';
import Queue from 'queue-promise';
import { Hue } from 'hap-nodejs/dist/lib/definitions';

const { ready, pending, busy } = DeviceWriteStatus;
const CCT = 'CCT';
const HSL = 'HSL';

const BUFFER_MS = 50;
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {
  protected service: Service;
  protected colorWhiteThreshold = this.config.whiteEffects.colorWhiteThreshold;
  protected colorWhiteThresholdSimultaniousDevices = this.config.whiteEffects.colorWhiteThresholdSimultaniousDevices;
  protected colorOffThresholdSimultaniousDevices = this.config.whiteEffects.colorOffThresholdSimultaniousDevices;
  protected simultaniousDevicesColorWhite = this.config.whiteEffects.simultaniousDevicesColorWhite;

  protected alController;

  protected newAccessoryCommand: IAccessoryCommand;
  protected latestDeviceCommand: IDeviceCommand;

  protected ColorCommandMode = HSL;

  protected logs = getLogs();

  protected accessoryState: IAccessoryState = DefaultAccessoryCommand;
  protected accessoryStateTemporary: IAccessoryState;
  protected deviceWriteStatus = ready;
  // protected deviceAPI: IDeviceAPI;
  protected protoDevice: IProtoDevice;
  protected queue;
  protected deviceAPI: { hasBrightness, hasCCT };
  saturationCharacteristic: any;

  //=================================================
  // Start Constructor //
  constructor(
    protected readonly hap: HAP,
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    private readonly controller: BaseController,
  ) {

    this.accessoryState = this.accessory.context.cachedAccessoryState || DefaultAccessoryCommand;

    // this.accessoryState.HSL = Object.assign( DefaultAccessoryCommand.HSL);
    this.logs.warn(this.accessoryState);
    //get acessory state from device


    this.queue = new Queue({
      concurrent: 1,
      interval: 20,
    });

    let timeout;

    this.queue.on('start', () => {
      clearTimeout(timeout);
    });

    this.queue.on('end', async () => {

      timeout = setTimeout(async () => {
        this.logs.warn(this.accessory.displayName, ': FINAL STATE', this.latestDeviceCommand);
        const options: ICommandOptions = { verifyRetries: 10, bufferMS: 0, timeoutMS: 200 };
        let deviceState: IDeviceState;
        if (this.latestDeviceCommand.isOn) {
          deviceState = await this.controller.setAllValues(this.latestDeviceCommand, options);
        } else {
          deviceState = await this.controller.setOn(false, options);
        }
        //this.accessoryState = deviceStateToAccessoryState(deviceState);
        this.accessory.context.cachedAccessoryState = this.accessoryState;

      }, 500);
    });

    this.queue.on('resolve', data => {/** */ });
    this.queue.on('reject', error => {/** */ });
    this.hap = hap;
    this.api = api;
    const {
      protoDevice: { uniqueId, ipAddress, modelNumber },
      deviceState: { controllerFirmwareVersion, controllerHardwareVersion },
      deviceAPI: { description, hasBrightness, hasCCT, hasColor },
    } = controller.getCachedDeviceInformation();
    // set accessory information
    this.accessory.getService(hap.Service.AccessoryInformation)!
      .setCharacteristic(hap.Characteristic.Manufacturer, 'MagicHome')
      .setCharacteristic(hap.Characteristic.SerialNumber, uniqueId)
      .setCharacteristic(hap.Characteristic.Model, modelNumber)
      .setCharacteristic(hap.Characteristic.HardwareRevision, controllerHardwareVersion.toString(16))
      .setCharacteristic(hap.Characteristic.FirmwareRevision, controllerFirmwareVersion.toString(16))
      .getCharacteristic(hap.Characteristic.Identify)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.identifyLight.bind(this));       // SET - bind to the 'Identify` method below

    this.accessory.getService(hap.Service.AccessoryInformation)!
      .addOptionalCharacteristic(hap.Characteristic.ConfiguredName);


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    if (hasBrightness) {

      if (this.accessory.getService(hap.Service.Switch)) {
        this.accessory.removeService(this.accessory.getService(hap.Service.Switch));
      }

      this.service = this.accessory.getService(hap.Service.Lightbulb) ?? this.accessory.addService(hap.Service.Lightbulb);

      this.service.getCharacteristic(hap.Characteristic.ConfiguredName)
        .removeAllListeners(CharacteristicEventTypes.SET)
        .removeAllListeners(CharacteristicEventTypes.GET)
        .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));

      // register handlers for the Brightness Characteristic
      this.service.getCharacteristic(hap.Characteristic.Brightness)
        .removeAllListeners(CharacteristicEventTypes.SET)
        .removeAllListeners(CharacteristicEventTypes.GET)
        .on(CharacteristicEventTypes.SET, this.setBrightness.bind(this))        // SET - bind to the 'setBrightness` method below
        .on(CharacteristicEventTypes.GET, this.getBrightness.bind(this));       // GET - bind to the 'getBrightness` method below

      if (hasColor) {

        // register handlers for the Hue Characteristic
        this.logs.trace('Adding Hue characteristic to device.');
        this.service.getCharacteristic(hap.Characteristic.Hue)
          .removeAllListeners(CharacteristicEventTypes.SET)
          .removeAllListeners(CharacteristicEventTypes.GET)
          .on(CharacteristicEventTypes.SET, this.setHue.bind(this))               // SET - bind to the 'setHue` method below
          .on(CharacteristicEventTypes.GET, this.getHue.bind(this));              // GET - bind to the 'getHue` method below

        // register handlers for the Saturation Characteristic
        this.logs.trace('Adding Saturation characteristic to device.');
        this.saturationCharacteristic = this.service.getCharacteristic(hap.Characteristic.Saturation)
          .removeAllListeners(CharacteristicEventTypes.SET)
          .removeAllListeners(CharacteristicEventTypes.GET)
          .on(CharacteristicEventTypes.SET, this.setSaturation.bind(this));        // SET - bind to the 'setSaturation` method below
        //.on(CharacteristicEventTypes.GET, this.getSaturation.bind(this));       // GET - bind to the 'getSaturation` method below
        // register handlers for the On/Off Characteristic

      }

      if (hasCCT) {
        // register handlers for the Saturation Characteristic
        this.logs.trace('Adding ColorTemperature characteristic to device.');
        this.service.getCharacteristic(hap.Characteristic.ColorTemperature)
          .removeAllListeners(CharacteristicEventTypes.SET)
          .removeAllListeners(CharacteristicEventTypes.GET)
          .on(CharacteristicEventTypes.SET, this.setColorTemperature.bind(this))        // SET - bind to the 'setSaturation` method below
          .on(CharacteristicEventTypes.GET, this.getColorTemperature.bind(this));       // GET - bind to the 'getSaturation` method below

        if (this.api.versionGreaterOrEqual && this.api.versionGreaterOrEqual('1.3.0-beta.46')) {
          this.logs.trace('Adding the adaptive lighting controller to the accessory...');
          this.alController = new this.api.hap.AdaptiveLightingController(this.service);
          this.accessory.configureController(this.alController);
        }
      }
    } else {
      //device is switch, register it as such
      this.logs.trace('Adding Switch service to device.');
      this.service = this.accessory.getService(hap.Service.Switch) ?? this.accessory.addService(hap.Service.Switch);
      this.service.getCharacteristic(hap.Characteristic.ConfiguredName)
        .removeAllListeners(CharacteristicEventTypes.SET)
        .removeAllListeners(CharacteristicEventTypes.GET)
        .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));

    }
    // register handlers for the On/Off Characteristic
    this.logs.trace('Adding On characteristic to device.');
    this.service.getCharacteristic(hap.Characteristic.On)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setOn.bind(this))              // SET - bind to the `setOn` method below
      .on(CharacteristicEventTypes.GET, this.getOn.bind(this));               // GET - bind to the `getOn` method below

    this.updateLocalState();
    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.

    // this.logListeners();

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

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { hue: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    callback(null);

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { saturation: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    callback(null);

    const accessoryCommand: IAccessoryCommand = { isOn: true, brightness: value as number };
    this.logs.error(accessoryCommand);
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

    this.updateLocalState();
  }

  getColorTemperature(callback: CharacteristicGetCallback) {

    const colorTemperature = this.accessoryState.colorTemperature;
    callback(null, colorTemperature);  //immediately return cached state to prevent laggy HomeKit UI

    this.updateLocalState();
  }

  getBrightness(callback: CharacteristicGetCallback) {

    const brightness = this.accessoryState.brightness;
    callback(null, brightness); //immediately return cached state to prevent laggy HomeKit UI
    this.updateLocalState();
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  getOn(callback: CharacteristicGetCallback) {

    const isOn = this.accessoryState.isOn;
    callback(null, isOn); //immediately return cached state to prevent laggy HomeKit UI

    this.updateLocalState();
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //


  protected async processAccessoryCommand(accessoryCommand: IAccessoryCommand) {
    const deviceWriteStatus = this.deviceWriteStatus;
    this.logs.info(this.deviceWriteStatus);
    switch (deviceWriteStatus) {
      case ready:

        this.deviceWriteStatus = pending;
        await this.writeStateToDevice(accessoryCommand).then((msg) => {
          //error logging
        }).finally(() => {
          //this.newAccessoryCommand = DefaultCommand;
          this.deviceWriteStatus = ready;
        });
        break;

      case pending:
        _.merge(this.newAccessoryCommand, accessoryCommand);
        // Object.assign(this.newAccessoryCommand, accessoryCommand);
        // Object.assign(this.newAccessoryCommand.HSL, accessoryCommand.HSL);
        //this.logs.warn('PENDING', this.newAccessoryCommand);
        break;
    }
  }

  protected async writeStateToDevice(accessoryCommand: IAccessoryCommand): Promise<unknown> {
    this.newAccessoryCommand = accessoryCommand;
    return new Promise<unknown>((resolve, reject) => {
      this.logs.info(this.ColorCommandMode);
      return setTimeout(() => {
        this.logs.warn(this.accessory.context.displayName, '\nthis.accessoryState: ', this.accessoryState, '\n this.newAccessoryCommand: ', this.newAccessoryCommand);
        const sanitizedAcessoryCommand = _.merge({}, this.accessoryState, this.newAccessoryCommand);
        // const sanitizedAcessoryCommand = Object.assign({}, this.accessoryState, this.newAccessoryCommand);
        // sanitizedAcessoryCommand.HSL = Object.assign({}, this.accessoryState.HSL, this.newAccessoryCommand.HSL);
        this.logs.warn('\nSanatizedCommand: ', sanitizedAcessoryCommand);

        //this.logs.warn(sanitizedAcessoryCommand);
        this.deviceWriteStatus = ready;
        //console.log('everything is probably fine', this.deviceAPI.description, this.protoDevice.uniqueId, this.deviceState.controllerHardwareVersion.toString(16), this.deviceAPI.needsPowerCommand, this.deviceState.controllerFirmwareVersion)

        return this.prepareCommand(sanitizedAcessoryCommand).then(state => {
          //set current state to state
        });
      }, BUFFER_MS);
    });
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand) {
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    this.latestDeviceCommand = deviceCommand;

    this.queue.enqueue(() => {
      const options: ICommandOptions = { verifyRetries: 0, bufferMS: 0, timeoutMS: 100 };
      this.accessoryState = Object.assign(accessoryCommand);
      //this.logs.warn(deviceCommand);
      if (deviceCommand.isOn) {
        return this.controller.setAllValues(deviceCommand, options);
      } else {
        return this.controller.setOn(false, options);
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

  protected async updateLocalState() {
    const deviceState = await this.controller.fetchState();
    const accessoryState = this.deviceStateToAccessoryState(deviceState);
    _.merge(this.accessoryState, accessoryState);
    this.updateHomekitState();
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

  // /**
  //  *  This is a debug function to show the number of listeners for each .on event.
  //  */
  // logListeners() {
  //   this.logs.warn('On set Listener count: ', this.service.getCharacteristic(hap.Characteristic.On).listenerCount('set'));
  //   this.logs.warn('Identify set Listener count: ', this.service.getCharacteristic(hap.Characteristic.Identify).listenerCount('set'));
  //   this.logs.warn('Name set Listener count: ', this.service.getCharacteristic(hap.Characteristic.ConfiguredName).listenerCount('set'));
  //   this.logs.warn('Brightness set Listener count: ', this.service.getCharacteristic(hap.Characteristic.Brightness).listenerCount('set'));
  //   this.logs.warn('Hue set Listener count: ', this.service.getCharacteristic(hap.Characteristic.Hue).listenerCount('set'));
  //   this.logs.warn('Sat set Listener count: ', this.service.getCharacteristic(hap.Characteristic.Saturation).listenerCount('set'));
  //   this.logs.warn('Manufacturer set: Listener count: ', this.service.setCharacteristic(hap.Characteristic.Manufacturer, null).listenerCount('set') );

  //   this.logs.warn('On get Listener count: ', this.service.getCharacteristic(hap.Characteristic.On).listenerCount('get'));
  //   this.logs.warn('Identify get Listener count: ', this.service.getCharacteristic(hap.Characteristic.Identify).listenerCount('get'));
  //   this.logs.warn('Name get Listener count: ', this.service.getCharacteristic(hap.Characteristic.ConfiguredName).listenerCount('get'));
  //   this.logs.warn('Brightness get Listener count: ', this.service.getCharacteristic(hap.Characteristic.Brightness).listenerCount('get'));
  //   this.logs.warn('Hue get Listener count: ', this.service.getCharacteristic(hap.Characteristic.Hue).listenerCount('get'));
  //   this.logs.warn('Sat get Listener count: ', this.service.getCharacteristic(hap.Characteristic.Saturation).listenerCount('get'));
  //   this.logs.warn('Manufacturer get: Listener count: ', this.service.setCharacteristic(hap.Characteristic.Manufacturer, null).listenerCount('get') );
  //}
} // ZackneticMagichomePlatformAccessory class

