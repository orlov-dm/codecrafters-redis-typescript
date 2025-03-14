import * as net from 'net';
import { CommandParser } from './data/CommandParser';
import { Encoder } from './data/Encoder';
import { Storage } from './data/Storage';
import { isString } from './data/helpers';
import { ArgumentsReader } from './server/ArgumentsReader';
import { Server } from './server/Server';
import { Command, Responses } from './server/const';
import { Client } from './client/Client';

const commandParser = new CommandParser();
const encoder = new Encoder();
const argumentsReader = new ArgumentsReader(process.argv);
const args = argumentsReader.getArguments();

const storage: Storage = new Storage({
    dir: args.dir,
    dbFilename: args.dbfilename,
});
storage.init();

console.log('Creating server', args, storage);
const server = new Server(encoder, commandParser, storage, {
    port: args.port,
    directory: args.dir,
    dbFilename: args.dbfilename,
    isReplica: !!args.replicaof,
});

if (args.masterHost && args.masterPort) {
    new Client(encoder, commandParser, {
        masterHost: args.masterHost,
        masterPort: args.masterPort,
        port: args.port,
    });
}

process.on('SIGINT', function () {
    console.log('\nGracefully shutting down from SIGINT (Ctrl-C)');

    if (storage) {
        console.log('try to save storage');
        storage.save();
        console.log('finish save storage');
    }

    process.exit();
});

server.startListening();
