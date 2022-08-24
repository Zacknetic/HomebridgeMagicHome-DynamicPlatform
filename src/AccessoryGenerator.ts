import { BaseController, ControllerGenerator, IDeviceAPI, ICompleteDevice, IProtoDevice, ICompleteDeviceInfo, mergeDeep, overwriteDeep } from 'magichome-platform';
import { IAccessoryContext, IAccessoryState, MagicHomeAccessory } from './misc/types';
import { API, HAP, PlatformAccessory, PlatformConfig } from 'homebridge';

// import { homekitInterface } from './misc/types';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';

export class AccessoryGenerator {

	public readonly accessoriesFromDiskMap: Map<string, MagicHomeAccessory> = new Map();
	public readonly activeAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
	public readonly cachedAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();

	private hap: HAP;
	private api: API;
	private hbLogger;
	private config: PlatformConfig;
	private controllerGenerator: ControllerGenerator;
	private logs: Logs;
	activeAccessoriesList: HomebridgeMagichomeDynamicPlatformAccessory[];
	constructor(api, logs, hbLogger, config, accessoriesFromDiskMap, controllerGenerator) {
		this.api = api;
		this.hap = api.hap;
		this.hbLogger = hbLogger;
		this.logs = logs;
		this.config = config;
		this.accessoriesFromDiskMap = accessoriesFromDiskMap;
		this.controllerGenerator = controllerGenerator;
		this.activeAccessoriesList = [];
	}

	public async discoverDevices(): Promise<HomebridgeMagichomeDynamicPlatformAccessory[]> {
		this.logs.info('Scanning network for MagicHome accessories...');

		try {
			const completeDevices: ICompleteDevice[] = await this.controllerGenerator.discoverCompleteDevices();


			const controllers: BaseController[] = await this.controllerGenerator.generateControllers(completeDevices);
			const activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[] = await this.generateActiveAccessories(controllers);
			// this.registerOfflineAccessories();
			return activeAccessories;
		} catch (error) {
			this.logs.error(error);
		}

	}

