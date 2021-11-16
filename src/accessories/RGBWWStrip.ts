import { clamp, convertHSLtoRGB, convertRGBtoHSL } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBWWStrip extends HomebridgeMagichomeDynamicPlatformAccessory {

  async updateDeviceState() {

    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    let [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const whites = this.hueToWhiteTemperature(); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
    const brightness = this.lightState.brightness;

    //this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    //  this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);

    let mask = 0xFF;

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
    let cw = Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));


    if (hsl.hue == 31 && hsl.saturation == 33) {

      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      cw = 0;
      mask = 0x0F;
      //  this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);

    } else if (hsl.hue == 208 && hsl.saturation == 17) {
      r = 0;
      g = 0;
      b = 0;
      ww = 0;
      cw = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if (hsl.saturation < this.colorOffThresholdSimultaniousDevices) {
      // this.platform.log.debug('Turning off color');
      r = 0;
      g = 0;
      b = 0;
      //  this.platform.log.debug('Setting only white: ww:%o cw:%o', ww, cw);

      //else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
      //set RGB to 100% saturation and 100% brightness
      //this allows brightness to only affect the white colors, creating beautiful white+color balance
      //we've set the color saturation to 100% because the higher the white level the more washed out the colors become
      //the white brightness effectively acts as the saturation value
    } else if (hsl.saturation < this.colorWhiteThresholdSimultaniousDevices && this.simultaniousDevicesColorWhite) {

      [red, green, blue] = convertHSLtoRGB({ hue: hsl.hue, saturation: 100, luminance: hsl.luminance }); //re-generate rgb with full saturation
      r = red;
      g = green;
      b = blue;
      // this.platform.log.debug('Setting fully saturated color mixed with white: r:%o g:%o b:%o ww:%o cw:%o', r, g, b, ww, cw);

      //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
    } else {
      ww = 0;
      cw = 0;
      // this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
    }

    await this.send([0x31, r, g, b, ww, cw, mask, 0x0F]); //9th byte checksum calculated later in send()

  }//setColor

  async updateHomekitState() {
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightState.HSL.saturation);
    if (this.lightState.HSL.luminance > 0 && this.lightState.isOn) {
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightState.HSL.luminance * 2);
    } else if (this.lightState.isOn) {
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, clamp(((this.lightState.whiteValues.coldWhite / 2.55) + (this.lightState.whiteValues.warmWhite / 2.55)), 0, 100));
      if (this.lightState.whiteValues.warmWhite > this.lightState.whiteValues.coldWhite) {
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.colorWhiteThreshold - (this.colorWhiteThreshold * (this.lightState.whiteValues.coldWhite / 255)));
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, 0);
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.colorWhiteThreshold - (this.colorWhiteThreshold * (this.lightState.whiteValues.warmWhite / 255)));
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, 180);
      }
    }
  }

}