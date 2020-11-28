import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';
import Common from './common'; 
import { cloneDeep } from 'lodash'; 
import { ILightState } from '../magichome-interface/types';

export class RGBWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  public eightByteProtocol = 2;

  addHomekitProps(state:ILightState):void {
    Common.convertRGBWtoHSB(state, this as any);
    return;
  }

  addMagicHomeProps(state:ILightState):void {
    Common.convertHSBtoRGBW(state, this as any);
    return;
  }

  async updateDeviceState(_timeout = 200, lockedState:ILightState) {
    this.addMagicHomeProps(lockedState);
    this.lightLastWrittenState = cloneDeep(lockedState);   
    const { r, g, b, ww, mask } = Common.getRGBWfromState(lockedState);

    if(this.eightByteProtocol == 0){
      await this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    } else if(this.eightByteProtocol == 1){
      await this.send([0x31, r, g, b, ww, 0x00, mask, 0x0F]);
    } else if (this.eightByteProtocol == 2){
      this.eightByteProtocol = (await this.send([0x31, r, g, b, ww, 0x00, mask, 0x0F])) == undefined ? 0 : 1;
      await this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    }

  }

}