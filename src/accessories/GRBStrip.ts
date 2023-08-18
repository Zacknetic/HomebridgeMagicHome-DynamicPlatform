// import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
// import { IAccessoryCommand, IAccessoryState } from '../misc/types';
// import { convertHueToColorCCT, cctToWhiteTemperature, clamp, whiteTemperatureToCCT, HSVtoRGB, RGBtoHSV } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';



// export class GRBStrip extends HomebridgeMagichomeDynamicPlatformAccessory {


//   protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

//     const { isOn, HSV, colorTemperature, brightness } = accessoryCommand;
//     const { hue, saturation, value } = HSV;
//     const { red, green, blue }: IColorRGB = HSVtoRGB(HSV);


//     //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
//     //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
//     const _green = Math.round((red / 100) * brightness);
//     const _red = Math.round((green / 100) * brightness);
//     const _blue = Math.round((blue / 100) * brightness);


//     const deviceCommand: IDeviceCommand = { isOn, RGB: { red: _red, green: _green, blue: _blue }, CCT: { warmWhite: 0, coldWhite: 0 }, colorMask: 0xF0 };
//     return deviceCommand;
//   }//setColor

//   deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

//     const { RGB: { red, green, blue }, isOn } = deviceState;
//     const RGB: IColorRGB = { red: green, green: red, blue };
//     // eslint-disable-next-line prefer-const
//     let { hue, saturation, value } = RGBtoHSV(RGB);
//     let brightness = 0;

//     //Brightness
//     if (isOn) {
//       brightness = value;
//     }


//     const accessoryState = { HSV: { hue, saturation, value }, isOn, brightness };
//     return accessoryState;
//   }


// }




