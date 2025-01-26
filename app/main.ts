import * as net from "net";
import { CommandParser } from "./data/CommandParser";
import { DataType } from "./data/types";
import { Encoder } from "./data/Encoder";
import { Storage } from "./data/Storage";
const PING_CMD = 'ping';
const ECHO_CMD = 'echo';
const GET_CMD = 'get';
const SET_CMD = 'set';

const server: net.Server = net.createServer((connection: net.Socket) => {
  const commandParser = new CommandParser();
  const encoder = new Encoder();
  const storage = new Storage();
  connection.on('data', (data) => {
    const input = data.toString();
    const commandData = commandParser.parse(input);    
    if (!commandData) {
      console.error('No command data');
      return;
    }
    if (commandData.type === DataType.Array) {
      if (!commandData.value) {
        console.warn('Empty array data');
        return;
      }
      const [command, ...rest] = commandData.value;
      if (commandParser.isString(command)) {
        if (!command.value) {
          console.warn('Empty string data');
          return;
        }
        let reply: string | null = null;
        switch(command.value.toLowerCase()) {
          case PING_CMD: {
            reply = encoder.encode({
              type: DataType.SimpleString,
              value: 'PONG'
            });
            break;
          }
          case ECHO_CMD: {
            reply = rest.map(restData => {
              if (commandParser.isString(restData)) {
                return encoder.encode(restData);
              }
              return '';
            }).join(' ');
            break;
          }      
          case SET_CMD: {
            const [keyData, valueData, pxData, pxValue] = rest;        
            if (commandParser.isString(keyData) && keyData.value) {
              const hasPxArg = pxData && commandParser.isString(pxData) && pxData?.value?.toLowerCase() === 'px';
              const expirationMs = hasPxArg ? Number(pxValue.value) : 0;
              storage.set(keyData.value, valueData, expirationMs);
            }
            reply = encoder.encode({
              type: DataType.SimpleString,
              value: 'OK'
            });
            break;
          }
          case GET_CMD: {
            const [keyData] = rest;
            if (commandParser.isString(keyData) && keyData.value) {
              const getValue = storage.get(keyData.value);
              reply = encoder.encode(getValue);
            } else {
              reply = encoder.encode({
                type: DataType.BulkString,
                value: null,
              });
            }
            
            break;
          }
        }
        if (reply) {
          connection.write(reply);
        }
      }      
    }
  })
  connection.on("close", () => {
    connection.end();
  });
});

server.listen(6379, "127.0.0.1");
