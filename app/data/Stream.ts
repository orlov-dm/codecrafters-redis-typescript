import type { Data, InternalValueType } from './types';

export interface KeyValue {
    key: string;
    value: InternalValueType;
}

export interface Entry {
    id: string;
    data: KeyValue[];
}

export enum StreamErrorCode {
    NO_ERROR = 0,
    ID_IS_SMALLER_OR_EQUAL = 1,
    ID_IS_ZERO = 2,
}

export class Stream {
    private entries: Entry[] = [];

    constructor(private readonly key: string) {}

    public addEntry(entry: Entry): [Entry | null, StreamErrorCode] {
        console.log('Add ', entry);
        entry = this.prepareEntry(entry);
        const [validationResult, validationError] = this.isEntryValid(entry);
        if (!validationResult) {
            return [null, validationError];
        }
        this.entries.push(entry);
        return [entry, validationError];
    }

    public getKey() {
        return this.key;
    }

    public getRange(startId: string = '-', endId: string = '+'): Entry[] {
        const range: Entry[] = [];
        const skipStartCheck = startId === '-';
        const skipEndCheck = endId === '+';
        const [startMs, startSeq] = this.parseId(startId);
        const [endMs, endSeq] = this.parseId(endId);

        for (let i = this.entries.length - 1; i >= 0; --i) {
            const entry = this.entries[i];
            const [ms, seq] = this.parseId(entry.id);
            if (
                (skipStartCheck || ms >= startMs) &&
                (skipEndCheck || ms <= endMs)
            ) {
                if (!skipStartCheck && ms === startMs && seq < startSeq) {
                    continue;
                }
                if (!skipEndCheck && ms === endMs && seq > endSeq) {
                    continue;
                }
                range.push(entry);
            }
        }

        return range.reverse();
    }

    public getRangeExclusive(
        startId: string = '-',
        endId: string = '+'
    ): Entry[] {
        const range: Entry[] = [];
        const skipStartCheck = startId === '-';
        const skipEndCheck = endId === '+';
        const [startMs, startSeq] = this.parseId(startId);
        const [endMs, endSeq] = this.parseId(endId);
        console.log('Get range exc', startMs, startSeq, this.entries);
        for (let i = this.entries.length - 1; i >= 0; --i) {
            const entry = this.entries[i];
            const [ms, seq] = this.parseId(entry.id);
            if (
                (skipStartCheck || ms >= startMs) &&
                (skipEndCheck || ms <= endMs)
            ) {
                if (!skipStartCheck && ms === startMs && seq <= startSeq) {
                    continue;
                }
                if (!skipEndCheck && ms === endMs && seq >= endSeq) {
                    continue;
                }
                range.push(entry);
            }
        }

        return range.reverse();
    }

    public getLatestEntry(): Entry | null {
        return this.entries.at(-1) ?? null;
    }

    private prepareEntry(entry: Entry) {
        if (entry.id === '*') {
            entry.id = `${Date.now()}-0`;
        }

        const [msPart, seqPart] = entry.id.split('-');
        const ms = Number(msPart);
        let seq: number;
        if (seqPart === '*') {
            seq = ms === 0 ? 1 : 0;
            const lastEntry = this.entries.at(-1);
            if (lastEntry) {
                const [lastMs, lastSeq] = this.parseId(lastEntry.id);
                if (lastMs === ms) {
                    seq = lastSeq + 1;
                }
            }
        } else {
            seq = Number(seqPart);
        }
        entry.id = `${ms}-${seq}`;
        return entry;
    }

    private parseId(id: string): [number, number] {
        const [ms = 0, seq = 0] = id.split('-').map(Number);
        return [ms, seq];
    }

    private isEntryValid(entry: Entry): [boolean, StreamErrorCode] {
        const [ms, sequence] = this.parseId(entry.id);
        console.log('Is Entry valid check', entry, ms, sequence);
        if (ms <= 0 && sequence <= 0) {
            return [false, StreamErrorCode.ID_IS_ZERO];
        }
        const lastEntry = this.entries[this.entries.length - 1];
        if (lastEntry) {
            const [prevMs, prevSequence] = this.parseId(lastEntry.id);
            if (ms < prevMs) {
                return [false, StreamErrorCode.ID_IS_SMALLER_OR_EQUAL];
            } else if (ms === prevMs) {
                if (sequence <= prevSequence) {
                    return [false, StreamErrorCode.ID_IS_SMALLER_OR_EQUAL];
                }
            }
        }

        return [true, StreamErrorCode.NO_ERROR];
    }
}
