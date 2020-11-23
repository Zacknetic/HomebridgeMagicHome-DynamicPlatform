import { clamp, convertHSLtoRGB, convertRGBtoHSL, convertColorTemperatureToWhites, convertWhitesToColorTemperature } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../PlatformAccessory';
import { opMode } from '../magichome-interface/types';

// TODO: add code to see if this DEFAULT_COLOR_TEMPERATURE is being used, it should come from a cached value instead.
const DEFAULT_COLOR_TEMPERATURE = 250;


export class RGBWWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  async updateDeviceState(_timeout = 200) {
    const { operatingMode } = this.lightState;
    const { targetColorTemperature, targetMode, targetBrightness } = this.lightState.targetState;

    const inColorTempMode = operatingMode === opMode.temperatureMode && targetMode === null;
    const wantingColorTempMode = targetMode === opMode.temperatureMode;
    if(inColorTempMode || wantingColorTempMode){
      let cw=0, ww=0;
      if(targetColorTemperature && targetBrightness){
        const { coldWhite:_cw, warmWhite:_ww} = convertColorTemperatureToWhites(targetColorTemperature);
        cw = Math.round( _cw * (targetBrightness/100) );
        ww = Math.round( _ww * (targetBrightness/100) );
        this.platform.log.debug(`[updateDeviceState.RGBWW] Target mode: ${opMode.temperatureMode} Temp&Bri Adj tgt_bri: ${targetBrightness} tgt_tmp:${targetColorTemperature} => cw:${cw} ww:${ww}.`);
      } else if(targetColorTemperature){
        this.lightState.colorTemperature = targetColorTemperature || this.getDefaultColorTemperature(); // store as state, so we don't rely on actuals, as subject to error.
        const { coldWhite:_cw, warmWhite:_ww} = convertColorTemperatureToWhites(targetColorTemperature);
        const { brightness } = this.lightState;
        cw = Math.round( _cw * (brightness/100) );
        ww = Math.round( _ww * (brightness/100) );
        this.platform.log.debug(`[updateDeviceState.RGBWW] Target mode: ${opMode.temperatureMode} Temp Adj: cw:${cw} ww:${ww}`);
      } else if(targetBrightness){
        const { coldWhite:_cw, warmWhite:_ww} = convertColorTemperatureToWhites(this.lightState.colorTemperature || this.getDefaultColorTemperature() );
        cw = Math.round( _cw * (targetBrightness/100) );
        ww = Math.round( _ww * (targetBrightness/100) );
        this.platform.log.debug(`[updateDeviceState.RGBWW] Target mode: ${opMode.temperatureMode} Bright Adj: tgt_bri: ${targetBrightness} curr_tmp:${this.lightState.colorTemperature} => cw:${cw} ww:${ww}.`, this.lightState.colorTemperature);
      }  else {
        this.platform.log.warn(`[updateDeviceState.RGBWW] Target mode: ${opMode.temperatureMode}. Unable to update, missing targetColorTemperature and targetBrightness`);
      }

      const mask = 0x0F; // color(0xF0), white (0x0F), or both (0xFF)
      
      const inRange = cw>=0 && cw <=255 && ww>=0 && ww <=255;
      if(targetBrightness === 0 && cw === undefined && ww === undefined){
        ww=0;
        cw=0;
      }
      if(!inRange){
        throw new Error(`cw, ww out of ranage! ${cw} ${ww}`);
      }
      // TODO: add brightness controll
      await this.send([0x31, 0,0,0, ww, cw, mask, 0x0F], true, _timeout); //9th byte checksum calculated later in send()
      return;
    }
    this.platform.log.debug(`[updateDeviceState.RGBWW] Target mode is: ${opMode.redBlueGreenMode}`);

    // case 1: update brightness
    // case 2  update hue and sat
    // case 3: (scene) update hue, sat and bri
    const { hue, saturation } = this.lightState.targetState.targetHSL;
    
    let tmpHSL = null;
    const tmpBrightness = targetBrightness !== null ? targetBrightness : this.lightState.brightness;
    if (targetBrightness){
      tmpHSL = this.lightState.HSL;
    } else{
      tmpHSL = this.lightState.targetState.targetHSL;
    }

    //**** local variables ****\\
    const [red, green, blue] = convertHSLtoRGB(tmpHSL); //convert HSL to RGB
    // const whites = this.hueToWhiteTemperature(); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = this.lightState.brightness;
    
    // this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    // this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
    const mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    const r = Math.round(((clamp(red, 0, 255) / 100) * tmpBrightness));
    const g = Math.round(((clamp(green, 0, 255) / 100) * tmpBrightness));
    const b = Math.round(((clamp(blue, 0, 255) / 100) * tmpBrightness));
    const ww = 0;//Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
    const cw = 0;//Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));
    
    /*
    if (hsl.hue == 31 && (hsl.saturation == 33)) {
      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      cw = 0;
      mask = 0x0F;
      //this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    } else if ((hsl.hue == 208 && (hsl.saturation == 17))) {
      r = 0;
      g = 0;
      b = 0;
      ww = 0;
      cw = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if ((hsl.saturation < this.colorWhiteThreshold)) {
      r = 0;
      g = 0;
      b = 0;
      mask = 0x0F;
      // this.platform.log.debug('Setting warmWhite and coldWhite without colors: ww:%o cw:%o', ww, cw);
    } else { //else set warmWhite and coldWhite to zero. Color mask already set at top

      ww = 0;
      cw = 0;
      //this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);

    }

*/
    await this.send([0x31, r, g, b, ww, cw, mask, 0x0F], true, _timeout); //9th byte checksum calculated later in send()

    
  }//setColor


  async updateHomekitState() {
    const { hue, saturation } = this.lightState.HSL;
    const { brightness, isOn, operatingMode} = this.lightState;
    const { mired } = convertWhitesToColorTemperature(this.lightState.whiteValues);

    let str;
    if(operatingMode === opMode.temperatureMode){
      this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, brightness);
      this.service.updateCharacteristic(this.platform.Characteristic.ColorTemperature, mired);

      // TODO: do we need to update hue/sat when we're in color mode?
      // this.service.updateCharacteristic(this.platform.Characteristic.Hue, null);
      // this.service.updateCharacteristic(this.platform.Characteristic.Saturation,  null);

      str = `on:${isOn} b:${brightness} , colorTemperature:${mired}`;
    } else {
      this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation,  saturation);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, brightness); 
      str = `on:${isOn} h:${hue} s:${saturation} b:${brightness}`;
    }
    this.platform.log.debug(`Reporting to HomeKit "${this.accessory.displayName}" ${operatingMode}: `, str);

    this.cacheCurrentLightState();
  }
    
  getDefaultColorTemperature = () => {
    this.platform.log.debug('Development note: see if instead this can come from a saved preference.');
    return DEFAULT_COLOR_TEMPERATURE;
  }
}