	public async rediscoverDevices(timeoutMinutes: number) {
		const completeDevices: ICompleteDevice[] = await this.controllerGenerator.discoverCompleteDevices();

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
				const { protoDevice: { uniqueId }, deviceState, deviceAPI } = controller.getCachedDeviceInformation();
				let currAccessory: MagicHomeAccessory;
				if (this.accessoriesFromDiskMap.has(uniqueId)) {
					const existingAccessory = this.accessoriesFromDiskMap.get(uniqueId);
					// console.log(existingAccessory.context.displayName)
					// console.log(existingAccessory.context.displayName.toLocaleLowerCase().includes('zack'));

					// if (!existingAccessory.context.displayName.includes('Zacks')) {
					// 	continue;
					// }
					this.accessoriesFromDiskMap.delete(uniqueId);
					this.logs.info(`[${existingAccessory.context.displayName}] - Found existing accessory. Updating...`);
					currAccessory = this.processOnlineAccessory(controller, existingAccessory);
					existingAccessoriesList.push(currAccessory);

				} else if (!this.activeAccessoriesMap.has(uniqueId)) { //if the accessory is not a duplicate active device
					currAccessory = this.createNewAccessory(controller);
					// this.logs.info(`[${currAccessory.context.displayName}] - Found new accessory. Registering...`);
					newAccessoriesList.push(currAccessory);	//add it to new accessory list
				}

				this.activeAccessoriesMap.set(uniqueId, currAccessory);
			} catch (error) {
				this.logs.error(error);
			}
		}

		this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
		this.updateExistingAccessories(existingAccessoriesList);
		return this.activeAccessoriesList;
	}

	// repairActiveAcessories(protoDevices: IProtoDevice[]) {

	// 	const { uniqueId, ipAddress } = protoDevice;
	// 	if (this.activeAccessoriesMap.has(uniqueId)) {
	// 		const activeAccessory = this.activeAccessoriesMap.get(uniqueId);
	// 		this.logs.warn(`[${activeAccessory.context.displayName}] - Found existing accessory which was offline in previous scan. Testing...`);
	// 		if (activeAccessory.context.cachedDeviceInformation.protoDevice.ipAddress === protoDevice.ipAddress) return;
	// 		else {

	// 		}

	// 	}
	// }

	createNewAccessory(controller: BaseController) {

		const cachedDeviceInformation = controller.getCachedDeviceInformation();
		const { protoDevice: { uniqueId }, protoDevice, deviceAPI: { description }, deviceMetaData } = cachedDeviceInformation;
		if (!this.isAllowed(uniqueId)) {
			return;
		}
		const homebridgeUUID = this.hap.uuid.generate(uniqueId);
		// console.log(homebridgeUUID);
		const newAccessory: MagicHomeAccessory = new this.api.platformAccessory(description, homebridgeUUID) as MagicHomeAccessory;
		// console.log(newAccessory)
		newAccessory.context = { displayName: description as string, deviceMetaData, protoDevice, latestUpdate: Date.now() };
		// new homekitInterface[description](this.api, newAccessory, this.config, controller, this.hbLogger, this.logs);
		const hBAccessory = new HomebridgeMagichomeDynamicPlatformAccessory(this.api, newAccessory, this.config, controller, this.hbLogger, this.logs)
		this.activeAccessoriesList.push(hBAccessory);
		return newAccessory;

	}

	processOnlineAccessory(controller: BaseController, existingAccessory: MagicHomeAccessory) {

		const { protoDevice, deviceAPI: { description }, deviceMetaData } = controller.getCachedDeviceInformation();

		// if (!this.isAllowed(uniqueId)) {
		// 	// throw new Error(`[Error] [${existingAccessory.context.displayName}] - Accessory is not allowed. Skipping...`);
		// }

		overwriteDeep(existingAccessory.context, { protoDevice, deviceMetaData, latestUpdate: Date.now() });

		try {
			const hBAccessory = new HomebridgeMagichomeDynamicPlatformAccessory(this.api, existingAccessory, this.config, controller, this.hbLogger, this.logs);
			this.activeAccessoriesList.push(hBAccessory);

			// new homekitInterface[description](this.api, existingAccessory, this.config, controller, this.hbLogger, this.logs);
		} catch (error) {
			// throw new Error(`[Error] [${existingAccessory.context.displayName}] [UID: ${cachedDeviceInformation.protoDevice.uniqueId}] [processExistingAccessory]: ${error}`);
		}
		return existingAccessory;
	}

	registerOfflineAccessories() {
		const offlineAccessoriesList: MagicHomeAccessory[] = [];
		const completeDevicesInfo: ICompleteDeviceInfo[] = [];
		this.accessoriesFromDiskMap.forEach(async (offlineAccessory) => {
			const { displayName, deviceMetaData, protoDevice, latestUpdate } = offlineAccessory.context;
			const completeDeviceInfo: ICompleteDeviceInfo = { protoDevice, deviceMetaData, latestUpdate };
			completeDevicesInfo.push(completeDeviceInfo);
		});

		const controllers = this.controllerGenerator.generateCustomControllers(completeDevicesInfo);

		for (const controller of controllers) {
			try {
				const { protoDevice: { uniqueId } } = controller.getCachedDeviceInformation();
				if (this.accessoriesFromDiskMap.has(uniqueId)) {
					const offlineAccessory = this.accessoriesFromDiskMap.get(uniqueId);
					this.accessoriesFromDiskMap.delete(uniqueId);
					this.processOfflineAccessory(offlineAccessory, controller);
					offlineAccessoriesList.push(offlineAccessory);
					this.cachedAccessoriesMap.set(uniqueId, offlineAccessory);
				}
			} catch (error) {
				this.logs.error(error);
			}
		}

		this.updateExistingAccessories(offlineAccessoriesList);
	}

	processOfflineAccessory(offlineAccessory: MagicHomeAccessory, controller: BaseController) {
		// offlineAccessory.context.restartsSinceSeen++;
		// const { deviceState, protoDevice, deviceAPI, deviceAPI: { description }, completeDevice } = offlineAccessory.context.cachedDeviceInformation;
		// this.logs.warn(`[${offlineAccessory.context.displayName}] [UID: ${protoDevice.uniqueId}] - Device Unreachable. Registering accessory with cached information.`);
		// this.logs.trace(deviceState);
		// new homekitInterface[description](this.api, offlineAccessory, this.config, controller, this.hbLogger);

	}



	registerNewAccessories(newAccessories: MagicHomeAccessory[]) {
		// link the accessory to your platform
		this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);

	}

	updateExistingAccessories(existingAccessories: MagicHomeAccessory[]) {
		this.api.updatePlatformAccessories(existingAccessories);
	}

	isAllowed(uniqueId: string): boolean {

		const blacklistedUniqueIDs = this.config.deviceManagement?.blacklistedUniqueIDs ?? [];
		const isWhitelist: boolean = this.config.deviceManagement?.blacklistOrWhitelist?.includes('whitelist') ?? false;
		const onList: boolean = (blacklistedUniqueIDs).includes(uniqueId);

		const isAllowed = isWhitelist ? onList : !onList;

		return isAllowed;
	}

	unregisterAccessory(existingAccessory: MagicHomeAccessory, reason: string) {

		this.activeAccessoriesMap.delete(existingAccessory.UUID);
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
		this.logs.warn(reason);
	}

	//    const accessory = new this.api.platformAccessory(deviceQueryData.lightParameters.convenientName, generatedUUID) as MagicHomeAccessory;

}