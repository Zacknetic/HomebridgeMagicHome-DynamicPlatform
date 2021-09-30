
import { join } from 'path';
import { loadJson } from './magichome-interface/utils';
import { cloneDeep } from 'lodash';
import { Logs } from './logs';
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { ICommandOptions, IDeviceAPI, IDeviceCommand, IProtoDevice, ControllerGenerator } from 'magichome-platform';

// import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { MagicHomeAccessory } from './magichome-interface/types';
import { BaseController } from 'magichome-platform/dist/DeviceControllers/BaseController';
//const NEW_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);
//const LEGACY_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0xEF, 0x01, 0x77]);
import { AccessoryGenerator } from './AccessoryGenerator';

/**
 */

const controllerGenerator = new ControllerGenerator();

let hap: HAP;
import { PLATFORM_NAME } from './settings';
import { HomebridgeMagichomeDynamicPlatform } from './platform'; 

let Accessory: typeof PlatformAccessory;
export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, HomebridgeMagichomeDynamicPlatform);
};
