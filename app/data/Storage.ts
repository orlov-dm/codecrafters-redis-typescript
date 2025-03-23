import { RDBStorageSaver } from '../rdb/RDBStorageSaver';
import { isString } from './helpers';
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

export class Storage {
    private data: Map<string, InternalValueType> = new Map();
    private expiry: Map<string, number> = new Map();
    private readonly rdbStorageSaver: RDBStorageSaver | null = null;

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
}
