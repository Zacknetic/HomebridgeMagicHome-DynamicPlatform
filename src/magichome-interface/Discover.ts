import dgram from 'dgram';
import os from 'os';
import broadcastAddress from 'broadcast-address';
import systemInformation from 'systeminformation';
import type { Logger, PlatformConfig } from 'homebridge';
import { Transport } from './Transport';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';
const NEW_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);
const LEGACY_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0xEF, 0x01, 0x77]);

export class Discover {
  private transport: Transport;
  constructor(
    public readonly log: Logger,
    private readonly config: PlatformConfig,
  ){}


  async scan(timeout = 500) {
    const ifaces = os.networkInterfaces();  
    const defaultInterface = await systemInformation.networkInterfaceDefault();
    const broadcastIPAddress = broadcastAddress(defaultInterface.toString());
    return new Promise((resolve, reject) => {
      const clients: Record<string, any> = [];
      const socket = dgram.createSocket('udp4');

      socket.on('error', (err) => {
        socket.close();
        reject(err);
      });

      socket.on('message', (msg) => {

        const parts = msg.toString().split(',');

        if (parts.length !== 3) {
          return;
        }

        const [ipAddress, uniqueId, modelNumber] = parts;
        clients.push({ ipAddress, uniqueId, modelNumber });
      });

      socket.on('listening', () => {
        socket.setBroadcast(true);
        socket.send(BROADCAST_MAGIC_STRING, BROADCAST_PORT, broadcastIPAddress);
      });

      socket.bind(BROADCAST_PORT);

      setTimeout(() => {
        socket.close();
        resolve(clients);
      }, timeout);
    });
  }

  determineTypes(lightVersion, lightVersionModifier, modelNumber){

    //set the lightVersion so that we can give the device a useful name and later know how which protocol to use
    //test if the version modifier is 4 which means it's an RGBW strip
    if(lightVersionModifier === 4){
      lightVersion = 10;
    } else if (lightVersionModifier === 51 && lightVersion === 3){
      lightVersion = 11;
    }

    if(modelNumber.contains('AK001-ZJ2131')){
      lightVersion = 12;
    }


    switch (lightVersion) {

      //light version 2 and 3 has rgb, warmWhite and coldWhite capabilities.
      //both color AND white can be enabled simultaniously (0xFF mask is possible). Both whites can turn on simultaniously as well.
      case 2:  //rgbww simultanious color/white capable wide strip controller
      case 3:  //rgbww simultanious color/white capable compact strip controller

        break;

      case 4: //rgb

        return {
          color_type: 'rgb',
          simultaneousCCT: true,
        };
  
        //light versions 7 and 5 have rgb, warmWhite and coldWhite capabilities.
        //only color OR white can be enabled at one time (no 0xFF mask). However, both whites can turn on simultaniously
      case 5: //rgbww color/white non-simultanious
      case 7: //rgbww color/white non-simultanious

      
        return {
          color_type: 'rgbww',
          simultaneousCCT: false,
        };

  


        //light versions 8 and 9 have rgb and warmWhite capabilities
      case 8: //rgbw
      case 9: //rgbw

        return {
          color_type: 'rgbw',
          simultaneousCCT: true,
        };
        //light version 10 has rgb and warmWhite capabilities.
        //both color AND white can be enabled simultaniously (0xFF mask is possible).
      case 10:  //rgbw simultanious color/white capable
  
        break;

      case 11: //rgb REVERSED... needs the order of red and green switched
        return {
          color_type: 'grb',
          simultaneousCCT: false,
        };

  
        //warn user if we encounter an unknown light type
      default:
        return {
          color_type: 'rgb',
          simultaneousCCT: false,
        };
        this.log.warn('Uknown light version: %o... type probably cannot be set. Trying anyway...', lightVersion);
        this.log.warn('Please create an issue at https://github.com/Zacknetic/HomebridgeMagicHome-DynamicPlatform/issues and post your log.txt');
        break;
    }
  }
  

  
  

  async getInitialState(ipAddress, _timeout = 500){

    try{
      this.transport = new Transport(ipAddress, this.config);
      const data = await this.transport.send(NEW_COMMAND_QUERY_STATE, true, _timeout);
      if (data.length < 14) {
        throw new Error('State query returned invalid data.');
      }
      return {   
        lightVersionModifier: data.readUInt8(1),
        lightVersion: data.readUInt8(10),
      };
    
    } catch (error) {
      // this.log.debug(error);
    }
    
  }

  async send(command: number[], useChecksum = true) {
    const buffer = Buffer.from(command);
    this.log.debug('\nSending command -> %o',
      buffer);

    await this.transport.send(buffer, useChecksum);
  } //send
  
}

