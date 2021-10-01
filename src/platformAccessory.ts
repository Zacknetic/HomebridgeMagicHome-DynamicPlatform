import { API, CharacteristicEventTypes } from 'homebridge';
import type {
  Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP,
} from 'homebridge';
import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './magichome-interface/utils';
import { getLogs } from './logs';
import { IAccessoryState, MagicHomeAccessory } from './magichome-interface/types';
import { BaseController, ICommandOptions } from 'magichome-platform';

import Queue from 'queue-promise';
import { IDeviceCommand, IDeviceState } from 'magichome-platform/dist/types';

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

  //protected interval;
  protected setColortemp = false;
  protected colorCommand = false;
  
  logs = getLogs();

  protected accessoryState: IAccessoryState;
  protected accessoryStateTemporary: IAccessoryState;
  
  protected latestDeviceCommand: IDeviceCommand;

  protected queue;

  //=================================================
  // Start Constructor //
  constructor(
    protected readonly hap: HAP,
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    private readonly controller: BaseController,
  ) {

    this.accessoryState = this.accessory.context.cachedAccessoryState;
    
    this.queue = new Queue({
      concurrent: 1,
      interval: 1,
    });

    let tempData: IDeviceState;


    let timeout;
    this.queue.on('start', () => {
      clearTimeout(timeout);
    });

    this.queue.on('end', async () => {

      timeout = setTimeout(async () => {
        const options: ICommandOptions = { verifyRetries: 10, bufferMS: 0, timeoutMS: 500 };
        
        this.accessoryState = await this.controller.setOn(this.accessoryState.LED.isOn, options);
      }, 500);
    });

    this.queue.on('resolve', data => {
      if (this.queue.size < 1) {
        tempData = data;

      }
    });
    this.queue.on('reject', error => {/** */ });
    this.hap = hap;
    this.api = api;
    const {
      protoDevice: { uniqueId, ipAddress, modelNumber },
      deviceState: { controllerFirmwareVersion, controllerHardwareVersion }, deviceAPI: { description },
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
    //if(this.myDevice.lightParameters.hasBrightness || this.myDevice.lightParameters.hasBrightness == undefined){

    if (this.accessory.getService(hap.Service.Switch)) {
      this.accessory.removeService(this.accessory.getService(hap.Service.Switch));
    }
    this.service = this.accessory.getService(hap.Service.Lightbulb) ?? this.accessory.addService(hap.Service.Lightbulb);
    //this.myDevice.lightParameters.hasBrightness = true;

    this.service.getCharacteristic(hap.Characteristic.ConfiguredName)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the Brightness Characteristic

    this.service.getCharacteristic(hap.Characteristic.Brightness)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setBrightness.bind(this))        // SET - bind to the 'setBrightness` method below
      .on(CharacteristicEventTypes.GET, this.getBrightness.bind(this));       // GET - bind to the 'getBrightness` method below


    // if( this..lightParameters.hasColor){
    // register handlers for the Hue Characteristic
    this.logs.trace('Adding Hue characteristic to device.');
    this.service.getCharacteristic(hap.Characteristic.Hue)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setHue.bind(this))               // SET - bind to the 'setHue` method below
      .on(CharacteristicEventTypes.GET, this.getHue.bind(this));              // GET - bind to the 'getHue` method below

    // register handlers for the Saturation Characteristic
    this.logs.trace('Adding Saturation characteristic to device.');
    this.service.getCharacteristic(hap.Characteristic.Saturation)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setSaturation.bind(this));        // SET - bind to the 'setSaturation` method below
    //.on(CharacteristicEventTypes.GET, this.getSaturation.bind(this));       // GET - bind to the 'getSaturation` method below
    // register handlers for the On/Off Characteristic

    // }

    // if(this.myDevice.lightParameters.hasCCT){
    //   // register handlers for the Saturation Characteristic
    //   this.logs.trace('Adding ColorTemperature characteristic to device.');
    //   this.service.getCharacteristic(hap.Characteristic.ColorTemperature)
    //     .removeAllListeners(CharacteristicEventTypes.SET)
    //     .removeAllListeners(CharacteristicEventTypes.GET)
    //     .on(CharacteristicEventTypes.SET, this.setColorTemperature.bind(this))        // SET - bind to the 'setSaturation` method below
    //     .on(CharacteristicEventTypes.GET, this.getColorTemperature.bind(this));       // GET - bind to the 'getSaturation` method below
    // }
    // } else {
    //   //device is switch, register it as such
    //   this.logs.trace('Adding Switch service to device.');
    //   this.service = this.accessory.getService(hap.Service.Switch) ?? this.accessory.addService(hap.Service.Switch);
    //   this.service.getCharacteristic(hap.Characteristic.ConfiguredName)
    //     .removeAllListeners(CharacteristicEventTypes.SET)
    //     .removeAllListeners(CharacteristicEventTypes.GET)
    //     .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));

    // }
    // register handlers for the On/Off Characteristic
    this.logs.trace('Adding On characteristic to device.');
    this.service.getCharacteristic(hap.Characteristic.On)
      .removeAllListeners(CharacteristicEventTypes.SET)
      .removeAllListeners(CharacteristicEventTypes.GET)
      .on(CharacteristicEventTypes.SET, this.setOn.bind(this))              // SET - bind to the `setOn` method below
      .on(CharacteristicEventTypes.GET, this.getOn.bind(this));               // GET - bind to the `getOn` method below

    //this.updateLocalState();
    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    //this.service.setCharacteristic(hap.Characteristic.Name,  this.myDevice.displayName);

    // this.logListeners();

  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //

  setConfiguredName(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const name: string = value.toString();
    this.logs.debug('Renaming device to %o', name);
    this.accessory.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);

    callback(null);
  }

  identifyLight() {
    //this.logs.info('Identifying accessory: %o!', this.myDevice.displayName);
    this.flashEffect();

  }

  setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    //this.logs.debug('Setting accessory %o\'s Hue value: %o', this.myDevice.displayName, value);
    this.setColortemp = false;
    this.accessoryState.HSL.hue = value as number;
    this.colorCommand = true;
    // this.processRequest();
    callback(null);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    //this.logs.debug('Setting accessory %o\'s Saturation value: %o', this.myDevice.displayName, value);
    this.setColortemp = false;
    this.lightState.HSL.saturation = value as number;
    this.colorCommand = true;
    //this.processRequest();
    callback(null);
  }

  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    //this.logs.debug('Setting accessory %o\'s Brightness value: %o', this.myDevice.displayName, value);
    this.lightState.brightness = value as number;
    this.colorCommand = true;
    // this.processRequest();
    callback(null);
  }

  setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // this.logs.debug('Setting accessory %o\'s Color Temperature value: %o', this.myDevice.displayName, value);
    this.setColortemp = true;
    this.lightState.CCT = value as number;
    this.colorCommand = true;
    // this.processRequest();
    callback(null);
  }

  /*
  async setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback){
    this.lightState.operatingMode = opMode.temperatureMode;
    this.processRequest({msg: `cct=${value}`} );
    callback(null);
  }*/

  async setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // this.logs.debug('Setting accessory %o\'s On value: %o', this.myDevice.displayName, value);
    callback(null);
    //this.lightState.isOn = value as boolean;
    await this.processRequest(value as boolean);
  }
  //=================================================
  // End Setters //

  //=================================================
  // Start Getters //

  getHue(callback: CharacteristicGetCallback) {
    const hue = this.lightState.HSL.hue;
    if (!this.setColortemp) {   //if we are not in Color Temperature mode, allow HB to update HK with Hue values
      //this.logs.debug('Returning accessory %o\'s cached Hue value: %o', this.myDevice.displayName, hue);
      // this.updateLocalState(); //update state with actual values asynchronously
    }
    callback(null, hue);
  }

  getColorTemperature(callback: CharacteristicGetCallback) {
    const CCT = this.lightState.CCT;
    if (this.setColortemp) {  //if we are in Color Temperature mode, allow HB to update HK with CCT values
      //this.logs.debug('Returning accessory %o\'s cached Color Temperature value: %o', this.myDevice.displayName, CCT);
      // this.updateLocalState(); //update state with actual values asynchronously
    }
    callback(null, CCT);  //immediately return cached state to prevent laggy HomeKit UI
  }

  getBrightness(callback: CharacteristicGetCallback) {
    const brightness = this.lightState.brightness;
    //this.logs.debug('Returning accessory %o\'s cached Brightness value: %o', this.myDevice.displayName, brightness);
    // this.updateLocalState();    //update state with actual values asynchronously
    callback(null, brightness); //immediately return cached state to prevent laggy HomeKit UI
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  getOn(callback: CharacteristicGetCallback) {

    const isOn = this.lightState.isOn;
    //this.logs.debug('Returning accessory %o\'s cached Power value: %o', this.myDevice.displayName, isOn);
    // this.updateLocalState();  //update state with actual values asynchronously
    callback(null, isOn); //immediately return cached state to prevent laggy HomeKit UI
  }

  //=================================================
  // End Getters //

  //=================================================



  //=================================================
  // End Misc Tools //


  //=================================================
  // Start LightEffects //

  flashEffect() {
    this.lightState.HSL.hue = 100 as number;
    this.lightState.HSL.saturation = 100 as number;

    let change = true;
    let count = 0;

    const interval = setInterval(() => {

      if (change) {
        this.lightState.brightness = 0;

      } else {
        this.lightState.brightness = 100;
      }

      change = !change;
      count++;
      // this.updateDeviceState();

      if (count >= 20) {

        this.lightState.HSL.hue = 0;
        this.lightState.HSL.saturation = 5;
        this.lightState.brightness = 100;
        //this.updateDeviceState();
        clearInterval(interval);
        return;
      }
    }, 300);
  } //flashEffect

  async stopAnimation() {
    this.activeAnimation = animations.none;
    // this.service2.updateCharacteristic(hap.Characteristic.On, false);
    //clearInterval(this.interval);
  }

  //=================================================
  // End LightEffects //


  async processRequest(value: boolean) {
    this.queue.enqueue(() => {
      const options: ICommandOptions = { verifyRetries: 0, bufferMS: 10, timeoutMS: 0 };
      this.logs.warn(this.queue.size);

      return this.controller.setOn(value, options);
    });

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

function deviceStateToAccessoryState(deviceState: IDeviceState):IAccessoryState{
  //
}

function accessoryStateToDeviceCommand(accessoryState: IAccessoryState): IDeviceCommand{
  //
}
