
import {
  API,
  HAP,
  PlatformAccessory,
} from 'homebridge';

let hap: HAP;
import { PLATFORM_NAME } from './settings';
import { HomebridgeMagichomeDynamicPlatform } from './platform';

let Accessory: typeof PlatformAccessory;
export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, HomebridgeMagichomeDynamicPlatform);
};
