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

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';
let hap: HAP;

// export = (api: API) => {

// };


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
  public readonly accessoriesActive: MagicHomeAccessory[] = [];


  constructor(
    hbLogger: Logging,
    config: PlatformConfig,
    api: API,
  ) {
    hap = api.hap;
    this.config = config;
    // this.log = new Logs(hbLogger, this.config.advancedOptions.logLevel);
this.log = new Logs(hbLogger, config.advancedOptions.logLevel);
    this.api = api;

    //this.logs = getLogger();
    this.log.warn('Finished initializing homebridge-magichome-dynamic-platform %o', loadJson<any>(join(__dirname, '../package.json'), {}).version);
    this.log.info('If this plugin brings you joy, consider visiting GitHub and giving it a ⭐.');

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

    this.log.debug('%o - Loading accessory from cache...', this.accessoriesActive.length, accessory.context.displayName);
    // set cached accessory as not recently seen 
    // if found later to be a match with a discovered device, will change to true
    // accessory.context.scansSinceSeen++;
    // accessory.context.pendingRegistration = true;
    // // add the restored accessory to the accessories cache so we can track if it has already been registered

    const homebridgeUUID = accessory.UUID;
    this.accessoriesFromDiskMap[homebridgeUUID] = accessory;
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


    const accesssoryGenerator = new AccessoryGenerator(hap, this.api, this.log, this.config, this.accessoriesFromDiskMap, controllerGenerator);
    await accesssoryGenerator.generateAccessories();
    // this.periodicDiscovery = setInterval(() => await this.discoverDevices(), 30000);
  }


  sanitizeConfig() {
    //recursive config sanitation
  }


}//ZackneticMagichomePlatform class