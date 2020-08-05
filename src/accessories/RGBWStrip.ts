import { clamp, convertHSLtoRGB, convertRGBtoHSL } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../PlatformAccessory';

export class RGBWStrip extends HomebridgeMagichomeDynamicPlatformAccessory {

    
  async setColor() {

    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    let [red, green, blue] = convertHSLtoRGB([hsl.Hue, hsl.Saturation, hsl.Luminance]); //convert HSL to RGB
    const brightness = this.lightState.Brightness;
    
    this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.Hue, hsl.Saturation, hsl.Luminance, brightness);
    this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
    const mask = 0xFF; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = 0;
    



    //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
    if ((hsl.Hue == 31 && hsl.Saturation == 33) || (hsl.Hue == 208 && hsl.Saturation == 17) || (hsl.Hue == 0 && hsl.Saturation == 0) || (hsl.Saturation < this.colorOffThresholdSimultaniousDevices) ) {
      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
  
      this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);

      //else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
      //set RGB to 100% saturation and 100% brightness
      //this allows brightness to only affect the white colors, creating beautiful white+color balance
      //we've set the color saturation to 100% because the higher the white level the more washed out the colors become
      //the white brightness effectively acts as the saturation value
    } else if (hsl.Saturation < this.colorWhiteThresholdSimultaniousDevices && this.simultaniousDevicesColorWhite) {
      [red, green, blue] = convertHSLtoRGB([hsl.Hue, 100, hsl.Luminance]); //re-generate rgb with full saturation
      r = red;
      g = green;
      b = blue;
      ww = Math.round((255 / 100) * brightness);

      this.platform.log.debug('Setting fully saturated color mixed with white: r:%o g:%o b:%o ww:%o', r, g, b, ww);

      //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
    } else {
      ww = 0;
      this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
    }

    this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()

    
  }//setColor
    
  async getState() {

    try {


      const state = await this.transport.getState(1000); //retrieve a state object from transport class showing light's current r,g,b,ww,cw, etc

      const { red, green, blue } = state.color; //create local constant for red, green, blue
      const [hue, saturation, luminance] = convertRGBtoHSL(red, green, blue);  //convert retrieved RGB values to hsl as homehit only uses hsl
      const isOn = state.isOn;
      const warmWhite = state.warmWhite;

      this.lightState.On = state.isOn;
      this.lightState.HSL.Hue = hue;
      this.lightState.HSL.Saturation = saturation;

      this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation, saturation);
      if(luminance > 0 && state.isOn){
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, luminance * 2);
      } else if (state.isOn){
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp((warmWhite/2.55), 0, 100));
      }

      this.accessory.context.lastKnownState = state;

      this.platform.log.debug('\nGetting state for Accessory: %o -- Type: %o \nOn: %o \nR: %o, G: %o, B: %o, WW: %o\nHue: %o \nSaturation: %o \nBrightness: %o \nBuffer Data: %o \n',  
        this.accessory.context.displayName,
        this.accessory.context.controllerName,
        state.isOn,
        red,
        green,
        blue,
        state.warmWhite,
        hue, 
        saturation, 
        luminance *2,
        state.debugBuffer);


    } catch (error) {
      this.platform.log.error('getState() error: ', error);
    }
  }
}