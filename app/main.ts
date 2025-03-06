import * as net from "net";
import { CommandParser } from "./data/CommandParser";
import { DataType } from "./data/types";
import { Encoder } from "./data/Encoder";
import { Storage } from "./data/Storage";
import { encode } from "punycode";
import { isString } from "./data/helpers";
const PING_CMD = 'ping';
const ECHO_CMD = 'echo';
const GET_CMD = 'get';
const SET_CMD = 'set';
const CONFIG_CMD = 'config';
const CONFIG_DIR_CMD = 'dir';
const CONFIG_DB_FILENAME_CMD = 'dbfilename';
const KEYS_CMD = 'keys';
const DEFAULT_DIR = '/tmp/redis-files';
const DEFAULT_DB_FILENAME = 'dump.rdb';
const DEFAULT_PORT = 6379;

const commandParser = new CommandParser();
const encoder = new Encoder();
const args = process.argv;    
let dir = DEFAULT_DIR;
const dirIndex = args.findIndex((arg) => arg.startsWith("--dir"));
if (dirIndex !== -1) {
  dir = args[dirIndex + 1];
  console.log('dir found', dir);
}
let dbFilename = DEFAULT_DB_FILENAME; 
const dbIndex = args.findIndex((arg) => arg.startsWith("--dbfilename"));
if (dbIndex !== -1) {
  dbFilename = args[dbIndex + 1];
  console.log('dbfilename found', dbFilename);
}
let port = DEFAULT_PORT;
const portIndex = args.findIndex((arg) => arg.startsWith("--port"));
if (portIndex !== -1) {
  port = Number(args[portIndex + 1]);
  console.log('port found', port);
}

const storage: Storage = new Storage({
  dir,
  dbFilename
});
storage.init();

console.log('Creating server');
console.log('dir', dir);
console.log('db', dbFilename);

const server: net.Server = net.createServer((connection: net.Socket) => {
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
      if (isString(command)) {
        if (!command.value) {
          console.warn('Empty string data');
          return;
        }
        let reply: string | null = null;
        switch(command.value.toLowerCase()) {
          case PING_CMD: {
            reply = encoder.encode('PONG');
            break;
          }
          case ECHO_CMD: {
            reply = rest.map(restData => {
              if (isString(restData)) {
                return encoder.encode(restData.value);
              }
              return '';
            }).join(' ');
            break;
          }      
          case SET_CMD: {
            const [keyData, valueData, pxData, pxValue] = rest;        
            if (isString(keyData) && keyData.value) {
              const hasPxArg = pxData && isString(pxData) && pxData?.value?.toLowerCase() === 'px';
              const expirationMs = hasPxArg ? Number(pxValue.value) : 0;
              console.log("SET CMD", keyData.value, valueData, expirationMs);
              storage.set(keyData.value, valueData, expirationMs);
            }
            reply = encoder.encode('OK');
            break;
          }
          case GET_CMD: {
            const [keyData] = rest;
            if (isString(keyData) && keyData.value) {
              const getValue = storage.get(keyData.value);
              reply = encoder.encode(getValue);
            }
            break;
          }
          case CONFIG_CMD: {
            const [subCmdData, keyData] = rest;
            if (isString(subCmdData) && subCmdData.value?.toLowerCase() === GET_CMD && isString(keyData)) {
              switch (keyData.value?.toLowerCase()) {
                case CONFIG_DIR_CMD: 
                  reply = encoder.encode([CONFIG_DIR_CMD, dir]);
                  break;
                case CONFIG_DB_FILENAME_CMD:
                  reply = encoder.encode([CONFIG_DB_FILENAME_CMD, dbFilename]);
                  break;
                }              
            }            
            break;
          }
          case KEYS_CMD: {
            const [searchData] = rest;
            if (isString(searchData)) {
              const key = searchData.value === '*' ? null : searchData.value;                        
              reply = encoder.encode(storage.keys(key));
            }
            break;
          }
        }

        if (!reply) {
          reply = encoder.encode(null);
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

process.on( 'SIGINT', function() {
  console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  
  if (storage) {
    console.log('try to save storage');
    storage.save();
    console.log('finish save storage');
  }

  process.exit( );
})

server.listen(port, "127.0.0.1");
