import * as net from 'net';
import type { Encoder } from '../data/Encoder';
import type { CommandParser } from '../data/CommandParser';
import { Commands, Responses, UNKNOWN } from '../server/const';
import { isString } from '../data/helpers';

interface Config {
    masterHost: string;
    masterPort: number;
    port: number;
}

export class Client {
    private readonly connection: net.Socket;
    private readonly commandsToSend: string[][] = [];
    private readonly capabilities = 'psync2';

    constructor(
        private readonly encoder: Encoder,
        private readonly commandParser: CommandParser,
        readonly config: Config
    ) {
        this.connection = net.createConnection(
            config.masterPort,
            config.masterHost,
            () => {
                console.log('Connected to server');
                const firstCommand = this.commandsToSend.shift();
                if (firstCommand) {
                    this.connection.write(encoder.encode(firstCommand));
                }
            }
        );
        this.connection.on('data', (data) => this.onDataHandler(data));
        this.connection.on('end', () =>
            console.log('Disconnected from server')
        );

        this.commandsToSend.push(
            ...[
                [Commands.PING_CMD],
                [
                    Commands.REPLCONF_CMD,
                    Commands.REPLCONF_LISTENING_PORT_CMD,
                    String(this.config.port),
                ],
                [
                    Commands.REPLCONF_CMD,
                    Commands.REPLCONF_CAPABILITIES_CMD,
                    this.capabilities,
                ],
                [Commands.PSYNC_CMD, UNKNOWN, '-1'],
            ]
        );
    }

    private onDataHandler(data: Buffer) {
        const input = data.toString();
        const commandData = this.commandParser.parse(input);
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
            const nextCommand = this.commandsToSend.shift();
            if (nextCommand) {
                console.log('send next command', nextCommand);
                this.connection.write(this.encoder.encode(nextCommand));
            }
        }
    }
}
