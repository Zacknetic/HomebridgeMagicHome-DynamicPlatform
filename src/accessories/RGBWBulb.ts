import { IColorRGB, IDeviceCommand } from 'magichome-platform/dist/types';
import { IAccessoryCommand } from '../magichome-interface/types';
import { clamp, convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
    const {hue, saturation} = HSL;
    const RGB:IColorRGB = convertHSLtoRGB(HSL);

    let {red, green, blue} = RGB, warmWhite;

    //this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    //  this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);

    let colorMask = 0xF0;

    

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    red = Math.round((red / 100) * brightness);
    green = Math.round((green / 100) * brightness);
    blue = Math.round((blue / 100) * brightness);
    warmWhite = Math.round(2.5 * brightness);

    if (hue == 31 && saturation == 33) {

      red = 0;
      green = 0;
      blue = 0;
      colorMask = 0x0F;
      //  this.platform.log.debug('Setting warmWhite only without colors or coldWhite: ww:%o', ww);
    } else if (saturation < 20) {
      // this.platform.log.debug('Turning off color');
      red = 0;
      green = 0;
      blue = 0;

      colorMask = 0x0F;
      // this.platform.log.debug('Setting warmWhite and coldWhite without colors: ww:%o cw:%o', ww, cw);
    } else {
      warmWhite = 0;
      // this.platform.log.debug('Setting colors without white: r:%o g:%o b:%o', r, g, b);
    }

    const deviceCommand: IDeviceCommand = { isOn, RGB:{red, green, blue}, CCT: {warmWhite}, colorMask};
    return deviceCommand;
    
  }//setColor
  
//   async updateHomekitState(){
//     // this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
//     // this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
//     // this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightState.HSL.saturation);
//     // if(this.lightState.HSL.luminance > 0 && this.lightState.isOn){
//     //   this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightState.HSL.luminance * 2);
//     // } else if (this.lightState.isOn){
//     //   this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp((this.lightState.whiteValues.warmWhite/2.55), 0, 100));
//     // }
//   // }
    
}