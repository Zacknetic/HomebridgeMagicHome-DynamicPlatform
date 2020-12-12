import { APIEvent } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { join } from 'path';
import { loadJson } from './magichome-interface/utils';
import { Switch } from './accessories/Switch';
import { DimmerStrip } from './accessories/DimmerStrip';
import { RGBStrip } from './accessories/RGBStrip';
import { GRBStrip } from './accessories/GRBStrip';
import { RGBWBulb } from './accessories/RGBWBulb';
import { RGBWWBulb } from './accessories/RGBWWBulb';
import { RGBWStrip } from './accessories/RGBWStrip';
import { RGBWWStrip } from './accessories/RGBWWStrip';
import { cloneDeep } from 'lodash';
import { setLogger } from './instance';

import { Discover } from './magichome-interface/Discover';
import { Transport } from './magichome-interface/Transport';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { IDeviceProps, IDeviceDiscoveredProps, IDeviceQueriedProps, ILightParameters } from './magichome-interface/types';
import { getPrettyName as getUniqueIdName, lightTypesMap} from './magichome-interface/LightMap';
import { MagicHomeAccessory, ControllerTypes } from './magichome-interface/types';
const NEW_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);
//const LEGACY_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0xEF, 0x01, 0x77]);

const accessoryType = {
  Switch,
  DimmerStrip,
  GRBStrip,
  RGBStrip,
  RGBWBulb,
  RGBWWBulb,
  RGBWStrip,
  RGBWWStrip,
};

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagichomeDynamicPlatform implements DynamicPlatformPlugin {
  public readonly Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: MagicHomeAccessory[] = [];
  public count = 1;
  //public readonly log: Logger;
  private periodicDiscovery: NodeJS.Timeout | null = null;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    setLogger(log);

    //this.log = getLogger();
    this.log.warn('Finished initializing homebridge-magichome-dynamic-platform %o', loadJson<any>(join(__dirname, '../package.json'), {}).version);
    this.log.info('If this plugin brings you joy, consider visiting GitHub and giving it a ⭐.');

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug('Executed didFinishLaunching callback');
      this.count = 1;
      // run the method to discover / register your devices as accessories
      this.discoverDevices(true);
      // Periodic scan for devices
      this.periodicDiscovery = setInterval( () => this.discoverDevices(false), 30000);
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: MagicHomeAccessory) {

    this.log.debug('%o - Loading accessory from cache...', this.count++, accessory.context.device.displayName);
    // set cached accessory as not recently seen 
    // if found later to be a match with a discovered device, will change to true
    accessory.context.device.restartsSinceSeen++;
    accessory.context.pendingRegistration = true;
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Accessories are added by one of three Methods:
   * Method One: New devices that were seen after scanning the network and are registered for the first time
   * Method Two: Cached devices that were seen after scanning the network and are added while checking for ip discrepancies 
   * Method Three: Cached devices that were not seen after scanning the network but are still added with a warning to the user
   */
  async discoverDevices(dgb: boolean | null) {
    const { isValidDeviceModel } = HomebridgeMagichomeDynamicPlatform;
    const pendingUpdate = new Set();
    const recentlyRegisteredDevices  = new Set();

    let registeredDevices = 0, newDevices = 0, unseenDevices = 0, scans = 0;
    let discover = new Discover(this.log, this.config);
    let devicesDiscovered: IDeviceDiscoveredProps[] = await discover.scan(2000);
  
    while(devicesDiscovered.length === 0 && scans <5){
      this.log.debug('( Scan: %o ) Discovered zero devices... rescanning...', scans + 1);
      devicesDiscovered = await discover.scan(2000);
      scans++;
    }

    discover = null;
    if (devicesDiscovered.length === 0){
      this.log.debug('\nDiscovered zero devices!\n');
    } else {
      this.log.debug('\nDiscovered %o devices.\n', devicesDiscovered.length);
    }
  
    // loop over the discovered devices and register each one if it has not already been registered
    for ( const deviceDiscovered of devicesDiscovered) { 
      let existingAccessory: MagicHomeAccessory = null;
      try {
        // generate a unique id for the accessory this should be generated from
        const generatedUUID = this.api.hap.uuid.generate(deviceDiscovered.uniqueId);
        // check that the device has not already been registered by checking the
        // cached devices we stored in the `configureAccessory` method above
        existingAccessory = this.accessories.find(accessory => accessory.UUID === generatedUUID);  

        if (!existingAccessory) { 
          if(!this.createNewAccessory(deviceDiscovered, generatedUUID)) {
            continue;
          }
          recentlyRegisteredDevices.add(deviceDiscovered.uniqueId);
          registeredDevices++;
          newDevices++;
          
        } else {
          // This deviceDiscovered already exist in cache!

          // Check if cached device complies to the device model,
          if(!isValidDeviceModel(existingAccessory.context.device, null)) {    
            //`Device "${uniqueId}" is online, but has outdated data model. Attempting to update it. 
            this.log.debug(`The known device "${deviceDiscovered.uniqueId}" seen during discovery has outdated data model (pre v1.8.6). Rebuilding device. `, deviceDiscovered);


            // ****** RECONSTRUCT DEVICE - patch existingAccessory with updated data *****
            const initialState = await this.getInitialState (deviceDiscovered.ipAddress, 10000);
            const deviceQueryData:IDeviceQueriedProps = await this.determineController(deviceDiscovered);

            if(!initialState || !deviceQueryData){
              this.log.error('Warning! Device type could not be determined for device: %o, this is usually due to an unresponsive device.\n Please restart homebridge. If the problem persists, ensure the device works in the "Magichome Pro" app.\n file an issue on github with an uploaded log\n', 
                deviceDiscovered.uniqueId);
              continue;
            }

            const oldName = existingAccessory.context.displayName || 
                            existingAccessory.context.device?.lightParameters?.convenientName || 
                            deviceQueryData.lightParameters.convenientName;

            const rootProps = {UUID: generatedUUID, cachedIPAddress: deviceDiscovered.ipAddress, restartsSinceSeen: 0, displayName: oldName, lastKnownState: initialState};
            const deviceData: IDeviceProps = Object.assign(rootProps, deviceDiscovered, deviceQueryData);        
            existingAccessory.context.device = deviceData; 
            // ****** RECONSTRUCT DEVICE *****
  
            if(isValidDeviceModel(existingAccessory.context.device, this.log)){
              this.log.debug(`[discovered+cached] Device "${deviceDiscovered.uniqueId}" successfully repaired!`);
            } else {
              this.log.error(`[discovered+cached] Device "${deviceDiscovered.uniqueId}" was not repaired successfully. Ensure it can be controlled in the MagicHome app then restart homebridge to try again while it is online.`);
              continue;
            }

          }
          if(!this.registerExistingAccessory(deviceDiscovered, existingAccessory)){
            continue;
          }

          // add to list of registered devices, so we can show a summary in the end
          recentlyRegisteredDevices.add(deviceDiscovered.uniqueId);
          registeredDevices++;
        } 

      } catch (error) {
        this.log.error('[discovered+cached] platform.ts discoverDevices() accessory creation has thrown the following error: %o', error);
        this.log.error('[discovered+cached] The existingAccessory object is: ', existingAccessory);
        this.log.error('[discovered+cached] The deviceDiscovered object is: ', deviceDiscovered);
      }
    }
    //=================================================
    // End Cached Devices //

   
    //***************** Device Pruning Start *****************//
    
    //if config settings are enabled, devices that are no longer seen
    //will be pruned, removing them from the cache. Usefull for removing
    //unplugged or unresponsive accessories

    for (const accessory of this.accessories){
      try {
           
        if(!isValidDeviceModel(accessory.context.device, null)) {
          // only offline, cached devices, old data model, should trigger here.
          const { uniqueId } = accessory.context.device;
          this.log.debug(`Device "${uniqueId}" was not seen during discovery. Ensure it can be controlled in the MagicHome app. Rescan in 30 seconds...`);
          pendingUpdate.add(uniqueId);
          continue;
        }
        
        if(accessory.context.device?.displayName && accessory.context.device.displayName.toString().toLowerCase().includes('delete')){
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.warn('Successfully pruned accessory: ', accessory.context.device.displayName,
            'due to being marked for deletion\n');
          continue;
        
        //if the config parameters for pruning are set to true, prune any devices that haven't been seen
        //for more restarts than the accepted ammount
        } else if(this.config.pruning.pruneMissingCachedAccessories || this.config.pruning.pruneAllAccessoriesNextRestart){
          if(accessory.context.device.restartsSinceSeen >= this.config.pruning.restartsBeforeMissingAccessoriesPruned || this.config.pruning.pruneAllAccessoriesNextRestart){
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.log.warn('Successfully pruned accessory:', accessory.context.device.displayName,
              'which had not being seen for (',accessory.context.device.restartsSinceSeen,') restart(s).\n');
            continue;
          }
        }
        //simple warning to notify user that their accessory hasn't been seen in n restarts
        if(accessory.context.device.restartsSinceSeen > 0){
        //logic for removing blacklisted devices
    
          if(!this.isAllowed(accessory.context.device.uniqueId)){
            this.log.warn('Warning! Accessory: %o will be pruned as its Unique ID: %o is blacklisted or is not whitelisted.\n', 
              accessory.context.device.displayName, accessory.context.device.uniqueId);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            continue;
          }

          this.log.debug(`Warning! Continuing to register cached accessory "${accessory.context.device.uniqueId}" despite not being seen for ${accessory.context.device.restartsSinceSeen} restarts.`);

          // create the accessory handler
          let lightAccessory: HomebridgeMagichomeDynamicPlatformAccessory = null;
          try {
            lightAccessory = new accessoryType[accessory.context.device.lightParameters.controllerLogicType](this, accessory, this.config);
          } catch (error) {
            this.log.error('[1] The controllerLogicType does not exist in accessoryType list. Did you migrate this? controllerLogicType=', accessory.context.device?.lightParameters?.controllerLogicType);
            this.log.error('device object: ', accessory.context.device);
            continue;
          }

          // udpate the accessory to platform
          this.api.updatePlatformAccessories([accessory]);
          registeredDevices++;
          unseenDevices++;

        }
    
      } catch (error) {
        this.log.error('platform.ts discoverDevices() accessory pruning has thrown the following error: %o',error);
        this.log.error('The context object is: ',accessory.context);
      }
    }

    this.log.debug('\nRegistered %o Magichome device(s). \nNew devices: %o \nCached devices that were seen this restart: %o'
     + '\nCached devices that were not seen this restart: %o\n',
    registeredDevices, 
    newDevices, 
    registeredDevices-newDevices-unseenDevices, 
    unseenDevices);



    // Discovery summary:
    if(recentlyRegisteredDevices.size > 0){
      const found = recentlyRegisteredDevices.size;
      const pending = Array.from(pendingUpdate).length;
      const pendingStr = pending > 0 ? ` Pending update: ${pending} devices` : '';
      this.log.debug(`Discovery summary:  Found ${found} devices.${pendingStr}`);
    }

    this.count = 1; // reset the device logging counter
  }//discoveredDevices


  isAllowed(uniqueId):boolean{
 
    const blacklistedUniqueIDs = this.config.deviceManagement.blacklistedUniqueIDs;
    let isAllowed = true;
    try {

      if(blacklistedUniqueIDs !== undefined 
        && this.config.deviceManagement.blacklistOrWhitelist !== undefined){
        if (((blacklistedUniqueIDs).includes(uniqueId) 
        && (this.config.deviceManagement.blacklistOrWhitelist).includes('blacklist')) 
         || (!(blacklistedUniqueIDs).includes(uniqueId)) 
         && (this.config.deviceManagement.blacklistOrWhitelist).includes('whitelist')){
          isAllowed = false; 
        }
      }
    } catch (error) {
      this.log.debug(error);
    }

    return isAllowed;
  }

  async getInitialState(ipAddress, _timeout = 500){

    const transport = new Transport(ipAddress, this.config);
    try{
      let scans = 0, data;

      while(data == null && scans < 5){
        
        data = await transport.getState(_timeout);
        scans++;
      }

      return data;
    
    } catch (error) {
      this.log.debug(error);
    }
  }
 
  async determineController(discoveredDevice):Promise<IDeviceQueriedProps | null> {
    const { ipAddress } = discoveredDevice || {};
    if(typeof ipAddress !== 'string' ){
      this.log.error('Cannot determine controller because invalid IP address. Device:', discoveredDevice);
      return null;
    }
    const initialState = await this.getInitialState (ipAddress, 10000);
    if( initialState == undefined){
      this.log.debug('Cannot determine controller. Device unreacheable.', discoveredDevice);
      return null;
    }

    let lightParameters: ILightParameters;
    const controllerHardwareVersion = initialState.controllerHardwareVersion;
    const controllerFirmwareVersion = initialState.controllerFirmwareVersion;
  
    this.log.debug('Attempting to assign controller to new device: UniqueId: %o \nIpAddress %o \nModel: %o\nHardware Version: %o \nDevice Type: %o\n',
      discoveredDevice.uniqueId, discoveredDevice.ipAddress,discoveredDevice.modelNumber, initialState.controllerHardwareVersion.toString(16), initialState.controllerFirmwareVersion.toString(16));
 
    //set the lightVersion so that we can give the device a useful name and later know how which protocol to use

    if(lightTypesMap.has(controllerHardwareVersion)){
      this.log.debug('Device %o: Hardware Version: %o with Firmware Version: %o matches known device type records', 
        discoveredDevice.uniqueId,
        controllerHardwareVersion.toString(16),
        controllerFirmwareVersion.toString(16));
      lightParameters = lightTypesMap.get(controllerHardwareVersion);
    } else {
      this.log.warn('Unknown device version number: %o... unable to create accessory.' , controllerHardwareVersion.toString(16));
      this.log.warn('Please create an issue at https://github.com/Zacknetic/HomebridgeMagicHome-DynamicPlatform/issues and upload your homebridge.log');
      return null;
    }

    this.log.debug('Controller Logic Type assigned to %o', lightParameters.controllerLogicType);
    
    return {
      lightParameters,
      controllerHardwareVersion: controllerHardwareVersion, 
      controllerFirmwareVersion: controllerFirmwareVersion,
    };
  }

  /**
 * Accessory Generation Method One: UUID has not been seen before. Register new accessory.
 * Accessories must only be registered once, previously created accessories
 * must not be registered again to prevent "duplicate UUID" errors.
 * @param deviceDiscovered 
 * @param generatedUUID 
 */
  async createNewAccessory(deviceDiscovered:IDeviceDiscoveredProps, generatedUUID):Promise<boolean>{   
    const unsupportedModels: string[] = [ '000-0000']; //AK001-ZJ210 is suported... 

    const deviceQueryData:IDeviceQueriedProps = await this.determineController(deviceDiscovered);

    if(deviceQueryData == null){
      if( unsupportedModels.includes(deviceDiscovered.modelNumber)){
        this.log.error('Warning! Discovered device did not respond to query. Device is in the unsupported device list.\nFile an issue on github requesting support. Details:', deviceDiscovered);
      } else {
        this.log.error('Warning! Discovered device did not respond to query. This is usually due to an unresponsive device.\nPlease restart homebridge. If the problem persists, ensure the device works in the "Magichome Pro" app.\nFile an issue on github with an uploaded log.', deviceDiscovered);
      }
      return false;
    }
    //check if device is on blacklist or is not on whitelist
    if(!this.isAllowed(deviceDiscovered.uniqueId)){
      this.log.warn('Warning! New device with Unique ID: %o is blacklisted or is not whitelisted.\n', 
        deviceDiscovered.uniqueId);

      return false;
    }
    // if user has oped, use unique name such as "Bulb AABBCCDD"
    if( this.config.advancedOptions && this.config.advancedOptions.namesWithMacAddress ){
      const uniqueIdName = getUniqueIdName(deviceDiscovered.uniqueId, deviceQueryData.lightParameters.controllerLogicType);
      deviceQueryData.lightParameters.convenientName = uniqueIdName;
    }

    const accessory = new this.api.platformAccessory(deviceQueryData.lightParameters.convenientName, generatedUUID) as MagicHomeAccessory;

    // set its restart prune counter to 0 as it has been seen this session
    const deviceData: IDeviceProps = Object.assign({UUID: generatedUUID, cachedIPAddress: deviceDiscovered.ipAddress, restartsSinceSeen: 0, displayName: deviceQueryData.lightParameters.convenientName}, deviceDiscovered, deviceQueryData);        
    accessory.context.device = deviceData; 

 
    this.printDeviceInfo('Registering new accessory...!', accessory);
    // link the accessory to your platform
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    
    // create the accessory handler
    let lightAccessory: HomebridgeMagichomeDynamicPlatformAccessory = null;
    try {
      lightAccessory = new accessoryType[accessory.context.device.lightParameters.controllerLogicType](this, accessory, this.config);
    } catch (error) {
      this.log.error('[2] The controllerLogicType does not exist in accessoryType list. controllerLogicType=', accessory.context.device?.lightParameters?.controllerLogicType);
      this.log.error('device object: ', accessory.context.device);
      return false;
    }
    this.accessories.push(accessory);

    return true;
  }

  /**
 * Accessory Generation Method Two: UUID has been seen before. Load from cache.
 * Test if seen accessory "is allowed" and that the IP address is identical
 * @param deviceDiscovered 
 * @param existingAccessory 
 */
  registerExistingAccessory(deviceDiscovered, existingAccessory:MagicHomeAccessory):boolean{

    if(!this.isAllowed(existingAccessory.context.device.uniqueId)){
      this.log.warn('Warning! Accessory: %o will be pruned as its Unique ID: %o is blacklisted or is not whitelisted.\n', 
        existingAccessory.context.device.displayName, existingAccessory.context.device.uniqueId);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      return false;
    }

    // set its restart prune counter to 0 as it has been seen this session
    existingAccessory.context.device.restartsSinceSeen = 0;

    // test if the existing cached accessory ip address matches the discovered
    // accessory ip address if not, replace it
    const ipHasNotChanged = existingAccessory.context.device.cachedIPAddress === deviceDiscovered.ipAddress;
    const { pendingRegistration } = existingAccessory.context;
    const registrationComplete = !pendingRegistration;
    if(registrationComplete  && ipHasNotChanged){
      this.log.debug(`Device ${existingAccessory.context.device.uniqueId} already registered. Registration update not required`) ;
      return false;
    }

    if(!ipHasNotChanged){
      this.log.warn('Ip address discrepancy found for accessory: %o\n Expected ip address: %o\n Discovered ip address: %o' ,
        existingAccessory.context.device.displayName,  existingAccessory.context.device.cachedIPAddress, deviceDiscovered.ipAddress);

      // overwrite the ip address of the existing accessory to the newly disovered ip address
      existingAccessory.context.device.cachedIPAddress = deviceDiscovered.ipAddress;

      this.log.warn('Ip address successfully reassigned to: %o\n ', existingAccessory.context.device.cachedIPAddress);            
    }

    this.printDeviceInfo('Registering existing accessory...', existingAccessory);
            
    // create the accessory handler
    let lightAccessory: HomebridgeMagichomeDynamicPlatformAccessory = null;
    try {
      if( !existingAccessory.context?.device?.lightParameters?.controllerLogicType || accessoryType[existingAccessory.context?.device?.lightParameters?.controllerLogicType] === undefined){
        this.log.error('[registerExistingAccessory] The controllerLogicType does not exist in accessoryType list. controllerLogicType=', existingAccessory.context.device?.lightParameters?.controllerLogicType);
        this.log.error('[registerExistingAccessory] device object: ', existingAccessory.context.device);
        return false;
      }
      lightAccessory = new accessoryType[existingAccessory.context.device.lightParameters.controllerLogicType](this, existingAccessory, this.config);
    } catch (error) {
      this.log.error('[registerExistingAccessory] The controllerLogicType does not exist in accessoryType list. controllerLogicType=', existingAccessory.context.device?.lightParameters?.controllerLogicType);
      this.log.error('[registerExistingAccessory] device object: ', existingAccessory.context.device);
      this.log.error(error);

      return false;
    }

    // udpate the accessory to your platform
    this.api.updatePlatformAccessories([existingAccessory]);
    existingAccessory.context.pendingRegistration = false;
    return true;
  }

  printDeviceInfo(message: string, accessory: MagicHomeAccessory){
    this.log.info( '%o - ' + message +
    '\nDisplay Name: %o \nController Logic Type: %o  \nModel: %o \nUnique ID: %o \nIP-Address: %o \nHardware Version: %o \nFirmware Version: %o \n',  
    this.count++,
    accessory.context.device.displayName,
    accessory.context.device.lightParameters?.controllerLogicType,
    accessory.context.device.modelNumber, 
    accessory.context.device.uniqueId, 
    accessory.context.device.ipAddress,
    accessory.context.device.controllerHardwareVersion?.toString(16),
    accessory.context.device.controllerFirmwareVersion?.toString(16));
  }

  async send(transport, command: number[], useChecksum = true, _timeout = 200) {
    const buffer = Buffer.from(command);

    const output = await transport.send(buffer, useChecksum, _timeout);
    this.log.debug('Recived the following response', output);

  } //send

  static isValidDeviceModel(_device: IDeviceProps, logger):boolean{
    const device = cloneDeep(_device);
    try{
      const { lightParameters } = device || {};

      const rootProps = ['UUID', 'cachedIPAddress', 'restartsSinceSeen', 'displayName', 'ipAddress', 'uniqueId', 'modelNumber', 'lightParameters', 'controllerHardwareVersion', 'controllerFirmwareVersion'];
      const lightProps = [ 'controllerLogicType', 'convenientName', 'simultaneousCCT', 'hasColor', 'hasBrightness'];
  
      const missingRootProps = rootProps.filter( k => device[k] === undefined || device[k] == null);
      const missingLightProps = lightProps.filter( k => lightParameters[k] === undefined || lightParameters[k] == null);
  
      const missingProps = [...missingRootProps, ...missingLightProps];
      
      // special case: props that can be null: 'lastKnownState'
      if(device.lastKnownState === undefined) {
        missingProps.push('lastKnownState');
      }

      if( !Object.values(ControllerTypes).includes( lightParameters.controllerLogicType ) ){
        if(logger){
          logger.error(`[isValidDeviceModel] The ContollerLogicType "${lightParameters.controllerLogicType}" is unknown.` );
        }
        return false;
      }
     
  
      if(missingProps.length > 0){
        if(logger){
          logger.error('[isValidDeviceModel] unable to validate device model. Missing properties: ', missingProps );
          logger.debug('\nThree things are certain:\nDeath, taxes and lost data.\nGuess which has occurred.');
        }
        return false;
      }
      
      return true;
    } catch (err){
      return false;
    }

  }

}//ZackneticMagichomePlatform class
