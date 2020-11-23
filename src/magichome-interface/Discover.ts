import dgram from 'dgram';
import { Network } from './Network';

import type { Logger, PlatformConfig } from 'homebridge';
import { IDeviceDiscoveredProps } from '../magichome-interface/types';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';

export class Discover {
  public count = 1;
  constructor(  
    public readonly log: Logger,
    private readonly config: PlatformConfig,
  ){}


  async scan(timeout = 500): Promise<IDeviceDiscoveredProps[]> {

    return new Promise((resolve, reject) => {
      const userInterfaces = Network.subnets();
      const clients: IDeviceDiscoveredProps[] = [];
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

        if (clients.findIndex((item) => item.uniqueId === uniqueId) === -1) {
          clients.push({ ipAddress, uniqueId, modelNumber });
          this.log.debug('\n%o - Discovered device...\nUniqueId: %o \nIpAddress %o \nModel: %o\n.', this.count++, uniqueId, ipAddress,modelNumber); 
        } else {
          this.log.info('\n%o - A device has been discovered that already exists. Likely due to a "fun" network layout...\nUniqueId: %o \nIpAddress %o \nModel: %o\n already exists.', this.count++, uniqueId, ipAddress,modelNumber);    
        }
        
      });

      socket.on('listening', () => {
        socket.setBroadcast(true);
        
        for (const userInterface of userInterfaces){
          this.log.info('Scanning broadcast-address: %o for Magichome devices... \n', userInterface.broadcast);
          socket.send(BROADCAST_MAGIC_STRING, BROADCAST_PORT, userInterface.broadcast);
        }
      });

      socket.bind(BROADCAST_PORT);

      setTimeout(() => {
        socket.close();
        resolve(clients);
      }, timeout);
    });
  } 

}

