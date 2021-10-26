import { IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform/dist/types';
import { IAccessoryCommand, IAccessoryState } from '../misc/types';
import { clamp, convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT } from '../misc/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
    const {hue, saturation} = HSL;
    const RGB:IColorRGB = convertHSLtoRGB(HSL);
    
    let {red, green, blue} = RGB;
    let warmWhite;
    let colorMask = 0xF0;

    

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    red = Math.round((red / 100) * brightness);
    green = Math.round((green / 100) * brightness);
    blue = Math.round((blue / 100) * brightness);
    warmWhite = Math.round(2.55 * brightness);

    if (hue == 31 && saturation == 33) {

      red = 0;
      green = 0;
      blue = 0;
      colorMask = 0x0F;

    } else if (saturation < 20) {

      red = 0;
      green = 0;
      blue = 0;
      colorMask = 0x0F;

    } else {
      warmWhite = 0;
    }

    const deviceCommand: IDeviceCommand = { isOn, RGB:{red, green, blue}, CCT: {warmWhite}, colorMask};
    return deviceCommand;
    
  }//setColor
  
  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LEDState: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
    // eslint-disable-next-line prefer-const
    let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
    let brightness = 0;

    if (luminance > 0 && isOn) {
      brightness = luminance;
    } else if (isOn) {
      brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
      if (warmWhite > coldWhite) {
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (coldWhite / 255));
      } else {
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (warmWhite / 255));
      }
    }

    const accessoryState: IAccessoryState = { HSL: {hue, saturation, luminance}, isOn, colorTemperature: 140, brightness };
    return accessoryState;
  }
    
}