// This is an intentionally recursive require. I don't like it either.
const uint64be = require('uint64be')
const Box = require('./index.js')
const Descriptor = require('./descriptor.js')

const TIME_OFFSET = 2082844800000

/*
TODO:
test these
add new box versions
*/

// These have 'version' and 'flags' fields in the headers
exports.fullBoxes = {}
const fullBoxes = [
  'mvhd',
  'tkhd',
  'mdhd',
  'vmhd',
  'smhd',
  'stsd',
  'esds',
  'stsz',
  'stco',
  'co64',
  'stss',
  'stts',
  'ctts',
  'stsc',
  'dref',
  'elst',
  'hdlr',
  'mehd',
  'trex',
  'mfhd',
  'tfhd',
  'tfdt',
  'trun'
]
fullBoxes.forEach(type => {
  exports.fullBoxes[type] = true
})

exports.ftyp = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.ftyp.encodingLength(box))
    const brands = box.compatibleBrands || []
    buf.write(box.brand, 0, 4, 'ascii')
    buf.writeUInt32BE(box.brandVersion, 4)
    for (let i = 0; i < brands.length; i++) buf.write(brands[i], 8 + (i * 4), 4, 'ascii')
    exports.ftyp.encode.bytes = 8 + brands.length * 4
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const brand = buf.toString('ascii', 0, 4)
    const version = buf.readUInt32BE(4)
    const compatibleBrands = []
    for (let i = 8; i < buf.length; i += 4) compatibleBrands.push(buf.toString('ascii', i, i + 4))
    return {
      brand,
      brandVersion: version,
      compatibleBrands
    }
  },
  encodingLength: box => 8 + (box.compatibleBrands || []).length * 4
}

exports.mvhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(96)
    writeDate(box.ctime || new Date(), buf, 0)
    writeDate(box.mtime || new Date(), buf, 4)
    buf.writeUInt32BE(box.timeScale || 0, 8)
    buf.writeUInt32BE(box.duration || 0, 12)
    writeFixed32(box.preferredRate || 0, buf, 16)
    writeFixed16(box.preferredVolume || 0, buf, 20)
    writeReserved(buf, 22, 32)
    writeMatrix(box.matrix, buf, 32)
    buf.writeUInt32BE(box.previewTime || 0, 68)
    buf.writeUInt32BE(box.previewDuration || 0, 72)
    buf.writeUInt32BE(box.posterTime || 0, 76)
    buf.writeUInt32BE(box.selectionTime || 0, 80)
    buf.writeUInt32BE(box.selectionDuration || 0, 84)
    buf.writeUInt32BE(box.currentTime || 0, 88)
    buf.writeUInt32BE(box.nextTrackId || 0, 92)
    exports.mvhd.encode.bytes = 96
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      ctime: readDate(buf, 0),
      mtime: readDate(buf, 4),
      timeScale: buf.readUInt32BE(8),
      duration: buf.readUInt32BE(12),
      preferredRate: readFixed32(buf, 16),
      preferredVolume: readFixed16(buf, 20),
      matrix: readMatrix(buf.slice(32, 68)),
      previewTime: buf.readUInt32BE(68),
      previewDuration: buf.readUInt32BE(72),
      posterTime: buf.readUInt32BE(76),
      selectionTime: buf.readUInt32BE(80),
      selectionDuration: buf.readUInt32BE(84),
      currentTime: buf.readUInt32BE(88),
      nextTrackId: buf.readUInt32BE(92)
    }
  },
  encodingLength: box => 96
}

exports.tkhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(80)
    writeDate(box.ctime || new Date(), buf, 0)
    writeDate(box.mtime || new Date(), buf, 4)
    buf.writeUInt32BE(box.trackId || 0, 8)
    writeReserved(buf, 12, 16)
    buf.writeUInt32BE(box.duration || 0, 16)
    writeReserved(buf, 20, 28)
    buf.writeUInt16BE(box.layer || 0, 28)
    buf.writeUInt16BE(box.alternateGroup || 0, 30)
    buf.writeUInt16BE(box.volume || 0, 32)
    writeMatrix(box.matrix, buf, 36)
    buf.writeUInt32BE(box.trackWidth || 0, 72)
    buf.writeUInt32BE(box.trackHeight || 0, 76)
    exports.tkhd.encode.bytes = 80
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      ctime: readDate(buf, 0),
      mtime: readDate(buf, 4),
      trackId: buf.readUInt32BE(8),
      duration: buf.readUInt32BE(16),
      layer: buf.readUInt16BE(28),
      alternateGroup: buf.readUInt16BE(30),
      volume: buf.readUInt16BE(32),
      matrix: readMatrix(buf.slice(36, 72)),
      trackWidth: buf.readUInt32BE(72),
      trackHeight: buf.readUInt32BE(76)
    }
  },
  encodingLength: box => 80
}

