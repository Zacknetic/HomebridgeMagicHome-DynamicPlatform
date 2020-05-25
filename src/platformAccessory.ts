/* eslint-disable linebreak-style */
/* eslint-disable eqeqeq */
/* eslint-disable linebreak-style */
import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformConfig, PlatformAccessory, CharacteristicValue, 
  CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';
import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './magichome-interface/utils';
import { ZackneticMagichomePlatform } from './platform';
import { Transport } from './magichome-interface/transport';

const COMMAND_POWER_ON = [0x71, 0x23, 0x0f];
const COMMAND_POWER_OFF = [0x71, 0x24, 0x0f];

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */ 
export class ZackneticMagichomePlatformAccessory {
  private service: Service;
  private transport = new Transport(this.accessory.context.cachedIPAddress, 50);

  private colorWhiteThreshold = this.config.colorWhiteThreshold;
  private colorOffThreshold = this.config.colorOffThreshold;
  private simultaniousColorWhite = this.config.simultaniousColorWhite;
  private isActive = false;
  private lightState = {
    HSL: { Hue: 255, Saturation: 100, Luminance: 50 },
    On: true,
    Brightness: 100,
  }



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
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.lightVersion)
      .getCharacteristic(this.platform.Characteristic.Identify)
      .on(CharacteristicEventTypes.SET, this.identifyLight.bind(this));       // SET - bind to the 'Identify` method below


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

  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  getActive(callback: CharacteristicGetCallback) {
    this.platform.log.debug('setting active');
 
    callback(null, this.isActive);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  identifyLight() {
    this.platform.log.debug('Identifying accessory!');
    this.flashEffect();

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

    this.platform.log.debug('Set Characteristic Saturation -> %o for device: %o ', value, this.accessory.context.device.uniqueId);

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
    this.platform.log.debug('Set Characteristic Brightness -> %o for device: %o ', value, this.accessory.context.device.uniqueId);

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
 
    this.platform.log.debug('Set Characteristic On -> %o for device: %o ', value, this.accessory.context.device.uniqueId);

    // you must call the callback function
    callback(null);
  }

  //=================================================
  // Start Getters //

  getHue(callback: CharacteristicGetCallback) {

    const hue = this.lightState.HSL.Hue;
    
    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic Hue -> %o for device: %o ', hue, this.accessory.context.device.uniqueId);

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

    this.platform.log.debug('Get Characteristic Saturation -> %o for device: %o ', saturation, this.accessory.context.device.uniqueId);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, saturation);
  }

  getBrightness(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const brightness = this.lightState.Brightness;
    
    // dont update the actual values from brightness, it is impossible to determine by rgb values alone
    //this.getState();

    this.platform.log.debug('Get Characteristic Brightness -> %o for device: %o ', brightness, this.accessory.context.device.uniqueId);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, brightness);
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready

   */
  getOn(callback: CharacteristicGetCallback) {

    const isOn = this.lightState.On;

    //update state with actual values asynchronously
    this.getState();

    this.platform.log.debug('Get Characteristic On -> %o for device: %o ', isOn, this.accessory.context.device.uniqueId);
    callback(null, isOn);
  }

  //=================================================
  // End Getters //

  //=================================================
  // Start State Get/Set //

  /**
   ** @getState
   * retrieve light's state object from transport class
   * once values are available, update homekit with actual values
   */
  async getState() {
   
    try {
      this.platform.log.debug('Getting state for accessory: %o version-%o',
        this.accessory.displayName, this.accessory.context.lightVersion);

      const state = await this.transport.getState(); //retrieve a state object from transport class showing light's current r,g,b,ww,cw, etc
      
      const { red, green, blue } = state.color; //create local constant for red, green, blue
      const [hue, saturation] = convertRGBtoHSL(red, green, blue);  //convert retrieved RGB values to hsl as homehit only uses hsl
      //luminance is never read

      this.lightState.On = state.isOn;
      this.lightState.HSL.Hue = hue;
      this.lightState.HSL.Saturation = saturation;

      this.service.updateCharacteristic(this.platform.Characteristic.On, state.isOn);
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation,saturation);
      //we never update Luminance as we use 'brightness' to determine each LED's power
      //brightness is returned instantly in "getBrightness()" 
      //(todo) should probably calculate brightness from rgbww for initial values
      //(todo) should probably create global warmWhite and coldWhite values and determine current white mode (color, white, both)

    } catch (error) {
      this.platform.log.info('getState() error: ', error); 
    }
  }

  /**
   ** @setColor
   *  determine RGB and warmWhite/coldWhite values  from homekit's HSL
   *  perform different logic based on light's capabilities, detimined by "this.accessory.context.lightVersion"
   *  
   */
  async setColor() {

    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    let [red, green, blue] = convertHSLtoRGB([hsl.Hue, hsl.Saturation, hsl.Luminance]); //convert HSL to RGB
    const whites = this.calculateWhiteColor(); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = this.lightState.Brightness;

    this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o',hsl.Hue, hsl.Saturation, hsl.Luminance, brightness);
    this.platform.log.debug('Converted RGB: r:%o g:%o b:%o',red, green, blue);
    
    let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = Math.round(((clamp(whites.warmWhite, 0, 255)/ 100) * brightness));
    let cw = Math.round(((clamp(whites.coldWhite, 0, 255)/ 100) * brightness));

    //****logic switch for light types****\\

    //different light types need different different logic as they all have different capablilities
    //(todo) add rgb only case for users with rgb only light strips. Will need to know light version number
    switch(this.accessory.context.lightVersion) {

      //light versions 8 and 9 have rgb and warmWhite capabilities
      case 10://rgbw strip
      case 9: //rgbw
      case 8: //rgbw
      
   
        //if saturation is below config set threshold or if user asks for warm white / cold white  
        //set all other values besides warmWhite to 0 and set the mask to white (0x0F)
        
        if ((hsl.Saturation < this.colorWhiteThreshold) || 
        (hsl.Hue == 31 && hsl.Saturation == 33) || (hsl.Hue == 208 && hsl.Saturation == 17)) {
          
          r = 0;
          g = 0;
          b = 0;
          ww = Math.round((255 / 100) * brightness);
          cw = 0;
          mask = 0x0F;
          this.platform.log.debug('Setting warmWhite only without colors: ww:%o', ww);

        } else { //else set warmWhite and coldWhite to zero. Color mask already set at top
          
          ww = 0;
          cw = 0;
          this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
        }
        break;

        
      //light versions 7 and 5 have rgb, warmWhite and coldWhite capabilities.
      //only color OR white can be enabled at one time (no 0xFF mask). However, both whites can turn on simultaniously
      case 7: //rgbww color/white non-simultanious
      case 5: //rgbww color/white non-simultanious
     
        if(hsl.Hue == 31 && hsl.Saturation == 33){
          r = 0;
          g = 0;
          b = 0;
          ww = Math.round((255 / 100) * brightness);
          cw = 0;
          mask = 0x0F;
          this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
        } else if (hsl.Hue == 208 && hsl.Saturation == 17){
          r = 0;
          g = 0;
          b = 0;
          ww = 0;
          cw = Math.round((255 / 100) * brightness);
          mask = 0x0F;
          this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);
       
        //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
        //White colors were already calculated above
        } else if (hsl.Saturation < this.colorWhiteThreshold) {
          r = 0;
          g = 0;
          b = 0;
          mask = 0x0F;
          this.platform.log.debug('Setting warmWhite and coldWhite without colors: ww:%o cw:%o', ww, cw);
        } else { //else set warmWhite and coldWhite to zero. Color mask already set at top
        
          ww = 0;
          cw = 0;
          this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);

        }
        break;

      //light version 3 has rgb, warmWhite and coldWhite capabilities.
      //both color AND white can be enabled simultaniously (0xFF mask is possible). Both whites can turn on simultaniously as well.
      case 3:  //rgbww simultanious color/white capable

        //set mask to both color/white (0xFF) so we can control both color and white simultaniously,
        mask = 0xFF;
        

        if(hsl.Hue == 31 && hsl.Saturation == 33){
          r = 0;
          g = 0;
          b = 0;
          ww = Math.round((255 / 100) * brightness);
          cw = 0;
          mask = 0x0F;
          this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
        } else if (hsl.Hue == 208 && hsl.Saturation == 17){
          r = 0;
          g = 0;
          b = 0;
          ww = 0;
          cw = Math.round((255 / 100) * brightness);
          mask = 0x0F;
          this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);
       
        //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
        //White colors were already calculated above
        } else if (hsl.Saturation < this.colorOffThreshold) {
          this.platform.log.debug('Turning off color');
          r = 0;
          g = 0;
          b = 0;
          this.platform.log.debug('Setting only white: ww:%o cw:%o', ww, cw);

          //else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
          //set RGB to 100% saturation and 100% brightness
          //this allows brightness to only affect the white colors, creating beautiful white+color balance
          //we've set the color saturation to 100% because the higher the white level the more washed out the colors become
          //the white brightness effectively acts as the saturation value
        } else if(hsl.Saturation < this.colorWhiteThreshold){
          [red, green, blue] = convertHSLtoRGB([hsl.Hue, 100, hsl.Luminance]); //re-generate rgb with full saturation
          r = red;
          g = green;
          b = blue;
          this.platform.log.debug('Setting fully saturated color mixed with white: r:%o g:%o b:%o ww:%o cw:%o', r, g, b, ww, cw);

          //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
        } else {
          ww = 0;
          cw = 0;
          this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
        }
        break;

        //warn user if we encounter an unknown light type
      default:
        this.platform.log.warn('Uknown light version: %o... color cannot be set.', this.accessory.context.lightVersion);
        this.platform.log.warn('Please create an issue at https://github.com/Lethegrin/HomebridgeMagicHome-DynamicPlatform/issues and post your log');
        break;
    }

    //set state messages are constructed as follows:

    /*
          # sample message for RGB protocol (w/o checksum at end)
        #  0  1  2  3  4
        # 56 90 fA 77 AA
        #  |  |  |  |  |
        #  |  |  |  |  terminator
        #  |  |  |  blue
        #  |  |  green
        #  |  red
        #  head

        
        # sample message for 8-byte protocols (w/ checksum at end)
        #  0  1  2  3  4  5  6  7
        # 31 90 fA 77 00 00 0F 00
        #  |  |  |  |  |  |  |  |
        #  |  |  |  |  |  |  |  checksum
        #  |  |  |  |  |  |  terminator
        #  |  |  |  |  |  write mask (F0 color, 0F white)
        #  |  |  |  |  white
        #  |  |  |  blue
        #  |  |  green
        #  |  red
        #  persistence (31 for true / 41 for false)
        #  useful if you want to set a default color such as warm white that can be easily reverted to by turning a switch on / off

        # sample message for 9-byte LEDENET protocol (w/ checksum at end)
        #  0  1  2  3  4  5  6  7  8
        # 31 BC C1 FF 00 00 F0 0F 00
        #  |  |  |  |  |  |  |  |  |
        #  |  |  |  |  |  |  |  |  checksum
        #  |  |  |  |  |  |  |  terminator
        #  |  |  |  |  |  |  write mask (F0 color, 0F white, FF color & white)
        #  |  |  |  |  |  cold white
        #  |  |  |  |  warm white
        #  |  |  |  blue
        #  |  |  green
        #  |  red
        #  persistence (31 for true / 41 for false). Sets if the color will remain after a power cycle (on / off)
        #  useful if you want to set a default color such as warm white that can be easily reverted to by turning a switch on / off
        #
    */

    //if the device type is rgbw it can only accept an 8 byte message
    if (this.accessory.context.lightVersion == 8 || this.accessory.context.lightVersion == 9 || this.accessory.context.lightVersion == 10) {
      this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    } else {  //else the device type is rgbww and can only accept a 9 byte message
      this.send([0x31, r, g, b, ww, cw, mask, 0x0F]); //9th byte checksum calculated later in send()
      // this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    }
   
  }//setColor

  //=================================================
  // End State Get/Set //

  //=================================================
  // Start Misc Tools //

  /**
   ** @calculateWhiteColor
   *  determine warmWhite/coldWhite values from hue
   *  the closer to 0/360 the weaker coldWhite brightness becomes
   *  the closer to 180 the weaker warmWhite brightness becomes
   *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
   *  @returns whites object
   */
  calculateWhiteColor (){
    const hsl = this.lightState.HSL;
    let multiplier = 0;
    const whites = {warmWhite: 0, coldWhite: 0};
    

    if (hsl.Hue <= 90) {        //if hue is <= 90, warmWhite value is full and we determine the coldWhite value based on Hue
      whites.warmWhite = 255;
      multiplier = ((hsl.Hue / 90));
      whites.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.Hue > 270) { //if hue is >270, warmWhite value is full and we determine the coldWhite value based on Hue
      whites.warmWhite = 255;
      multiplier = (1 - (hsl.Hue - 270) / 90);
      whites.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.Hue > 180 && hsl.Hue <= 270) { //if hue is > 180 and <= 270, coldWhite value is full and we determine the warmWhite value based on Hue
      whites.coldWhite = 255;
      multiplier = ((hsl.Hue - 180) / 90);
      whites.warmWhite = Math.round((255 * multiplier));
    } else if (hsl.Hue > 90 && hsl.Hue <= 180) {//if hue is > 90 and <= 180, coldWhite value is full and we determine the warmWhite value based on Hue
      whites.coldWhite = 255;
      multiplier = (1 - (hsl.Hue - 90) / 90);
      whites.warmWhite = Math.round((255 * multiplier));
    }
    return whites;
  } //calculateWhiteColor

  /**
   ** @send
   *  create a buffer from our byte array and send it to transport
   *  @returns buffer
   */
  async send(command: number[]) {
    console.log('platformAccessory class Send function. Sending: %o', command);
    const buffer = Buffer.from(command);
    await this.transport.send(buffer);
  } //send

  //=================================================
  // End Misc Tools //
 
  //=================================================
  // Start LightEffects //
  
  flashEffect(){
    this.lightState.HSL.Hue = 100 as number;
    this.lightState.HSL.Saturation = 100 as number;
    
    let change = true;
    let count = 0;
 
    const interval = setInterval(() => {
      

      if (change){
        this.lightState.Brightness = 0;
          
      } else {
        this.lightState.Brightness = 100;
      }
      
      change = !change;
      count ++;
      this.setColor();

      if(count >= 10){

        this.lightState.HSL.Hue = 0;
        this.lightState.HSL.Saturation = 5;
        this.lightState.Brightness = 100;
        this.setColor();
        clearInterval(interval);
        return;
      }
    }, 300);
  } //flashEffect

  rainbowEffect(){

    const interval = setInterval(() => {
      this.lightState.HSL.Hue = 100 as number;
      this.lightState.HSL.Saturation = 100 as number;
      let rainbowHue = 0;
      let count = 0;

      rainbowHue += 10;
      if(rainbowHue > 360) {
        rainbowHue = 0;
        count++;
      }
      this.lightState.HSL.Hue = rainbowHue as number;
      this.setColor();
      if(count >= 2){

        this.lightState.HSL.Hue = 0;
        this.lightState.HSL.Saturation = 5;
        this.lightState.Brightness = 100;
        this.setColor();
        clearInterval(interval);
        return;
      }
    }, 50);

  } //rainbowEffect

   
  //=================================================
  // End LightEffects //

} // ZackneticMagichomePlatformAccessory class
