import * as net from "net";

const PING_CMD = 'ping';

const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.addListener('data', (data) => {
    const input = data.toString().toLowerCase();    
    let index = input.indexOf(PING_CMD);
    while (index !== -1) {      
      connection.write('+PONG\r\n');
      index = input.indexOf(PING_CMD, index + PING_CMD.length);
    }
  })
});

server.listen(6379, "127.0.0.1");
