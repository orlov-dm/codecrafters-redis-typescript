import * as net from 'net';
import { Encoder } from '../data/Encoder';
import { Storage } from '../data/Storage';
import { CommandParser } from '../data/CommandParser';
import { DataType, DELIMITER } from '../data/types';
import { isString } from '../data/helpers';
import { Commands, LOCALHOST, Responses } from './const';
import type { Arguments, ArgumentsReader } from './ArgumentsReader';

interface ServerConfig {
    port: number;
    directory: string;
    dbFilename: string;
    isReplica: boolean;
}

export class Server {
    private readonly instance: net.Server;
    private readonly serverId = crypto.randomUUID();
    private readonly replicationOffset = 0;
    private readonly listeningPorts: number[] = [];
    constructor(
        private readonly encoder: Encoder,
        private readonly commandParser: CommandParser,
        private readonly storage: Storage,
        private readonly config: ServerConfig
    ) {
        this.instance = net.createServer((connection: net.Socket) => {
            connection.on('data', (data: Buffer) =>
                this.onDataHandler(connection, data)
            );
            connection.on('close', () => {
                connection.end();
            });
        });
    }

    public startListening() {
        this.instance.listen(this.config.port, LOCALHOST);
    }

    private onDataHandler(connection: net.Socket, data: Buffer) {
        const input = data.toString();
        const commandData = this.commandParser.parse(input);
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
                switch (command.value.toLowerCase()) {
                    case Commands.PING_CMD: {
                        reply = this.encoder.encode(Responses.RESPONSE_PONG);
                        break;
                    }
                    case Commands.ECHO_CMD: {
                        reply = rest
                            .map((restData) => {
                                if (isString(restData)) {
                                    return this.encoder.encode(restData.value);
                                }
                                return '';
                            })
                            .join(' ');
                        break;
                    }
                    case Commands.SET_CMD: {
                        const [keyData, valueData, pxData, pxValue] = rest;
                        if (isString(keyData) && keyData.value) {
                            const hasPxArg =
                                pxData &&
                                isString(pxData) &&
                                pxData?.value?.toLowerCase() === 'px';
                            const expirationMs = hasPxArg
                                ? Number(pxValue.value)
                                : 0;
                            console.log(
                                'SET CMD',
                                keyData.value,
                                valueData,
                                expirationMs
                            );
                            this.storage.set(
                                keyData.value,
                                valueData,
                                expirationMs
                            );
                        }
                        reply = this.encoder.encode(Responses.RESPONSE_OK);
                        break;
                    }
                    case Commands.GET_CMD: {
                        const [keyData] = rest;
                        if (isString(keyData) && keyData.value) {
                            const getValue = this.storage.get(keyData.value);
                            reply = this.encoder.encode(getValue);
                        }
                        break;
                    }
                    case Commands.CONFIG_CMD: {
                        const [subCmdData, keyData] = rest;
                        if (
                            isString(subCmdData) &&
                            subCmdData.value?.toLowerCase() ===
                                Commands.GET_CMD &&
                            isString(keyData)
                        ) {
                            switch (keyData.value?.toLowerCase()) {
                                case Commands.CONFIG_DIR_CMD:
                                    reply = this.encoder.encode([
                                        Commands.CONFIG_DIR_CMD,
                                        this.config.directory,
                                    ]);
                                    break;
                                case Commands.CONFIG_DB_FILENAME_CMD:
                                    reply = this.encoder.encode([
                                        Commands.CONFIG_DB_FILENAME_CMD,
                                        this.config.dbFilename,
                                    ]);
                                    break;
                            }
                        }
                        break;
                    }
                    case Commands.KEYS_CMD: {
                        const [searchData] = rest;
                        if (isString(searchData)) {
                            const key =
                                searchData.value === '*'
                                    ? null
                                    : searchData.value;
                            reply = this.encoder.encode(this.storage.keys(key));
                        }
                        break;
                    }
                    case Commands.INFO_CMD: {
                        const [subCmdData] = rest;
                        console.log('INFO CMD', subCmdData);
                        if (
                            isString(subCmdData) &&
                            subCmdData.value === Commands.INFO_REPLICATION_CMD
                        ) {
                            const role = !this.config.isReplica
                                ? 'master'
                                : 'slave';
                            const info = [
                                `role:${role}`,
                                `master_replid:${this.serverId}`,
                                `master_repl_offset:${this.replicationOffset}`,
                            ];
                            reply = this.encoder.encode(info.join(DELIMITER));
                        }
                        break;
                    }
                    case Commands.REPLCONF_CMD: {
                        const [subCmdData] = rest;
                        if (isString(subCmdData)) {
                            switch (subCmdData.value) {
                                case Commands.REPLCONF_LISTENING_PORT_CMD: {
                                    const [, listeningPort] = rest;
                                    this.listeningPorts.push(
                                        Number(listeningPort.value)
                                    );
                                    break;
                                }
                                case Commands.REPLCONF_CAPABILITIES_CMD: {
                                    console.log('CAPA', rest);
                                    break;
                                }
                            }
                            reply = this.encoder.encode(Responses.RESPONSE_OK);
                        }
                        break;
                    }
                }

                if (!reply) {
                    reply = this.encoder.encode(null);
                }
                if (reply) {
                    connection.write(reply);
                }
            }
        }
    }
}
