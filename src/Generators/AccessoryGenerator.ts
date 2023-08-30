import {
	BaseController,
	ControllerGenerator,
	ICompleteDevice,
	ICompleteDeviceInfo,
	mergeDeep,
} from 'magichome-platform';
import { HomebridgeAccessory, AccessoryTypes } from '../misc/types/types';
import { HomebridgeMagichomeDynamicPlatform } from '../platform';
import { MHLogger } from '../misc/helpers/MHLogger';
import { MHConfig } from '../misc/helpers/MHConfig';
import { rescanAccessories } from './AccessoryRepair';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';

const controllerGenerator: ControllerGenerator = new ControllerGenerator();

export class AccessoryGenerator {
	private static instance: AccessoryGenerator;
	private static onlineMHAccessories: Map<
		string,
		HomebridgeMagichomeDynamicPlatformAccessory
	> = new Map();
	private static offlineMHAccessories: Map<
		string,
		HomebridgeMagichomeDynamicPlatformAccessory
	> = new Map();

	constructor(
		private readonly platform: HomebridgeMagichomeDynamicPlatform,
		public readonly hbAccessoriesFromDisk: Map<string, HomebridgeAccessory>
	) {
		if (AccessoryGenerator.instance) {
			return AccessoryGenerator.instance;
		}
		this.platform = platform;
		MHLogger.info('Accessory Generator Initialized');
		AccessoryGenerator.instance = this;
	}

	public static async discoverAccessories() {
		// : Promise<Map<string, HomebridgeMagichomeDynamicPlatformAccessory>>
		MHLogger.info('Scanning network for MagicHome accessories...');

		try {
			const completeDevices: ICompleteDevice[] =
				await controllerGenerator.discoverCompleteDevices();
			const baseControllers: Map<string, BaseController> =
				await controllerGenerator.generateControllers(completeDevices);
			const { onlineHBAccessories, offlineHBAccessories, newHBAccessories } =
				AccessoryGenerator.filterHBAccessories(
					baseControllers,
					AccessoryGenerator.instance.hbAccessoriesFromDisk
				);
			AccessoryGenerator.onlineMHAccessories =
				await AccessoryGenerator.generateActiveAccessories(
					onlineHBAccessories,
					newHBAccessories,
					baseControllers
				);
			AccessoryGenerator.offlineMHAccessories =
				await AccessoryGenerator.generateOfflineAccessories(
					offlineHBAccessories
				);
			return AccessoryGenerator.onlineMHAccessories;
		} catch (error) {
			MHLogger.error(error);
		}
	}

	public static async rescanAccessories() {
		await rescanAccessories(
			controllerGenerator,
			AccessoryGenerator.instance.hbAccessoriesFromDisk,
			AccessoryGenerator.offlineMHAccessories,
			AccessoryGenerator.onlineMHAccessories
		);
	}

	public static filterHBAccessories(
		baseControllers: Map<string, BaseController>,
		hbAccessories: Map<string, HomebridgeAccessory>
	): {
		onlineHBAccessories: HomebridgeAccessory[];
		offlineHBAccessories: HomebridgeAccessory[];
		newHBAccessories: HomebridgeAccessory[];
	} {
		const onlineHBAccessories: HomebridgeAccessory[] = [];
		const offlineHBAccessories: HomebridgeAccessory[] = [];
		const newHBAccessories: HomebridgeAccessory[] = [];

		hbAccessories.forEach((hbAccessory) => {
			const { uniqueId } = hbAccessory.context.protoDevice;
			if (baseControllers.has(uniqueId)) onlineHBAccessories.push(hbAccessory);
			else offlineHBAccessories.push(hbAccessory);
		});

		baseControllers.forEach((controller) => {
			const { uniqueId } = controller.getCachedDeviceInformation().protoDevice;
			if (!hbAccessories.has(uniqueId)) {
				const newHBAccessory =
					AccessoryGenerator.generateNewHBAccessory(controller);
				AccessoryGenerator.instance.hbAccessoriesFromDisk.set(
					uniqueId,
					newHBAccessory
				);
				newHBAccessories.push(newHBAccessory);
			}
		});

		return { onlineHBAccessories, offlineHBAccessories, newHBAccessories };
	}

