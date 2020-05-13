import dgram from 'dgram';

const BROADCAST_ADDR = '255.255.255.255';
const BROADCAST_PORT = 48899;
const BROADCAST_MAGIC_STRING = 'HF-A11ASSISTHREAD';

class Discovery {
  static scan(timeout = 500) {

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

        const [host, id, model] = parts;
        clients.push({ host, id, model });
      });

      socket.on('listening', () => {
        socket.setBroadcast(true);
        socket.send(BROADCAST_MAGIC_STRING, BROADCAST_PORT, BROADCAST_ADDR);
      });

      socket.bind(BROADCAST_PORT);

      setTimeout(() => {
        socket.close();
        resolve(clients);
      }, timeout);
    });
  }
}

export default Discovery;
