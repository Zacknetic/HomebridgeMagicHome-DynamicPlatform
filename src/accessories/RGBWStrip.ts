import { RGBStrip } from './RGBStrip';
import { clamp, convertHSLtoRGB, convertRGBtoHSL } from '../magichome-interface/utils';

export class RGBWStrip extends RGBStrip {
    private colorWhiteThreshold = this.config.whiteEffects.colorWhiteThreshold;
    private colorWhiteThresholdSimultaniousDevices = this.config.whiteEffects.colorWhiteThresholdSimultaniousDevices;
    private colorOffThresholdSimultaniousDevices = this.config.whiteEffects.colorOffThresholdSimultaniousDevices;
    private simultaniousDevicesColorWhite = this.config.whiteEffects.simultaniousDevicesColorWhite;

    /**
   ** @calculateWhiteColor
   *  determine warmWhite/coldWhite values from hue
   *  the closer to 0/360 the weaker coldWhite brightness becomes
   *  the closer to 180 the weaker warmWhite brightness becomes
   *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
   *  @returns whites object
   */
  
    calculateWhiteColor() {
      const hsl = this.lightState.HSL;
      let multiplier = 0;
      const whites = { warmWhite: 0, coldWhite: 0 };
    
    
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
    }
    
    async setColor() {


      //**** local variables ****\\
      const hsl = this.lightState.HSL;
      let [red, green, blue] = convertHSLtoRGB([hsl.Hue, hsl.Saturation, hsl.Luminance]); //convert HSL to RGB
      const whites = this.calculateWhiteColor(); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
      const brightness = this.lightState.Brightness;
    
      this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.Hue, hsl.Saturation, hsl.Luminance, brightness);
      this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
      let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
      //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
      //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
      //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
      let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
      let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
      let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
      let ww = Math.round(((clamp(whites.warmWhite, 0, 255) / 100) * brightness));
      let cw = Math.round(((clamp(whites.coldWhite, 0, 255) / 100) * brightness));
    
      //****logic switch for light types****\\
    
      //different light types need different different logic as they all have different capablilities
      //(FINISHED)(todo) add rgb-only case for users with rgb only light strips. Will need to know light version number (FINISHED)
      switch (this.accessory.context.lightVersion) {
    
        case 11: //rgb REVERSED... needs the order of red and green switched
          this.send([0x31, g, r, b, 0x00, mask, 0x0F]); //8th byte checksum calculated later in send()
          break;
    
        case 4: //rgb NORMAL
          this.send([0x31, r, g, b, 0x00, mask, 0x0F]); //8th byte checksum calculated later in send()
          break;
    
          //light versions 8 and 9 have rgb and warmWhite capabilities
        case 9: //rgbw
        case 8: //rgbw
    
          //if saturation is below config set threshold or if user asks for warm white / cold white  
          //set all other values besides warmWhite to 0 and set the mask to white (0x0F)
    
          if ((hsl.Saturation < this.colorWhiteThreshold) 
            || (hsl.Hue == 31 && hsl.Saturation == 33) 
            || (hsl.Hue == 208 && hsl.Saturation == 17) 
            || (hsl.Hue == 0 && hsl.Saturation == 0)) {
    
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
          this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
          break;
    
    
          //light versions 7 and 5 have rgb, warmWhite and coldWhite capabilities.
          //only color OR white can be enabled at one time (no 0xFF mask). However, both whites can turn on simultaniously
        case 7: //rgbww color/white non-simultanious
        case 5: //rgbww color/white non-simultanious
    
          if (hsl.Hue == 31 && hsl.Saturation == 33) {
            r = 0;
            g = 0;
            b = 0;
            ww = Math.round((255 / 100) * brightness);
            cw = 0;
            mask = 0x0F;
            this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
          } else if (hsl.Hue == 208 && hsl.Saturation == 17) {
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
          this.send([0x31, r, g, b, ww, cw, mask, 0x0F]); //9th byte checksum calculated later in send()
          break;
    
          //light version 3 has rgb, warmWhite and coldWhite capabilities.
          //both color AND white can be enabled simultaniously (0xFF mask is possible). Both whites can turn on simultaniously as well.
        case 3:  //rgbww simultanious color/white capable compact strip
        case 2:  //rgbww simultanious color/white capable wide strip
          //set mask to both color/white (0xFF) so we can control both color and white simultaniously,
          mask = 0xFF;
    
    
          if (hsl.Hue == 31 && hsl.Saturation == 33) {
    
            r = 0;
            g = 0;
            b = 0;
            ww = Math.round((255 / 100) * brightness);
            cw = 0;
            mask = 0x0F;
            this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    
          } else if (hsl.Hue == 208 && hsl.Saturation == 17) {
            r = 0;
            g = 0;
            b = 0;
            ww = 0;
            cw = Math.round((255 / 100) * brightness);
            mask = 0x0F;
            this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);
    
            //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
            //White colors were already calculated above
          } else if (hsl.Saturation < this.colorOffThresholdSimultaniousDevices) {
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
          } else if (hsl.Saturation < this.colorWhiteThresholdSimultaniousDevices && this.simultaniousDevicesColorWhite) {
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
    
          this.send([0x31, r, g, b, ww, cw, mask, 0x0F]); //9th byte checksum calculated later in send()
          break;
    
          //light version 10 has rgb and warmWhite capabilities.
          //both color AND white can be enabled simultaniously (0xFF mask is possible).
        case 10:  //rgbw simultanious color/white capable
    
          //set mask to both color/white (0xFF) so we can control both color and white simultaniously,
          mask = 0xFF;
    
          //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
          if ((hsl.Hue == 31 && hsl.Saturation == 33) || (hsl.Hue == 208 && hsl.Saturation == 17) || (hsl.Hue == 0 && hsl.Saturation == 0) || (hsl.Saturation < this.colorOffThresholdSimultaniousDevices) ) {
            r = 0;
            g = 0;
            b = 0;
            ww = Math.round((255 / 100) * brightness);
            cw = 0;
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
            cw = 0;
            this.platform.log.debug('Setting fully saturated color mixed with white: r:%o g:%o b:%o ww:%o', r, g, b, ww);
    
            //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
          } else {
            ww = 0;
            cw = 0;
            this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
          }
    
          this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
          break;
    
          //warn user if we encounter an unknown light type
        default:
          this.platform.log.warn('Uknown light version: %o... color probably cannot be set. Trying anyway...', this.accessory.context.lightVersion);
          this.send([0x31, r, g, b, 0x00, mask, 0x0F]); //8th byte checksum calculated later in send()
          this.platform.log.warn('Please create an issue at https://github.com/Zacknetic/HomebridgeMagicHome-DynamicPlatform/issues and post your log.txt');
          break;
    
    
      }
    
    }//setColor
    
    
}