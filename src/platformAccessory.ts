import { CharacteristicEventTypes } from 'homebridge';
import type {
  Service, PlatformConfig, PlatformAccessory, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback,
} from 'homebridge';
import { clamp, convertWhitesToColorTemperature } from './magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatform } from './platform';
import { Transport } from './magichome-interface/Transport';
import { getLogger } from './instance';
import { ILightState, opMode } from './magichome-interface/types';
import _ from 'lodash'; // Import the entire lodash library

const COMMAND_POWER_ON = [0x71, 0x23, 0x0f];
const COMMAND_POWER_OFF = [0x71, 0x24, 0x0f];

/* 
   Homekit send some "split commands", that is, instead of sending single command message for "TurnOn at Brightness at 50%", it sends two messages one "TurnOn" and another "Set Brightness at 50%".
   
   However, the light works better when you send a single command mesasge to it, so our code we wait for some time for a subsequent message. The INTRA_MESSAGE_TIME sets the time we wait since last received message. 

*/
const INTRA_MESSAGE_TIME = 5; 

/*
  We notice that if you send a command to the light, and read the status back right away, the status comes back with the old reading.
  For proper operation, we wait some time between the write and read back, so the lamp reports accurate state.r status
*/
const DEVICE_READBACK_DELAY = 1200;

// amount of time with no user message
//
const USER_IDLE_TIME = 1000;

const DEFAULT_LIGHT_STATE: ILightState = {
  isOn: true,
  operatingMode: opMode.redBlueGreenMode,
  HSL: { hue: 255, saturation: 100, luminance: 50 },
  RGB: { red: 0, green: 0, blue: 0 },
  whiteValues: { warmWhite: 0, coldWhite: 0 },
  colorTemperature: null,
  brightness: 100,
};

const OFFLINE_STATE: ILightState = {
  isOn: false,
  operatingMode: opMode.unknown,
  HSL: { hue: 0, saturation: 0, luminance: 0 },
  RGB: { red: 0, green: 0, blue: 0 },
  whiteValues: { warmWhite: 0, coldWhite: 0 },
  colorTemperature: null,
  brightness: 0,
};

const animations = {
  none: { name: 'none', brightnessInterrupt: true, hueSaturationInterrupt: true },
};

