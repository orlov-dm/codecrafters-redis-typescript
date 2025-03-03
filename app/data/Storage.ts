import { RDBStorageSaver } from '../rdb/RDBStorageSaver';
import { DataType, type Data, type StringData } from './types';

export interface PersistenceConfig {
    dir: string;
    dbFilename: string;
}

export interface StorageState {
    data: Map<string, string>;
    expiry: Map<string, number>;
}

const SAVE_INTERVAL_MS = 2000 * 10; 

export class Storage {
    private data: Map<string, string> = new Map();
    private expiry: Map<string, number> = new Map();
    private readonly rdbStorageSaver: RDBStorageSaver | null = null;
    
    constructor(persistenceConfig?: PersistenceConfig) {
        console.log('Storage config', persistenceConfig);
        if (persistenceConfig) {
            this.rdbStorageSaver = new RDBStorageSaver(persistenceConfig);            
        }
    }
    
    public init() {
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
            this.data.set(key, JSON.stringify(value));
            if (ms) {
                this.expiry.set(key, Date.now() + ms);
                console.log('Expiry is set for key', key, ms);
            } 
            return true;
        } catch(error) {
            console.error(error);
        }        
        return false;
    }

    public get(key: string): Data {
        const NULL_DATA: StringData = {
            type: DataType.BulkString,
            value: null,
        };
        try { 
            if (!this.data.has(key)) {
                return NULL_DATA;
            }
            if (this.expiry.has(key) && this.expiry.get(key)! <= Date.now()) {
                console.log('Returning null insted, as key has expired');
                this.data.delete(key);
                this.expiry.delete(key);
                return NULL_DATA;
            }
            const value = this.data.get(key);
            return value ? JSON.parse(value) : NULL_DATA;
        } catch (error) {
            console.error(error);
        }
        return NULL_DATA;
    }

    public keys(search: string | null = null ): string[] {
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
        console.log('data', this.data);
        this.rdbStorageSaver.save({
            data: this.data,
            expiry: this.expiry
        });
    }

    public restore() {

    }
}