import type { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { HomebridgeMagichomeDynamicPlatform } from './platform'; 

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform('homebrige-magichome-dynamic-platform', PLATFORM_NAME, HomebridgeMagichomeDynamicPlatform);
}
 