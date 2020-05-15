/* eslint-disable linebreak-style */
/* eslint-disable eqeqeq */
/* eslint-disable linebreak-style */
import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformConfig, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';
import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './magichome-interface/utils';
import { ZackneticMagichomePlatform } from './platform';
import { Transport } from './magichome-interface/transport';
import { runInThisContext } from 'vm';



const COMMAND_POWER_ON = [0x71, 0x23, 0x0f];
const COMMAND_POWER_OFF = [0x71, 0x24, 0x0f];
const COMMAND_QUERY_STATE = [0x81, 0x8a, 0x8b];

const COMMAND_POWER_ON_SUCCESS = [0xf0, 0x71, 0x23, 0x84];
const COMMAND_POWER_OFF_SUCCESS = [0xf0, 0x71, 0x24, 0x85];


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */ 
export class ZackneticMagichomePlatformAccessory {
  private service: Service;
  private transport = new Transport(this.accessory.context.cachedIPAddress);
  private lightState = {
    HSL: { Hue: 255, Saturation: 100, Luminance: 50 },
    WarmWhite: 0,
    ColdWhite: 0,
    On: true,
    Brightness: 100,
  }

  private colorWhiteThreshold = this.config.colorWhiteThreshold;
  constructor(
    private readonly platform: ZackneticMagichomePlatform,
    private readonly accessory: PlatformAccessory,
    public readonly config: PlatformConfig,
  ) {
    
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Magic Home')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uniqueId)
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.modelNumber)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.lightVersion); 


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) ?? this.accessory.addService(this.platform.Service.Lightbulb);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.SET, this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .on(CharacteristicEventTypes.GET, this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Hue Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Hue)
      .on(CharacteristicEventTypes.SET, this.setHue.bind(this))               // SET - bind to the 'setHue` method below
      .on(CharacteristicEventTypes.GET, this.getHue.bind(this));              // GET - bind to the 'getHue` method below

    // register handlers for the Saturation Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Saturation)
      .on(CharacteristicEventTypes.SET, this.setSaturation.bind(this))        // SET - bind to the 'setSaturation` method below
      .on(CharacteristicEventTypes.GET, this.getSaturation.bind(this));       // GET - bind to the 'getSaturation` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .on(CharacteristicEventTypes.SET, this.setBrightness.bind(this))        // SET - bind to the 'setBrightness` method below
      .on(CharacteristicEventTypes.GET, this.getBrightness.bind(this));       // GET - bind to the 'getBrightness` method below

    // this.service.getCharacteristic(this.platform.Characteristic.Identify)
    //.on(CharacteristicEventTypes.SET, this.identifyLight.bind(this));       // SET - bind to the 'Identify` method below

    // EXAMPLE ONLY
    // Example showing how to update the state of a Characteristic asynchronously instead
    // of using the `on('get')` handlers.
    //
    // Here we change update the brightness to a random value every 5 seconds using 
    // the `updateCharacteristic` method.
 
    /*   setInterval(() => {
      // assign the current brightness a random value between 0 and 100
      const currentBrightness = Math.floor(Math.random() * 100);

      // push the new value to HomeKit
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, currentBrightness);

      this.platform.log.debug('Pushed updated current Brightness state to HomeKit:', currentBrightness);
    }, 10000);*/
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  identifyLight(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.lightState.HSL.Hue = 300 as number;

    this.setColor();

    this.platform.log.debug('Set Characteristic Hue -> ', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  async setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.lightState.HSL.Hue = value as number;

    await this.setColor();

    this.platform.log.debug('Set Characteristic Hue -> ', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  async setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.lightState.HSL.Saturation = value as number;

    await this.setColor();

    this.platform.log.debug('Set Characteristic Saturation -> ', value);

    // you must call the callback function
    callback(null);
  }
  
  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  async setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.lightState.Brightness = value as number;

    await this.setColor();

    this.platform.log.debug('Set Characteristic Brightness -> ', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {


    this.lightState.On = value as boolean;
    this.send(this.lightState.On ? COMMAND_POWER_ON : COMMAND_POWER_OFF);
 
    this.platform.log.debug('Set Characteristic On ->', value);

    // you must call the callback function
    callback(null);
  }

  getHue(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const hue = this.lightState.HSL.Hue;
    
    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic Hue ->', hue);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, hue);
  }

  getSaturation(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const saturation = this.lightState.HSL.Saturation;
    
    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic Hue ->', saturation);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, saturation);
  }

  getBrightness(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const brightness = this.lightState.Brightness;
    
    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic Brightness ->', brightness);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, brightness);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.lightState.On;

    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  async getState() {
   
    this.platform.log.debug('Getting state for accessory:', this.accessory.context.displayName);
    const state = await this.transport.getState();
    
    const { red, green, blue } = state.color;
    const [h, s, l] = convertRGBtoHSL(red, green, blue);
    const hsl = { Hue: h, Saturation: s, Luminance: l };

    this.lightState.On = state.isOn;
    this.lightState.HSL.Hue = hsl.Hue;
    this.lightState.HSL.Saturation = hsl.Saturation;
    this.lightState.HSL.Luminance = hsl.Luminance;
    this.lightState.WarmWhite = state.warmWhite;
    this.lightState.ColdWhite = state.coldWhite;
    this.accessory.context.lightVersion = state.lightVersion;
    this.platform.log.debug('Light version:', this.accessory.context.lightVersion);
    
    this.service.updateCharacteristic(this.platform.Characteristic.On, state.isOn);
   
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, hsl.Hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, hsl.Saturation);
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, hsl.Luminance);
 

  }

 
  async setColor() {
    const hsl = this.lightState.HSL;
    const brightness = this.lightState.Brightness;
    
    let mask = 0xF0;
    if (this.lightState.HSL.Saturation < this.colorWhiteThreshold) {
      mask = 0xF0;
    } else {
      mask = 0x0F;
    }

    if (this.accessory.context.lightVersion == 3 && this.config.simultaniousStripControllerColorWhite) {
      mask = 0xFF;
    }


    const [red, green, blue] = convertHSLtoRGB([hsl.Hue, hsl.Saturation, hsl.Luminance]);


    const r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    const g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    const b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    const ww = Math.round(((clamp(this.lightState.WarmWhite, 0, 255)/ 100) * brightness));
    const cw = Math.round(((clamp(this.lightState.ColdWhite, 0, 255)/ 100) * brightness));



    this.platform.log.debug('colors', red, green, blue);



    if (this.accessory.context.lightVersion == 8 || this.accessory.context.lightVersion == 9) {
      this.send([0x31, r, g, b, ww, mask, 0x0F]);
    } else { 
      this.send([0x31, r, g, b, ww, cw, mask, 0x0F]);
    }
   
  }

  async send(command: number[]) {
    this.platform.log.debug('Light version:', this.accessory.context.lightVersion);
    const buffer = Buffer.from(command);
    return await this.transport.send(buffer);
  }

}
