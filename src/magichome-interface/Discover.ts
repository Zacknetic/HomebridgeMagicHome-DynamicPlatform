import dgram from 'dgram';
import broadcastAddress from 'broadcast-address';
import systemInformation from 'systeminformation';
import type { Logger, PlatformConfig } from 'homebridge';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';


export class Discover {
  constructor(  
    public readonly log: Logger,
    private readonly config: PlatformConfig,
  ){}


  async scan(timeout = 500) {

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
        this.log.debug('\nDiscover.ts.scan(): Discovered device\nUniqueId: %o \nIpAddress %o \nModel: %o\n', uniqueId, ipAddress,modelNumber);
        
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

}

