import {DataType, type Data, type StringData} from './types';

export class Storage {
    private readonly data: Map<string, string> = new Map();
    private readonly expiry: Map<string, number> = new Map();
    
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
                return NULL_DATA;
            }
            const value = this.data.get(key);
            return value ? JSON.parse(value) : NULL_DATA;
        } catch (error) {
            console.error(error);
        }
        return NULL_DATA;
    }
}