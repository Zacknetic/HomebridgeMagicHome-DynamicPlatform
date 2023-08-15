import { BaseController, ControllerGenerator, IDeviceAPI, ICompleteDevice, IProtoDevice, ICompleteDeviceInfo, mergeDeep, overwriteDeep } from "magichome-platform";
import { IAccessoryContext, IAccessoryState, HomebridgeAccessory } from "./misc/types";
import { API, HAP, PlatformAccessory, PlatformConfig, uuid } from "homebridge";
import { HomebridgeMagichomeDynamicPlatform } from "./platform";

import { MHLogger } from "./MHLogger";
import { MHConfig } from "./MHConfig";

import { HomebridgeMagichomeDynamicPlatformAccessory } from "./platformAccessory";

const PLATFORM_NAME = "homebridge-magichome-dynamic-platform";
const PLUGIN_NAME = "homebridge-magichome-dynamic-platform";

const controllerGenerator: ControllerGenerator = new ControllerGenerator();

export class AccessoryGenerator {
  public onlineMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = new Map();
  public offlineMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = new Map();

  constructor(private readonly platform: HomebridgeMagichomeDynamicPlatform, private readonly hbAccessoriesFromDisk: Map<string, HomebridgeAccessory>) {
    MHLogger.info("Accessory Generator Initialized");
  }

  public async discoverAccessories(): Promise<Map<string, HomebridgeMagichomeDynamicPlatformAccessory>> {
    MHLogger.info("Scanning network for MagicHome accessories...");

    try {
      const completeDevices: ICompleteDevice[] = await controllerGenerator.discoverCompleteDevices();
      const controllers: BaseController[] = await controllerGenerator.generateControllers(completeDevices);
      const activeMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = await this.generateActiveAccessories(controllers);
      this.offlineMHAccessories = this.processOfflineAccessories();
      return activeMHAccessories;
    } catch (error) {
      MHLogger.error(error);
    }
  }

  public async removeAllAccessories() {
    if (this.hbAccessoriesFromDisk.size === 0) return;
    this.hbAccessoriesFromDisk.forEach((accessory) => {
      this.unregisterAccessory(accessory, "Removing accessory from disk.");
    });
  }

