import { join } from 'path';
import { loadJson } from './misc/utils';
import { cloneDeep } from 'lodash';
import { Logs } from './logs';
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformConfig,
} from 'homebridge';

import { ControllerGenerator } from 'magichome-platform';

import { MagicHomeAccessory } from './misc/types';
import { AccessoryGenerator } from './AccessoryGenerator';
import  logger  from 'node-color-log';
/**
 */

const controllerGenerator = new ControllerGenerator();
let hap: HAP;

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagichomeDynamicPlatform implements DynamicPlatformPlugin {
  private log;
  private readonly api: API;
  // this is used to track restored cached accessories


  public count = 1;

  private periodicDiscovery: NodeJS.Timeout | null = null;

  public readonly config: PlatformConfig;
  public readonly accessoriesFromDiskMap: Map<string, MagicHomeAccessory> = new Map();
  private readonly hbLogger: Logging;
  constructor(
    logging: Logging,
    config: PlatformConfig,
    api: API,
  ) {
    this.hbLogger = logging;
    hap = api.hap;
    this.config = config;
    this.log = new Logs(logging, config?.globalAccessoryOptions?.logLevel ?? 3);
    this.api = api;
    //this.logs = getLogger();
    this.log.warn('Finished initializing homebridge-magichome-dynamic-platform %o', loadJson<any>(join(__dirname, '../package.json'), {}).version);
    logger.reverse().log('If this plugin brings you joy, consider visiting GitHub and giving it a ⭐.');

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.

    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Homebridge Magichome Dynamic Platform didFinishLaunching');
      this.initializePlatform();
    });
  }


  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: MagicHomeAccessory) {
    // set cached accessory as not recently seen 
    // if found later to be a match with a discovered device, will change to true
    // accessory.context.scansSinceSeen++;
    // accessory.context.pendingRegistration = true;
    // // add the restored accessory to the accessories cache so we can track if it has already been registered

    const homebridgeUUID = accessory.UUID;
    this.accessoriesFromDiskMap.set(homebridgeUUID, accessory);
    this.log.debug(`${this.accessoriesFromDiskMap.size} - Loading accessory from cache: ${accessory.context.displayName}`);

  }

  /**
 * Accessories are added by one of three Methods:
 * Method One: New devices that were seen after scanning the network and are registered for the first time
 * Method Two: Cached devices that were seen after scanning the network and are added while checking for ip discrepancies 
 * Method Three: Cached devices that were not seen after scanning the network but are still added with a warning to the user
 */
  async initializePlatform() {
    // const { isValidDeviceModel } = HomebridgeMagichomeDynamicPlatform;
    // const pendingUpdate = new Set();
    // const recentlyRegisteredDevices = new Set();

    // let registeredDevices = 0, newDevices = 0, unseenDevices = 0, scans = 0;


    const accesssoryGenerator = new AccessoryGenerator(this.api, this.log, this.hbLogger, this.config, this.accessoriesFromDiskMap, controllerGenerator);
    await accesssoryGenerator.generateAccessories();
    this.periodicDiscovery = setInterval(() => accesssoryGenerator.rescanAccessories(), 30000);

  }


  // sanitizeConfig() {
  //   //recursive config sanitation
  // }


}//ZackneticMagichomePlatform class