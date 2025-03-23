import * as net from 'net';
import type { Encoder } from '../data/Encoder';
import type { CommandParser } from '../data/CommandParser';
import { Command, Responses, UNKNOWN } from '../server/const';
import { isArray, isString } from '../data/helpers';
import { DELIMITER, type Data } from '../data/types';
import { Storage } from '../data/Storage';

const QUEUE_EXECUTE_INTERVAL_MS = 100;

interface Config {
    masterHost: string;
    masterPort: number;
    port: number;
}

export class Client {
    private readonly connection: net.Socket;
    private readonly commandsToSend: string[][] = [];
    private readonly capabilities = 'psync2';
    private replicationOffset: number = 0;
    private mainServerId: string = '';
    private waitForRDB: boolean = false;
    private commandDataQueue: Data[] = [];
    private commandDataCheckerIntervalTimer: Timer | null = null;

    constructor(
        private readonly encoder: Encoder,
        private readonly commandParser: CommandParser,
        private readonly storage: Storage,
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
        this.connection.on('data', (data) => this.onDataHandle(data));
        this.connection.on('end', () =>
            console.log('Disconnected from server')
        );

        this.commandsToSend.push(
            ...[
                [Command.PING_CMD],
                [
                    Command.REPLCONF_CMD,
                    Command.REPLCONF_LISTENING_PORT_CMD,
                    String(this.config.port),
                ],
                [
                    Command.REPLCONF_CMD,
                    Command.REPLCONF_CAPABILITIES_CMD,
                    this.capabilities,
                ],
                [Command.PSYNC_CMD, UNKNOWN, '-1'],
            ]
        );
    }

    private onDataHandle(data: Buffer) {
        const commandDataEntries = this.commandParser.parse(data);
        if (
            !commandDataEntries.length ||
            commandDataEntries.every(
                (commandDataEntry) => commandDataEntry === null
            )
        ) {
            console.error('No command data');
            return;
        }
        for (const commandData of commandDataEntries) {
            if (!commandData) {
                console.error('Invalid command data, skip');
                continue;
            }
            this.onCommandDataHandle(commandData);
        }
    }

    private onCommandDataHandle(commandData: Data) {
        if (isString(commandData)) {
            if (
                commandData.value === Responses.RESPONSE_OK ||
                commandData.value === Responses.RESPONSE_PONG
            ) {
                const nextCommand = this.commandsToSend.shift();
                if (nextCommand) {
                    this.connection.write(this.encoder.encode(nextCommand));
                }
            } else if (
                commandData.value.startsWith(Responses.RESPONSE_FULLRESYNC)
            ) {
                const delimiterIndex = commandData.value.indexOf(DELIMITER);
                const fullResyncData = commandData.value.slice(
                    0,
                    delimiterIndex !== -1 ? delimiterIndex : undefined
                );
                const [, mainServerId, replicationOffset] =
                    fullResyncData.split(' ');
                this.mainServerId = mainServerId;
                this.replicationOffset = Number(replicationOffset);
                this.waitForRDB = true;

                this.commandDataCheckerIntervalTimer = setInterval(
                    () => this.onCommandDataQueueHandle(),
                    QUEUE_EXECUTE_INTERVAL_MS
                );

                console.log(
                    'Waiting for RDB file content from main server: ',
                    this.mainServerId,
                    this.replicationOffset
                );
            } else if (this.waitForRDB) {
                const rdbData = commandData.value;
                this.storage.setFileContent(rdbData);
                this.waitForRDB = false;
                console.log('Waiting for RDB file finished');
                this.onCommandDataQueueHandle();
            }
        } else if (isArray(commandData)) {
            const [command, ...rest] = commandData.value;
            if (isString(command)) {
                switch (command.value.toLowerCase()) {
                    case Command.SET_CMD: {
                        if (this.waitForRDB) {
                            this.commandDataQueue.push(commandData);
                            return;
                        }
                        const [keyData, valueData, pxData, pxValue] = rest;
                        if (isString(keyData) && keyData.value) {
                            const hasPxArg =
                                pxData &&
                                isString(pxData) &&
                                pxData?.value?.toLowerCase() === 'px';
                            const expirationMs = hasPxArg
                                ? Number(pxValue.value)
                                : 0;
                            this.storage.set(
                                keyData.value,
                                valueData,
                                expirationMs
                            );
                        }
                        break;
                    }
                    case Command.REPLCONF_CMD: {
                        const [subCmdData, offsetData] = rest;
                        if (isString(subCmdData)) {
                            switch (subCmdData.value.toLowerCase()) {
                                case Command.REPLCONF_GETACK_CMD: {
                                    if (
                                        isString(offsetData) &&
                                        offsetData.value !== '*'
                                    ) {
                                        console.warn(
                                            'Strange REPLCONF ACK request'
                                        );
                                    }
                                    this.connection.write(
                                        this.encoder.encode([
                                            Command.REPLCONF_CMD,
                                            Responses.RESPONSE_ACK,
                                            '0', // TODO: should be byte offset
                                        ])
                                    );
                                }
                            }
                        }
                    }
                }
            } else {
                console.error('Unprocessed command', command);
            }
        }
    }

    private onCommandDataQueueHandle() {
        if (this.waitForRDB) {
            return;
        }
        while (this.commandDataQueue.length) {
            const cmdData = this.commandDataQueue.shift();
            if (cmdData) {
                this.onCommandDataHandle(cmdData);
            }
        }

        if (
            !this.commandDataQueue.length &&
            this.commandDataCheckerIntervalTimer
        ) {
            clearInterval(this.commandDataCheckerIntervalTimer);
            return;
        }
    }
}
