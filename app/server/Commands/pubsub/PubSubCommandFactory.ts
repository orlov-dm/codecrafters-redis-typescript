import type { Encoder } from "../../../data/Encoder";
import type { Storage } from "../../../data/Storage";
import type { Data } from "../../../data/types";
import { Command } from "../../const";
import type { BaseCommand } from "../BaseCommand";
import { PublishCommand } from "./PublishCommand";
import { SubscribeCommand } from "./SubscribeCommand";
import { Socket } from 'net';
import { UnsubscribeCommand } from "./UnsubscribeCommand";


export class PubSubCommandFactory {
    public static createCommand(command: string, encoder: Encoder, storage: Storage, commandData: Data[], connection: Socket): BaseCommand | null {
        switch (command) {
            case Command.SUBSCRIBE_CMD: {
                return new SubscribeCommand(encoder, storage, commandData, connection);
            }
            case Command.UNSUBSCRIBE_CMD: {
                return new UnsubscribeCommand(encoder, storage, commandData, connection);
            }
            case Command.PUBLISH_CMD: {
                return new PublishCommand(encoder, storage, commandData, connection);
            }
        }

        return null;
    }
}