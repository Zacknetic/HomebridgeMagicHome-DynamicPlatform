import {
  clamp,
  convertHSLtoRGB,
  convertMiredToTempInKelvin,
  convertRGBtoHSL,
  convertTempInKelvinToWhiteValues,
} from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class RGBCWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  async updateDeviceState(_timeout = 200) {
    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    const isColorTempChange = this.setColortemp;
    let [red, green, blue] = [0, 0, 0];
    if (!isColorTempChange) {
      [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    }
    const brightness = this.lightState.brightness;
    const mask = isColorTempChange ? 0x0f : 0xf0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on

    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    const r = Math.round((clamp(red, 0, 255) / 100) * brightness);
    const g = Math.round((clamp(green, 0, 255) / 100) * brightness);
    const b = Math.round((clamp(blue, 0, 255) / 100) * brightness);

    const temperatureInKelvin = convertMiredToTempInKelvin(this.lightState.CCT);
    const brightnessPercentage = brightness / 100;

    const whiteValues = convertTempInKelvinToWhiteValues(
      temperatureInKelvin,
      brightnessPercentage,
    );

    await this.send(
      [0x31, r, g, b, whiteValues.warmWhite, whiteValues.coldWhite, mask, mask],
      true,
      _timeout,
    ); //9th byte checksum calculated later in send()
  }

  async updateHomekitState() {
    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.lightState.isOn,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.Hue,
      this.lightState.HSL.hue,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.Saturation,
      this.lightState.HSL.saturation,
    );
    if (this.lightState.HSL.luminance > 0 && this.lightState.isOn) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        this.lightState.HSL.luminance * 2,
      );
    } else if (this.lightState.isOn) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        clamp(
          this.lightState.whiteValues.coldWhite / 2.55 +
            this.lightState.whiteValues.warmWhite / 2.55,
          0,
          100,
        ),
      );
      if (
        this.lightState.whiteValues.warmWhite >
        this.lightState.whiteValues.coldWhite
      ) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.Saturation,
          this.colorWhiteThreshold -
            this.colorWhiteThreshold *
              (this.lightState.whiteValues.coldWhite / 255),
        );
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, 0);
      } else {
        this.service.updateCharacteristic(
          this.platform.Characteristic.Saturation,
          this.colorWhiteThreshold -
            this.colorWhiteThreshold *
              (this.lightState.whiteValues.warmWhite / 255),
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.Hue,
          180,
        );
      }
    }
    this.service.updateCharacteristic(
      this.platform.Characteristic.ColorTemperature,
      this.lightState.CCT,
    );
    this.cacheCurrentLightState();
  }
}
