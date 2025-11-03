import type { Encoder } from "../../../data/Encoder";
import type { Storage } from "../../../data/Storage";
import { isString } from "../../../data/helpers";
import { DataType, type Data } from "../../../data/types";
import { Responses } from "../../const";
import { BaseCommand, type CommandResponse } from "../BaseCommand";


export class SubscribeCommand extends BaseCommand {

    public async process(): Promise<CommandResponse | null> {
        const [channelName] = this.getData();
        if (!isString(channelName)) {
            return null;
        }

        const subscribersCount = this.getStorage().subscribe(channelName.value);

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