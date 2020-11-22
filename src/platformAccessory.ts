import { CharacteristicEventTypes } from 'homebridge';
import type {
  Service, PlatformConfig, PlatformAccessory, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback,
} from 'homebridge';
import { clamp, convertHSLtoRGB, convertRGBtoHSL, convertWhitesToColorTemperature } from './magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatform } from './platform';
import { Transport } from './magichome-interface/Transport';
import { getLogger } from './instance';
import { ILightState, opMode } from './magichome-interface/types';

const COMMAND_POWER_ON = [0x71, 0x23, 0x0f];
const COMMAND_POWER_OFF = [0x71, 0x24, 0x0f];
const INTRA_MESSAGE_TIME = 5;
const DEFAULT_LIGHT_STATE: ILightState = {
  isOn: true,
  operatingMode: opMode.redBlueGreenMode,
  HSL: { hue: 255, saturation: 100, luminance: 50 },
  RGB: { red: 0, green: 0, blue: 0 },
  whiteValues: { warmWhite: 0, coldWhite: 0 },
  colorTemperature: null,
  brightness: 100,
  targetState: {   targetHSL: { hue:null, saturation:null, luminance:null}, 
    targetMode: null, targetOnState: null, targetColorTemperature:null,
    targetBrightness: null,
  },
};

