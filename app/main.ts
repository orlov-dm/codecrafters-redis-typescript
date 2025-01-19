import * as net from "net";

const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.addListener('data', (data) => {
    const command = data.toString();
    console.log('command', command);
    switch (command) {
      default:
        connection.write('+PONG\r\n');
    }
    connection.pipe(connection);
    connection.end();
  })
});

server.listen(6379, "127.0.0.1");
