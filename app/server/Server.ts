import * as net from 'net';
import { Encoder } from '../data/Encoder';
import { Storage } from '../data/Storage';
import { CommandParser } from '../data/CommandParser';
import {
    DataType,
    DELIMITER,
    InternalValueDataType,
    type Data,
} from '../data/types';
import { isString } from '../data/helpers';
import { Command, ConfigArgs, LOCALHOST, Responses, UNKNOWN } from './const';
import { RDBStorage } from '../rdb/const';
import { PingCommand } from './Commands/PingCommand';
import { EchoCommand } from './Commands/EchoCommand';
import { SetCommand } from './Commands/SetCommand';
import { GetCommand } from './Commands/GetCommand';
import { ConfigCommand } from './Commands/ConfigCommand';
import { KeysCommand } from './Commands/KeysCommand';
import { InfoCommand } from './Commands/InfoCommand';
import { ReplConfCommand } from './Commands/ReplConfCommand';
import { PsyncCommand } from './Commands/PsyncCommand';
import { WaitCommand } from './Commands/WaitCommand';
import { TypeCommand } from './Commands/TypeCommand';
import { XAddCommand } from './Commands/XAddCommand';
import { XRangeCommand } from './Commands/XRangeCommand';
import { XReadCommand } from './Commands/XReadCommand';

export interface ServerConfig {
    port: number;
    directory: string;
    dbFilename: string;
    isReplica: boolean;
}

export class Server {
    private readonly instance: net.Server;
    private readonly serverId: string = crypto.randomUUID().split('-').join('');
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
            this.processCommand(connection, data, commandData);
        }
    }

    private async processCommand(
        connection: net.Socket,
        data: Buffer,
        commandData: Data
    ) {
        if (commandData.type !== DataType.Array) {
            console.warn('No known commands of not Array type');
            return;
        }

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
                    reply = await new PingCommand(
                        this.encoder,
                        this.storage
                    ).process();
                    break;
                }
                case Command.ECHO_CMD: {
                    reply = await new EchoCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.SET_CMD: {
                    reply = await new SetCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.GET_CMD: {
                    reply = await new GetCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.CONFIG_CMD: {
                    reply = await new ConfigCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        this.config
                    ).process();
                    break;
                }
                case Command.KEYS_CMD: {
                    reply = await new KeysCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.INFO_CMD: {
                    reply = await new InfoCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        this.config,
                        this.serverId,
                        this.replicationOffset
                    ).process();
                    break;
                }
                case Command.REPLCONF_CMD: {
                    reply = await new ReplConfCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        (port) => {
                            this.listeningPorts.push(port);
                            this.setReplicaConnection(port, connection);
                            this.addReplicaReply();
                        },
                        () => {
                            if (connection.remotePort) {
                                this.addReplicaReply();
                            }
                        }
                    ).process();
                    break;
                }
                case Command.PSYNC_CMD: {
                    reply = await new PsyncCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        connection,
                        this.serverId,
                        this.replicationOffset
                    ).process();
                    break;
                }
                case Command.WAIT_CMD: {
                    reply = await new WaitCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        async (numReplicas, timeout) => {
                            return this.waitForReplicas(
                                numReplicas,
                                timeout,
                                this.replicationOffset
                            );
                        }
                    ).process();
                    break;
                }
                case Command.TYPE_CMD: {
                    reply = await new TypeCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.XADD_CMD: {
                    reply = await new XAddCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        (streamKey, entryId, values) =>
                            this.storage.setStream(streamKey, entryId, values)
                    ).process();
                    break;
                }
                case Command.XRANGE_CMD: {
                    reply = await new XRangeCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.XREAD_CMD: {
                    reply = await new XReadCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
            }

            if (reply) {
                connection.write(reply);
            }

            if (Server.isWriteCommand(command.value)) {
                this.onWrite(data);
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
