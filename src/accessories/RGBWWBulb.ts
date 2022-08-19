// import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
// import { IAccessoryCommand, IAccessoryState } from '../misc/types';
// import { clamp, convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT, cctToWhiteTemperature, whiteTemperatureToCCT, convertMiredColorTemperatureToHueSat } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

// export class RGBWWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {

//   protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

//     const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
//     const { hue, saturation } = HSL;
    
//     const RGB: IColorRGB = convertHSLtoRGB({ hue, saturation, luminance: brightness });
//     // let _CCT: IColorCCT;
//     // if (this.ColorCommandMode == 'HSL') {
//     const _CCT: IColorCCT = convertHueToColorCCT(HSL.hue); //calculate the white colors as a function of hue and saturation. See "calculateWhiteColor()"
//     // } else {
//     //   _CCT = cctToWhiteTemperature(colorTemperature);
//     // }
//     let { red, green, blue } = RGB, { warmWhite, coldWhite } = _CCT;

//     let colorMask = 0xF0;



//     //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
//     //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
//     red = Math.round((red / 100) * brightness);
//     green = Math.round((green / 100) * brightness);
//     blue = Math.round((blue / 100) * brightness);
//     warmWhite = Math.round((warmWhite / 100) * brightness);
//     coldWhite = Math.round((coldWhite / 100) * brightness);


//     if (hue == 31 && saturation == 33) {

//       red = 0;
//       green = 0;
//       blue = 0;
//       coldWhite = 0;
//       colorMask = 0x0F;
//     } else if (hue == 208 && saturation == 17) {

//       red = 0;
//       green = 0;
//       blue = 0;
//       warmWhite = 0;
//       colorMask = 0x0F;

//       //if saturation is below config set threshold, set rgb to 0 and set the mask to white (0x0F). 
//       //White colors were already calculated above
//     } else if (saturation < 20) {

//       red = 0;
//       green = 0;
//       blue = 0;

//       colorMask = 0x0F;
//     } else {
//       warmWhite = 0;
//       coldWhite = 0;
//     }

//     const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, CCT: { warmWhite, coldWhite }, colorMask };
//     return deviceCommand;

//   }//setColor

//   deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {
//     const  { RGB, CCT: { coldWhite, warmWhite }, isOn }  = deviceState;
//     // eslint-disable-next-line prefer-const
//     let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
//     let brightness = 0;
//     let colorTemperature = 140;
//     if (luminance > 0 && isOn) {
//       brightness = luminance;
//       if (coldWhite > 0 || warmWhite > 0) {
//         saturation = 25;
//         brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
//       }
//     } else {
//       if (isOn) {
//         brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
//       }
//       colorTemperature = whiteTemperatureToCCT({ warmWhite, coldWhite: 0 });
//       const hueSat = convertMiredColorTemperatureToHueSat(colorTemperature);
//       hue = hueSat[0];
//       saturation = 10;

//     }
//     const accessoryState: IAccessoryState = { HSL: { hue, saturation, luminance }, isOn, colorTemperature: 140, brightness };
//     return accessoryState;
//   }

// }