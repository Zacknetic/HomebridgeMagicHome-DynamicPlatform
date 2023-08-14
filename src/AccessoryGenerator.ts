import { BaseController, ControllerGenerator, IDeviceAPI, ICompleteDevice, IProtoDevice, ICompleteDeviceInfo, mergeDeep, overwriteDeep } from "magichome-platform";
import { IAccessoryContext, IAccessoryState, MagicHomeAccessory } from "./misc/types";
import { API, HAP, PlatformAccessory, PlatformConfig, uuid } from "homebridge";
import { HomebridgeMagichomeDynamicPlatform } from "./platform";

import { MHLogger } from "./MHLogger";
import { MHConfig } from "./MHConfig";

import { HomebridgeMagichomeDynamicPlatformAccessory } from "./platformAccessory";

const PLATFORM_NAME = "homebridge-magichome-dynamic-platform";
const PLUGIN_NAME = "homebridge-magichome-dynamic-platform";

const controllerGenerator: ControllerGenerator = new ControllerGenerator();

export class AccessoryGenerator {
  public readonly activeAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
  public readonly cachedAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
  activeAccessoriesList: HomebridgeMagichomeDynamicPlatformAccessory[];

  constructor(
    private readonly platform: HomebridgeMagichomeDynamicPlatform,
    private readonly accessoriesFromDiskMap: Map<string, MagicHomeAccessory>,
    private readonly api: API
  ) {
    MHLogger.info("Accessory Generator Initialized");
    this.accessoriesFromDiskMap = accessoriesFromDiskMap;
    this.activeAccessoriesList = [];
  }

  public async discoverDevices(): Promise<HomebridgeMagichomeDynamicPlatformAccessory[]> {
    MHLogger.info("Scanning network for MagicHome accessories...");

    try {
      const completeDevices: ICompleteDevice[] = await controllerGenerator.discoverCompleteDevices();
      const controllers: BaseController[] = await controllerGenerator.generateControllers(completeDevices);
      const activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[] = await this.generateActiveAccessories(controllers);
      this.processOfflineAccessories();
      return activeAccessories;
    } catch (error) {
      MHLogger.error(error);
    }
  }

  public async removeAllAccessories() {
    if (this.accessoriesFromDiskMap.size === 0) return;
    this.accessoriesFromDiskMap.forEach((accessory) => {
      this.unregisterAccessory(accessory, "Removing accessory from disk.");
    });
  }

  public async rediscoverDevices(timeoutMinutes: number) {
    const completeDevices: ICompleteDevice[] = await controllerGenerator.discoverCompleteDevices();
  }

  /**
   *
   * 1. iterate through scanned controllers
   * 	a. exist already as a homebridge accessory?
   * 		i. yes:
   * 			1. check if it's allowed, if not, skip+remove
   * 			2. check it for inconsistencies and fix
   * 			3. register it with homekit again and reset the "last seen" to 0
   * 			4. remove it from the diskMap so we later know that it was seen
   * 		ii. no:
   * 			1. check if it's allowed, if not, skip
   * 			2. create a new accessory Object and new homeKit interface
   * 			3. register it with homekit and set "last seen" to 0
   * 2. iterate through all remaining disk devices not yet removed by our scan function
   * 	a. is it allowed, less than allocated number of restarts ( maybe add this to isAllowed)... if not, skip+remove
   * 	b. warn user about device
   * 	c. increment number of times unseen
   * 	d. register with homekit again
   * 	e. add new homeKit interface
   *
   * note: need a way to just do a base protodevice scan on concurrent scans because current method creates new objects
   * 				which is quite wasteful...
   */

  generateActiveAccessories(controllers: BaseController[]): HomebridgeMagichomeDynamicPlatformAccessory[] {
    const newAccessoriesList: MagicHomeAccessory[] = [];
    const existingAccessoriesList: MagicHomeAccessory[] = [];

    for (const controller of controllers) {
      try {
        const {
          protoDevice: { uniqueId }, deviceAPI: { description }, protoDevice,
        } = controller.getCachedDeviceInformation();
        let currAccessory: MagicHomeAccessory;

        if (this.accessoriesFromDiskMap.has(uniqueId)) {
          const existingAccessory = this.accessoriesFromDiskMap.get(uniqueId);
          this.accessoriesFromDiskMap.delete(uniqueId);
          MHLogger.info(`[${existingAccessory.context.displayName}] - Found existing accessory which has an online device. Updating...`);
          currAccessory = this.processOnlineAccessory(controller, existingAccessory);
          existingAccessoriesList.push(currAccessory);
        } else if (!this.activeAccessoriesMap.has(uniqueId)) {
          //if the accessory is not a duplicate active device
          currAccessory = this.createNewAccessory(controller);
		  MHLogger.info(`Creating new accessory for [${description}] [UID: ${uniqueId}] [IP: ${protoDevice.ipAddress}]`);
          newAccessoriesList.push(currAccessory); //add it to new accessory list
        }

        this.activeAccessoriesMap.set(uniqueId, currAccessory);
      } catch (error) {
        MHLogger.error("[GenerateActiveAccessories]", error);
      }
    }

    this.registerNewAccessories(newAccessoriesList); //register new accessories from scan
    this.updateExistingAccessories(existingAccessoriesList);
    return this.activeAccessoriesList;
  }

