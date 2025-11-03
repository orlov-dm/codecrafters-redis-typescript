
export class StoragePubSub {
    private readonly subscribers: Map<string, number> = new Map();

    public subscribe(channelName: string): number {
        if (!this.subscribers.has(channelName)) {
            this.subscribers.set(channelName, 0);
        }
        const newCount = (this.subscribers.get(channelName) || 0) + 1;
        this.subscribers.set(channelName, newCount);
        return newCount;
    }
}