exports.mdhd = {
  encode (box, buf, offset) {
    if (box.version === 1) {
      buf = buf ? buf.slice(offset) : Buffer.alloc(32)
      writeDate64(box.ctime || new Date(), buf, 0)
      writeDate64(box.mtime || new Date(), buf, 8)
      buf.writeUInt32BE(box.timeScale || 0, 16)
      // Node only supports integer <= 48bit. Waiting for BigInt!
      buf.writeUIntBE(box.duration || 0, 20, 6)
      buf.writeUInt16BE(box.language || 0, 28)
      buf.writeUInt16BE(box.quality || 0, 30)
      exports.mdhd.encode.bytes = 32
      return buf
    }

    buf = buf ? buf.slice(offset) : Buffer.alloc(20)
    writeDate(box.ctime || new Date(), buf, 0)
    writeDate(box.mtime || new Date(), buf, 4)
    buf.writeUInt32BE(box.timeScale || 0, 8)
    buf.writeUInt32BE(box.duration || 0, 12)
    buf.writeUInt16BE(box.language || 0, 16)
    buf.writeUInt16BE(box.quality || 0, 18)
    exports.mdhd.encode.bytes = 20
    return buf
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset)

    const version1 = (end - offset) !== 20

    // In version 1 creation time and modification time are unsigned long
    if (version1) {
      return {
        ctime: readDate64(buf, 0),
        mtime: readDate64(buf, 8),
        timeScale: buf.readUInt32BE(16),
        // Node only supports integer <= 48bit. Waiting for BigInt!
        duration: buf.readUIntBE(20, 6),
        language: buf.readUInt16BE(28),
        quality: buf.readUInt16BE(30)
      }
    }

    return {
      ctime: readDate(buf, 0),
      mtime: readDate(buf, 4),
      timeScale: buf.readUInt32BE(8),
      duration: buf.readUInt32BE(12),
      language: buf.readUInt16BE(16),
      quality: buf.readUInt16BE(18)
    }
  },
  encodingLength: box => box.version === 1 ? 32 : 20
}

exports.vmhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(8)
    buf.writeUInt16BE(box.graphicsMode || 0, 0)
    const opcolor = box.opcolor || [0, 0, 0]
    buf.writeUInt16BE(opcolor[0], 2)
    buf.writeUInt16BE(opcolor[1], 4)
    buf.writeUInt16BE(opcolor[2], 6)
    exports.vmhd.encode.bytes = 8
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      graphicsMode: buf.readUInt16BE(0),
      opcolor: [buf.readUInt16BE(2), buf.readUInt16BE(4), buf.readUInt16BE(6)]
    }
  },
  encodingLength: box => 8
}

exports.smhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(4)
    buf.writeUInt16BE(box.balance || 0, 0)
    writeReserved(buf, 2, 4)
    exports.smhd.encode.bytes = 4
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      balance: buf.readUInt16BE(0)
    }
  },
  encodingLength: box => 4
}

exports.stsd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.stsd.encodingLength(box))
    const entries = box.entries || []

    buf.writeUInt32BE(entries.length, 0)

    let ptr = 4
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      Box.encode(entry, buf, ptr)
      ptr += Box.encode.bytes
    }

    exports.stsd.encode.bytes = ptr
    return buf
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)
    let ptr = 4

    for (let i = 0; i < num; i++) {
      const entry = Box.decode(buf, ptr, end)
      entries[i] = entry
      ptr += entry.length
    }

    return {
      entries
    }
  },
  encodingLength (box) {
    let totalSize = 4
    if (!box.entries) return totalSize
    for (let i = 0; i < box.entries.length; i++) {
      totalSize += Box.encodingLength(box.entries[i])
    }
    return totalSize
  }
}

