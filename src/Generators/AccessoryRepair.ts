import {
	ICompleteDevice,
	BaseController,
	ControllerGenerator,
} from 'magichome-platform';
import { MHLogger } from '../misc/helpers/MHLogger';
import { AccessoryGenerator } from './AccessoryGenerator';
import { HomebridgeAccessory } from '../misc/types/types';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export async function rescanAccessories(
	controllerGenerator: ControllerGenerator,
	hbAccessoriesFromDisk: Map<string, HomebridgeAccessory>,
	offlineMHAccessories: Map<
		string,
		HomebridgeMagichomeDynamicPlatformAccessory
	>,
	onlineMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory>
) {
	const scanInterval = 10000; // 1 minute
	const shouldScan = true;
	const scan = async () => {
		while (shouldScan) {
			// Adding a loop to keep scanning
			try {
				MHLogger.trace('Scanning network for MagicHome accessories...');
				MHLogger.trace('Offline devices: ', offlineMHAccessories.keys());
				const completeDevices: ICompleteDevice[] =
					await controllerGenerator.discoverCompleteDevices();
				const baseControllers: Map<string, BaseController> =
					controllerGenerator.generateControllers(completeDevices);

				repairAccessory(offlineMHAccessories, baseControllers, false, onlineMHAccessories);
				repairAccessory(onlineMHAccessories, baseControllers, true, onlineMHAccessories);
				const { newHBAccessories } = AccessoryGenerator.filterHBAccessories(
					baseControllers,
					hbAccessoriesFromDisk
				);
				AccessoryGenerator.generateActiveAccessories(
					[],
					newHBAccessories,
					baseControllers
				);
			} catch (error) {
				MHLogger.error('Rescan Error: ', error);
			} finally {
				await new Promise((resolve) => setTimeout(resolve, scanInterval)); // Wait for scanInterval before next iteration
			}
		}
	};

	MHLogger.trace('Starting device rescan...');
	try {
		await scan();
	} catch (error) {
		MHLogger.error('Rescan Error Outer: ', error);
	}
}

function repairAccessory(
	mhAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory>,
	baseControllers: Map<string, BaseController>,
	repairOnline: boolean,
	onlineMHAccessories: Map<string, HomebridgeMagichomeDynamicPlatformAccessory>
) {
	for (let mhAccessory of mhAccessories.values()) {
		const {
			protoDevice: { uniqueId, ipAddress },
			displayName,
			isOnline,
		} = mhAccessory.hbAccessory.context;
		try {
			if (baseControllers.has(uniqueId)) {
				//if the device is now online
				const baseController = baseControllers.get(uniqueId);
				const currHBAccessory = mhAccessory.hbAccessory;
				if (!isOnline) {
					MHLogger.trace(
						`${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}] - Found existing accessory whos device was reported offline. Updating`
					);
				}

				if (
					baseController.getCachedDeviceInformation().protoDevice.ipAddress !==
					ipAddress
				) {
					MHLogger.warn(
						`[${currHBAccessory.context.displayName}] - IP address has changed. Updating...`
					);
					mhAccessory = AccessoryGenerator.processMHAccessory(
						baseControllers.get(uniqueId),
						currHBAccessory
					);
				}
				if (!repairOnline) {
					mhAccessories.delete(uniqueId);
					onlineMHAccessories.set(uniqueId, mhAccessory);
					mhAccessory.hbAccessory.context.isOnline = true;
				}
			}
		} catch (error) {
			MHLogger.error(
				`Error repairing accessory for [${displayName}] [UID: ${uniqueId}] [IP: ${ipAddress}] `,
				error
			);
		}
	}
}
