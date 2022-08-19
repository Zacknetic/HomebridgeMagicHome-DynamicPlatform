// import { IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
// import { IAccessoryCommand, IAccessoryState } from '../misc/types';
// import { clamp, convertHueToColorCCT, whiteTemperatureToCCT } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

// export class RGBWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {

//   // protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

//   //   const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
//   //   const { hue, saturation } = HSL;
//   //   const RGB: IColorRGB = convertHSLtoRGB({ hue, saturation, luminance: brightness });

//   //   let { red, green, blue } = RGB;
//   //   let warmWhite;
//   //   let colorMask = 0xF0;



//   //   //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
//   //   //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
//   //   // red = Math.round((red / 100) * brightness);
//   //   // green = Math.round((green / 100) * brightness);
//   //   // blue = Math.round((blue / 100) * brightness);
//   //   warmWhite = Math.round(2.55 * brightness);

//   //   if (hue == 31 && saturation == 33) {

//   //     red = 0;
//   //     green = 0;
//   //     blue = 0;
//   //     colorMask = 0x0F;

//   //   } else if (saturation < 20) {

//   //     red = 0;
//   //     green = 0;
//   //     blue = 0;
//   //     colorMask = 0x0F;

//   //   } else {
//   //     warmWhite = 0;
//   //   }

//   //   const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, CCT: { warmWhite, coldWhite: 0 }, colorMask };
//   //   return deviceCommand;

//   // }//setColor

//   // deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

//   //   const  { RGB, CCT: { coldWhite, warmWhite }, isOn }  = deviceState;
//   //   // eslint-disable-next-line prefer-const
//   //   let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
//   //   let brightness = 0;
//   //   let colorTemperature = 140;
//   //   if (luminance > 0 && isOn) {
//   //     brightness = luminance;
//   //   } else if (isOn) {
//   //     brightness = clamp(warmWhite / 2.55, 0, 100);
//   //   }

//   //   if (warmWhite > 0) {
//   //     saturation = luminance;
//   //     colorTemperature = whiteTemperatureToCCT({ warmWhite, coldWhite: 0 });
//   //     if (saturation <= 2) {
//   //       const hueSat = convertMiredColorTemperatureToHueSat(colorTemperature);
//   //       hue = hueSat[0];
//   //       saturation = 10;
//   //     }
//   //   }

//   //   const accessoryState: IAccessoryState = { HSL: { hue, saturation, luminance }, isOn, colorTemperature: 140, brightness };
//   //   return accessoryState;
// //   }

// }