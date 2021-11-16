import dgram from 'dgram';
import { Network } from './Network';

import { Logs } from '../logs';
import type { PlatformConfig } from 'homebridge';
import { IDeviceDiscoveredProps } from '../magichome-interface/types';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';

export class Discover {
  public count = 1;
  constructor(
    public readonly logs: Logs,
    private readonly config: PlatformConfig,
  ) { }


  async scan(timeout = 500): Promise<IDeviceDiscoveredProps[]> {

    return new Promise((resolve, reject) => {
      const userInterfaces = Network.subnets();
      const clients: IDeviceDiscoveredProps[] = [];
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

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
          this.logs.debug('\n%o - Discovered device...\nUniqueId: %o \nIpAddress %o \nModel: %o\n.', this.count++, uniqueId, ipAddress, modelNumber);
        } else {
          this.logs.debug('\n%o - A device has been discovered that already exists. Likely due to a "fun" network layout...\nUniqueId: %o \nIpAddress %o \nModel: %o\n already exists.', this.count++, uniqueId, ipAddress, modelNumber);
        }

      });

      socket.on('listening', () => {
        socket.setBroadcast(true);

        const addressAlreadyScanned: string[] = [];
        for (const userInterface of userInterfaces) {
          if (addressAlreadyScanned.includes(userInterface.broadcast)) {
            this.logs.debug('Skipping redundant scan of broadcast-address %o for Magichome devices.', userInterface.broadcast);
            continue;
          }
          addressAlreadyScanned.push(userInterface.broadcast);
          this.logs.debug('Scanning broadcast-address: %o for Magichome devices...', userInterface.broadcast);
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

