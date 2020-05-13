/* eslint-disable linebreak-style */
import type {PlatformAccessory} from 'homebridge';
//import { Transport } from './transport';
import { ZackneticMagichomePlatform } from '../platform';

const COMMAND_POWER_ON = [0x71, 0x23, 0x0f];
const COMMAND_POWER_OFF = [0x71, 0x24, 0x0f];
const COMMAND_QUERY_STATE = [0x81, 0x8a, 0x8b];

const COMMAND_POWER_ON_SUCCESS = [0xf0, 0x71, 0x23, 0x84];
const COMMAND_POWER_OFF_SUCCESS = [0xf0, 0x71, 0x24, 0x85];

export class LightController{
  constructor(
    private readonly accessory: PlatformAccessory,
    private readonly platform: ZackneticMagichomePlatform,
  ) {

  
  }

  //transport = new Transport (this.accessory.context.cachedIPAddress);
  
  async state() {
    this.platform.log.debug('Querying state');
    const data = await this.send(COMMAND_QUERY_STATE);

    /*
    if (data.length < 14) {
      throw new Error('State query returned invalid data.');
    }

    return {
      
      isOn: data.readUInt8(2) === 0x23,
      color: {
        red: data.readUInt8(6),
        green: data.readUInt8(7),
        blue: data.readUInt8(8),
      },
      warmWhite: data.readUInt8(9),
      lightVersion: data.readUInt8(10),
      coldWhite: data.readUInt8(11),
    };*/
  }

  async send(command: number[] | ArrayBuffer) {
    const buffer = Buffer.from(command);
    //return this.transport.send(buffer);
  }
  
}