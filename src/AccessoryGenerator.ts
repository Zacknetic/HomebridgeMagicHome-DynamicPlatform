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
      const baseControllers: Map<string, BaseController> = await controllerGenerator.generateControllers(completeDevices);
      const { onlineHBAccessories, offlineHBAccessories, newHBAccessories } = this.filterHBAccessoriesFromDisk(baseControllers);
      this.onlineMHAccessories = await this.generateActiveAccessories(onlineHBAccessories, newHBAccessories, baseControllers);
      this.offlineMHAccessories = await this.generateOfflineAccessories(offlineHBAccessories);
      return this.onlineMHAccessories;
    } catch (error) {
      MHLogger.error(error);
    }
  }

  private filterHBAccessoriesFromDisk(baseControllers: Map<string, BaseController>): {
    onlineHBAccessories: HomebridgeAccessory[];
    offlineHBAccessories: HomebridgeAccessory[];
    newHBAccessories: HomebridgeAccessory[];
  } {
    const onlineHBAccessories: HomebridgeAccessory[] = [];
    const offlineHBAccessories: HomebridgeAccessory[] = [];
    const newHBAccessories: HomebridgeAccessory[] = [];

    this.hbAccessoriesFromDisk.forEach((hbAccessory) => {
      const repairedHBAccessory = hbAccessory; //to Implement with method call
      const { uniqueId } = repairedHBAccessory.context.protoDevice;
      if (baseControllers.has(uniqueId)) onlineHBAccessories.push(repairedHBAccessory);
      else offlineHBAccessories.push(repairedHBAccessory);
    });

    baseControllers.forEach((controller) => {
      const { uniqueId } = controller.getCachedDeviceInformation().protoDevice;
      if (!this.hbAccessoriesFromDisk.has(uniqueId)) {
        const newHBAccessory = this.generateNewHBAccessory(controller);
        newHBAccessories.push(newHBAccessory);
      }
    });

    return { onlineHBAccessories, offlineHBAccessories, newHBAccessories };
  }

  public async rescanDevices() {
    const completeDevices: ICompleteDevice[] = await controllerGenerator.discoverCompleteDevices();
    const baseControllers: Map<string, BaseController> = controllerGenerator.generateControllers(completeDevices);

    this.repairOfflineAccessories(baseControllers);
  }

  private generateMHAccessories(
    hbAccessories: HomebridgeAccessory[],
    mhAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory>,
    baseControllers: Map<string, BaseController>,
    accessoryText: string,
    isOnline: boolean = true
  ) {
    for (const accessory of hbAccessories) {
      const {
        protoDevice: { uniqueId, ipAddress },
        displayName,
      } = accessory.context;
      try {
        MHLogger.info(`Discovered accessory for [${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}]. - ${accessoryText}`);
        const baseController = baseControllers.get(uniqueId);
        const newMHAccessory = this.processMHAccessory(baseController, accessory, isOnline);
        mhAccessories.set(uniqueId, newMHAccessory);
      } catch (error) {
        MHLogger.error(`Error generating accessory for [${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}] `, error);
      }
    }
  }

  private generateActiveAccessories(
    onlineHBAccessories: HomebridgeAccessory[],
    newHBAccessories: HomebridgeAccessory[],
    baseControllers: Map<string, BaseController>
  ): Map<string, HomebridgeMagichomeDynamicPlatformAccessory> {
    const activeMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = new Map();

    this.generateMHAccessories(onlineHBAccessories, activeMHAccessories, baseControllers, "Registering existing accessory.");
    this.generateMHAccessories(newHBAccessories, activeMHAccessories, baseControllers, "Registering new accessory.");
    this.registerNewAccessories(newHBAccessories); //register new accessories from scan
    this.updateExistingAccessories(onlineHBAccessories);

    return activeMHAccessories;
  }

  private async generateOfflineAccessories(offlineHBAccessories: HomebridgeAccessory[]): Promise<Map<string, HomebridgeMagichomeDynamicPlatformAccessory>> {
    const offlineMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory> = new Map();
    const completeMHDevicesInfo: ICompleteDeviceInfo[] = [];

    for (const offlineHBAccessory of offlineHBAccessories) {
      const { deviceMetaData, protoDevice, latestUpdate } = offlineHBAccessory.context;
      const completeDeviceInfo: ICompleteDeviceInfo = { protoDevice, deviceMetaData, latestUpdate };
      offlineHBAccessory.context.isOnline = false;
      completeMHDevicesInfo.push(completeDeviceInfo);
    }

    try {
      const baseControllers: Map<string, BaseController> = await controllerGenerator.generateCustomControllers(completeMHDevicesInfo);
      this.generateMHAccessories(offlineHBAccessories, offlineMHAccessories, baseControllers, "Device Unreachable. Registering accessory with cached information.", false);
    } catch (error) {
      MHLogger.error("[registerOfflineAccessories]", error);
    }
    this.updateExistingAccessories(offlineHBAccessories);
    return offlineMHAccessories;
  }

  //create a new hbAccessory and a new mhAccessory and return them. Returns an object with both
  private generateNewHBAccessory(controller: BaseController): HomebridgeAccessory {
    const {
      protoDevice: { uniqueId },
      protoDevice,
      deviceAPI: { description },
      deviceMetaData,
    } = controller.getCachedDeviceInformation();

    if (!this.isAllowed(uniqueId)) {
      return;
    }
    const homebridgeUUID = this.platform.api.hap.uuid.generate(uniqueId);
    const newHBAccessory: HomebridgeAccessory = new this.platform.api.platformAccessory(description, homebridgeUUID);
    newHBAccessory.context = {
      displayName: description as string,
      deviceMetaData,
      protoDevice,
      latestUpdate: Date.now(),
      assignedAnimations: [],
      isOnline: true,
    };
    return newHBAccessory;
  }

  repairOfflineAccessories(controllers: Map<string, BaseController>) {
    for (const controller of controllers) {
      const {
        protoDevice: { uniqueId, ipAddress },
      } = controller.getCachedDeviceInformation();
      if (this.offlineMHAccessories.has(uniqueId)) {
        let currMHAccessory: HomebridgeMagichomeDynamicPlatformAccessory = this.offlineMHAccessories.get(uniqueId);
        const currHBAccessory = currMHAccessory.hbAccessory;
        if (!currHBAccessory.context.isOnline) MHLogger.trace(`[${currHBAccessory.context.displayName}] - Found existing accessory whos device was offline in previous scan. Testing...`);
        if (currHBAccessory.context.protoDevice.ipAddress !== ipAddress) {
          MHLogger.warn(`[${currHBAccessory.context.displayName}] - IP address has changed. Updating...`);
          currMHAccessory = this.processMHAccessory(controller, currHBAccessory);
        }
        this.onlineMHAccessories.set(uniqueId, currMHAccessory);
        this.offlineMHAccessories.delete(uniqueId);
      }
    }
  }

  private processMHAccessory(controller: BaseController, existingAccessory: HomebridgeAccessory, isOnline: boolean = true): HomebridgeMagichomeDynamicPlatformAccessory {
    const { protoDevice, deviceMetaData } = controller.getCachedDeviceInformation();

    if (!this.isAllowed(protoDevice.uniqueId)) throw new Error("Accessory is not allowed. Skipping...");
    if (isOnline) mergeDeep(existingAccessory.context, { protoDevice, deviceMetaData, latestUpdate: Date.now(), isOnline: true });

    return new HomebridgeMagichomeDynamicPlatformAccessory(this.platform, existingAccessory, controller);
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

  public async removeAllAccessories() {
    if (this.hbAccessoriesFromDisk.size === 0) return;
    this.hbAccessoriesFromDisk.forEach((accessory) => {
      this.unregisterAccessory(accessory, "Removing accessory from disk.");
    });
  }

  unregisterAccessory(existingAccessory: HomebridgeAccessory, reason: string) {
    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    this.onlineMHAccessories.delete(existingAccessory.UUID);

    MHLogger.warn(`[${existingAccessory.context.displayName}] - ${reason}`);
  }
}
