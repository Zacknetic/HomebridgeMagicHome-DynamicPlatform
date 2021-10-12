import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform/dist/types';
import { IAccessoryCommand, IAccessoryState } from '../misc/types';
import { convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT, cctToWhiteTemperature, clamp, whiteTemperatureToCCT } from '../misc/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBWWStrip extends HomebridgeMagichomeDynamicPlatformAccessory {

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
    const { hue, saturation } = HSL;
    const RGB: IColorRGB = convertHSLtoRGB(HSL);
    // let _CCT: IColorCCT;
    // if (this.ColorCommandMode == 'HSL') {
      const _CCT = convertHueToColorCCT(HSL.hue); //calculate the white colors as a function of hue and saturation. See "convertHueToColorCCT()"
    // } else {
    //   _CCT = cctToWhiteTemperature(colorTemperature);
    // }
    let { red, green, blue } = RGB, { warmWhite, coldWhite } = _CCT;

    //this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    //  this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);

    let colorMask = 0xFF;

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    red = Math.round((red / 100) * brightness);
    green = Math.round((green / 100) * brightness);
    blue = Math.round((blue / 100) * brightness);

    warmWhite = Math.round((warmWhite / 100) * brightness);
    coldWhite = Math.round((coldWhite / 100) * brightness);

    if (hue == 31 && saturation == 33) {

      red = 0;
      green = 0;
      blue = 0;
      coldWhite = 0;
      colorMask = 0x0F;
      //  this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);

    } else if (hue == 208 && saturation == 17) {
      red = 0;
      green = 0;
      blue = 0;
      warmWhite = 0;
      colorMask = 0x0F;
      // this.platform.log.debug('Setting coldWhite only without colors or warmWhite: cw:%o', cw);

      //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
      //White colors were already calculated above
    } else if (saturation < 50) {
      // this.platform.log.debug('Turning off color');
      red = 0;
      green = 0;
      blue = 0;
      //  this.platform.log.debug('Setting only white: ww:%o cw:%o', ww, cw);

      //else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
      //set RGB to 100% saturation and 100% brightness
      //this allows brightness to only affect the white colors, creating beautiful white+color balance
      //we've set the color saturation to 100% because the higher the white level the more washed out the colors become
      //the white brightness effectively acts as the saturation value
    } else if (saturation < 70) {

      const _RGB = convertHSLtoRGB({ hue, saturation: 100 }); //re-generate rgb with full saturation
      red = _RGB.red;
      green = _RGB.green;
      blue = _RGB.blue;

      // this.platform.log.debug('Setting fully saturated color mixed with white: r:%o g:%o b:%o ww:%o cw:%o', r, g, b, ww, cw);

      //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
    } else {
      warmWhite = 0;
      coldWhite = 0;
      // this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
    }

    const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, CCT: { warmWhite, coldWhite }, colorMask };
    return deviceCommand;
  }//setColor

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LED: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
    // eslint-disable-next-line prefer-const
    let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
    let brightness = 0;
    let colorTemperature = 140;
    if (luminance > 0 && isOn) {
      brightness = luminance;
    } else if (isOn) {
      colorTemperature = whiteTemperatureToCCT({warmWhite, coldWhite});
      brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
      if (warmWhite > coldWhite) {
        saturation = this.colorWhiteThreshold - (this.colorWhiteThreshold * (coldWhite / 255));
      } else {
        saturation = this.colorWhiteThreshold - (this.colorWhiteThreshold * (warmWhite / 255));
      }
    }

    

    const accessoryState = { HSL: { hue, saturation, luminance }, colorTemperature, isOn, brightness };

    return accessoryState;
  }

  updateHomekitState() {
    this.service.updateCharacteristic(this.hap.Characteristic.On, this.accessoryState.isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, this.accessoryState.HSL.hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessoryState.HSL.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, this.accessoryState.brightness);
  }

}


// deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

//   const { LED: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
//   // eslint-disable-next-line prefer-const
//   let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
//   let brightness = 0;
//   //let colorTemperature = 140;
//   if (luminance > 0 && isOn) {
//     brightness = luminance;
//    }else {
//     // if(isOn){
//       brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
//     // }
//   //   colorTemperature = whiteTemperatureToCCT({warmWhite, coldWhite});
//   //   const hueSat = convertMiredColorTemperatureToHueSat(colorTemperature);
//   //   hue = hueSat[0];
//   //   saturation = 10;

//    }

//   const accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
//   return accessoryState;
// }