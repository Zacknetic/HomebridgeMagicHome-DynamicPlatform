import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { MagichomePlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { ControllerGenerator } from 'magichome-platform';

// This is only required when using Custom Services and Characteristics not support by HomeKit
import { EveHomeKitTypes } from 'homebridge-lib/EveHomeKitTypes';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagicHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();

  // This is only required when using Custom Services and Characteristics not support by HomeKit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomServices: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomCharacteristics: any;

  private controllerGenerator: ControllerGenerator;

  // store UUIDs we see when scanning to detect offline accessories
  public readonly discoveredCacheUUIDs: string[] = [];

  // optional offline accessories store (if you need to reference them)
  private offlineAccessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // This is only required when using Custom Services and Characteristics not support by HomeKit
    this.CustomServices = new EveHomeKitTypes(this.api).Services;
    this.CustomCharacteristics = new EveHomeKitTypes(this.api).Characteristics;

    this.controllerGenerator = new ControllerGenerator();

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');

      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      // Optionally run periodic scans:
      this.periodicScanForDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.context.configuredName);

    // ensure necessary context properties exist
    if (typeof accessory.context.missedScans !== 'number') {
      accessory.context.missedScans = 0;
    }
    if (typeof accessory.context.isOnline !== 'boolean') {
      accessory.context.isOnline = false;
    }

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * EXAMPLE ONLY
   *
   * A real plugin you would discover accessories from the local network, cloud services
   * or a user-defined array in the platform config.
   */
  async discoverDevices() {
    this.log.debug('Starting initial discovery of MagicHome devices...');
    await this.scanAndSyncDevices();
  }

  /**
   * Periodically scan the network to keep accessory states updated.
   * You can call this in didFinishLaunching or wherever fits your use case.
   */
  periodicScanForDevices() {
    setInterval( () => {
      this.log.debug('Periodic scan triggered...');
      this.scanAndSyncDevices();
    }, 60_000); // example: every 30 seconds
  }

  /**
   * DRY method to:
   * 1) Discover all devices on the network.
   * 2) Add new accessories if they've never been seen before.
   * 3) Update existing accessories if their IP changed (re-run constructor).
   * 4) Mark accessories offline only if they are missed in 5 consecutive scans.
   */
  private async scanAndSyncDevices() {
    // clear the discovered UUIDs from any previous run
    this.discoveredCacheUUIDs.length = 0;

    // A real plugin you would discover accessories from the local network, cloud services,
    // or a user-defined array in the platform config.
    const devices = await this.controllerGenerator.getDevices(this.config.subnets);

    // loop over the discovered devices and register each one if it has not already been registered
    for (const [id, device] of devices) {
      // generate a unique id for the accessory; this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(id);

      // see if an accessory with the same uuid has already been registered
      // and restored from the cached devices we stored in the
      // `configureAccessory` method above
      const existingAccessory = this.accessories.get(uuid);
      const currentIP = device.fullDeviceInformation.protoDevice.ipAddress;
      
      if (existingAccessory) {
        existingAccessory.displayName = existingAccessory.UUID;
        // the accessory already exists
        this.log.info('Found existing accessory in cache:', existingAccessory.context.configuredName);

        // track that we've seen this accessory during the current scan
        this.discoveredCacheUUIDs.push(uuid);

        // reset missed scans and mark it online
        existingAccessory.context.missedScans = 0;
        existingAccessory.context.isOnline = true;

        // if IP changed, update it and re-run the platform accessory constructor
        if (existingAccessory.context.ipAddress !== currentIP) {
          this.log.info(
            `IP changed for ${existingAccessory.context.configuredName} (was: ` +
            `${existingAccessory.context.ipAddress}, now: ${currentIP}). Re-initializing device.`,
          );

          existingAccessory.context.ipAddress = currentIP;
          this.api.updatePlatformAccessories([existingAccessory]);

          // re-run the accessory handler for the updated IP
          new MagichomePlatformAccessory(this, existingAccessory, device);
        } else {
          // IP didn't change; just ensure accessory is up to date
          // re-run the constructor to refresh event handlers, etc.
          this.api.updatePlatformAccessories([existingAccessory]);
          new MagichomePlatformAccessory(this, existingAccessory, device);
        }

        // it is possible to remove platform accessories at any time using
        // `api.unregisterPlatformAccessories`, e.g.:
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.context.configuredName);
      } else {
        // the accessory does not yet exist, so we need to create it
        const configuredName = device.fullDeviceInformation.deviceAPI.description + ' ' + id.slice(-4);
        this.log.info('Adding new accessory:', configuredName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(configuredName, uuid);

        // store only minimal info: IP, online status, and missed scans
        accessory.context.ipAddress = currentIP;
        accessory.context.isOnline = true;
        accessory.context.missedScans = 0;
        accessory.context.configuredName = configuredName;
        // create the accessory handler for the newly created accessory
        // this is imported from `platformAccessory.ts`
        new MagichomePlatformAccessory(this, accessory, device);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        // track that we've seen it during the current scan
        this.accessories.set(uuid, accessory);
        this.discoveredCacheUUIDs.push(uuid);
      }
    }

    // handle accessories from the cache which are not found in this scan
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        // increment missed scans
        accessory.context.missedScans = (accessory.context.missedScans ?? 0) + 1;
        
        // only mark offline if missed for 5 or more scans
        if (accessory.context.missedScans >= 5) {
          if (accessory.context.isOnline) {
            this.log.info(
              `Accessory ${accessory.context.configuredName} has been missed for ` +
              `${accessory.context.missedScans} consecutive scans. Marking offline.`,
            );
          }
          accessory.context.isOnline = false;

          // push it to offline array if you want to track offline
          this.offlineAccessories.push(accessory);

          this.api.updatePlatformAccessories([accessory]);
          // optionally, remove it if desired:
          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          // this.accessories.delete(uuid);
        }
      }
    }
  }

  /**
   * Example of a function to purge all accessories (be cautious using this in production).
   */
  purgeAllAccessories() {
    this.api.unregisterPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      Array.from(this.accessories.values()),
    );
    this.accessories.clear();
  }
}
