// import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
// import { IAccessoryCommand, IAccessoryState } from '../misc/types';
// import { convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT, cctToWhiteTemperature, clamp, whiteTemperatureToCCT, convertMiredColorTemperatureToHueSat } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

// export class RGBWWStrip extends HomebridgeMagichomeDynamicPlatformAccessory {

//   protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

//     const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;

//     const { hue, saturation } = HSL;
//     const RGB: IColorRGB = convertHSLtoRGB({ hue, saturation, luminance: brightness });

//     // let _CCT: IColorCCT;
//     // if (this.ColorCommandMode == 'HSL') {
//     const _CCT = convertHueToColorCCT(HSL.hue); //calculate the white colors as a function of hue and saturation. See "convertHueToColorCCT()"
//     // } else {
//     //   _CCT = cctToWhiteTemperature(colorTemperature);
//     // }
//     let { red, green, blue } = RGB, { warmWhite, coldWhite } = _CCT;
//     let colorMask = 0xFF;

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
//     } else if (saturation <= 2) {

//       red = 0;
//       green = 0;
//       blue = 0;

//       //else if saturation is less than config set "colorWhiteThreshold" AND above "colorOffThreshold"
//       //set RGB to 100% saturation and 100% brightness
//       //this allows brightness to only affect the white colors, creating beautiful white+color balance
//       //we've set the color saturation to 100% because the higher the white level the more washed out the colors become
//       //the white brightness effectively acts as the saturation value
//     } else if (saturation <= 50) {

//       const _RGB = convertHSLtoRGB({ hue, saturation: 100 }); //re-generate rgb with full saturation
//       red = _RGB.red;
//       green = _RGB.green;
//       blue = _RGB.blue;

//       red = Math.round((red / 100) * (saturation * 2));
//       green = Math.round((green / 100) * (saturation * 2));
//       blue = Math.round((blue / 100) * (saturation * 2));


//       //else saturation is greater than "colorWhiteThreshold" so we set ww and cw to 0 and only display the color LEDs
//     } else {
//       warmWhite = 0;
//       coldWhite = 0;
//     }

//     const deviceCommand: IDeviceCommand = { isOn, RGB: { red, green, blue }, CCT: { warmWhite, coldWhite }, colorMask };
//     return deviceCommand;
//   }//setColor

//   deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

//     const { RGB, RGB: { red, green, blue }, CCT: { coldWhite, warmWhite }, isOn } = deviceState;

//     // eslint-disable-next-line prefer-const
//     let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
//     let brightness = 0;
//     let colorTemperature = 140;

//     //Brightness
//     if (isOn) {
//       if (coldWhite == 0 && warmWhite == 0) {
//         brightness = luminance;
//       } else {
//         brightness = clamp((Math.max(coldWhite / 2.55), (warmWhite / 2.55)), 0, 100);
//       }
//     }
//     //Hue && Saturation
//     if (coldWhite > 0 || warmWhite > 0) {
//       saturation = luminance;
//       colorTemperature = whiteTemperatureToCCT({ warmWhite, coldWhite });
//       if (saturation <= 2) {
//         const hueSat = convertMiredColorTemperatureToHueSat(colorTemperature);
//         hue = hueSat[0];
//         saturation = 10;
//       }
//     }

//     const accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
//     return accessoryState;
//   }
// }