exports.avc1 =
exports.VisualSampleEntry = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.VisualSampleEntry.encodingLength(box))

    writeReserved(buf, 0, 6)
    buf.writeUInt16BE(box.dataReferenceIndex || 0, 6)
    writeReserved(buf, 8, 24)
    buf.writeUInt16BE(box.width || 0, 24)
    buf.writeUInt16BE(box.height || 0, 26)
    buf.writeUInt32BE(box.hResolution || 0x480000, 28)
    buf.writeUInt32BE(box.vResolution || 0x480000, 32)
    writeReserved(buf, 36, 40)
    buf.writeUInt16BE(box.frameCount || 1, 40)
    const compressorName = box.compressorName || ''
    const nameLen = Math.min(compressorName.length, 31)
    buf.writeUInt8(nameLen, 42)
    buf.write(compressorName, 43, nameLen, 'utf8')
    buf.writeUInt16BE(box.depth || 0x18, 74)
    buf.writeInt16BE(-1, 76)

    let ptr = 78
    const children = box.children || []
    children.forEach(child => {
      Box.encode(child, buf, ptr)
      ptr += Box.encode.bytes
    })
    exports.VisualSampleEntry.encode.bytes = ptr
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset)
    const length = end - offset
    const nameLen = Math.min(buf.readUInt8(42), 31)
    const box = {
      dataReferenceIndex: buf.readUInt16BE(6),
      width: buf.readUInt16BE(24),
      height: buf.readUInt16BE(26),
      hResolution: buf.readUInt32BE(28),
      vResolution: buf.readUInt32BE(32),
      frameCount: buf.readUInt16BE(40),
      compressorName: buf.toString('utf8', 43, 43 + nameLen),
      depth: buf.readUInt16BE(74),
      children: []
    }

    let ptr = 78
    while (length - ptr >= 8) {
      const child = Box.decode(buf, ptr, length)
      box.children.push(child)
      box[child.type] = child
      ptr += child.length
    }

    return box
  },
  encodingLength (box) {
    let len = 78
    const children = box.children || []
    children.forEach(child => {
      len += Box.encodingLength(child)
    })
    return len
  }
}

exports.avcC = {
  encode ({ buffer }, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(buffer.length)

    buffer.copy(buf)
    exports.avcC.encode.bytes = buffer.length
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset, end)

    return {
      mimeCodec: buf.toString('hex', 1, 4),
      buffer: Buffer.from(buf)
    }
  },
  encodingLength: box => box.buffer.length
}

exports.mp4a =
exports.AudioSampleEntry = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.AudioSampleEntry.encodingLength(box))

    writeReserved(buf, 0, 6)
    buf.writeUInt16BE(box.dataReferenceIndex || 0, 6)
    writeReserved(buf, 8, 16)
    buf.writeUInt16BE(box.channelCount || 2, 16)
    buf.writeUInt16BE(box.sampleSize || 16, 18)
    writeReserved(buf, 20, 24)
    buf.writeUInt32BE(box.sampleRate || 0, 24)

    let ptr = 28
    const children = box.children || []
    children.forEach(child => {
      Box.encode(child, buf, ptr)
      ptr += Box.encode.bytes
    })
    exports.AudioSampleEntry.encode.bytes = ptr
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset, end)
    const length = end - offset
    const box = {
      dataReferenceIndex: buf.readUInt16BE(6),
      channelCount: buf.readUInt16BE(16),
      sampleSize: buf.readUInt16BE(18),
      sampleRate: buf.readUInt32BE(24),
      children: []
    }

    let ptr = 28
    while (length - ptr >= 8) {
      const child = Box.decode(buf, ptr, length)
      box.children.push(child)
      box[child.type] = child
      ptr += child.length
    }

    return box
  },
  encodingLength (box) {
    let len = 28
    const children = box.children || []
    children.forEach(child => {
      len += Box.encodingLength(child)
    })
    return len
  }
}

