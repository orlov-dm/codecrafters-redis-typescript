import * as net from 'net';
import { Encoder, type EncodeData } from '../data/Encoder';
import { Storage } from '../data/Storage';
import { CommandParser } from '../data/CommandParser';
import { DataType, type Data } from '../data/types';
import { isString } from '../data/helpers';
import { Command, LOCALHOST, Responses } from './const';
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
import { XAddCommand } from './Commands/streaming/XAddCommand';
import { XRangeCommand } from './Commands/streaming/XRangeCommand';
import { XReadCommand } from './Commands/streaming/XReadCommand';
import { IncrCommand } from './Commands/IncrCommand';
import { MultiCommand } from './Commands/transactions/MultiCommand';
import { ExecCommand } from './Commands/transactions/ExecCommand';
import type { CommandResponse } from './Commands/BaseCommand';
import { DiscardCommand } from './Commands/transactions/DiscardCommand';
import { RpushCommand } from './Commands/lists/RpushCommand';

export interface ServerConfig {
    port: number;
    directory: string;
    dbFilename: string;
    isReplica: boolean;
}

export interface CommandQueueContext {
    commandData: Data;
    data: Buffer;
}

export class Server {
    private readonly instance: net.Server;
    private readonly serverId: string = crypto.randomUUID().split('-').join('');
    private replicationOffset = 0;
    private readonly listeningPorts: number[] = [];
    private readonly replicaConnections: Map<number, net.Socket> = new Map();
    private replicaReplies: Map<number, number> = new Map();
    private replicaAckTimer: Timer | null = null;
    private commandQueue: Map<net.Socket, CommandQueueContext[]> = new Map();
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
        commandData: Data,
        isEnqueued: boolean = false
    ): Promise<CommandResponse | null> {
        if (commandData.type !== DataType.Array) {
            console.warn('No known commands of not Array type');
            return null;
        }

        if (!commandData.value) {
            console.warn('Empty array data');
            return null;
        }

        const [command, ...rest] = commandData.value;
        if (this.commandQueue.has(connection)) {
            const isTransactionExec =
                isString(command) &&
                command.value.toUpperCase() === Command.EXEC_CMD;
            const isTransactionDiscard =
                isString(command) &&
                command.value.toUpperCase() === Command.DISCARD_CMD;
            if (!isTransactionExec && !isTransactionDiscard) {
                const queue = this.commandQueue.get(connection);
                if (queue) {
                    queue.push({
                        commandData,
                        data: data.subarray(),
                    });
                    connection.write(
                        this.encoder.encode(Responses.RESPONSE_QUEUED, {
                            enforceDataType: DataType.SimpleString,
                        })
                    );
                }
                return null;
            }
        }
        let reply: string = '';

        if (isString(command)) {
            if (!command.value) {
                console.warn('Empty string data');
                return null;
            }
            let commandResponse: CommandResponse | null = null;
            switch (command.value.toUpperCase()) {
                case Command.PING_CMD: {
                    commandResponse = await new PingCommand(
                        this.encoder,
                        this.storage
                    ).process();
                    break;
                }
                case Command.ECHO_CMD: {
                    commandResponse = await new EchoCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.SET_CMD: {
                    commandResponse = await new SetCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.GET_CMD: {
                    commandResponse = await new GetCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.CONFIG_CMD: {
                    commandResponse = await new ConfigCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        this.config
                    ).process();
                    break;
                }
                case Command.KEYS_CMD: {
                    commandResponse = await new KeysCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.INFO_CMD: {
                    commandResponse = await new InfoCommand(
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
                    commandResponse = await new ReplConfCommand(
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
                    commandResponse = await new PsyncCommand(
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
                    commandResponse = await new WaitCommand(
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
                    commandResponse = await new TypeCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.XADD_CMD: {
                    commandResponse = await new XAddCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        (streamKey, entryId, values) =>
                            this.storage.setStream(streamKey, entryId, values)
                    ).process();
                    break;
                }
                case Command.XRANGE_CMD: {
                    commandResponse = await new XRangeCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.XREAD_CMD: {
                    commandResponse = await new XReadCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.INCR_CMD: {
                    commandResponse = await new IncrCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
                case Command.MULTI_CMD: {
                    commandResponse = await new MultiCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        () => this.commandQueue.set(connection, [])
                    ).process();
                    break;
                }
                case Command.DISCARD_CMD: {
                    commandResponse = await new DiscardCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        this.commandQueue.get(connection) ?? null,
                        () => this.commandQueue.delete(connection)
                    ).process();
                    break;
                }
                case Command.EXEC_CMD: {
                    const commandResponses = await new ExecCommand(
                        this.encoder,
                        this.storage,
                        rest,
                        this.commandQueue.get(connection) ?? null,
                        async (commands) => {
                            this.commandQueue.delete(connection);
                            const responses = await Promise.all(
                                commands.map((commandContext) =>
                                    this.processCommand(
                                        connection,
                                        commandContext.data,
                                        commandContext.commandData,
                                        true
                                    )
                                )
                            );
                            return responses;
                        }
                    ).processMulti();

                    if (commandResponses) {
                        if (
                            commandResponses.length === 1 &&
                            commandResponses[0].dataType ===
                                DataType.SimpleError
                        ) {
                            commandResponse = commandResponses[0];
                        } else {
                            const encodeData: EncodeData[] =
                                commandResponses.map((response) => ({
                                    data: response.data,
                                    dataType: response.dataType,
                                }));
                            reply = this.encoder.encodeArray(encodeData);
                        }
                    }
                    break;
                }
                case Command.RPUSH_CMD: {
                    commandResponse = await new RpushCommand(
                        this.encoder,
                        this.storage,
                        rest
                    ).process();
                    break;
                }
            }

            if (commandResponse && !isEnqueued) {
                reply = this.encoder.encode(commandResponse.data, {
                    enforceDataType: commandResponse.dataType,
                });
            }

            if (reply) {
                connection.write(reply);
            }

            if (Server.isWriteCommand(command.value) && !isEnqueued) {
                this.onWrite(data);
            }

            return commandResponse;
        }

        return null;
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
