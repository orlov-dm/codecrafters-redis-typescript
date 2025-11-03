import type { Encoder } from "../../../data/Encoder";
import type { Storage } from "../../../data/Storage";
import type { Data } from "../../../data/types";
import { Command } from "../../const";
import type { BaseCommand } from "../BaseCommand";
import { SubscribeCommand } from "./SubscribeCommand";



export class PubSubCommandFactory {
    public static createCommand(command: string, encoder: Encoder, storage: Storage, commandData: Data[]): BaseCommand | null {
        switch (command) {
            case Command.SUBSCRIBE_CMD: {
                return new SubscribeCommand(encoder, storage, commandData);
            }
        }

        return null;
    }
    public static createSubscribeCommand(encoder: Encoder, storage: Storage, commandData: Data[]): SubscribeCommand {
        return new SubscribeCommand(encoder, storage, commandData);
    }
}