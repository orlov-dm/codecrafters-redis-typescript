
import { Socket } from 'net';
export class StoragePubSub {
    private readonly subscribers: WeakMap<Socket, Set<string>> = new Map();

    public subscribe(connection: Socket, channelName: string): number {
        if (!this.subscribers.has(connection)) {
            this.subscribers.set(connection, new Set());
        }
        const connectionChannels = this.subscribers.get(connection);
        if (!connectionChannels) {
            throw new Error('unhandled error');
        }
        connectionChannels.add(channelName);        
        return connectionChannels.size;
    }
}