/* eslint-disable linebreak-style */
import type { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { ZackneticMagichomePlatform } from './platform'; 

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, ZackneticMagichomePlatform);
}
 