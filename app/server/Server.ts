import * as net from 'net';
import { Encoder } from '../data/Encoder';
import { Storage } from '../data/Storage';
import { CommandParser } from '../data/CommandParser';
import { DataType, DELIMITER, InternalValueDataType } from '../data/types';
import { isString } from '../data/helpers';
import { Command, ConfigArgs, LOCALHOST, Responses, UNKNOWN } from './const';
import { RDBStorage } from '../rdb/const';

interface ServerConfig {
    port: number;
    directory: string;
    dbFilename: string;
    isReplica: boolean;
}

export class Server {
    private readonly instance: net.Server;
    private readonly serverId = crypto.randomUUID().split('-').join('');
    private replicationOffset = 0;
    private readonly listeningPorts: number[] = [];
    private readonly replicaConnections: Map<number, net.Socket> = new Map();
    private replicaReplies: Map<number, number> = new Map();
    private replicaAckTimer: Timer | null = null;
    constructor(
        private readonly encoder: Encoder,
        private readonly commandParser: CommandParser,
        private readonly storage: Storage,
        private readonly config: ServerConfig
    ) {
        this.instance = net.createServer((connection: net.Socket) => {
            connection.on('data', async (data: Buffer) =>
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

    private async onDataHandler(connection: net.Socket, data: Buffer) {
        const { data: commandDataEntries } = this.commandParser.parse(data);
        if (
            !commandDataEntries.length ||
            commandDataEntries.every(
                (commandDataEntry) => commandDataEntry.element === null
            )
        ) {
            console.error('No command data');
            return;
        }

        for (const commandDataEntry of commandDataEntries) {
            const commandData = commandDataEntry.element;
            if (!commandData) {
                console.error('Invalid command data, skip');
                continue;
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
                    switch (command.value.toUpperCase()) {
                        case Command.PING_CMD: {
                            reply = this.encoder.encode(
                                Responses.RESPONSE_PONG,
                                DataType.SimpleString
                            );
                            break;
                        }
                        case Command.ECHO_CMD: {
                            reply = rest
                                .map((restData) => {
                                    if (isString(restData)) {
                                        return this.encoder.encode(
                                            restData.value
                                        );
                                    }
                                    return '';
                                })
                                .join(' ');
                            break;
                        }
                        case Command.SET_CMD: {
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
                            reply = this.encoder.encode(
                                Responses.RESPONSE_OK,
                                DataType.SimpleString
                            );
                            break;
                        }
                        case Command.GET_CMD: {
                            const [keyData] = rest;
                            if (isString(keyData) && keyData.value) {
                                const getValue = this.storage.get(
                                    keyData.value
                                );
                                reply = this.encoder.encode(getValue);
                            }
                            break;
                        }
                        case Command.CONFIG_CMD: {
                            const [subCmdData, keyData] = rest;
                            if (
                                isString(subCmdData) &&
                                subCmdData.value?.toUpperCase() ===
                                    Command.GET_CMD &&
                                isString(keyData)
                            ) {
                                switch (keyData.value?.toLowerCase()) {
                                    case ConfigArgs.DIR:
                                        reply = this.encoder.encode([
                                            ConfigArgs.DIR,
                                            this.config.directory,
                                        ]);
                                        break;
                                    case ConfigArgs.DB_FILENAME:
                                        reply = this.encoder.encode([
                                            ConfigArgs.DB_FILENAME,
                                            this.config.dbFilename,
                                        ]);
                                        break;
                                }
                            }
                            break;
                        }
                        case Command.KEYS_CMD: {
                            const [searchData] = rest;
                            if (isString(searchData)) {
                                const key =
                                    searchData.value === '*'
                                        ? null
                                        : searchData.value;
                                reply = this.encoder.encode(
                                    this.storage.keys(key)
                                );
                            }
                            break;
                        }
                        case Command.INFO_CMD: {
                            const [subCmdData] = rest;
                            if (
                                isString(subCmdData) &&
                                subCmdData.value ===
                                    Command.INFO_REPLICATION_CMD
                            ) {
                                const role = !this.config.isReplica
                                    ? 'master'
                                    : 'slave';
                                const info = [
                                    `role:${role}`,
                                    `master_replid:${this.serverId}`,
                                    `master_repl_offset:${this.replicationOffset}`,
                                ];
                                reply = this.encoder.encode(
                                    info.join(DELIMITER)
                                );
                            }
                            break;
                        }
                        case Command.REPLCONF_CMD: {
                            const [subCmdData] = rest;
                            if (isString(subCmdData)) {
                                switch (subCmdData.value) {
                                    case Command.REPLCONF_LISTENING_PORT_CMD: {
                                        const [, listeningPort] = rest;
                                        const listeningPortValue = Number(
                                            listeningPort.value
                                        );
                                        this.listeningPorts.push(
                                            listeningPortValue
                                        );
                                        this.setReplicaConnection(
                                            listeningPortValue,
                                            connection
                                        );
                                        this.addReplicaReply();
                                        break;
                                    }
                                    case Command.REPLCONF_CAPABILITIES_CMD: {
                                        console.log('CAPA', rest);
                                        break;
                                    }
                                    case Responses.RESPONSE_ACK: {
                                        console.log('Response ACK');
                                        if (connection.remotePort) {
                                            this.addReplicaReply();
                                        }
                                        return;
                                    }
                                }
                                reply = this.encoder.encode(
                                    Responses.RESPONSE_OK,
                                    DataType.SimpleString
                                );
                            }
                            break;
                        }
                        case Command.PSYNC_CMD: {
                            const [replIdData, replOffsetData] = rest;
                            reply = this.encoder.encode(
                                `${replIdData.type} '${replIdData.value}' , ${replOffsetData.type} '${replOffsetData.value}'`,
                                DataType.SimpleString
                            );

                            if (
                                isString(replIdData) &&
                                replIdData.value === UNKNOWN &&
                                isString(replOffsetData) &&
                                Number(replOffsetData.value) === -1
                            ) {
                                reply = this.encoder.encode(
                                    `${Responses.RESPONSE_FULLRESYNC} ${this.serverId} ${this.replicationOffset}`,
                                    DataType.SimpleString
                                );
                                connection.write(reply);

                                const fileContent =
                                    this.storage.getFileContent();
                                if (fileContent) {
                                    connection.write(
                                        Buffer.concat([
                                            Buffer.from(
                                                `$${fileContent.length}${DELIMITER}`,
                                                RDBStorage.SOURCE_ENCODING
                                            ),
                                            fileContent,
                                        ])
                                    );
                                }
                                return;
                            }
                            break;
                        }
                        case Command.WAIT_CMD: {
                            const [numReplicas, timeout] = rest;
                            console.log('WAIT_CMD ', numReplicas, timeout);

                            if (isString(timeout) && isString(numReplicas)) {
                                const acks = await this.waitForReplicas(
                                    Number(numReplicas.value),
                                    Number(timeout.value),
                                    this.replicationOffset
                                );
                                reply = this.encoder.encode(acks);
                            }
                            break;
                        }
                        case Command.TYPE_CMD: {
                            const [key] = rest;

                            if (isString(key)) {
                                const data = this.storage.get(key.value);
                                if (!data) {
                                    reply = this.encoder.encode(
                                        InternalValueDataType.TYPE_NONE,
                                        DataType.SimpleString
                                    );
                                } else {
                                    reply = this.encoder.encode(
                                        this.encoder.getDataType(data),
                                        DataType.SimpleString
                                    );
                                }
                            }
                        }
                    }

                    if (!reply) {
                        reply = this.encoder.encode(null);
                    }
                    if (reply) {
                        connection.write(reply);
                    }

                    if (Server.isWriteCommand(command.value)) {
                        this.onWrite(data);
                    }
                }
            }
        }
    }

    private getReplicaConnection(port: number): net.Socket | null {
        return this.replicaConnections.get(port) ?? null;
    }

    private setReplicaConnection(port: number, connection: net.Socket) {
        this.replicaConnections.set(port, connection);
    }

    private static isWriteCommand(command: string) {
        return command.toUpperCase() === Command.SET_CMD;
    }

    private addReplicaReply() {
        if (!this.replicaReplies.get(this.replicationOffset)) {
            this.replicaReplies.set(this.replicationOffset, 0);
        }
        this.replicaReplies.set(
            this.replicationOffset,
            this.replicaReplies.get(this.replicationOffset)! + 1
        );
    }

    private getReplicaReplies(offset: number): number {
        return Number(this.replicaReplies.get(offset) ?? 0);
    }

    private async waitForReplicas(
        requiredReplicas: number,
        timeoutMs: number,
        currentOffset: number
    ): Promise<number> {
        return new Promise((resolve) => {
            // Immediate check
            const firstAcked = this.getReplicaReplies(currentOffset);
            if (firstAcked >= requiredReplicas) {
                return resolve(firstAcked);
            }

            let resolved = false;

            // Periodically check for new ACKs
            const interval = setInterval(() => {
                const acked = this.getReplicaReplies(currentOffset);
                if (acked >= requiredReplicas) {
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolved = true;
                    resolve(acked);
                }
            }, 10); // Poll every 10ms

            // Timeout fallback
            const timeout = setTimeout(() => {
                if (!resolved) {
                    clearInterval(interval);
                    resolve(this.getReplicaReplies(currentOffset)); // Return however many we got
                }
            }, timeoutMs);
        });
    }

    private onWrite(data: Buffer) {
        ++this.replicationOffset;

        console.log(
            'Write command to replicate',
            JSON.stringify(data.toString())
        );
        let requestAckFromReplicas = false;
        this.listeningPorts.forEach((port) => {
            const replicaConnection = this.getReplicaConnection(port);
            if (replicaConnection) {
                requestAckFromReplicas = true;
                replicaConnection.write(data);
            }
        });

        // Reset ACK timer
        if (this.replicaAckTimer) {
            clearTimeout(this.replicaAckTimer);
        }
        this.replicaAckTimer = setTimeout(() => {
            this.listeningPorts.forEach((port) => {
                const replicaConnection = this.getReplicaConnection(port);
                if (replicaConnection) {
                    if (requestAckFromReplicas) {
                        replicaConnection.write(
                            this.encoder.encode([
                                Command.REPLCONF_CMD,
                                Command.REPLCONF_GETACK_CMD,
                                '*',
                            ])
                        );
                    }
                }
            });
            this.replicaAckTimer = null;
        }, 300);
    }
}
