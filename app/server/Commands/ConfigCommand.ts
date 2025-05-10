import type { Encoder } from '../../data/Encoder';
import { isString } from '../../data/helpers';
import type { Data } from '../../data/types';
import { Command, ConfigArgs } from '../const';
import type { ServerConfig } from '../Server';
import { BaseCommand } from './BaseCommand';
import { Storage } from '../../data/Storage';

export class ConfigCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly config: ServerConfig
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<string | null> {
        const [subCmdData, keyData] = this.getData();
        if (
            isString(subCmdData) &&
            subCmdData.value?.toUpperCase() === Command.GET_CMD &&
            isString(keyData)
        ) {
            switch (keyData.value?.toLowerCase()) {
                case ConfigArgs.DIR:
                    return this.encode([ConfigArgs.DIR, this.config.directory]);
                case ConfigArgs.DB_FILENAME:
                    return this.encode([
                        ConfigArgs.DB_FILENAME,
                        this.config.dbFilename,
                    ]);
            }
        }

        return null;
    }
}