exports.esds = {
  encode ({ buffer }, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(buffer.length)

    buffer.copy(buf, 0)
    exports.esds.encode.bytes = buffer.length
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset, end)

    const desc = Descriptor.Descriptor.decode(buf, 0, buf.length)
    const esd = (desc.tagName === 'ESDescriptor') ? desc : {}
    const dcd = esd.DecoderConfigDescriptor || {}
    const oti = dcd.oti || 0
    const dsi = dcd.DecoderSpecificInfo
    const audioConfig = dsi ? (dsi.buffer.readUInt8(0) & 0xf8) >> 3 : 0

    let mimeCodec = null
    if (oti) {
      mimeCodec = oti.toString(16)
      if (audioConfig) {
        mimeCodec += `.${audioConfig}`
      }
    }

    return {
      mimeCodec,
      buffer: Buffer.from(buf.slice(0))
    }
  },
  encodingLength: box => box.buffer.length
}

// TODO: integrate the two versions in a saner way
exports.stsz = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.stsz.encodingLength(box))

    buf.writeUInt32BE(0, 0)
    buf.writeUInt32BE(entries.length, 4)

    for (let i = 0; i < entries.length; i++) {
      buf.writeUInt32BE(entries[i], i * 4 + 8)
    }

    exports.stsz.encode.bytes = 8 + entries.length * 4
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const size = buf.readUInt32BE(0)
    const num = buf.readUInt32BE(4)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      if (size === 0) {
        entries[i] = buf.readUInt32BE(i * 4 + 8)
      } else {
        entries[i] = size
      }
    }

    return {
      entries
    }
  },
  encodingLength: box => 8 + box.entries.length * 4
}

exports.stss =
exports.stco = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.stco.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      buf.writeUInt32BE(entries[i], i * 4 + 4)
    }

    exports.stco.encode.bytes = 4 + entries.length * 4
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      entries[i] = buf.readUInt32BE(i * 4 + 4)
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 4
}

exports.co64 = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.co64.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      uint64be.encode(entries[i], buf, i * 8 + 4)
    }

    exports.co64.encode.bytes = 4 + entries.length * 8
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      entries[i] = uint64be.decode(buf, i * 8 + 4)
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 8
}

exports.stts = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.stts.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      const ptr = i * 8 + 4
      buf.writeUInt32BE(entries[i].count || 0, ptr)
      buf.writeUInt32BE(entries[i].duration || 0, ptr + 4)
    }

    exports.stts.encode.bytes = 4 + box.entries.length * 8
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      const ptr = i * 8 + 4
      entries[i] = {
        count: buf.readUInt32BE(ptr),
        duration: buf.readUInt32BE(ptr + 4)
      }
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 8
}

exports.ctts = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.ctts.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      const ptr = i * 8 + 4
      buf.writeUInt32BE(entries[i].count || 0, ptr)
      buf.writeUInt32BE(entries[i].compositionOffset || 0, ptr + 4)
    }

    exports.ctts.encode.bytes = 4 + entries.length * 8
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      const ptr = i * 8 + 4
      entries[i] = {
        count: buf.readUInt32BE(ptr),
        compositionOffset: buf.readInt32BE(ptr + 4)
      }
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 8
}

exports.stsc = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.stsc.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      const ptr = i * 12 + 4
      buf.writeUInt32BE(entries[i].firstChunk || 0, ptr)
      buf.writeUInt32BE(entries[i].samplesPerChunk || 0, ptr + 4)
      buf.writeUInt32BE(entries[i].sampleDescriptionId || 0, ptr + 8)
    }

    exports.stsc.encode.bytes = 4 + entries.length * 12
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      const ptr = i * 12 + 4
      entries[i] = {
        firstChunk: buf.readUInt32BE(ptr),
        samplesPerChunk: buf.readUInt32BE(ptr + 4),
        sampleDescriptionId: buf.readUInt32BE(ptr + 8)
      }
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 12
}