  repairActiveAcessories(protoDevices: IProtoDevice[]) {
    for (const protoDevice of protoDevices) {
      const { uniqueId, ipAddress } = protoDevice;
      if (this.activeAccessoriesMap.has(uniqueId)) {
        const activeAccessory = this.activeAccessoriesMap.get(uniqueId);
        MHLogger.info(`[${activeAccessory.context.displayName}] - Found existing accessory whos device was offline in previous scan. Testing...`);
        if (activeAccessory.context.protoDevice.ipAddress === protoDevice.ipAddress) return;
        else {
          MHLogger.info(`[${activeAccessory.context.displayName}] - IP address has changed. Updating...`);
          activeAccessory.context.protoDevice = protoDevice;
          activeAccessory.context.latestUpdate = Date.now();
        }
      }
    }
  }

  createNewAccessory(controller: BaseController) {
    const cachedDeviceInformation = controller.getCachedDeviceInformation();
    const {
      protoDevice: { uniqueId },
      protoDevice,
      deviceAPI: { description },
      deviceMetaData,
    } = cachedDeviceInformation;

    if (!this.isAllowed(uniqueId)) {
      return;
    }
    const homebridgeUUID = this.platform.api.hap.uuid.generate(uniqueId);
    const newAccessory: MagicHomeAccessory = new this.platform.api.platformAccessory(description, homebridgeUUID) as MagicHomeAccessory;
    newAccessory.context = {
      displayName: description as string,
      deviceMetaData,
      protoDevice,
      latestUpdate: Date.now(),
      assignedAnimations: [],
      isOnline: true,
    };
	new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, newAccessory, controller);
    return newAccessory;
  }

  processOnlineAccessory(controller: BaseController, existingAccessory: MagicHomeAccessory): MagicHomeAccessory {
    const { protoDevice, deviceMetaData } = controller.getCachedDeviceInformation();

    if (!this.isAllowed(protoDevice.uniqueId)) {
      MHLogger.error(`[${existingAccessory.context.displayName}] - Accessory is not allowed. Skipping...`);
      throw new Error("Accessory is not allowed. Skipping...");
    }

    mergeDeep(existingAccessory.context, { protoDevice, deviceMetaData, latestUpdate: Date.now(), isOnline: true});
	new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, existingAccessory, controller);
    return existingAccessory;
  }

  async processOfflineAccessories() {
    const offlineAccessoriesList: MagicHomeAccessory[] = [];
    const completeDevicesInfo: ICompleteDeviceInfo[] = [];
    this.accessoriesFromDiskMap.forEach(async (offlineAccessory) => {
      const { displayName, deviceMetaData, protoDevice, latestUpdate } = offlineAccessory.context;
      const completeDeviceInfo: ICompleteDeviceInfo = { protoDevice, deviceMetaData, latestUpdate };
      offlineAccessory.context.isOnline = false;
      completeDevicesInfo.push(completeDeviceInfo);
    });

    try {
      const controllers: BaseController[] = await controllerGenerator.generateCustomControllers(completeDevicesInfo);
      for (const controller of controllers) {
        try {
          const {
            protoDevice: { uniqueId },
          } = controller.getCachedDeviceInformation();
          if (this.accessoriesFromDiskMap.has(uniqueId)) {
            const offlineAccessory = this.accessoriesFromDiskMap.get(uniqueId);
            MHLogger.warn(`[${offlineAccessory.context.displayName}] [UUID: ${uniqueId}] - Device Unreachable. Registering accessory with cached information.`);
            this.accessoriesFromDiskMap.delete(uniqueId);
			new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, offlineAccessory, controller);
            offlineAccessoriesList.push(offlineAccessory);
            this.cachedAccessoriesMap.set(uniqueId, offlineAccessory);
          }
        } catch (error) {
          MHLogger.error("[registerOfflineAccessories] ", controller.getCachedDeviceInformation().protoDevice.uniqueId + " ", error);
        }
      }
    } catch (error) {
      MHLogger.error("[registerOfflineAccessories]", error);
    }

    this.updateExistingAccessories(offlineAccessoriesList);
  }

  registerNewAccessories(newAccessories: MagicHomeAccessory[]) {
    this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);
  }

  updateExistingAccessories(existingAccessories: MagicHomeAccessory[]) {
    this.platform.api.updatePlatformAccessories(existingAccessories);
  }

  isAllowed(uniqueId: string): boolean {
    const { blacklistedUniqueIDs, blacklistOrWhitelist } = MHConfig.deviceManagement;
    const onList: boolean = blacklistedUniqueIDs.includes(uniqueId);

    return blacklistOrWhitelist.includes("whitelist") ? onList : !onList;
  }

  unregisterAccessory(existingAccessory: MagicHomeAccessory, reason: string) {
    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    this.activeAccessoriesMap.delete(existingAccessory.UUID);

    MHLogger.warn(`[${existingAccessory.context.displayName}] - ${reason}`);
  }
}
