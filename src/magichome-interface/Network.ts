import Os from 'os';

export class Network {
  static masks(cidr: string): { [key: string]: string } {
    const subnet = parseInt(cidr.split('/').pop() || '24', 10);
    const ipaddress = (cidr.split('/').shift() || '').split('.').map((b) => parseInt(b, 10));
    const masks: number[] | undefined = (`${('1').repeat(subnet)}${'0'.repeat(32 - subnet)}`).match(/.{1,8}/g)?.map((b) => parseInt(b, 2));
    const inverted = masks?.map((b) => b ^ 255); // eslint-disable-line no-bitwise
    const base = ipaddress.map((block: number, index: number) => block & masks![index]); // eslint-disable-line no-bitwise
    const broadcast = base.map((block: number, index: number) => block | inverted![index]); // eslint-disable-line no-bitwise
    return {
      base: base.join('.'),
      broadcast: broadcast.join('.'),
    };
  }

  static network(): string[] {
    const ifaces: NodeJS.Dict<Os.NetworkInterfaceInfo[]> = Os.networkInterfaces();
    const results: string[] = [];
    Object.keys(ifaces).forEach((ifname: string) => {
            ifaces[ifname]!.forEach((iface: Os.NetworkInterfaceInfo) => {
              if (iface.family !== 'IPv4' || iface.internal !== false) {
                return;
              }
              if (results.indexOf(iface.address) === -1) {
                results.push(`${iface.cidr}`);
              }
            });
    });
    return results;
  }

  static subnets(): { [key: string]: string }[] {
    const network: string[] = Network.network();
    const masks: { [key: string]: string }[] = network.map((n) => Network.masks(n));
    return masks;
  }
}