  public async rescanDevices() {
    const completeDevices: ICompleteDevice[] = await controllerGenerator.discoverCompleteDevices();
	const controllers: BaseController[] = controllerGenerator.generateControllers(completeDevices);

    this.repairOfflineAccessories(controllers);
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

  generateActiveAccessories(controllers: BaseController[]): Map<string, HomebridgeMagichomeDynamicPlatformAccessory> {
    const activeMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = new Map();

    const newHBAccessories: HomebridgeAccessory[] = [];
    const existingHBAccessories: HomebridgeAccessory[] = [];

    for (const controller of controllers) {
      try {
        const {
          protoDevice: { uniqueId, ipAddress },
          deviceAPI: { description },
          protoDevice,
        } = controller.getCachedDeviceInformation();

        let newMHAccessory: HomebridgeMagichomeDynamicPlatformAccessory;
        let newHBAccessory: HomebridgeAccessory;
        if (activeMHAccessories.has(uniqueId)) {
          MHLogger.warn(`[${description}] [${uniqueId}] [${ipAddress}] - Duplicate device found. Skipping...`);
          continue;
        }

        // -- Update Existing Accessory Logic -- //
        if (this.hbAccessoriesFromDisk.has(uniqueId)) {
          const existingHBAccessory = this.hbAccessoriesFromDisk.get(uniqueId);
          this.hbAccessoriesFromDisk.delete(uniqueId);

          MHLogger.info(`[${existingHBAccessory.context.displayName}] - Found existing accessory which has an online device. Updating...`);
          newMHAccessory = this.processOnlineAccessory(controller, existingHBAccessory);
          existingHBAccessories.push(existingHBAccessory); // add it to existingHBAccessories so we can update it later

          // -- Register New Accessory Logic -- //
        } else {
          ({ newMHAccessory, newHBAccessory } = this.createNewAccessory(controller));
          MHLogger.info(`Creating new accessory for [${description}] [UID: ${uniqueId}] [IP: ${protoDevice.ipAddress}]`);
          newHBAccessories.push(newHBAccessory); //add it to newHBAccessories so we can register it later as a new accessory
        }

        activeMHAccessories.set(uniqueId, newMHAccessory);
      } catch (error) {
        MHLogger.error("[GenerateActiveAccessories]", error);
      }
    }

    this.registerNewAccessories(newHBAccessories); //register new accessories from scan
    this.updateExistingAccessories(existingHBAccessories);
    return activeMHAccessories;
  }

  repairOfflineAccessories(controllers: BaseController[]) {
    for (const controller of controllers) {
      const {
        protoDevice: { uniqueId, ipAddress },
      } = controller.getCachedDeviceInformation();
      if (this.offlineMHAccessories.has(uniqueId)) {

		  let currMHAccessory: HomebridgeMagichomeDynamicPlatformAccessory = this.offlineMHAccessories.get(uniqueId);
		  const currHBAccessory = currMHAccessory.hbAccessory;
		  if(!currHBAccessory.context.isOnline)  MHLogger.trace(`[${currHBAccessory.context.displayName}] - Found existing accessory whos device was offline in previous scan. Testing...`);
		  if (currHBAccessory.context.protoDevice.ipAddress !== ipAddress) {
			MHLogger.warn(`[${currHBAccessory.context.displayName}] - IP address has changed. Updating...`);
			currMHAccessory = this.processOnlineAccessory(controller, currHBAccessory);
		  }
		  this.onlineMHAccessories.set(uniqueId, currMHAccessory);
		  this.offlineMHAccessories.delete(uniqueId);
      }
    }
  }

  //create a new hbAccessory and a new mhAccessory and return them. Returns an object with both
  createNewAccessory(controller: BaseController): { newMHAccessory: HomebridgeMagichomeDynamicPlatformAccessory; newHBAccessory: HomebridgeAccessory } {
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
    const newHBAccessory: HomebridgeAccessory = new this.platform.api.platformAccessory(description, homebridgeUUID) as HomebridgeAccessory;
    newHBAccessory.context = {
      displayName: description as string,
      deviceMetaData,
      protoDevice,
      latestUpdate: Date.now(),
      assignedAnimations: [],
      isOnline: true,
    };
    const newMHAccessory = new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, newHBAccessory, controller);
    return { newMHAccessory, newHBAccessory };
  }

  processOnlineAccessory(controller: BaseController, existingAccessory: HomebridgeAccessory): HomebridgeMagichomeDynamicPlatformAccessory {
    const { protoDevice, deviceMetaData } = controller.getCachedDeviceInformation();

    if (!this.isAllowed(protoDevice.uniqueId)) throw new Error("Accessory is not allowed. Skipping...");

    mergeDeep(existingAccessory.context, { protoDevice, deviceMetaData, latestUpdate: Date.now(), isOnline: true });
    return new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, existingAccessory, controller);
  }

  async processOfflineAccessories() {
    const offlineAccessoriesList: HomebridgeAccessory[] = [];
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
            this.offlineMHAccessories.set(uniqueId, offlineAccessory);
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

  registerNewAccessories(newAccessories: HomebridgeAccessory[]) {
    this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);
  }

  updateExistingAccessories(existingAccessories: HomebridgeAccessory[]) {
    this.platform.api.updatePlatformAccessories(existingAccessories);
  }

  isAllowed(uniqueId: string): boolean {
    const { blacklistedUniqueIDs, blacklistOrWhitelist } = MHConfig.deviceManagement;
    const onList: boolean = blacklistedUniqueIDs.includes(uniqueId);

    return blacklistOrWhitelist.includes("whitelist") ? onList : !onList;
  }

  unregisterAccessory(existingAccessory: HomebridgeAccessory, reason: string) {
    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    this.onlineMHAccessories.delete(existingAccessory.UUID);

    MHLogger.warn(`[${existingAccessory.context.displayName}] - ${reason}`);
  }
}
