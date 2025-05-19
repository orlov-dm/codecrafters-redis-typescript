import util from 'node:util';
import { RDBStorageSaver } from '../rdb/RDBStorageSaver';
import { isNumber, isString } from './helpers';
import { Stream, StreamErrorCode, type Entry, type KeyValue } from './Stream';
import {
    DataType,
    type Data,
    type InternalValueType,
    type StringData,
} from './types';

export interface PersistenceConfig {
    dir: string;
    dbFilename: string;
}

export interface StorageState {
    data: Map<string, InternalValueType>;
    expiry: Map<string, number>;
}

const SAVE_INTERVAL_MS = 2000 * 10;

type StreamAddListener = () => void;

export class Storage {
    private data: Map<string, InternalValueType> = new Map();
    private expiry: Map<string, number> = new Map();
    private streams: Map<string, Stream> = new Map();
    private readonly rdbStorageSaver: RDBStorageSaver | null = null;
    private readonly onStreamAddListeners: Map<string, StreamAddListener[]> =
        new Map();

    constructor(persistenceConfig?: PersistenceConfig) {
        console.log('Storage config', persistenceConfig);
        if (persistenceConfig) {
            this.rdbStorageSaver = new RDBStorageSaver(persistenceConfig);
        }
    }

    public init() {
        console.log('Storage init');
        if (this.rdbStorageSaver) {
            const restoredState = this.rdbStorageSaver.restore();
            if (restoredState) {
                const { data, expiry } = restoredState;
                if (data) {
                    this.data = data;
                }
                if (expiry) {
                    this.expiry = expiry;
                }
            }
            setInterval(() => this.save(), SAVE_INTERVAL_MS);
        }
    }

    public set(key: string, value: Data, ms: number = 0) {
        try {
            if (isString(value)) {
                this.data.set(key, value.value);
            } else {
                this.data.set(key, JSON.stringify(value));
            }
            if (ms) {
                this.expiry.set(key, Date.now() + ms);
            }
            return true;
        } catch (error) {
            console.error(error);
        }
        return false;
    }

    public get(key: string): InternalValueType | null {
        try {
            if (!this.data.has(key)) {
                return null;
            }
            if (this.expiry.has(key) && this.expiry.get(key)! <= Date.now()) {
                this.data.delete(key);
                this.expiry.delete(key);
                return null;
            }
            const value = this.data.get(key);
            return value ?? null;
        } catch (error) {
            console.error(error);
        }
        return null;
    }

    public incr(key: string): number | null {
        try {
            const value = this.data.get(key);
            const numValue = Number(value ?? 0);
            if (Number.isNaN(numValue)) {
                return null;
            }
            const newValue = numValue + 1;
            this.data.set(key, newValue);
            return newValue;
        } catch (error) {
            console.error(error);
        }
        return null;
    }

    public keys(search: string | null = null): string[] {
        const keys = this.data.keys();

        if (!search) {
            return Array.from(keys);
        }

        const searchRE = new RegExp(search.replace('*', '.*'), 'g');
        return Array.from(keys.filter((key) => searchRE.exec(key) !== null));
    }

    public save() {
        if (!this.rdbStorageSaver) {
            return;
        }
        this.rdbStorageSaver.save({
            data: this.data,
            expiry: this.expiry,
        });
    }

    public getFileContent(): Buffer | null {
        if (!this.rdbStorageSaver) {
            return null;
        }
        return this.rdbStorageSaver.getFileContent({
            data: this.data,
            expiry: this.expiry,
        });
    }

    public setFileContent(fileContent: string) {
        if (!this.rdbStorageSaver) {
            return null;
        }
        const result = this.rdbStorageSaver.setFileContent(
            Buffer.from(fileContent)
        );
        console.log('Result of File Content Set', result);
        if (result) {
            this.data = result.data;
            this.expiry = result.expiry;
        }
    }

    public setStream(
        streamKey: string,
        entryId: string,
        values: Data[]
    ): [Entry | null, StreamErrorCode] {
        let stream = this.streams.get(streamKey);
        if (!stream) {
            stream = new Stream(streamKey);
            this.streams.set(streamKey, stream);
        }

        const keyValues: KeyValue[] = [];
        for (let i = 0; i < values.length; i += 2) {
            const key = values[i];
            const value = values[i + 1];

            let resultValue;
            if (isString(key)) {
                if (isString(value) || isNumber(value)) {
                    resultValue = value.value;
                } else {
                    resultValue = JSON.stringify(value.value);
                }
                keyValues.push({
                    key: key.value,
                    value: resultValue,
                });
            }
        }
        const result = stream.addEntry({
            id: entryId,
            data: keyValues,
        });

        const listeners = this.onStreamAddListeners.get(streamKey);
        if (listeners) {
            listeners.forEach((listener) => listener());
        }

        return result;
    }

    public getStream(streamKey: string): Stream | null {
        return this.streams.get(streamKey) ?? null;
    }

    public addStreamAddObserver(streamKey: string, callback: () => void) {
        const listeners = this.onStreamAddListeners.get(streamKey);
        if (!listeners) {
            this.onStreamAddListeners.set(streamKey, [callback]);
            return;
        }
        this.onStreamAddListeners.set(streamKey, [...listeners, callback]);
    }
}
