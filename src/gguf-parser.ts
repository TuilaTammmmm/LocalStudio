import fs from 'node:fs';

export interface GgufHeaderInfo {
  valid: boolean;
  version?: number;
  tensorCount?: number;
  metadataCount?: number;
  architecture?: string;
  name?: string;
  contextLength?: number;
  totalLayers?: number;
  quantizationType?: string;
  metadata?: Record<string, string | number | boolean>;
}

// GGUF Value Types according to ggml specification
const GGUF_TYPE_UINT8 = 0;
const GGUF_TYPE_INT8 = 1;
const GGUF_TYPE_UINT16 = 2;
const GGUF_TYPE_INT16 = 3;
const GGUF_TYPE_UINT32 = 4;
const GGUF_TYPE_INT32 = 5;
const GGUF_TYPE_FLOAT32 = 6;
const GGUF_TYPE_BOOL = 7;
const GGUF_TYPE_STRING = 8;
const GGUF_TYPE_ARRAY = 9;
const GGUF_TYPE_UINT64 = 10;
const GGUF_TYPE_INT64 = 11;
const GGUF_TYPE_FLOAT64 = 12;

/**
 * Fast direct binary GGUF header reader.
 * Reads only the first 64KB of the file without loading the gigabyte weights into RAM.
 */
export function parseGgufHeader(filePath: string): GgufHeaderInfo {
  if (!fs.existsSync(filePath)) {
    return { valid: false };
  }

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const bufferSize = 65536; // 64 KB is plenty for all initial header metadata
    const buffer = Buffer.alloc(bufferSize);
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);

    if (bytesRead < 24) {
      return { valid: false };
    }

    // Check magic: "GGUF" (0x47, 0x47, 0x55, 0x46)
    const magic = buffer.toString('ascii', 0, 4);
    if (magic !== 'GGUF') {
      return { valid: false };
    }

    let offset = 4;
    const version = buffer.readUInt32LE(offset);
    offset += 4;

    const tensorCount = Number(buffer.readBigUInt64LE(offset));
    offset += 8;

    const metadataCount = Number(buffer.readBigUInt64LE(offset));
    offset += 8;

    const metadata: Record<string, any> = {};

    // Helper to read string with 64-bit length
    const readString = (): string | null => {
      if (offset + 8 > bytesRead) return null;
      const len = Number(buffer.readBigUInt64LE(offset));
      offset += 8;
      if (offset + len > bytesRead) return null;
      const str = buffer.toString('utf-8', offset, offset + len);
      offset += len;
      return str;
    };

    // Helper to read a value based on GGUF type
    const readValue = (type: number): any => {
      switch (type) {
        case GGUF_TYPE_UINT8:
          if (offset + 1 > bytesRead) return null;
          return buffer.readUInt8(offset++);
        case GGUF_TYPE_INT8:
          if (offset + 1 > bytesRead) return null;
          return buffer.readInt8(offset++);
        case GGUF_TYPE_UINT16:
          if (offset + 2 > bytesRead) return null;
          const u16 = buffer.readUInt16LE(offset);
          offset += 2;
          return u16;
        case GGUF_TYPE_INT16:
          if (offset + 2 > bytesRead) return null;
          const i16 = buffer.readInt16LE(offset);
          offset += 2;
          return i16;
        case GGUF_TYPE_UINT32:
          if (offset + 4 > bytesRead) return null;
          const u32 = buffer.readUInt32LE(offset);
          offset += 4;
          return u32;
        case GGUF_TYPE_INT32:
          if (offset + 4 > bytesRead) return null;
          const i32 = buffer.readInt32LE(offset);
          offset += 4;
          return i32;
        case GGUF_TYPE_FLOAT32:
          if (offset + 4 > bytesRead) return null;
          const f32 = buffer.readFloatLE(offset);
          offset += 4;
          return f32;
        case GGUF_TYPE_BOOL:
          if (offset + 1 > bytesRead) return null;
          return buffer.readUInt8(offset++) !== 0;
        case GGUF_TYPE_STRING:
          return readString();
        case GGUF_TYPE_UINT64:
          if (offset + 8 > bytesRead) return null;
          const u64 = buffer.readBigUInt64LE(offset);
          offset += 8;
          return Number(u64);
        case GGUF_TYPE_INT64:
          if (offset + 8 > bytesRead) return null;
          const i64 = buffer.readBigInt64LE(offset);
          offset += 8;
          return Number(i64);
        case GGUF_TYPE_FLOAT64:
          if (offset + 8 > bytesRead) return null;
          const f64 = buffer.readDoubleLE(offset);
          offset += 8;
          return f64;
        case GGUF_TYPE_ARRAY: {
          if (offset + 12 > bytesRead) return null;
          const itemType = buffer.readUInt32LE(offset);
          offset += 4;
          const arrayLen = Number(buffer.readBigUInt64LE(offset));
          offset += 8;
          const arr: any[] = [];
          for (let i = 0; i < arrayLen && i < 20; i++) {
            const val = readValue(itemType);
            if (val === null) break;
            arr.push(val);
          }
          return arr;
        }
        default:
          return null;
      }
    };

    for (let i = 0; i < metadataCount && offset < bytesRead - 8; i++) {
      const key = readString();
      if (!key) break;
      if (offset + 4 > bytesRead) break;
      const type = buffer.readUInt32LE(offset);
      offset += 4;
      const val = readValue(type);
      if (val !== null && val !== undefined) {
        metadata[key] = val;
      }
    }

    const arch = metadata['general.architecture'] as string | undefined;
    const name = (metadata['general.name'] as string) || (metadata[`${arch}.name`] as string) || undefined;

    // Context length key is architecture-specific (e.g. llama.context_length, qwen2.context_length)
    let contextLength: number | undefined;
    if (arch && metadata[`${arch}.context_length`]) {
      contextLength = Number(metadata[`${arch}.context_length`]);
    } else if (metadata['general.context_length']) {
      contextLength = Number(metadata['general.context_length']);
    }

    // Block count / layers
    let totalLayers: number | undefined;
    if (arch && metadata[`${arch}.block_count`]) {
      totalLayers = Number(metadata[`${arch}.block_count`]);
    }

    const quantizationType = metadata['general.file_type_name'] as string | undefined;

    return {
      valid: true,
      version,
      tensorCount,
      metadataCount,
      architecture: arch,
      name,
      contextLength,
      totalLayers,
      quantizationType,
      metadata,
    };
  } catch {
    return { valid: false };
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}
