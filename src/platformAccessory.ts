import type {
  API, Service, PlatformConfig, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback, HAP, Logger, Logging,
} from 'homebridge';

const thunderstruck: IAnimationLoop = {

  'name': 'ThunderStruck',
  'pattern': [
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': 1000,
      'durationAtTargetMS': [10000, 30000],
      'chancePercent': 100,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },
      },
      'transitionTimeMS': 50,
      'durationAtTargetMS': [50, 150],
      'chancePercent': 50,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': 30,
      'durationAtTargetMS': [200, 300],
      'chancePercent': 100,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },
      },
      'transitionTimeMS': 50,
      'durationAtTargetMS': [50, 150],
      'chancePercent': 50,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': 30,
      'durationAtTargetMS': [200, 300],
      'chancePercent': 100,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },
      },
      'transitionTimeMS': 50,
      'durationAtTargetMS': [50, 150],
      'chancePercent': 50,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': 30,
      'durationAtTargetMS': [200, 300],
      'chancePercent': 100,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },

      },
      'colorTarget': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },
      },
      'transitionTimeMS': 30,
      'durationAtTargetMS': [50, 300],
      'chancePercent': 100,
    },
  ],
  'accessories': [
    'Office Light',
  ],
  'accessoryOffsetMS': 0,
};

