import type { Encoder } from "../../../data/Encoder";
import type { Storage } from "../../../data/Storage";
import { isString } from "../../../data/helpers";
import { DataType, type Data } from "../../../data/types";
import { Responses } from "../../const";
import { BaseCommand, type CommandResponse } from "../BaseCommand";
import { Socket } from 'net';

export class SubscribeCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly connection: Socket,        
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<CommandResponse | null> {
        const [channelName] = this.getData();
        if (!isString(channelName)) {
            return null;
        }

        const subscribersCount = this.getStorage().subscribe(this.connection, channelName.value);

        return {
            data: [
                Responses.RESPONSE_SUBSCRIBE,
                channelName.value,
                subscribersCount,
            ],
            dataTypePerArrayItem: 
                [DataType.BulkString, DataType.BulkString, DataType.Integer],            
        };
    }
}