// // import { IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
// // import { IAccessoryCommand, IAccessoryState } from '../misc/types';
// // import { convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT, clamp, convertMiredColorTemperatureToHueSat, whiteTemperatureToCCT } from '../misc/utils';
// // import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';


// export class RGBWStrip extends HomebridgeMagichomeDynamicPlatformAccessory {

//   // protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

//   //   const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
//   //   const { hue, saturation } = HSL;
//   //   const RGB: IColorRGB = convertHSLtoRGB({ hue, saturation, luminance: brightness });
//   //   let { red, green, blue } = RGB, warmWhite;

//   //   let colorMask = 0xFF;

//   //   warmWhite = Math.round(2.55 * brightness);

//   //   if (hue == 31 && saturation == 33) {

//   //     red = 0;
//   //     green = 0;
//   //     blue = 0;
//   //     colorMask = 0x0F;

//   //   } else if (saturation < this.colorOffSaturationLevel) {
//   //     red = 0;
//   //     green = 0;
//   //     blue = 0;

//   //     /**
//   //      * else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
//   //      * set RGB to 100% saturation and 100% brightness
//   //      * this allows brightness to only affect the white colors, creating beautiful white+color balance
//   //      * we've set the color saturation to 100% because the higher the white level the more washed out the colors become
//   //      * the white brightness effectively acts as the saturation value
//   //      */

//   //   } else if (saturation < this.colorWhiteSimultaniousSaturationLevel) {

//   //     const _RGB = convertHSLtoRGB({ hue, saturation: 100 }); //re-generate rgb with full saturation
//   //     red = _RGB.red;
//   //     green = _RGB.green;
//   //     blue = _RGB.blue;

//   //     red = Math.round((red / 100) * (saturation * 2));
//   //     green = Math.round((green / 100) * (saturation * 2));
//   //     blue = Math.round((blue / 100) * (saturation * 2));

//   //   } else {
//   //     warmWhite = 0;
//   //   }

//   //   const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, CCT: { warmWhite, coldWhite: 0 }, colorMask };
//   //   return deviceCommand;
//   // }

//   // deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

//   //   const { RGB, CCT: { coldWhite, warmWhite }, isOn } = deviceState;
//   //   // eslint-disable-next-line prefer-const
//   //   let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
//   //   let brightness = 0;
//   //   let colorTemperature = 140;
//   //   if (luminance > 0 && isOn) {
//   //     brightness = luminance;
//   //     if (coldWhite > 0 || warmWhite > 0) {
//   //       saturation = 25;
//   //       brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
//   //     }
//   //   } else {
//   //     if (isOn) {
//   //       brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
//   //     }
//   //     colorTemperature = whiteTemperatureToCCT({ warmWhite, coldWhite });
//   //     const hueSat = convertMiredColorTemperatureToHueSat(colorTemperature);
//   //     hue = hueSat[0];
//   //     saturation = 10;

//   //   }

//   //   const accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
//   //   return accessoryState;
//   // }
// }