import dgram from 'dgram';
import { Network } from './Network';

import { Logs } from '../logs';
import type { PlatformConfig } from 'homebridge';
import { IDeviceDiscoveredProps } from '../magichome-interface/types';

const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';

export class Discover {
  protected firstScan = true;
  protected broadcastAddresses = [];
  public count = 1;
  constructor(
    public readonly logs: Logs,
    private readonly config: PlatformConfig,
  ) {
    const userInterfaces = Network.subnets();
    for (const userInterface of userInterfaces) {
      this.broadcastAddresses.push(userInterface.broadcast);
    }

    this.broadcastAddresses.push(...this.config.advancedOptions?.additionalSubnets ?? []);
  }


  async scan(timeout = 500): Promise<IDeviceDiscoveredProps[]> {


    return new Promise((resolve, reject) => {
      const userInterfaces = Network.subnets();
      const clients: IDeviceDiscoveredProps[] = [];
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const seenClients: Set<string> = new Set();

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

        if (!seenClients.has(uniqueId)) {
          clients.push({ ipAddress, uniqueId, modelNumber });
          seenClients.add(uniqueId);
          this.logs.debug('\n%o - Discovered device...\nUniqueId: %o \nIpAddress %o \nModel: %o\n.', this.count++, uniqueId, ipAddress, modelNumber);
        } else {
          this.logs.debug('\n%o - A device has been discovered that already exists. Likely due to a "fun" network layout...\nUniqueId: %o \nIpAddress %o \nModel: %o\n already exists.', this.count++, uniqueId, ipAddress, modelNumber);
        }

      });

      socket.on('listening', () => {
        socket.setBroadcast(true);

        const addressAlreadyScanned = new Set<string>();
        for (const broadcast of this.broadcastAddresses) {
          if (addressAlreadyScanned.has(broadcast)) {
            this.logs.debug('Skipping redundant scan of broadcast-address: %o for Magichome devices.', broadcast);
            continue;
          }
          addressAlreadyScanned.add(broadcast);
          this.logs.debug('Scanning broadcast-address: %o for Magichome devices...', broadcast);
          socket.send(BROADCAST_MAGIC_STRING, BROADCAST_PORT, broadcast);
        }
      });

      socket.bind(BROADCAST_PORT);

      setTimeout(() => {
        this.logs.debug('Discovered %o MagicHome devices on the network.', this.count);
        socket.close();
        resolve(clients);
      }, timeout);
    });



  }

}

