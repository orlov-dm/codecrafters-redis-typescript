
import { Socket } from 'net';
export class StoragePubSub {
    private readonly subscribers: WeakMap<Socket, Set<string>> = new WeakMap();

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

    public getSubscribedChannels(connection: Socket): number {
        return this.subscribers.get(connection)?.size || 0;
    }
}