exports.dref = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.dref.encodingLength(box))
    const entries = box.entries || []

    buf.writeUInt32BE(entries.length, 0)

    let ptr = 4
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const size = (entry.buf ? entry.buf.length : 0) + 4 + 4

      buf.writeUInt32BE(size, ptr)
      ptr += 4

      buf.write(entry.type, ptr, 4, 'ascii')
      ptr += 4

      if (entry.buf) {
        entry.buf.copy(buf, ptr)
        ptr += entry.buf.length
      }
    }

    exports.dref.encode.bytes = ptr
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)
    let ptr = 4

    for (let i = 0; i < num; i++) {
      const size = buf.readUInt32BE(ptr)
      const type = buf.toString('ascii', ptr + 4, ptr + 8)
      const tmp = buf.slice(ptr + 8, ptr + size)
      ptr += size

      entries[i] = {
        type,
        buf: tmp
      }
    }

    return {
      entries
    }
  },
  encodingLength (box) {
    let totalSize = 4
    if (!box.entries) return totalSize
    for (let i = 0; i < box.entries.length; i++) {
      const buf = box.entries[i].buf
      totalSize += (buf ? buf.length : 0) + 4 + 4
    }
    return totalSize
  }
}

exports.elst = {
  encode (box, buf, offset) {
    const entries = box.entries || []
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.elst.encodingLength(box))

    buf.writeUInt32BE(entries.length, 0)

    for (let i = 0; i < entries.length; i++) {
      const ptr = i * 12 + 4
      buf.writeUInt32BE(entries[i].trackDuration || 0, ptr)
      buf.writeUInt32BE(entries[i].mediaTime || 0, ptr + 4)
      writeFixed32(entries[i].mediaRate || 0, buf, ptr + 8)
    }

    exports.elst.encode.bytes = 4 + entries.length * 12
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    const num = buf.readUInt32BE(0)
    const entries = new Array(num)

    for (let i = 0; i < num; i++) {
      const ptr = i * 12 + 4
      entries[i] = {
        trackDuration: buf.readUInt32BE(ptr),
        mediaTime: buf.readInt32BE(ptr + 4),
        mediaRate: readFixed32(buf, ptr + 8)
      }
    }

    return {
      entries
    }
  },
  encodingLength: box => 4 + box.entries.length * 12
}

exports.hdlr = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(exports.hdlr.encodingLength(box))

    const len = 21 + (box.name || '').length
    buf.fill(0, 0, len)

    buf.write(box.handlerType || '', 4, 4, 'ascii')
    writeString(box.name || '', buf, 20)

    exports.hdlr.encode.bytes = len
    return buf
  },
  decode (buf, offset, end) {
    buf = buf.slice(offset)
    return {
      handlerType: buf.toString('ascii', 4, 8),
      name: readString(buf, 20, end)
    }
  },
  encodingLength: box => 21 + (box.name || '').length
}

exports.mehd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(4)

    buf.writeUInt32BE(box.fragmentDuration || 0, 0)
    exports.mehd.encode.bytes = 4
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      fragmentDuration: buf.readUInt32BE(0)
    }
  },
  encodingLength: box => 4
}

exports.trex = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(20)

    buf.writeUInt32BE(box.trackId || 0, 0)
    buf.writeUInt32BE(box.defaultSampleDescriptionIndex || 0, 4)
    buf.writeUInt32BE(box.defaultSampleDuration || 0, 8)
    buf.writeUInt32BE(box.defaultSampleSize || 0, 12)
    buf.writeUInt32BE(box.defaultSampleFlags || 0, 16)
    exports.trex.encode.bytes = 20
    return buf
  },
  decode (buf, offset) {
    buf = buf.slice(offset)
    return {
      trackId: buf.readUInt32BE(0),
      defaultSampleDescriptionIndex: buf.readUInt32BE(4),
      defaultSampleDuration: buf.readUInt32BE(8),
      defaultSampleSize: buf.readUInt32BE(12),
      defaultSampleFlags: buf.readUInt32BE(16)
    }
  },
  encodingLength: box => 20
}

exports.mfhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(4)

    buf.writeUInt32BE(box.sequenceNumber || 0, 0)
    exports.mfhd.encode.bytes = 4
    return buf
  },
  decode: (buf, offset) => ({
    sequenceNumber: buf.readUInt32BE(0)
  }),
  encodingLength: box => 4
}

exports.tfhd = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(4)
    buf.writeUInt32BE(box.trackId, 0)
    exports.tfhd.encode.bytes = 4
    return buf
  },
  decode (buf, offset) {
    // TODO: this
  },
  encodingLength: box => 4 // TODO: this is wrong!
}

