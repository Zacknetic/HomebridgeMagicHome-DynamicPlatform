/*
    This are common function that one or more accessory might implement

*/
import { ILightState, opMode } from '../magichome-interface/types';
import { convertRGBtoHSL, convertHSLtoRGB, convertWhitesToColorTemperature, clamp, convertColorTemperatureToWhites, estimateBrightnessFromWhites } from '../magichome-interface/utils';
import {ColorUtils} from '../util/colorUtils';
interface IConvProps {
  //this.config.whiteEffects.colorWhiteThreshold
  config?: {
    whiteEffects?: {
      colorWhiteThreshold?: number;
    }
  }
}
export default class CommonClass{
  static convertHSBtoRGBWW_CCT(state:ILightState, props:IConvProps ):void{

    if(state.operatingMode === opMode.temperatureMode){
      state.RGB = { red:0, green:0, blue: 0}; // must be zero, so we can stuff tx message to device?
      state.whiteValues = convertColorTemperatureToWhites(state.colorTemperature, state.brightness);
      state.brightness = estimateBrightnessFromWhites(state.whiteValues);
      return;
    }

    const { colorWhiteThreshold } = props.config.whiteEffects;
    //**** local variables ****\\
    const hsl = state.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const whites = CommonClass.hueToWhiteTemperature(state); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = state.brightness;
       
    let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
    let cw = Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));
    

    if ( (hsl.hue > 0 && hsl.hue < 31) && (hsl.saturation >= 72 && hsl.saturation <= 76)) {
      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      cw = 0;
      mask = 0x0F;
      //this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    } else if (  (hsl.hue >= 208 && hsl.hue >= 222) && (hsl.saturation >= 17 && hsl.saturation <= 22)  ) {
      r = 0;
      g = 0;
      b = 0;
      ww = 0;
      cw = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if ((hsl.saturation < colorWhiteThreshold)) {
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
    state.RGB = { red:r, green:g, blue: b};
    state.whiteValues= { coldWhite:cw, warmWhite:ww};
    state.operatingMode = CommonClass.parseOperatingMode(mask);

    return;
  }

  static convertHSBtoRGB(state: ILightState, props: any):void {
    const [red, green, blue] = convertHSLtoRGB(state.HSL);
    const brightness = state.brightness;
         
    const r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    const g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    const b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    state.RGB = { red:r, green:g, blue: b};

    const mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    state.operatingMode = CommonClass.parseOperatingMode(mask);
    return;
  }

  static convertRGBtoHSB(state: ILightState, props: any):void {
    throw new Error('Method not implemented.');
  }

  static convertDimmerToHSB(state: ILightState, props: IConvProps):void {
    state.brightness = state.isOn ? state.RGB.red / 2.5 : 0;
    return;
  }

  static convertHSBtoDimmer(state: ILightState, props: IConvProps):void {
    state.RGB.red = Math.round((2.5 * state.brightness));
    return;
  }

  static convertHSBtoRGBW(state: ILightState, props: IConvProps):void {
    const { colorWhiteThreshold } = props?.config?.whiteEffects;
    const hsl = state.HSL;
    
    //if saturation is below config set threshold or if user asks for warm white / cold white  
    //set all other values besides warmWhite to 0 and set the mask to white (0x0F)
    if ((hsl.saturation < colorWhiteThreshold) 
            || (hsl.hue == 31 && hsl.saturation == 33) 
            || (hsl.hue == 208 && hsl.saturation == 17) 
            || (hsl.hue == 0 && hsl.saturation == 0)) {

      const ww = Math.round((255 / 100) * state.brightness);
      const mask = 0x0F;
      state.RGB = { red:0, green:0, blue: 0};
      state.whiteValues= { coldWhite:null, warmWhite:ww};
      state.operatingMode = CommonClass.parseOperatingMode(mask);
    } else {
      CommonClass.convertHSBtoRGB(state, props);
    }
    return;
  }

  static convertRGBWtoHSB(state: ILightState, props: IConvProps):void {
    state.HSL = convertRGBtoHSL(state.RGB);
    const { hue, saturation, luminance } = state.HSL;
    const { isOn } = state;
    const { coldWhite, warmWhite } = state.whiteValues;

    //TODO: implement HSB output in case white(s) are non-zero
    
    let brightness = 0;
    if(luminance > 0 && isOn){
      brightness = luminance * 2;
    } else if (isOn){
      brightness = clamp((warmWhite/2.55), 0, 100);
    }
    state.brightness = Math.round(brightness);
    return;
  }

  /* 
    converts HSB to RGBWW
    Homekit uses HSB, MagicHome uses RGB
  */
  static convertHSBtoRGBWW(state:ILightState, props:IConvProps ):void{
    const { colorWhiteThreshold } = props.config.whiteEffects;
    //**** local variables ****\\
    const hsl = state.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const whites = CommonClass.hueToWhiteTemperature(state); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = state.brightness;
    
    // this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    // this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
    let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
    let cw = Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));
    

    if ( (hsl.hue > 0 && hsl.hue < 31) && (hsl.saturation >= 72 && hsl.saturation <= 76)) {
      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      cw = 0;
      mask = 0x0F;
      //this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    } else if (  (hsl.hue >= 208 && hsl.hue >= 222) && (hsl.saturation >= 17 && hsl.saturation <= 22)  ) {
      r = 0;
      g = 0;
      b = 0;
      ww = 0;
      cw = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if ((hsl.saturation < colorWhiteThreshold)) {
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
    state.RGB = { red:r, green:g, blue: b};
    state.whiteValues= { coldWhite:cw, warmWhite:ww};
    state.operatingMode = CommonClass.parseOperatingMode(mask);

    return;
  }

  /*
        Update H,S,B based on RBGWW
  */
  static convertRGBWWtoHSB_CCT(state:ILightState, props:IConvProps ):void{
    if(state.operatingMode === opMode.temperatureMode){

  
      state.colorTemperature = convertWhitesToColorTemperature(state.whiteValues);
      state.brightness = estimateBrightnessFromWhites(state.whiteValues);
      const r = ColorUtils.colorTemperatureToHueAndSaturation(state.colorTemperature);

      // since we're in color temperature mode, all we need is to respond with mired
      // state.HSL = {hue:0, saturation:0, luminance:0};
      // state.HSL = {hue:null, saturation:null, luminance:null};
      state.HSL = {hue:r.hue, saturation:r.saturation, luminance:0}; // TODO: must fix this
      return;
    }
    // determine if we're if white mode, e.g. r:0 g:0 b:0 cw:0 ww:255
    const zeroRGB = state.RGB.red === 0 && state.RGB.green === 0 && state.RGB.blue === 0;
    const hasSomeWhite = state.whiteValues.coldWhite > 0 || state.whiteValues.warmWhite > 0;

    if( zeroRGB && hasSomeWhite){
      if(state.whiteValues.coldWhite > state.whiteValues.warmWhite){
        state.HSL = { hue: 220, saturation: 18 , luminance:0};
      } else {
        state.HSL = { hue: 30, saturation: 70 , luminance:0};
      }
      state.brightness = 100;
      return;
    }

    state.colorTemperature = 0;
    state.HSL = convertRGBtoHSL(state.RGB);
    const {hue: _hue, saturation: _saturation, brightness:_brightness} = this.estimateBrightness(state, props);
    state.brightness = _brightness;
    state.HSL.hue = _hue;
    state.HSL.saturation = _saturation;

  }

  /*
        Update H,S,B based on RBGWW
  */
  static convertRGBWWtoHSB(state:ILightState, props:IConvProps ):void{

    // determine if we're if white mode, e.g. r:0 g:0 b:0 cw:0 ww:255
    const zeroRGB = state.RGB.red === 0 && state.RGB.green === 0 && state.RGB.blue === 0;
    const hasSomeWhite = state.whiteValues.coldWhite > 0 || state.whiteValues.warmWhite > 0;
    const hasSomeRGB = state.RGB.red > 0 || state.RGB.green > 0 || state.RGB.blue > 0;

    if( zeroRGB && hasSomeWhite){
      // TODO: improve mapping of cw/ww to HSB
      // if H and S are user inputs, and we must watch to not corrupt them.
      if(state.whiteValues.coldWhite > state.whiteValues.warmWhite){
        state.HSL = { hue: 220, saturation: 18 , luminance:0};
      } else {
        state.HSL = { hue: 0, saturation: 0 , luminance:50};
      }
      state.brightness = 100;
      state.colorTemperature = null;
      return;
    }
    if( hasSomeRGB && hasSomeWhite ){
      throw new Error('Combined RGB and White brightness not implemented');
    }
    
    state.HSL = convertRGBtoHSL(state.RGB);
    const mired = convertWhitesToColorTemperature(state.whiteValues);
    state.colorTemperature = null;
    const rgb_2 = convertHSLtoRGB(state.HSL);
    // const {hue: _hue, saturation: _saturation, brightness:_brightness} = this.estimateBrightnessFromRGB(state, props);
    state.brightness = state.HSL.luminance * 2;

    return;
  }   

  // input: h,s,b 
  static estimateBrightness(lightState:ILightState, props:IConvProps):any {
    const { colorWhiteThreshold } = props?.config?.whiteEffects;
    let { hue, saturation } = lightState.HSL;
    const { luminance } = lightState.HSL;
    let brightness = 0;
    const { isOn } = lightState;
    const { coldWhite, warmWhite } = lightState.whiteValues;

    if(luminance > 0 && isOn){
      brightness = luminance * 2;
    } else if (isOn){
      brightness = clamp(((coldWhite/2.55) + (warmWhite/2.55)), 0, 100);
      if(warmWhite>coldWhite){
        saturation = colorWhiteThreshold - (colorWhiteThreshold * (coldWhite/255));
        hue = 0.0;
      } else {
        saturation = colorWhiteThreshold - (colorWhiteThreshold * (warmWhite/255));
        hue = 180.0;
      }
    }
    brightness = Math.round(brightness);
    return { hue, saturation, brightness};
  }

  /**
   ** @calculateWhiteColor
   *  determine warmWhite/coldWhite values from hue
   *  the closer to 0/360 the weaker coldWhite brightness becomes
   *  the closer to 180 the weaker warmWhite brightness becomes
   *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
   */
  static hueToWhiteTemperature(lightState:ILightState) {
    const hsl = lightState.HSL;
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
  }

  
  static parseOperatingMode(opModeCode: number): opMode{
    if(opModeCode === 0xF0){
      return opMode.redBlueGreenMode;
    } else if( opModeCode === 0x0F){
      return opMode.temperatureMode;
    } else if ( opModeCode === 0xFF){
      return opMode.simultaneous;
    } else {
      return opMode.unknown;
    }
  }
  
  static getMaskFromOpMode(opModeCode:opMode):number{
    if(opModeCode === opMode.redBlueGreenMode){
      return 0xF0;
    } else if( opModeCode === opMode.temperatureMode ){
      return 0x0F;
    } else if ( opModeCode === opMode.simultaneous ){
      return 0xFF;
    } else {
      return 0xFF;
    }
  }

  static flattenLightState(lightState:ILightState):any{
    const { red:r, green:g, blue:b } = lightState.RGB;
    const { coldWhite:cw, warmWhite:ww } = lightState.whiteValues;
    const mask = this.getMaskFromOpMode(lightState.operatingMode);
    return { r, g, b, cw, ww, mask};
  }

}



