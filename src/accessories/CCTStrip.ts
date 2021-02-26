import { clamp } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

export class CCTStrip extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  async updateDeviceState(_timeout = 200) {

    //**** local variables ****\\
    const CCT = this.lightState.CCT;
    const brightness = this.lightState.brightness;

    const newCCT = 100 - ((CCT-140)/3.6);
    this.logs.trace('New CCT Value %o', newCCT );
    
    await this.send([0x35, 0xb1, newCCT, brightness, 0x00, 0x00, 0x00, 0x03], true, _timeout); //9th byte checksum calculated later in send()

    
  }//setColor


  /**
   ** @updateLocalState
   * retrieve light's state object from transport class
   * once values are available, update homekit with actual values
   */
  async updateLocalState() {

    if( this.deviceWriteInProgress || this.deviceUpdateInProgress || this.deviceReadInProgress){
      this.logs.trace('Accessory %o already has write/update/read in progress. Skipping updateLocalState.', this.myDevice.displayName);
      return;
    }

    this.deviceReadInProgress = true;
    
    try {
      let state;
      let scans = 0;
      while(state == null && scans <= 5){
        this.logs.debug('Retrieving accessory %o\'s current state...', this.myDevice.displayName);
        state = await this.transport.getState(1000, true); //retrieve a state object from transport class showing light's current r,g,b,ww,cw, etc
        scans++;
      } 
      if(state == null){
        const { ipAddress, uniqueId, displayName } = this.myDevice;
        this.logs.debug(`No response from device '${displayName}' (${uniqueId}) ${ipAddress}`); 
        
        this.updateLocalIsOn(this.offlineValue);
        this.updateHomekitState();
        this.deviceReadInProgress = false;
        this.deviceIsOffline = true;
        setTimeout(() => {
          this.logs.debug('Checking to see if the device is back online...'); 
          this.updateLocalState();
        }, 8000);
        return;
      } else {
        this.deviceIsOffline = false;
      }
      const convertedCCT = ((100 - state.CCT) * 3.6) + 100;
      this.myDevice.lastKnownState = state;
      this.updateLocalCCT(convertedCCT);
      this.updateLocalIsOn(state.isOn);
      this.updateHomekitState();
      

    } catch (error) {
      this.logs.error('getState() error: ', error);
    }
    this.deviceReadInProgress = false;
  }

  async updateHomekitState() {
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
    if (this.lightState.isOn){
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp(this.lightState.brightness, 0, 100));
      this.service.updateCharacteristic(this.platform.Characteristic.ColorTemperature,clamp(this.lightState.CCT, 140, 500));
    }
    this.cacheCurrentLightState();
  }
    
}