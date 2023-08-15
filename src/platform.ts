import { join } from "path";
import { loadJson } from "./misc/utils";
import { MHLogger } from "./MHLogger";
import { API, APIEvent, DynamicPlatformPlugin, HAP, Logger, PlatformConfig, Service } from "homebridge";

// import { AnimationGenerator } from './AnimationGenerator'
import { AnimationAccessory, HomebridgeAccessory } from "./misc/types";
import { AccessoryGenerator } from "./AccessoryGenerator";
import { HomebridgeMagichomeDynamicPlatformAccessory } from "./platformAccessory";
import  {MHConfig} from "./MHConfig";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagichomeDynamicPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;

  public count = 1;

  private periodicDiscovery: NodeJS.Timeout | null = null;

  // public readonly logger: MHLogger;
  public readonly hbAccessoriesFromDisk: Map<string, HomebridgeAccessory> = new Map();
  animationsFromDiskMap: Map<string, AnimationAccessory> = new Map();

  constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
    new MHConfig(config);
    const {advancedOptions: {logLevel}} = MHConfig;
    new MHLogger(log, logLevel);
   
    MHLogger.warn("If this plugin brings you joy, consider visiting GitHub and giving it a ⭐.");

    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      MHLogger.debug("Homebridge Magichome Dynamic Platform didFinishLaunching");
      this.initializePlatform();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory) {
    // set cached accessory as not recently seen
    // if found later to be a match with a discovered device, will change to true
    // accessory.context.scansSinceSeen++;
    // accessory.context.pendingRegistration = true;
    // // add the restored accessory to the accessories cache so we can track if it has already been registered
    if (typeof accessory.context.protoDevice != "undefined") {

      const homebridgeUUID = accessory.context.protoDevice?.uniqueId;
      this.hbAccessoriesFromDisk.set(homebridgeUUID, accessory);

      MHLogger.info(`${this.hbAccessoriesFromDisk.size} - Loading accessory from cache: ${accessory.context.displayName}`);
    } else {
      const homebridgeUUID = this.api.hap.uuid.generate(accessory.context.animationBlueprint.name);

      this.animationsFromDiskMap.set(homebridgeUUID, accessory);

      // const homebridgeUUID = accessory.context.animationLoop;
    }
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

    const accesssoryGenerator = new AccessoryGenerator(this, this.hbAccessoriesFromDisk);
    // accesssoryGenerator.removeAllAccessories();
    const activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[] = await accesssoryGenerator.discoverAccessories();
    this.periodicDiscovery = setInterval(() => accesssoryGenerator.rescanDevices(), 30000);
  }

  // sanitizeConfig() {
  //   //recursive config sanitation
  // }
} //ZackneticMagichomePlatform class
