import * as net from 'net';
import { CommandParser } from './data/CommandParser';
import { Encoder } from './data/Encoder';
import { Storage } from './data/Storage';
import { isString } from './data/helpers';
import { ArgumentsReader } from './server/ArgumentsReader';
import { Server } from './server/Server';
import { Commands, Responses } from './server/const';

const commandParser = new CommandParser();
const encoder = new Encoder();
const argumentsReader = new ArgumentsReader(process.argv);
const args = argumentsReader.getArguments();

const storage: Storage = new Storage({
    dir: args.dir,
    dbFilename: args.dbfilename,
});
storage.init();

const [masterHost, masterPortString] = args.replicaof
    ? args.replicaof.split(' ')
    : [null, null];
const masterPort = masterPortString ? Number(masterPortString) : null;
const capabilities = 'psync2';

console.log('Creating server', args, storage);
const server = new Server(encoder, commandParser, storage, args);

// TODO extract CLIENT
if (masterHost && masterPort) {
    const commandsToSend: string[][] = [
        [Commands.PING_CMD],
        [
            Commands.REPLCONF_CMD,
            Commands.REPLCONF_LISTENING_PORT_CMD,
            String(args.port),
        ],
        [
            Commands.REPLCONF_CMD,
            Commands.REPLCONF_CAPABILITIES_CMD,
            capabilities,
        ],
    ];
    const client = net.createConnection(masterPort, masterHost, () => {
        console.log('Connected to server');
        const firstCommand = commandsToSend.shift();
        if (firstCommand) {
            client.write(encoder.encode(firstCommand));
        }
    });

    client.on('data', (data) => {
        const input = data.toString();
        const commandData = commandParser.parse(input);
        if (!commandData) {
            console.error('No command data');
            return;
        }
        if (
            isString(commandData) &&
            (commandData.value === Responses.RESPONSE_OK ||
                commandData.value === Responses.RESPONSE_PONG)
        ) {
            console.log('Server response:', data.toString());
            const nextCommand = commandsToSend.shift();
            if (nextCommand) {
                console.log('send next command', nextCommand);
                client.write(encoder.encode(nextCommand));
            }
        }
    });

    client.on('end', () => console.log('Disconnected from server'));
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