const animations = {
  none: { name: 'none', brightnessInterrupt: true, hueSaturationInterrupt: true },
};

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {
  protected service: Service;
  protected transport = new Transport(this.accessory.context.cachedIPAddress, this.config);
  protected colorWhiteThreshold = this.config.whiteEffects.colorWhiteThreshold;
  protected colorWhiteThresholdSimultaniousDevices = this.config.whiteEffects.colorWhiteThresholdSimultaniousDevices;
  protected colorOffThresholdSimultaniousDevices = this.config.whiteEffects.colorOffThresholdSimultaniousDevices;
  protected simultaniousDevicesColorWhite = this.config.whiteEffects.simultaniousDevicesColorWhite;

  //protected interval;
  public activeAnimation = animations.none;
  protected deviceUpdateInProgress = false;
  log = getLogger();

  public lightStateTemporary: ILightState = DEFAULT_LIGHT_STATE
  protected lightState: ILightState = DEFAULT_LIGHT_STATE

  //=================================================
  // Start Constructor //

  constructor(
    protected readonly platform: HomebridgeMagichomeDynamicPlatform,
    protected readonly accessory: PlatformAccessory,
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

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    if(this.accessory.context.lightParameters.hasBrightness || this.accessory.context.lightParameters.hasBrightness == undefined){
            
      if (this.accessory.getService(this.platform.Service.Switch)) {
        this.accessory.removeService(this.accessory.getService(this.platform.Service.Switch));
      }
      this.service = this.accessory.getService(this.platform.Service.Lightbulb) ?? this.accessory.addService(this.platform.Service.Lightbulb);
      this.accessory.context.lightParameters.hasBrightness = true;

      this.service.getCharacteristic(this.platform.Characteristic.ConfiguredName)
        .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));
    
      // each service must implement at-minimum the "required characteristics" for the given service type
      // see https://developers.homebridge.io/#/service/Lightbulb

      // register handlers for the Brightness Characteristic
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .on(CharacteristicEventTypes.SET, this.setBrightness.bind(this))        // SET - bind to the 'setBrightness` method below
        .on(CharacteristicEventTypes.GET, this.getBrightness.bind(this));       // GET - bind to the 'getBrightness` method below

      if( this.accessory.context.lightParameters.hasColor){
        // register handlers for the Hue Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Hue)
          .on(CharacteristicEventTypes.SET, this.setHue.bind(this))               // SET - bind to the 'setHue` method below
          .on(CharacteristicEventTypes.GET, this.getHue.bind(this));              // GET - bind to the 'getHue` method below

        // register handlers for the Saturation Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Saturation)
          .on(CharacteristicEventTypes.SET, this.setSaturation.bind(this))        // SET - bind to the 'setSaturation` method below
          .on(CharacteristicEventTypes.GET, this.getSaturation.bind(this));       // GET - bind to the 'getSaturation` method below
        // register handlers for the On/Off Characteristic
      
        // register handler for Color Temperature Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature)
          .on(CharacteristicEventTypes.SET, this.setColorTemperature.bind(this)) 
          .on(CharacteristicEventTypes.GET, this.getColorTemperature.bind(this));  

      }
    } else {

      this.service = this.accessory.getService(this.platform.Service.Switch) ?? this.accessory.addService(this.platform.Service.Switch);
      this.service.getCharacteristic(this.platform.Characteristic.ConfiguredName)
        .on(CharacteristicEventTypes.SET, this.setConfiguredName.bind(this));

    }
    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.SET, this.setOn.bind(this))              // SET - bind to the `setOn` method below
      .on(CharacteristicEventTypes.GET, this.getOn.bind(this));               // GET - bind to the `getOn` method below
    //this.service2.updateCharacteristic(this.platform.Characteristic.On, false);
    this.updateLocalState();
    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
  

  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //

  setConfiguredName(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const name: string = value.toString();
    this.platform.log.debug('Renaming device to %o', name);
    this.accessory.context.displayName = name;
    this.platform.api.updatePlatformAccessories([this.accessory]);

    callback(null);
  }

  identifyLight() {
    this.platform.log.info('Identifying accessory: %o!',this.accessory.displayName);
    this.flashEffect();
  }

  setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`[ProcessRequest] setHue rxD: ${value}`);
    this.lightState.targetState.targetHSL.hue = value as number;
    this.lightState.targetState.targetMode = opMode.redBlueGreenMode;
    this.processRequest('msg');
    callback(null);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`[ProcessRequest] setSat rxD: ${value}`);
    this.lightState.targetState.targetHSL.saturation = value as number;
    this.lightState.targetState.targetMode = opMode.redBlueGreenMode;
    this.processRequest('msg');
    callback(null);
  }

  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`[ProcessRequest] setBri rxD: ${value}`);
    this.lightState.targetState.targetBrightness =  value as number;
    this.processRequest('msg');
    callback(null);
  }

  async setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback){
    this.platform.log.debug(`[ProcessRequest] colorTemp rxD: ${value}`);
    this.lightState.targetState.targetColorTemperature = value as number;
    this.lightState.targetState.targetMode = opMode.temperatureMode;
    this.processRequest('msg');
    callback(null);
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`[ProcessRequest] setOn rxD: ${value}`);
    this.lightState.targetState.targetOnState = value as boolean;
    this.processRequest('msg');
    callback(null);
  }

  protected myTimer = null
  protected timestamps = []
  async processRequest(reason: string){
    reason = reason || 'msg';
    const dbg = () => ( {...this.lightState.targetState} );
    this.platform.log.debug(`[ProcessRequest] Triggered by "${reason}". Dbg: `, dbg());

    if(reason === 'msg'){
      clearTimeout(this.myTimer);
      this.timestamps.push(Date.now());
    }

    /*
      Message Transmission Logic
          Every time a new message arrives OR 100ms after last message, we perform the following logic:
          CASE1: [scene] If have hue, sat and bri, then send message to device
          CASE2: [hue/sat] else if I have only hue and sat, and idle for 100ms (bri missing), send message with last known bri
          CASE3: [bri] else if I have bri, and 100ms has passed from last msg, then send msg
          CASE4: [on/off] else if I have on/off, and 100ms has passed from last msg, then send msg
          CASE5: [colorTemp]
          CASEx: [error] else if I have only hue XOR sat, and 100ms has passed from last msg, then reset

          After performing cases 1,2,3 update the target on state, if any.
          -- Note: if in the future user reports issues, this is the likely cultript
    */

    const { targetOnState, targetBrightness, targetColorTemperature, targetHSL } = this.lightState.targetState;
    const { hue, saturation } = targetHSL; 


    const sceneUpdate = hue !== null && saturation !== null && targetBrightness !== null;
    const wheelHueAndSaturationUpdate = hue !== null && saturation !== null && reason === 'timeout';
    const wheelColorTemperatureUpdate = targetColorTemperature !== null && reason === 'timeout';
    const slideBrighnessUpdate = targetBrightness !== null && reason === 'timeout';
    const slideBrightnessToZero = this.lightState.isOn && targetOnState === false && targetBrightness === 0;
    const updatePoweredLight = (this.lightState.isOn && targetOnState !== false) || targetOnState === true;
    const toggleOnState = targetOnState !== null && reason === 'timeout';

    const case1 = sceneUpdate;
    const case2 = wheelHueAndSaturationUpdate;
    const case3 = slideBrighnessUpdate;
    const case4 = toggleOnState;
    const case5 = wheelColorTemperatureUpdate !== null && reason === 'timeout';
    
    const printTS = (ts) =>{
      return ts.length=== 0 ? [] : ts.map( e=> e-ts[0]);
    };

    if( case1 || case2 || case3 || case5) {  

      if( slideBrightnessToZero || updatePoweredLight){
        this.platform.log.debug(`[ProcessRequest] Transmission started. Type: ${case1 ? '"scene"' : ''} ${case2 ? '"hue/sat"' : ''} ${case3 ? `"bright=${targetBrightness}"` : ''} ${case5 ? `"colorTemp=${targetColorTemperature}"` : ''} `);
        this.platform.log.debug('\t timestamps', printTS(this.timestamps) );
        this.timestamps = [];
        await this.updateDeviceState(); // Send message to light
        await this.updateLocalState();  // Read light state, tell homekit and store as current state  
        this.clearTargetState();        // clear state changes
        this.platform.log.debug('[ProcessRequest] Transmission complete!');
      } else{
        // Edge Case 2: User adjusts hue/sat OR colorTemp while lamp is off - let's store the target, and apply it when user sets lamp on. 
        this.platform.log.debug(`[ProcessRequest] skip ${case1 ? '"scene"' : ''} ${case2 ? '"hue/sat"' : ''} ${case3 ? '"bright"' : ''} ${case5 ? '"colorTemp"' : ''} update because current and target is off (user tunning hue/sat while light off)`);
      }

    } else if(case4 /* targetOn */) {
      this.platform.log.debug(`[ProcessRequest] Transmission started. type: ${case4 ? `"on=${targetOnState}"` :''}`);
      this.platform.log.debug('\t timestamps', printTS(this.timestamps) );
      this.timestamps = [];
      await this.send(targetOnState ? COMMAND_POWER_ON : COMMAND_POWER_OFF);
      await this.updateLocalState(); // get the actual light state
      this.clearTargetState();
      this.platform.log.debug('[ProcessRequest] Transmission complete!');
    }else if( reason === 'timeout' ){
      this.platform.log.info('[ProcessRequest] Timeout with no valid data. State: ', dbg() );
      this.timestamps = [];
      this.clearTargetState();
    } else {
      // this.platform.log.debug(`[ProcessRequest] wait ${INTRA_MESSAGE_TIME}ms timer: `, dbg() );
      this.myTimer = setTimeout( () => this.processRequest('timeout'), INTRA_MESSAGE_TIME);
    }
 
  }

  clearTargetState():void{
    this.lightState.targetState = {   targetHSL: { hue:null, saturation:null, luminance:null}, 
      targetMode: null, targetOnState: null, targetColorTemperature:null,
      targetBrightness: null,
    };
  }

  //=================================================
  // End Setters //

  //=================================================
  // Start Getters //

  getHue(callback: CharacteristicGetCallback) {
    this.getDeviceStatus();
    this.platform.log.debug('Get Characteristic Hue -> %o for device: %o ', this.lightState.HSL.hue, this.accessory.context.displayName);
    callback(null, this.lightState.HSL.hue);
  }

  getBrightness(callback: CharacteristicGetCallback) {
    this.getDeviceStatus();
    this.platform.log.debug('Get Characteristic Brightness -> %o for device: %o ', this.lightState.brightness, this.accessory.context.displayName);
    callback(null, this.lightState.brightness);
  }

  getSaturation(callback: CharacteristicGetCallback) {
    this.getDeviceStatus();
    this.platform.log.debug('Get Characteristic Saturation -> %o for device: %o ', this.lightState.HSL.saturation, this.accessory.context.displayName);
    callback(null, this.lightState.HSL.saturation);
  }

  getColorTemperature(callback: CharacteristicGetCallback){
    this.getDeviceStatus();
    const { mired } = convertWhitesToColorTemperature(this.lightState.whiteValues);
    this.platform.log.debug('Get Characteristic Color Temperature -> %o for device: %o ', mired, this.accessory.context.displayName);
    callback(null, mired);
  }

  protected lastTimeCalled = Date.now()
  async getDeviceStatus(){
    if( Date.now() - this.lastTimeCalled > 50 ){
      this.lastTimeCalled = Date.now(); 
      await this.updateLocalState();
      this.platform.log.debug('status refreshed', this.accessory.displayName);
    }
    return;
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  getOn(callback: CharacteristicGetCallback) {
    //update state with actual values asynchronously
    this.getDeviceStatus();
    this.platform.log.debug('Get Characteristic On -> %o for device: %o ', this.lightState.isOn, this.accessory.context.displayName);
    callback(null, this.lightState.isOn);
  }

  getIsAnimating(callback: CharacteristicGetCallback) {
    let isAnimating = true;

    if(this.activeAnimation == animations.none) {
      isAnimating = false;
    }
    this.platform.log.debug('Get Characteristic isAnimating -> %o for device: %o ', isAnimating, this.accessory.context.displayName);
    callback(null, isAnimating);
  }

  //=================================================
  // End Getters //

  //=================================================
  // Start State Get/Set //

  calculateBrightness():number {
    const { operatingMode, HSL, whiteValues } = this.lightState;
    let brightness = 0;
    if(operatingMode === opMode.redBlueGreenMode){
      brightness =  HSL.luminance * 2;
    } else if (operatingMode === opMode.temperatureMode){
      const { coldWhite, warmWhite} = whiteValues;
      this.platform.log.debug(`cw: ${coldWhite}, ww: ${warmWhite}`);

      brightness = ( (whiteValues.coldWhite + whiteValues.warmWhite) / 255) *100;
    } 
    this.platform.log.debug('Calculated brightness: ', brightness);

    return brightness;
  }

  /**
   ** @updateLocalState
   * retrieve light's state object from transport class
   * once values are available, update homekit with actual values
   */
  async updateLocalState() {

    try {
      let state;
      let scans = 0;
      while(state == null && scans <= 5){
        state = await this.transport.getState(1000); //retrieve a state object from transport class showing light's current r,g,b,ww,cw, etc
        scans++;
      } 
      if(state == null){
        this.platform.log.debug('Warning. Was unable to determine state for device: %o', this.accessory.context.displayName);
        return;
      }
      this.accessory.context.lastKnownState = state;

      this.lightState.RGB = state.RGB;
      this.lightState.HSL = convertRGBtoHSL(state.RGB);
      this.lightState.whiteValues = state.whiteValues;
      const { mired } = convertWhitesToColorTemperature(state.whiteValues);
      this.lightState.colorTemperature = mired;
      this.lightState.isOn = state.isOn;
      this.lightState.operatingMode = state.operatingMode;
      this.lightState.brightness = this.calculateBrightness();

      const { red, green, blue } = this.lightState.RGB;
      const { brightness, isOn} = this.lightState;
      const { coldWhite:cw, warmWhite:ww} = this.lightState.whiteValues;
      const mode = this.lightState.operatingMode;
      const str = `on:${isOn} ${mode} r:${red} g:${green} b:${blue} , cw:${cw} ww:${ww} (calculated brightness: ${brightness}) raw: `;
      this.platform.log.debug('[getLampState] Lamp is reporting:', str);
      this.platform.log.debug('state', state);


      await this.updateHomekitState();

    } catch (error) {
      this.platform.log.error('getState() error: ', error);
    }
  }

  /**
   ** @updateHomekitState
   * send state to homekit
   */
  async updateHomekitState() {

    this.service.updateCharacteristic(this.platform.Characteristic.On,  this.lightState.isOn);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightState.HSL.saturation);
    if(this.lightState.HSL.luminance > 0 && this.lightState.isOn){
      this.updateLocalBrightness(this.lightState.HSL.luminance * 2);
    }
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness,  this.lightState.brightness);
  }

  updateLocalHSL(_hsl){
    this.lightState.HSL = _hsl;
  }

  updateLocalRGB(_rgb){
    this.lightState.RGB = _rgb;
  }

  updateLocalWhiteValues(_whiteValues){
    this.lightState.whiteValues = _whiteValues;
  }

  updateLocalIsOn(_isOn){
    this.lightState.isOn = _isOn;
  }

  updateLocalBrightness(_brightness){
    this.lightState.brightness = _brightness;
  }


  /**
   ** @updateDeviceState
   *  determine RGB and warmWhite/coldWhite values  from homekit's HSL
   *  perform different logic based on light's capabilities, detimined by "this.accessory.context.lightVersion"
   *  
   */
  async updateDeviceState(_timeout = 200) {


    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const brightness = this.lightState.brightness;
    /*
    this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    */
    const mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    const r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    const g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    const b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));

    await this.send([0x31, r, g, b, 0x00, mask, 0x0F], true, _timeout); //8th byte checksum calculated later in send()
  


  }//updateDeviceState

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
   */
  hueToWhiteTemperature() {
    const hsl = this.lightState.HSL;
    let multiplier = 0;
    const whiteTemperature = { warmWhite: 0, coldWhite: 0 };


    if (hsl.hue <= 90) {        //if hue is <= 90, warmWhite value is full and we determine the coldWhite value based on Hue
      whiteTemperature.warmWhite = 255;
      multiplier = ((hsl.hue / 90));
      whiteTemperature.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 270) { //if hue is >270, warmWhite value is full and we determine the coldWhite value based on Hue
      whiteTemperature.warmWhite = 255;
      multiplier = (1 - (hsl.hue - 270) / 90);
      whiteTemperature.coldWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 180 && hsl.hue <= 270) { //if hue is > 180 and <= 270, coldWhite value is full and we determine the warmWhite value based on Hue
      whiteTemperature.coldWhite = 255;
      multiplier = ((hsl.hue - 180) / 90);
      whiteTemperature.warmWhite = Math.round((255 * multiplier));
    } else if (hsl.hue > 90 && hsl.hue <= 180) {//if hue is > 90 and <= 180, coldWhite value is full and we determine the warmWhite value based on Hue
      whiteTemperature.coldWhite = 255;
      multiplier = (1 - (hsl.hue - 90) / 90);
      whiteTemperature.warmWhite = Math.round((255 * multiplier));
    }
    return whiteTemperature;
  } //hueToWhiteTemperature

  


  async send(command: number[], useChecksum = true, _timeout = 200) {
    const buffer = Buffer.from(command);

    const output = await this.transport.send(buffer, useChecksum, _timeout);
    //this.platform.log.debug('Recieved the following response', output);

  } //send

  cacheCurrentLightState(){
    this.lightStateTemporary.HSL = this.lightState.HSL;
  }

  async restoreCachedLightState(){
    this.lightState.HSL = this.lightStateTemporary.HSL;
    await this.updateDeviceState();
  }
  //=================================================
  // End Misc Tools //


  //=================================================
  // Start LightEffects //

  flashEffect() {
    this.lightState.HSL.hue = 100 as number;
    this.lightState.HSL.saturation = 100 as number;

    let change = true;
    let count = 0;

    const interval = setInterval( async () => {

      if (change) {
        this.lightState.brightness = 0;

      } else {
        this.lightState.brightness = 100;
      }

      change = !change;
      count++;
      await this.updateDeviceState();

      if (count >= 20) {

        this.lightState.HSL.hue = 0;
        this.lightState.HSL.saturation = 5;
        this.lightState.brightness = 100;
        await this.updateDeviceState();
        clearInterval(interval);
        return;
      }
    }, 300);
  } //flashEffect
  
  async stopAnimation(){
    this.activeAnimation = animations.none;
    // this.service2.updateCharacteristic(this.platform.Characteristic.On, false);
    //clearInterval(this.interval);
  }

  /*
  async rainbowEffect(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const isOn = value as boolean;
    if(!isOn){
      this.stopAnimation();
    }else{ 
      let hue = 0;
      const increment = 10;
      const waitTime = 0;
      let wait = waitTime;
      const isWaiting = false;
      
      this.interval = setInterval(() => {
        this.lightState.HSL.saturation = 100 as number;
        this.lightState.HSL.hue = hue as number;
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);

        if(wait > 0 && hue % (360/increment)){
          wait --;
        } else {
          wait = waitTime;
          hue += increment;
        }
        
        this.updateDeviceState(10);

        if(hue>359){
          hue = 0;
        }

      }, 125);
     
    }
    callback(null);
  } //rainbowEffect
*/


  //=================================================
  // End LightEffects //


  speedToDelay(speed: number) {
    speed = clamp(speed, 0, 100);
    return (30 - ((speed / 100) * 30)) + 1;
  }

  /**
	 * Sets the controller to display one of the predefined patterns
	 * @param {String} pattern Name of the pattern
	 * @param {Number} speed between 0 and 100
	 * @param {function} callback 
	 * @returns {Promise<boolean>}
	 */
  setPattern(pattern: number, speed: number) {

    const delay = this.speedToDelay(speed);

    //const cmd_buf = Buffer.from();

    //const promise = new Promise((resolve, reject) => {
    this.send([0x61, pattern, delay, 0x0f]);
    //}).then(data => {
    //return (data.length > 0 || !this._options.ack.pattern); 
    //});

    // if (callback && typeof callback == 'function') {
    // promise.then(callback.bind(null, null), callback);
    //}

    //return promise;
  }

  
} // ZackneticMagichomePlatformAccessory class

