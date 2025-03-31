import type {
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';
import {
  BaseController,
  CCTtoTB,
  DeviceCommandHSV,
  DeviceCommandRGB,
  TBtoCCT,
} from 'magichome-platform';
import type { HomebridgeMagicHomePlatform } from './platform.js';
import { HSVtoRGB } from 'magichome-platform/dist/utils/colorConversions.js';
import { ConfigLoader } from './utils/ConfigLoader.js';

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class MagichomePlatformAccessory {
  private service: Service;

  resistOffFromBrightness: boolean = false;

  fetchStateThrottle: boolean = false;

  accessoryCommand: DeviceCommandHSV = {
    isOn: true,
    CCT: {
      warmWhite: 0,
      coldWhite: 0,
    },
    HSV: {
      hue: 0,
      saturation: 0,
      value: 100,
    },
  };

  temperature: number = 500;
  lastValue: number = 100;
  finalCommand: DeviceCommandRGB | null = null;
  finalTimeout: NodeJS.Timeout | null = null;

  private backupCommand: DeviceCommandHSV | null = null;

  constructor(
    private readonly platform: HomebridgeMagicHomePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly controller: BaseController,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Default-Manufacturer',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        'Default-Serial',
      );

    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)); // SET - bind to the `setOn` method below
    // .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setValue.bind(this));
    // .onGet(this.getBrightness.bind(this));

    // register handlers for Hue and Saturation
    this.service
      .getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setHue.bind(this));
    // .onGet(this.getHue.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this));
    // .onGet(this.getSaturation.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.ColorTemperature)
      .onSet(this.setColorTemperature.bind(this));
    // .onGet(this.getColorTemperature.bind(this));

    this.periodicFetchStateUpdate();
  }

  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.controller.ledStateHSV.isOn;
    this.fetchStateUpdateAsync();
    return isOn;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    const brightness = this.controller.ledStateHSV.HSV.value;
    this.fetchStateUpdateAsync();
    return brightness;
  }

  async getHue(): Promise<CharacteristicValue> {
    const hue = this.controller.ledStateHSV.HSV.hue;
    this.fetchStateUpdateAsync();
    return hue;
  }

  async getSaturation(): Promise<CharacteristicValue> {
    const saturation = this.controller.ledStateHSV.HSV.saturation;
    this.fetchStateUpdateAsync();
    return saturation;
  }

  async getColorTemperature(): Promise<CharacteristicValue> {
    const temperature = CCTtoTB(this.controller.ledStateHSV.CCT).temperature;

    this.fetchStateUpdateAsync();
    return temperature;
  }

  async setOn(value: CharacteristicValue) {
    this.resistOff();
    this.platform.log.warn('setOn', value);
    try {
      this.accessoryCommand.isOn = value as boolean;
      await this.controller.setOn(value as boolean);
    } catch (error) {
      this.platform.log.error('Error setting on:', error);
    }
  }

  setHue(value: CharacteristicValue) {
    // this.resistOff();
    this.accessoryCommand.HSV.hue = value as number;
    this.throttleColorUpdate();
  }

  setSaturation(value: CharacteristicValue) {
    // this.resistOff();
    this.accessoryCommand.HSV.saturation = value as number;
    this.throttleColorUpdate();
  }

  setValue(value: CharacteristicValue) {
    // this.resistOff();
    this.accessoryCommand.HSV.value = value as number;
    this.throttleColorUpdate();
  }

  async setColorTemperature(value: CharacteristicValue) {
    // this.resistOff();
    const CCT = TBtoCCT({
      temperature: value as number,
      brightness: this.controller.ledStateHSV.HSV.value,
    });
    this.temperature = value as number;
    this.accessoryCommand.CCT = CCT;
    this.throttleColorUpdate();
  }

  /**
   * Queue color updates to handle separately arriving hue and saturation values
   */
  private throttleInProgress = false;

  private async throttleColorUpdate(): Promise<void> {
    if (this.resistOffFromBrightness) {
      console.log('Resisting off from brightness, skipping color update.');
      return;
    }
    if (this.accessoryCommand.isOn === false) {
      console.log('Accessory is off, skipping color update.');
      return;
    }

    // If throttle isn't in progress, start it
    if (this.throttleInProgress) return;
    this.throttleInProgress = true;

    this.finalTimeout = setTimeout(async () => {
      // Execute the update with the accumulated command values
      const command = this.generateCommand();
      this.platform.log.debug('Throttled color update:', command);
      this.platform.log.debug('lastValue', this.lastValue);
      try {
        await this.controller.setLEDRGB(command);
      } catch (error) {
        this.platform.log.warn('Error setting color:', error);
      }

      this.throttleInProgress = false;
    }, 20); // 20ms throttle delay

    // If throttle is already in progress, the accessoryCommand will be updated
    // and the next execution will use the latest values
  }

  generateCommand(): DeviceCommandRGB {
    const { hue, saturation, value } = this.accessoryCommand.HSV;

    // Initial CCT (warm/cold) values based on temperature & brightness
    let { warmWhite, coldWhite } = TBtoCCT({
      temperature: this.temperature,
      brightness: value,
    });

    // Initial RGB values based on hue/sat/val
    let { red, green, blue } = HSVtoRGB({ hue, saturation, value });

    // Special cases
    if (hue === 31 && saturation === 33) {
      // Force warm white only
      this.accessoryCommand.CCT = {
        warmWhite: Math.round(value * 2.55),
        coldWhite: 0,
      };
      red = green = blue = 0;
    } else if (hue === 208 && saturation === 17) {
      // Force cold white only
      this.accessoryCommand.CCT = {
        warmWhite: 0,
        coldWhite: Math.round(value * 2.55),
      };
      red = green = blue = 0;
    } else if (saturation >= 95) {
      // Force color only (turn off white LEDs)
      warmWhite = 0;
      coldWhite = 0;
    } else {
      // Re-compute with full saturation, but use stored lastValue
      ({ red, green, blue } = HSVtoRGB({
        hue,
        saturation: 100,
        value: this.lastValue,
      }));

      // If saturation is nearly zero, treat as “white”
      if (saturation < 5) {
        this.lastValue = value;
        red = green = blue = 0;
      }
    }

    return {
      isOn: this.accessoryCommand.isOn,
      RGB: { red, green, blue },
      CCT: { warmWhite, coldWhite },
    };
  }

  async fetchStateUpdateAsync() {
    if (this.fetchStateThrottle) {
      return;
    }
    this.fetchStateThrottle = true;
    setTimeout(async () => {
      try {
        const state = await this.controller.fetchDeviceStateHSV();

        this.service.updateCharacteristic(
          this.platform.Characteristic.Brightness,
          state.HSV.value,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          state.isOn,
        );
        if (state.isOn) {
          this.service.updateCharacteristic(
            this.platform.Characteristic.Hue,
            state.HSV.hue,
          );
          this.service.updateCharacteristic(
            this.platform.Characteristic.Saturation,
            state.HSV.saturation,
          );
          const temperature = CCTtoTB(
            this.controller.ledStateHSV.CCT,
          ).temperature;
          this.service.updateCharacteristic(
            this.platform.Characteristic.ColorTemperature,
            temperature,
          );
        }
      } catch (error) {
        this.platform.log.error('error', error);
      }
    }, 5000);
  }

  immediateUpdate() {
    this.service.updateCharacteristic(
      this.platform.Characteristic.Brightness,
      this.accessoryCommand.HSV.value,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.Hue,
      this.accessoryCommand.HSV.hue,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.Saturation,
      this.accessoryCommand.HSV.saturation,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.accessoryCommand.isOn,
    );
    const temperature = CCTtoTB(this.controller.ledStateHSV.CCT).temperature;
    this.service.updateCharacteristic(
      this.platform.Characteristic.ColorTemperature,
      temperature,
    );
    this.platform.log.debug('Immediate update:', this.accessoryCommand);
  }

  private async periodicFetchStateUpdate() {
    while (true) {
      await this.fetchStateUpdateAsync();
      await sleep(ConfigLoader('device_discovery_interval'));
    }
  }

  async resistOff() {
    // this.logs.trace(`[Trace] [${this.accessory.context.configuredName}] - Resisting Off`);
    this.resistOffFromBrightness = true;
    await sleep(500);
    this.resistOffFromBrightness = false;
  }
}