interface IProcessRequest {
  msg?: string;
  txType?: 'endOfFrame' | 'consistencyFix';
}


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
  protected deviceWriteInProgress = false;
  protected periodicTimer = null;
  protected pendingConsistencyCheck = false
  protected nextCommand = null;
  protected myTimer = null
  protected timestamps = []
  protected timeOfLastUserInteraction = null
  log = getLogger();

  protected lightState: ILightState = DEFAULT_LIGHT_STATE
  protected lightLastWrittenState: ILightState = _.cloneDeep(this.lightState) 
  public lightLastReadState: ILightState = _.cloneDeep(this.lightState)

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

      // //get, set
      // this.service.getCharacteristic(this.platform.Characteristic.Brightness.CharacteristicValueTransitionControl)
      //   .on(CharacteristicEventTypes.SET, this.setCVT.bind(this))
      //   .on(CharacteristicEventTypes.GET, this.getCVT.bind(this));
        
      // // get
      // this.service.getCharacteristic(this.platform.Characteristic.Brightness.SupportedCharacteristicValueTransitionConfiguration)
      //   .on(CharacteristicEventTypes.GET, this.getSupportedCVT.bind(this));


      if( this.accessory.context.lightParameters.hasColor){
        // register handlers for the Hue Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Hue)
          .on(CharacteristicEventTypes.SET, this.setHue.bind(this))               // SET - bind to the 'setHue` method below
          .on(CharacteristicEventTypes.GET, this.getHue.bind(this));              // GET - bind to the 'getHue` method below

        // register handlers for the Saturation Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Saturation)
          .on(CharacteristicEventTypes.SET, this.setSaturation.bind(this))        // SET - bind to the 'setSaturation` method below
        // TODO: why get saturation is not needed?
          .on(CharacteristicEventTypes.GET, this.getSaturation.bind(this));       // GET - bind to the 'getSaturation` method below
        // register handlers for the On/Off Characteristic
      
        // register handler for Color Temperature Characteristic
        if(this.config.advancedOptions?.useColorTemperature){
          this.platform.log.info('[EXPERIMENTAL] Registering ColorTemperature for device ',this.accessory.context.displayName);
          this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature)
            .on(CharacteristicEventTypes.SET, this.setColorTemperature.bind(this)) 
            .on(CharacteristicEventTypes.GET, this.getColorTemperature.bind(this));  
        }

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
    
    // TODO: should we use the last know state here? this should contain the last user desire.
    //   this.accessory.context.lastKnownState
    this.platform.log.info(`Last Known state for ${this.accessory.displayName}: `, this.accessory.context.lastKnownState );
    this.updateLocalState();

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
  
  }

  addHomekitProps(state:ILightState):void{
    const {controllerType } = this.accessory.context.device.lightParameters;
    throw new Error(`This abstract method  ("addHomekitProps")  must be implemented for device type "${controllerType}"`);
  }

  addMagicHomeProps(state:ILightState):void{
    const {controllerType } = this.accessory.context.device.lightParameters;
    throw new Error(`This abstract method ("addMagicHomeProps") must be implemented for device type "${controllerType}"`);
  }

  async consistencyCheck(){
    clearInterval(this.periodicTimer);
    await this.updateLocalState();
    this.platform.log.debug('consistencyCheck NOT implemented');
    return;
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
    // this.flashEffect();
    this.readBackTest();
  }

  async readBackTest(){
    let state;
    await this.send(COMMAND_POWER_ON);
    await this.sleep(1000);
    for (let delay=50; delay<=2000; delay = delay + 50){
      this.platform.log.info(`Performing read back test: ${this.accessory.displayName} with ${delay}ms delay!`);
      await this.send(COMMAND_POWER_OFF);
      await this.sleep(5000);
      await this.send(COMMAND_POWER_ON);
      await this.sleep(delay);
      state = await this.transport.getState(1000); //read state
      if(state.isOn === true){
        this.platform.log.info(`Test at ${delay}ms: SUCCESS. (${this.accessory.displayName})`);
        this.platform.log.info(`TEST COMPLETE! ${this.accessory.displayName}`);
        return;
      } else {
        this.platform.log.info(`\tTest at ${delay}ms: FAIL. (${this.accessory.displayName})`);
        // this.platform.log.info(`Test result: ${this.accessory.displayName}: `, state);
      }
    }
    this.platform.log.info(`TEST COMPLETE! ${this.accessory.displayName}`);
  }

  setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.lightState.HSL.hue = value as number; 
    this.nextCommand = 'setColor';
    this.processRequest({ msg: `hue=${value}`});
    callback(null);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.lightState.HSL.saturation = value as number; 
    this.nextCommand = 'setColor';
    this.processRequest({ msg: `sat=${value}`});
    callback(null);
  }

  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.lightState.brightness = value as number; 
    this.nextCommand = 'setColor';
    this.processRequest({msg: `bri=${value}`});
    callback(null);
  }

  async setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback){
    this.lightState.operatingMode = opMode.temperatureMode;
    this.nextCommand = 'setColor';
    this.processRequest({msg: `cct=${value}`} );
    callback(null);
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.lightState.isOn = value as boolean;
    if(this.lightState.isOn === false || this.nextCommand === null){
      this.nextCommand = 'setPower';
    }
    this.processRequest({msg: `on=${value}`});
    callback(null);
  }

  async processRequest(props: IProcessRequest): Promise<void>{
    const { displayName } = this.accessory.context;
    const {getStateString} = HomebridgeMagichomeDynamicPlatformAccessory;

    try{ 
      const { msg, txType } = props;

      if(msg){
        this.timeOfLastUserInteraction = Date.now();
        this.platform.log.warn(`[ProcessRequest] User message received '${displayName}': `, msg);
        clearTimeout(this.myTimer); //Restart the time since last message
        this.myTimer = setTimeout( () => this.processRequest({txType: 'endOfFrame'}), INTRA_MESSAGE_TIME);
        return;
      }
      
      if(this.deviceWriteInProgress){
        return;
      }
      this.deviceWriteInProgress = true; //block reads of device while

      // At this point we're ready to transmit,
      //  determine if a transmission is actually needed
      //    check the delta between current state and last transmitted
      // (or should be last read back?)
    
      const nextState = this.nextCommand;
      const stateMsg = '';
      const desiredLocked: ILightState = _.cloneDeep(this.lightState);


      this.platform.log.debug(`[ProcessRequest] Triggered "${txType}" for device '${displayName}' ('${this.nextCommand}')`);
      // keep, toggle, setcolor
      if(nextState==='keepState'){
        this.platform.log.debug(`[ProcessRequest] Transmission skipped type (${nextState}). Detail:${stateMsg} for device '${displayName}'`);
      } else {
        const timeStart = Date.now();
 
        this.platform.log.debug('\t timestamps', this.printTimestamp(this.timestamps) );
        this.timestamps = [];

        const writeStartTime = Date.now();
        if( nextState === 'setPower') {
          this.platform.log.info('Commiting writing setPower=', desiredLocked.isOn);
          await this.send(desiredLocked.isOn ? COMMAND_POWER_ON : COMMAND_POWER_OFF);
        } else {
          const lockedStr = getStateString(desiredLocked);
          this.platform.log.info(`Commiting writing ${nextState}: `, lockedStr);
          await this.updateDeviceState(null,desiredLocked); // Send message to light
        }
        const writeElapsedTime = Date.now() - writeStartTime;
        
        const elapsed = Date.now() - timeStart;
        this.platform.log.debug(`[ProcessRequest] Transmission complete in ${elapsed}ms. (w:${writeElapsedTime} '. Type: ${stateMsg} for device '${displayName}'\n`);
      }
    } catch(err){
      this.platform.log.error(`[ProcessRequest] ERROR for device '${displayName}':`, err);
    }
    this.deviceWriteInProgress = false; //allow reads to occur
    this.timeOfLastWrite = Date.now();
    clearInterval(this.periodicTimer);
    this.periodicTimer = setTimeout( () => this.consistencyCheck(), 1000);
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
    this.platform.log.debug('Get Characteristic Brightness -> %o for device: %o ', Math.round( this.lightState.brightness ) , this.accessory.context.displayName);
    callback(null, Math.round( this.lightState.brightness ) );
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

  getDeviceStatus(){
    // we already responsed with an infered state. Now we check for the real value
    this.platform.log.info('set interval of 300 to report actual state');

    this.pendingConsistencyCheck = true;
    clearInterval(this.periodicTimer);
    this.periodicTimer = setInterval( () => this.consistencyCheck(), 300);
  }

  protected timeOfLastRead = null; 
  protected timeOfLastWrite = null; 



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


  static getStateString(state:ILightState):string{
    let str;
    try{
      const { red, green, blue } = state.RGB;
      const { brightness, isOn} = state;
      const { coldWhite:cw, warmWhite:ww} = state.whiteValues;
      const mode = state.operatingMode;
      str =  `on:${isOn} ${mode} r:${red} g:${green} b:${blue} cw:${cw} ww:${ww} ~bri:${brightness}`;
    } catch(err){
      str = '(unable to get state string)';
    }
    return str;
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

      const timer = Date.now();

      while(state == null && scans <= 5){
        state = await this.transport.getState(1000); //retrieve a state object from transport class showing light's current r,g,b,ww,cw, etc
        scans++;
      } 
      const elapsed = Date.now() - timer;

      const name = this.accessory.context.displayName;
      const { ipAddress:ip, uniqueId:mac } = this.accessory.context.device;

      if(state == null){

        this.platform.log.error(`No device response: "${name}" "${mac}" "${ip}" (offline)`);
        // TODO: report off-line here so that device shows as "no response". Use reachable?
        // this.service.updateCharacteristic(this.platform.Characteristic.Reachable, false);
        // temporary work around: report as off.
        this.lightState.isOn = false; //FIXME: we're changing the user intent, but not letting them know. Add (!)
        state = OFFLINE_STATE;
      } else {
        this.addHomekitProps(state);
      }

      
      this.accessory.context.lastKnownState = _.cloneDeep(state); // useful after a Homebridge restart?
      this.lightLastReadState = _.cloneDeep(state); // store last value sent to light
      this.timeOfLastRead = Date.now();

      const { getStateString } = HomebridgeMagichomeDynamicPlatformAccessory;
      this.platform.log.debug('[updateLocalState] lastWritten:', getStateString(this.lightLastWrittenState));
      this.platform.log.debug('[updateLocalState] desired    :', getStateString(this.lightState));
      this.platform.log.debug('[updateLocalState] lastRead   :', getStateString(this.lightLastReadState));

      await this.updateHomekitState(this.lightLastReadState);
      this.platform.log.debug(`[updateLocalState] for '${this.accessory.context.displayName}' is complete` );

    } catch (error) {
      this.platform.log.error('[updateLocalState] error: ', error);
    }
  }

  /**
   ** @updateHomekitState
   * send state to homekit
   */
  async updateHomekitState(state:ILightState):Promise<any> {
    const { getHomeKitProps } = HomebridgeMagichomeDynamicPlatformAccessory;

    const { isOn, hue, saturation, brightness } = getHomeKitProps(state);
    isOn       && this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
    hue        && this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
    saturation && this.service.updateCharacteristic(this.platform.Characteristic.Saturation,  saturation);
    brightness && this.service.updateCharacteristic(this.platform.Characteristic.Brightness, brightness);

    this.platform.log.info(`updateHomekitState for '${this.accessory.context.displayName}' isOn:${isOn} h:${hue} s:${saturation} b:${brightness}` );
  }

  /**
   ** @updateDeviceState
   *  determine RGB and warmWhite/coldWhite values  from homekit's HSL
   *  perform different logic based on light's capabilities, detimined by "this.accessory.context.lightVersion"
   *  
   */
  async updateDeviceState(_timeout = 200, lockedState:ILightState) {
    const {controllerType } = this.accessory.context.device.lightParameters;
    throw new Error(`This abstract method  ("updateDeviceState")  must be implemented for device type "${controllerType}"`);
  }

  //=================================================
  // End State Get/Set //

  //=================================================
  // Start Misc Tools //

  async send(command: number[], useChecksum = true, _timeout = 200) {
    const buffer = Buffer.from(command);

    const output = await this.transport.send(buffer, useChecksum, _timeout);
    //this.platform.log.debug('Recieved the following response', output);

  } //send

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
      await this.updateDeviceState(null, this.lightState);

      if (count >= 20) {

        this.lightState.HSL.hue = 0;
        this.lightState.HSL.saturation = 5;
        this.lightState.brightness = 100;
        await this.updateDeviceState(null, this.lightState);
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

  static getHomeKitProps(state:ILightState){
    const { isOn, HSL, brightness, colorTemperature } = state;
    return { isOn, hue: HSL?.hue, saturation: HSL?.saturation, brightness, colorTemperature };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printTimestamp(timestampArray) {
    if(timestampArray.length=== 0){
      return [];
    } else {
      return timestampArray.map( e=> e-timestampArray[0]);
    }
  }
  
} // ZackneticMagichomePlatformAccessory class