exports.tfdt = {
  encode (box, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(4)

    buf.writeUInt32BE(box.baseMediaDecodeTime || 0, 0)
    exports.tfdt.encode.bytes = 4
    return buf
  },
  decode (buf, offset) {
  // TODO: this
  },
  encodingLength: box => 4
}

exports.trun = {
  encode ({ entries, dataOffset, version }, buf, offset) {
    buf = buf ? buf.slice(offset) : Buffer.alloc(8 + entries.length * 16)

    // TODO: this is wrong
    buf.writeUInt32BE(entries.length, 0)
    buf.writeInt32BE(dataOffset, 4)
    let ptr = 8
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      buf.writeUInt32BE(entry.sampleDuration, ptr)
      ptr += 4

      buf.writeUInt32BE(entry.sampleSize, ptr)
      ptr += 4

      buf.writeUInt32BE(entry.sampleFlags, ptr)
      ptr += 4

      if ((version || 0) === 0) {
        buf.writeUInt32BE(entry.sampleCompositionTimeOffset, ptr)
      } else {
        buf.writeInt32BE(entry.sampleCompositionTimeOffset, ptr)
      }
      ptr += 4
    }
    exports.trun.encode.bytes = ptr
  },
  // TODO: this
  decode (buf, offset) {},
  // TODO: this is wrong
  encodingLength: box => 8 + box.entries.length * 16
}

exports.mdat = {
  encode (box, buf, offset) {
    if (box.buffer) {
      box.buffer.copy(buf, offset)
      exports.mdat.encode.bytes = box.buffer.length
    } else {
      exports.mdat.encode.bytes = exports.mdat.encodingLength(box)
    }
  },
  decode: (buf, start, end) => ({
    buffer: Buffer.from(buf.slice(start, end))
  }),
  encodingLength: box => box.buffer ? box.buffer.length : box.contentLength
}

function writeReserved (buf, offset, end) {
  for (let i = offset; i < end; i++) buf[i] = 0
}

function writeDate (date, buf, offset) {
  buf.writeUInt32BE(Math.floor((date.getTime() + TIME_OFFSET) / 1000), offset)
}

function writeDate64 (date, buf, offset) {
  // Node only supports integer <= 48bit. Waiting for BigInt!
  buf.writeUIntBE(Math.floor((date.getTime() + TIME_OFFSET) / 1000), offset, 6)
}

// TODO: think something is wrong here
function writeFixed32 (num, buf, offset) {
  buf.writeUInt16BE(Math.floor(num) % (256 * 256), offset)
  buf.writeUInt16BE(Math.floor(num * 256 * 256) % (256 * 256), offset + 2)
}

function writeFixed16 (num, buf, offset) {
  buf[offset] = Math.floor(num) % 256
  buf[offset + 1] = Math.floor(num * 256) % 256
}

function writeMatrix (list, buf, offset) {
  if (!list) list = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < list.length; i++) {
    writeFixed32(list[i], buf, offset + i * 4)
  }
}

function writeString (str, buf, offset) {
  const strBuffer = Buffer.from(str, 'utf8')
  strBuffer.copy(buf, offset)
  buf[offset + strBuffer.length] = 0
}

function readMatrix (buf) {
  const list = new Array(buf.length / 4)
  for (let i = 0; i < list.length; i++) list[i] = readFixed32(buf, i * 4)
  return list
}

function readDate64 (buf, offset) {
  // Node only supports integer <= 48bit. Waiting for BigInt!
  return new Date(buf.readUIntBE(offset, 6) * 1000 - TIME_OFFSET)
}

function readDate (buf, offset) {
  return new Date(buf.readUInt32BE(offset) * 1000 - TIME_OFFSET)
}

function readFixed32 (buf, offset) {
  return buf.readUInt16BE(offset) + buf.readUInt16BE(offset + 2) / (256 * 256)
}

function readFixed16 (buf, offset) {
  return buf[offset] + buf[offset + 1] / 256
}

function readString (buf, offset, length) {
  let i
  for (i = 0; i < length; i++) {
    if (buf[offset + i] === 0) {
      break
    }
  }
  return buf.toString('utf8', offset, offset + i)
}
