export function readBitsAcrossBytes(
    buffer: Buffer,
    byteIndex: number,
    bitOffset: number,
    bitLength: number
): number {
    let totalBytes = Math.ceil((bitOffset + bitLength) / 8);
    let value = buffer.readUIntBE(byteIndex, totalBytes);

    let shiftRight = totalBytes * 8 - (bitOffset + bitLength);
    return (value >> shiftRight) & ((1 << bitLength) - 1);
}
