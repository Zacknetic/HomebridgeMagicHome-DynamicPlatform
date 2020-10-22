import dgram from 'dgram';

import { Network } from './Network';

import type { Logger, PlatformConfig } from 'homebridge';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';


export class Discover {
  constructor(  
    public readonly log: Logger,
    private readonly config: PlatformConfig,
  ){}


  async scan(timeout = 500) {
    
    const userInterfaces = Network.subnets();
    
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
        this.log.debug('\nDiscover.ts.scan(): Discovered device\nUniqueId: %o \nIpAddress %o \nModel: %o\n', uniqueId, ipAddress,modelNumber);
        
      });

      socket.on('listening', () => {
        socket.setBroadcast(true);
        
        for (const userInterface of userInterfaces){
          this.log.info('Scanning broadcast-address: %o on interface: %o for Magichome lights... \n', userInterface.broadcast);
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

