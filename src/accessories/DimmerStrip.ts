import { HomebridgeMagichomeDynamicPlatformAccessory } from '../PlatformAccessory';
import { ILightState } from '../magichome-interface/types';
import { cloneDeep } from 'lodash'; 
import Common from './common'; 

export class DimmerStrip extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  addHomekitProps(state:ILightState):void {
    // convert Dimmer to HSB
    Common.convertDimmerToHSB(state, this);
    return;
  }

  addMagicHomeProps(state:ILightState):void {
    // convert HSB to Dimmer
    Common.convertHSBtoDimmer(state, this);
    return;
  }

  async updateDeviceState(_timeout = 200, state:ILightState) {
    this.addMagicHomeProps(state);
    this.lightLastWrittenState = cloneDeep(state);   
    await this.send([0x31, state.RGB.red, 0x00, 0x00, 0x03, 0x01, 0x0F]); //8th byte checksum calculated later in send()
  }
    
}