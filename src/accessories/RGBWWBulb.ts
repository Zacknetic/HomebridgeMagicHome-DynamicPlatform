import { clamp, convertHSLtoRGB, convertRGBtoHSL } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBWWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  async updateDeviceState(_timeout = 200) {

    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const whites = this.cctToWhiteTemperature(); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = this.lightState.brightness;
    
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

    // If the user is controlling the colorTemp slider in homekit, set the CT leds to turn on.
    if (this.setColortemp) {
      r = 0;
      g = 0;
      b = 0;
      mask = 0x0F;
    } else { // If the user is controlling the HSB slider in homekit, set the RGB leds to turn on.
      cw = 0;
      ww = 0;
      mask = 0xF0;
    }

    await this.send([0x31, r, g, b, ww, cw, mask, 0x0F], true, _timeout); //9th byte checksum calculated later in send()
  }


  async updateHomekitState() {
    /*
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation,  this.lightState.HSL.saturation);
    if(this.lightState.HSL.luminance > 0 && this.lightState.isOn){
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightState.HSL.luminance * 2);
    } else if (this.lightState.isOn){
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp(((this.lightState.whiteValues.coldWhite/2.55) + (this.lightState.whiteValues.warmWhite/2.55)), 0, 100));
      if(this.lightState.whiteValues.warmWhite>this.lightState.whiteValues.coldWhite){
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.colorWhiteThreshold - (this.colorWhiteThreshold * (this.lightState.whiteValues.coldWhite/255)));
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, 0);
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.colorWhiteThreshold - (this.colorWhiteThreshold * (this.lightState.whiteValues.warmWhite/255)));
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, 180);
      }
    }
    this.cacheCurrentLightState();
    */
  }
    
}