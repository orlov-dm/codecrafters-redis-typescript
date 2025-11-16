
import { Socket } from 'net';
export class StoragePubSub {
    private readonly subscribers: WeakMap<Socket, Set<string>> = new WeakMap();
    private readonly channels: Map<string, Set<Socket>> = new Map();

    public subscribe(connection: Socket, channelName: string): number {
        if (!this.subscribers.has(connection)) {
            this.subscribers.set(connection, new Set());
        }
        const connectionChannels = this.subscribers.get(connection);
        if (!connectionChannels) {
            throw new Error('unhandled error');
        }
        connectionChannels.add(channelName);
        
        if (!this.channels.has(channelName)) {
            this.channels.set(channelName, new Set());
        }
        const channelConnections = this.channels.get(channelName)!;
        channelConnections.add(connection);

        return connectionChannels.size;
    }

    public unsubscribe(connection: Socket, channelName: string): void {
        const connectionChannels = this.subscribers.get(connection);
        connectionChannels?.delete(channelName);
        
        const channelConnections = this.channels.get(channelName);
        channelConnections?.delete(connection);
        
        if (channelConnections?.size === 0) {
            this.channels.delete(channelName);
        }
    }

    public getSubscribedChannels(connection: Socket): number {
        return this.subscribers.get(connection)?.size || 0;
    }

    public getSubscribedConnections(channelName: string): Socket[] {
        return this.channels.has(channelName) ? [...this.channels.get(channelName)!] : [];
    }

    public cleanupConnection(connection: Socket): void {
        const connectionChannels = this.subscribers.get(connection);
        if (!connectionChannels) {
            return;
        }        
        for (const channelName of connectionChannels) {
            const channelConnections = this.channels.get(channelName);
            channelConnections?.delete(connection);
            if (channelConnections?.size === 0) {
                this.channels.delete(channelName);
            }
        }        
    }
}