const hell: IAnimationLoop = {

  'name': 'hell',
  'pattern': [
    {
      'colorTarget': {
        RGB: { red: [100, 255], green: [0, 25], blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': [100, 300],
      'durationAtTargetMS': [0, 5000],
      'chancePercent': 100,
    },
    {
      'colorStart': {
        RGB: { red: 0, green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 255 },
      },
      'colorTarget': {
        RGB: { red: [100, 255], green: 0, blue: 0 }, CCT: { warmWhite: 0, coldWhite: 0 },
      },
      'transitionTimeMS': 30,
      'durationAtTargetMS': [100, 150],
      'chancePercent': 10,
    },
  ],
  'accessories': [
    'Office Light',
  ],
  'accessoryOffsetMS': 0,
};

import { clamp, convertHSLtoRGB, convertRGBtoHSL } from './misc/utils';
import { DefaultAccessoryCommand, IAccessoryCommand, IAccessoryState, IConfigOptions, MagicHomeAccessory } from './misc/types';
import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, ICommandOptions, IDeviceCommand, IDeviceState, DeviceWriteStatus as DeviceStatus, IProtoDevice, IAnimationLoop } from 'magichome-platform';
import { _ } from 'lodash';
import Queue from 'queue-promise';
import { Logs } from './logs';

const { ready, pending, busy } = DeviceStatus;

const CCT = 'CCT';
const HSL = 'HSL';
const BUFFER_MS = 0;
const FINAL_COMMAND_TIMEOUT = 100;
const QUEUE_INTERVAL = 150;

const SLOW_COMMAND_OPTIONS: ICommandOptions = { maxRetries: 20, bufferMS: 0, timeoutMS: 2000 };
const MEDIUM_COMMAND_OPTIONS: ICommandOptions = { maxRetries: 20, bufferMS: 0, timeoutMS: 1000 };
const FAST_COMMAND_OPTIONS: ICommandOptions = { maxRetries: 0, bufferMS: 0, timeoutMS: 20 };

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomebridgeMagichomeDynamicPlatformAccessory {

  protected service: Service;
  protected readonly hap: HAP;

  protected adaptiveLightingService;
  protected animationInterval;
  protected interruptInterval;
  protected intervals;

  protected newAccessoryCommand: IAccessoryCommand;
  protected latestDeviceCommand: IDeviceCommand;
  protected latestAccessoryCommand: IAccessoryCommand;

  protected ColorCommandMode = HSL;
  protected logs;

  protected colorWhiteSimultaniousSaturationLevel;
  protected colorOffSaturationLevel;
  protected simultaniousDevicesColorWhite;

  protected deviceWriteStatus = ready;
  protected deviceReadStatus = ready;
  protected readRequestLevel = 0;

  protected queue;
  protected slowQueueRetry = false;
  latestDeviceState: IDeviceState;

  //=================================================
  // Start Constructor //

  constructor(
    protected readonly api: API,
    protected readonly accessory: MagicHomeAccessory,
    public readonly config: PlatformConfig,
    protected readonly controller: BaseController,
    protected readonly hbLogger: Logging,
  ) {

    this.setupMisc();

    this.controller = controller;
    this.hap = api.hap;
    this.api = api;
    this.config = config;
    this.setupCommandQueue();
    this.initializeCharacteristics();
    this.fetchAndUpdateState(2);
  }

  //=================================================
  // End Constructor //

  //=================================================
  // Start Setters //
  async setOn(value: CharacteristicValue) {
    const accessoryCommand: IAccessoryCommand = { isOn: value as boolean };
    this.processAccessoryCommand(accessoryCommand);
  }

  setHue(value: CharacteristicValue) {
    this.accessory.context.accessoryState.HSL.hue = value as number;
    this.ColorCommandMode = HSL;
    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { hue: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  setSaturation(value: CharacteristicValue) {

    this.accessory.context.accessoryState.HSL.saturation = value as number;

    this.ColorCommandMode = HSL;

    const accessoryCommand: IAccessoryCommand = { isOn: true, HSL: { saturation: value as number } };
    this.processAccessoryCommand(accessoryCommand);
  }

  async setBrightness(value: CharacteristicValue) {


    this.accessory.context.accessoryState.brightness = value as number;
    const accessoryCommand: IAccessoryCommand = { isOn: true, brightness: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setColorTemperature(value: CharacteristicValue) {

    this.ColorCommandMode = CCT;
    const accessoryCommand: IAccessoryCommand = { colorTemperature: value as number };
    this.processAccessoryCommand(accessoryCommand);
  }

  setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.warn('Renaming device to %o', name);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);
  }

  identifyLight() {

    this.flashEffect();
  }

  //=================================================
  // End Setters //

  //=================================================
  // Start Getters //

  getHue() {

    const hue = this.accessory.context.accessoryState.HSL.hue;
    this.fetchAndUpdateState(2);
    return hue;

  }

  getColorTemperature() {

    const colorTemperature = this.accessory.context.accessoryState.colorTemperature;
    this.fetchAndUpdateState(3);
    return colorTemperature;
  }

  getBrightness() {
    const brightness = this.accessory.context.accessoryState.brightness;
    this.fetchAndUpdateState(2);
    return brightness;
  }

  /**
   ** @getOn
   * instantly retrieve the current on/off state stored in our object
   * next call this.getState() which will update all values asynchronously as they are ready
   */
  async getOn() {
    const isOn = this.accessory.context.accessoryState.isOn;
    this.fetchAndUpdateState(2);
    return isOn;
  }

  flashEffect() {
    //
  } //flashEffect

  //=================================================
  // End LightEffects //


  protected async processAccessoryCommand(accessoryCommand: IAccessoryCommand) {
    // for (const interval of this.intervals) {
    this.controller.clearAnimations();
    //}

    const deviceWriteStatus = this.deviceWriteStatus;
    switch (deviceWriteStatus) {
      case ready:

        this.deviceWriteStatus = pending;
        await this.writeStateToDevice(accessoryCommand).then((msg) => {
          //error logging
        }).finally(() => {
          this.deviceWriteStatus = ready;
        });
        break;

      case pending:
        _.merge(this.newAccessoryCommand, accessoryCommand);
        break;
    }
  }

  protected async writeStateToDevice(accessoryCommand: IAccessoryCommand): Promise<unknown> {
    this.newAccessoryCommand = accessoryCommand;
    return new Promise<unknown>((resolve, reject) => {
      return setTimeout(() => {
        this.logs.debug(this.accessory.context.displayName, '\n Current State:', this.accessory.context.accessoryState, '\n Received Command', this.newAccessoryCommand);
        const sanitizedAcessoryCommand: IAccessoryCommand = _.merge({}, this.accessory.context.accessoryState, this.newAccessoryCommand);

        // eslint-disable-next-line no-prototype-builtins
        if (this.newAccessoryCommand.hasOwnProperty('isOn') && !(this.newAccessoryCommand.hasOwnProperty('HSL') || this.newAccessoryCommand.hasOwnProperty('brightness'))) {
          sanitizedAcessoryCommand.isPowerCommand = true;
        }
        resolve(this.prepareCommand(sanitizedAcessoryCommand));
      }, BUFFER_MS);
    });
  }

  protected async prepareCommand(accessoryCommand: IAccessoryCommand, options: ICommandOptions = MEDIUM_COMMAND_OPTIONS) {
    // if (accessoryCommand.HSL.saturation < 5) {
    //   this.animateMe(thunderstruck);
    //   return;
    // }
    // if(accessoryCommand.HSL.hue < 5 || accessoryCommand.HSL.hue > 355){
    //   this.animateMe(hell);
    // }
    const deviceCommand = this.accessoryCommandToDeviceCommand(accessoryCommand);
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Outgoing Command:`, deviceCommand);
    this.latestDeviceCommand = deviceCommand;
    this.latestAccessoryCommand = accessoryCommand;

    this.queue.enqueue(async () => {

      if (this.queue.size > 0) {
        this.slowQueueRetry = true;
        options = FAST_COMMAND_OPTIONS;
      }

      if (!(this.slowQueueRetry && this.queue.size < 1)) {
        let response;
        if (!accessoryCommand.isPowerCommand) {
          response = await this.controller.setAllValues(deviceCommand, options);
        } else {
          response = await this.controller.setOn(deviceCommand.isOn, options);
        }
        this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - After sending command, received response from device:`, response);
      }

    });
  }

  protected accessoryCommandToDeviceCommand(accessoryCommand: IAccessoryCommand): IDeviceCommand {
    const { isOn, HSL, colorTemperature, brightness } = accessoryCommand;

    const RGB = convertHSLtoRGB(HSL);
    RGB.red = Math.round((RGB.red / 100) * brightness);
    RGB.green = Math.round((RGB.green / 100) * brightness);
    RGB.blue = Math.round((RGB.blue / 100) * brightness);

    const deviceCommand: IDeviceCommand = { isOn, RGB };
    return deviceCommand;
  }

  protected async updateLocalState(requestLevel, deviceState) {
    if (!deviceState) {
      deviceState = await this.controller?.fetchState() ?? this.accessory.context.cachedDeviceInformation.deviceState;
    }
    this.logs.debug(`[${this.accessory.context.displayName}] - Device State:\n`, deviceState);
    this.accessory.context.cachedDeviceInformation.deviceState = deviceState;
    const { HSL: { hue, saturation, luminance }, colorTemperature, brightness, isOn } = this.deviceStateToAccessoryState(deviceState);
    let accessoryState: IAccessoryState;
    if (deviceState) {
      switch (requestLevel) {
        case 0:
          accessoryState = { HSL: { luminance }, isOn };
          break;
        case 1:
          accessoryState = { HSL: { hue, luminance }, isOn };
          break;
        case 2:
          accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness };
          break;
        case 3:
          accessoryState = { HSL: { hue, saturation, luminance }, isOn, brightness, colorTemperature };
          break;
      }
      _.merge(this.accessory.context.accessoryState, accessoryState);

      this.logs.debug(`[${this.accessory.context.displayName}] - Homebridge State:\n`, this.accessory.context.accessoryState);
    } else {
      _.merge(this.accessory.context.accessoryState, { isOn: false });
    }
  }

  updateHomekitState() {
    this.service.updateCharacteristic(this.hap.Characteristic.On, this.accessory.context.accessoryState.isOn);
    this.service.updateCharacteristic(this.hap.Characteristic.Hue, this.accessory.context.accessoryState.HSL.hue);
    this.service.updateCharacteristic(this.hap.Characteristic.Saturation, this.accessory.context.accessoryState.HSL.saturation);
    this.service.updateCharacteristic(this.hap.Characteristic.Brightness, this.accessory.context.accessoryState.brightness);
  }

  deviceStateToAccessoryState(deviceState: IDeviceState): IAccessoryState {

    const { LEDState: { RGB, CCT: { coldWhite, warmWhite }, isOn } } = deviceState;
    // eslint-disable-next-line prefer-const
    let { hue, saturation, luminance } = convertRGBtoHSL(RGB);
    let brightness = 0;

    if (luminance > 0 && isOn) {
      brightness = luminance * 2;
    } else if (isOn) {
      brightness = clamp(((coldWhite / 2.55) + (warmWhite / 2.55)), 0, 100);
      if (warmWhite > coldWhite) {
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (coldWhite / 255));
      } else {
        saturation = this.colorWhiteSimultaniousSaturationLevel - (this.colorWhiteSimultaniousSaturationLevel * (warmWhite / 255));
      }
    }

    const accessoryState: IAccessoryState = { HSL: { hue, saturation, luminance }, isOn, colorTemperature: 140, brightness };
    return accessoryState;
  }

  setupCommandQueue() {
    let deviceState;
    this.queue = new Queue({
      concurrent: 1,
      interval: QUEUE_INTERVAL,
    });

    let timeout;

    this.queue.on('start', () => {
      clearTimeout(timeout);
    });

    this.queue.on('end', async () => {

      if (!_.isEqual(_.omit(this.latestDeviceState?.LEDState ?? {}, ['colorMask']), _.omit(this.latestDeviceCommand, ['colorMask']))) {
        if (this.slowQueueRetry) {
          timeout = setTimeout(async () => {
            this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Sending a slow write command to increase chance of success:\n`, this.latestDeviceCommand);
            this.slowQueueRetry = false;
            await this.prepareCommand(this.latestAccessoryCommand, SLOW_COMMAND_OPTIONS);
            this.fetchAndUpdateState(2);

          }, FINAL_COMMAND_TIMEOUT);
        }
        deviceState = null;
      }
    });

    this.queue.on('resolve', _deviceState => {
      deviceState = _deviceState;
    });
    this.queue.on('reject', error => {
      this.logs.error(error);
    });
  }

  initializeCharacteristics() {

    let cachedDeviceInformation = this.controller?.getCachedDeviceInformation();
    if (cachedDeviceInformation) {
      this.accessory.context.cachedDeviceInformation = cachedDeviceInformation;
    } else {
      cachedDeviceInformation = this.accessory.context.cachedDeviceInformation;
    }

    const { deviceAPI: { hasBrightness, hasCCT, hasColor } } = cachedDeviceInformation;

    addAccessoryInformationCharacteristic(this);

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Lightbulb service to accessory.`);
    this.service = this.accessory.getService(this.hap.Service.Lightbulb) ?? this.accessory.addService(this.hap.Service.Lightbulb);

    if (hasColor) {
      addHueCharacteristic(this);
      addSaturationCharacteristic(this);
    }

    if (hasBrightness) {
      addBrightnessCharacteristic(this);
    }

    if (hasCCT) {
      addColorTemperatureCharacteristic(this);
    }

    if (!hasBrightness) {
      this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Switch service to accessory.`);  //device is switch, register it as such
      this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch);
    }
    addOnCharacteristic(this);
    addConfiguredNameCharacteristic(this);
  }

  setupMisc() {
    this.accessory.context.accessoryState = this.accessory.context.accessoryState ?? DefaultAccessoryCommand;

    const localAccessoryOptions = new Map(Object.entries(this.config?.individualAccessoryOptions)).get(this.accessory.context.displayName);
    const { colorOffSaturationLevel, colorWhiteSimultaniousSaturationLevel, logLevel } = _.merge({}, this.config.globalAccessoryOptions, localAccessoryOptions);


    this.colorWhiteSimultaniousSaturationLevel = colorWhiteSimultaniousSaturationLevel;
    this.colorOffSaturationLevel = colorOffSaturationLevel;
    this.logs = new Logs(this.hbLogger, logLevel ?? 3);

  }

  async fetchAndUpdateState(requestLevel) {
    switch (this.deviceReadStatus) {
      case ready:
        this.deviceReadStatus = pending;
        this.readRequestLevel = requestLevel;
        setTimeout(async () => {
          await this.updateLocalState(this.readRequestLevel, null);
          this.updateHomekitState();
          this.deviceReadStatus = ready;
        }, BUFFER_MS);
        break;
      case pending:
        this.readRequestLevel = Math.max(requestLevel, this.readRequestLevel);
        break;
    }

  }

  protected animateMe(animation) {
    this.logs.warn('animating', animation.name);
    this.controller.animateIndividual(animation);
  }

} // ZackneticMagichomePlatformAccessory class