	private static generateMHAccessories(
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
				MHLogger.info(
					`Discovered accessory for [${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}]. - ${accessoryText}`
				);
				const baseController = baseControllers.get(uniqueId);
				const newMHAccessory = AccessoryGenerator.processMHAccessory(
					baseController,
					accessory,
					isOnline
				);
				mhAccessories.set(uniqueId, newMHAccessory);
			} catch (error) {
				MHLogger.error(
					`Error generating accessory for [${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}] `,
					error
				);
			}
		}
	}

	public static generateActiveAccessories(
		onlineHBAccessories: HomebridgeAccessory[],
		newHBAccessories: HomebridgeAccessory[],
		baseControllers: Map<string, BaseController>
	): Map<string, HomebridgeMagichomeDynamicPlatformAccessory> {
		const activeMHAccessories: Map<
			string,
			HomebridgeMagichomeDynamicPlatformAccessory
		> = new Map();

		AccessoryGenerator.generateMHAccessories(
			onlineHBAccessories,
			activeMHAccessories,
			baseControllers,
			'Registering existing accessory.'
		);
		AccessoryGenerator.generateMHAccessories(
			newHBAccessories,
			activeMHAccessories,
			baseControllers,
			'Registering new accessory.'
		);
		AccessoryGenerator.registerNewAccessories(newHBAccessories); //register new accessories from scan
		AccessoryGenerator.updateExistingAccessories(onlineHBAccessories);

		return activeMHAccessories;
	}

	private static async generateOfflineAccessories(
		offlineHBAccessories: HomebridgeAccessory[]
	): Promise<Map<string, HomebridgeMagichomeDynamicPlatformAccessory>> {
		const offlineMHAccessories: Map<
			string,
			HomebridgeMagichomeDynamicPlatformAccessory
		> = new Map();
		const completeMHDevicesInfo: ICompleteDeviceInfo[] = [];

		for (const offlineHBAccessory of offlineHBAccessories) {
			const { deviceMetaData, protoDevice, latestUpdate } =
				offlineHBAccessory.context;
			const completeDeviceInfo: ICompleteDeviceInfo = {
				protoDevice,
				deviceMetaData,
				latestUpdate,
			};
			offlineHBAccessory.context.isOnline = false;
			completeMHDevicesInfo.push(completeDeviceInfo);
		}

		try {
			const baseControllers: Map<string, BaseController> =
				await controllerGenerator.generateCustomControllers(
					completeMHDevicesInfo
				);
			this.generateMHAccessories(
				offlineHBAccessories,
				offlineMHAccessories,
				baseControllers,
				'Device Unreachable. Registering accessory with cached information.',
				false
			);
		} catch (error) {
			MHLogger.error('[registerOfflineAccessories]', error);
		}
		AccessoryGenerator.updateExistingAccessories(offlineHBAccessories);
		return offlineMHAccessories;
	}

	//create a new hbAccessory and a new mhAccessory and return them. Returns an object with both
	private static generateNewHBAccessory(
		controller: BaseController
	): HomebridgeAccessory {
		const {
			protoDevice: { uniqueId },
			protoDevice,
			deviceAPI: { description },
			deviceMetaData,
		} = controller.getCachedDeviceInformation();

		if (!AccessoryGenerator.isAllowed(uniqueId)) {
			return;
		}
		const homebridgeUUID =
			AccessoryGenerator.instance.platform.api.hap.uuid.generate(uniqueId);
		const newHBAccessory: HomebridgeAccessory =
			new AccessoryGenerator.instance.platform.api.platformAccessory(
				description,
				homebridgeUUID
			);
		newHBAccessory.context = {
			displayName: description as string,
			deviceMetaData,
			protoDevice,
			latestUpdate: Date.now(),
			assignedAnimations: [],
			isOnline: true,
			accessoryType: AccessoryTypes.Light,
		};
		return newHBAccessory;
	}

	public static processMHAccessory(
		controller: BaseController,
		hbAccessory: HomebridgeAccessory,
		updateOnline: boolean = true
	): HomebridgeMagichomeDynamicPlatformAccessory {
		const { protoDevice, deviceMetaData } =
			controller.getCachedDeviceInformation();

		if (!AccessoryGenerator.isAllowed(protoDevice.uniqueId))
			throw new Error('Accessory is not allowed. Skipping...');
		if (updateOnline)
			mergeDeep(hbAccessory.context, {
				protoDevice,
				deviceMetaData,
				latestUpdate: Date.now(),
				isOnline: true,
			});
		return new HomebridgeMagichomeDynamicPlatformAccessory(
			AccessoryGenerator.instance.platform,
			hbAccessory,
			controller
		);
	}

	private static registerNewAccessories(newAccessories: HomebridgeAccessory[]) {
		AccessoryGenerator.instance.platform.api.registerPlatformAccessories(
			PLUGIN_NAME,
			PLATFORM_NAME,
			newAccessories
		);
	}

	private static updateExistingAccessories(
		existingAccessories: HomebridgeAccessory[]
	) {
		AccessoryGenerator.instance.platform.api.updatePlatformAccessories(
			existingAccessories
		);
	}

	private static isAllowed(uniqueId: string): boolean {
		const { blacklistedUniqueIDs, blacklistOrWhitelist } =
			MHConfig.deviceManagement;
		const onList: boolean = blacklistedUniqueIDs.includes(uniqueId);

		return blacklistOrWhitelist.includes('whitelist') ? onList : !onList;
	}

	public static async removeAllAccessories() {
		if (AccessoryGenerator.instance.hbAccessoriesFromDisk.size === 0) return;
		AccessoryGenerator.instance.hbAccessoriesFromDisk.forEach((accessory) => {
			AccessoryGenerator.unregisterAccessory(
				accessory,
				'Removing accessory from disk.'
			);
		});
	}

	private static unregisterAccessory(
		existingAccessory: HomebridgeAccessory,
		reason: string
	) {
		AccessoryGenerator.instance.platform.api.unregisterPlatformAccessories(
			PLUGIN_NAME,
			PLATFORM_NAME,
			[existingAccessory]
		);
		AccessoryGenerator.onlineMHAccessories.delete(existingAccessory.UUID);

		MHLogger.warn(`[${existingAccessory.context.displayName}] - ${reason}`);
	}
}
