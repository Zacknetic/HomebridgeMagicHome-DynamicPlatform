import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform/dist/types';
import { IAccessoryCommand, IAccessoryState } from '../misc/types';
import { convertHSLtoRGB, convertRGBtoHSL, convertHueToColorCCT, cctToWhiteTemperature, clamp, whiteTemperatureToCCT, convertMiredColorTemperatureToHueSat } from '../misc/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';



export class GRBStrip extends HomebridgeMagichomeDynamicPlatformAccessory {


  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {

    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;
    const { hue, saturation } = HSL;
    const { red, green, blue }: IColorRGB = convertHSLtoRGB(HSL);


    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    const _green = Math.round((red / 100) * brightness);
    const _red = Math.round((green / 100) * brightness);
    const _blue = Math.round((blue / 100) * brightness);


    const deviceCommand: IDeviceCommand = { isOn, RGB: {red: _red, green: _green, blue: _blue } };
    return deviceCommand;
  }//setColor

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LEDState: { RGB: { red, green, blue }, isOn } } = deviceState;
    const RGB: IColorRGB = { red: green, green: red, blue };
    // eslint-disable-next-line prefer-const
    let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
    let brightness = 0;

    //Brightness
    if (isOn) {
      brightness = luminance;
    }


    const accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
    return accessoryState;
  }


}




