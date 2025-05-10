import type { InternalValueType } from './types';

interface Entry {
    id: string;
    key: string;
    value: InternalValueType;
}

export class Stream {
    private entries: Entry[] = [];

    constructor(private readonly key: string) {}

    public addEntry(entry: Entry) {
        this.entries.push(entry);
    }

    public getKey() {
        return this.key;
    }
}
