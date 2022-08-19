// import { clamp } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

// export class CCTStrip extends HomebridgeMagichomeDynamicPlatformAccessory {
  
//   async updateDeviceState(_timeout = 200) {

//     // //**** local variables ****\\
//     // const CCT = this.lightState.CCT;
    
//     //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
//     //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
//     //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
//     //const ww = Math.round(((clamp(whites.warmWhite, 0, 127) / 100) * brightness));
//     //const cw = Math.round(((clamp(whites.coldWhite, 0, 127) / 100) * brightness));
    
    
//     //await this.send([0x31, 0x00, 0x00, 0x00, ww, cw, 0xFF, 0x0F], true, _timeout); //9th byte checksum calculated later in send()
//    // await this.send([0x35, 0xb1, ww, cw, 0x00, 0x00, 0x00, 0x03], true, _timeout); //9th byte checksum calculated later in send()

    
//   }//setColor


//   async updateHomekitState() {
//     //   this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
//   //  this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
//     //this.service.updateCharacteristic(this.platform.Characteristic.Saturation,  this.lightState.HSL.saturation);
//     // if (this.lightState.isOn){
//       // this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp((
//       // (this.lightState.whiteValues.coldWhite/1.27) 
//       // + (this.lightState.whiteValues.warmWhite/1.27)), 0, 100));
//     // }
    
//     //this.cacheCurrentLightState();
//   }
    
// }