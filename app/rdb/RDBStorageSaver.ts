import type { PersistenceConfig, StorageState } from "../data/Storage";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { RDBStorageEncoder } from "./RDBStorageEncoder";
import { RDBStorageDecoder } from "./RDBStorageDecoder";
import { RDBStorage } from "./const";


export class RDBStorageSaver {
    private filePath;
    private readonly encoder: RDBStorageEncoder = new RDBStorageEncoder();
    private readonly decoder: RDBStorageDecoder = new RDBStorageDecoder();
    public constructor(config: PersistenceConfig) {
        this.filePath = config.dir + '/' + config.dbFilename;
        console.log('Built filepath', this.filePath, config);        
        
    }

    public save(storage: StorageState) {
        try {
            console.log('saving file', this.filePath);
            const header = this.encoder.encodeHeader();
            const metadata = this.encoder.encodeMetadata();
            const database = this.encoder.encodeDatabase(storage);
            const eofMarker = this.encoder.encodeEOF();

            const buffer = Buffer.concat([header, metadata, database, eofMarker].filter(part => !!part))
            writeFileSync(this.filePath, buffer);
        } catch (err) {
            console.error(err, "Can't write file", this.filePath)
        }
    }

    public restore(): StorageState | null {
        try {
            console.log('restoring file', this.filePath);
            const buffer = readFileSync(this.filePath);            
            const header = this.decoder.decodeHeader(buffer);
            if (header.value !== (RDBStorage.MAGIC_STRING + RDBStorage.MAGIC_STRING_VER)) {
                console.error("Magic string doesn't exist", header);
                return null;
            }                      
            let metadata = this.decoder.decodeMetadata(buffer, header.index);
            while (metadata.value) {
                metadata = this.decoder.decodeMetadata(buffer, metadata.index)
                console.log('metadata', metadata.value, metadata.index);                
            }
            
            console.log('header and metadata', header.value);
                        
            const storage = this.decoder.decodeDatabase(buffer, metadata.index);

            console.log('Restore state here', storage);
            return storage;
        } catch (err) {
            console.error(err, "Can't restore data from file", this.filePath);
        }        
        return null;
    }
}