import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import { isString } from '../../data/helpers';
import { DELIMITER, type Data } from '../../data/types';
import { Command } from '../const';
import type { ServerConfig } from '../Server';
import { BaseCommand } from './BaseCommand';

export class InfoCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly config: ServerConfig,
        private readonly serverId: string,
        private readonly replicationOffset: number
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<string | null> {
        const [subCmdData] = this.getData();
        if (
            isString(subCmdData) &&
            subCmdData.value === Command.INFO_REPLICATION_CMD
        ) {
            const role = !this.config.isReplica ? 'master' : 'slave';
            const info = [
                `role:${role}`,
                `master_replid:${this.serverId}`,
                `master_repl_offset:${this.replicationOffset}`,
            ];
            return this.encode(info.join(DELIMITER));
        }
        return null;
    }
}
