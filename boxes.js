// This is an intentionally recursive require. I don't like it either.
var Box = require('./index')
var Descriptor = require('./descriptor')
var bufferAlloc = require('buffer-alloc')
var bufferFrom = require('buffer-from')
var uint64be = require('uint64be')

var TIME_OFFSET = 2082844800000

/*
TODO:
test these
add new box versions
*/

// These have 'version' and 'flags' fields in the headers
exports.fullBoxes = {}
var fullBoxes = [
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
fullBoxes.forEach(function (type) {
  exports.fullBoxes[type] = true
})

exports.ftyp = {}
exports.ftyp.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.ftyp.encodingLength(box))
  var brands = box.compatibleBrands || []
  buf.write(box.brand, 0, 4, 'ascii')
  buf.writeUInt32BE(box.brandVersion, 4)
  for (var i = 0; i < brands.length; i++) buf.write(brands[i], 8 + (i * 4), 4, 'ascii')
  exports.ftyp.encode.bytes = 8 + brands.length * 4
  return buf
}
exports.ftyp.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var brand = buf.toString('ascii', 0, 4)
  var version = buf.readUInt32BE(4)
  var compatibleBrands = []
  for (var i = 8; i < buf.length; i += 4) compatibleBrands.push(buf.toString('ascii', i, i + 4))
  return {
    brand: brand,
    brandVersion: version,
    compatibleBrands: compatibleBrands
  }
}
exports.ftyp.encodingLength = function (box) {
  return 8 + (box.compatibleBrands || []).length * 4
}

exports.mvhd = {}
exports.mvhd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(96)
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
}
exports.mvhd.decode = function (buf, offset) {
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
}
exports.mvhd.encodingLength = function (box) {
  return 96
}

exports.tkhd = {}
exports.tkhd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(80)
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
}
exports.tkhd.decode = function (buf, offset) {
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
}
exports.tkhd.encodingLength = function (box) {
  return 80
}

exports.mdhd = {}
exports.mdhd.encode = function (box, buf, offset) {
  if (box.version === 1) {
    buf = buf ? buf.slice(offset) : bufferAlloc(32)
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

  buf = buf ? buf.slice(offset) : bufferAlloc(20)
  writeDate(box.ctime || new Date(), buf, 0)
  writeDate(box.mtime || new Date(), buf, 4)
  buf.writeUInt32BE(box.timeScale || 0, 8)
  buf.writeUInt32BE(box.duration || 0, 12)
  buf.writeUInt16BE(box.language || 0, 16)
  buf.writeUInt16BE(box.quality || 0, 18)
  exports.mdhd.encode.bytes = 20
  return buf
}

exports.mdhd.decode = function (buf, offset, end) {
  buf = buf.slice(offset)

  var version1 = (end - offset) !== 20

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
}
exports.mdhd.encodingLength = function (box) {
  if (box.version === 1) return 32

  return 20
}

exports.vmhd = {}
exports.vmhd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(8)
  buf.writeUInt16BE(box.graphicsMode || 0, 0)
  var opcolor = box.opcolor || [0, 0, 0]
  buf.writeUInt16BE(opcolor[0], 2)
  buf.writeUInt16BE(opcolor[1], 4)
  buf.writeUInt16BE(opcolor[2], 6)
  exports.vmhd.encode.bytes = 8
  return buf
}
exports.vmhd.decode = function (buf, offset) {
  buf = buf.slice(offset)
  return {
    graphicsMode: buf.readUInt16BE(0),
    opcolor: [buf.readUInt16BE(2), buf.readUInt16BE(4), buf.readUInt16BE(6)]
  }
}
exports.vmhd.encodingLength = function (box) {
  return 8
}

exports.smhd = {}
exports.smhd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(4)
  buf.writeUInt16BE(box.balance || 0, 0)
  writeReserved(buf, 2, 4)
  exports.smhd.encode.bytes = 4
  return buf
}
exports.smhd.decode = function (buf, offset) {
  buf = buf.slice(offset)
  return {
    balance: buf.readUInt16BE(0)
  }
}
exports.smhd.encodingLength = function (box) {
  return 4
}

exports.stsd = {}
exports.stsd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.stsd.encodingLength(box))
  var entries = box.entries || []

  buf.writeUInt32BE(entries.length, 0)

  var ptr = 4
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i]
    Box.encode(entry, buf, ptr)
    ptr += Box.encode.bytes
  }

  exports.stsd.encode.bytes = ptr
  return buf
}
exports.stsd.decode = function (buf, offset, end) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)
  var ptr = 4

  for (var i = 0; i < num; i++) {
    var entry = Box.decode(buf, ptr, end)
    entries[i] = entry
    ptr += entry.length
  }

  return {
    entries: entries
  }
}
exports.stsd.encodingLength = function (box) {
  var totalSize = 4
  if (!box.entries) return totalSize
  for (var i = 0; i < box.entries.length; i++) {
    totalSize += Box.encodingLength(box.entries[i])
  }
  return totalSize
}

exports.avc1 = exports.VisualSampleEntry = {}
exports.VisualSampleEntry.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.VisualSampleEntry.encodingLength(box))

  writeReserved(buf, 0, 6)
  buf.writeUInt16BE(box.dataReferenceIndex || 0, 6)
  writeReserved(buf, 8, 24)
  buf.writeUInt16BE(box.width || 0, 24)
  buf.writeUInt16BE(box.height || 0, 26)
  buf.writeUInt32BE(box.hResolution || 0x480000, 28)
  buf.writeUInt32BE(box.vResolution || 0x480000, 32)
  writeReserved(buf, 36, 40)
  buf.writeUInt16BE(box.frameCount || 1, 40)
  var compressorName = box.compressorName || ''
  var nameLen = Math.min(compressorName.length, 31)
  buf.writeUInt8(nameLen, 42)
  buf.write(compressorName, 43, nameLen, 'utf8')
  buf.writeUInt16BE(box.depth || 0x18, 74)
  buf.writeInt16BE(-1, 76)

  var ptr = 78
  var children = box.children || []
  children.forEach(function (child) {
    Box.encode(child, buf, ptr)
    ptr += Box.encode.bytes
  })
  exports.VisualSampleEntry.encode.bytes = ptr
}
exports.VisualSampleEntry.decode = function (buf, offset, end) {
  buf = buf.slice(offset)
  var length = end - offset
  var nameLen = Math.min(buf.readUInt8(42), 31)
  var box = {
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

  var ptr = 78
  while (length - ptr >= 8) {
    var child = Box.decode(buf, ptr, length)
    box.children.push(child)
    box[child.type] = child
    ptr += child.length
  }

  return box
}
exports.VisualSampleEntry.encodingLength = function (box) {
  var len = 78
  var children = box.children || []
  children.forEach(function (child) {
    len += Box.encodingLength(child)
  })
  return len
}

exports.avcC = {}
exports.avcC.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(box.buffer.length)

  box.buffer.copy(buf)
  exports.avcC.encode.bytes = box.buffer.length
}
exports.avcC.decode = function (buf, offset, end) {
  buf = buf.slice(offset, end)

  return {
    mimeCodec: buf.toString('hex', 1, 4),
    buffer: bufferFrom(buf)
  }
}
exports.avcC.encodingLength = function (box) {
  return box.buffer.length
}

exports.mp4a = exports.AudioSampleEntry = {}
exports.AudioSampleEntry.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.AudioSampleEntry.encodingLength(box))

  writeReserved(buf, 0, 6)
  buf.writeUInt16BE(box.dataReferenceIndex || 0, 6)
  writeReserved(buf, 8, 16)
  buf.writeUInt16BE(box.channelCount || 2, 16)
  buf.writeUInt16BE(box.sampleSize || 16, 18)
  writeReserved(buf, 20, 24)
  buf.writeUInt32BE(box.sampleRate || 0, 24)

  var ptr = 28
  var children = box.children || []
  children.forEach(function (child) {
    Box.encode(child, buf, ptr)
    ptr += Box.encode.bytes
  })
  exports.AudioSampleEntry.encode.bytes = ptr
}
exports.AudioSampleEntry.decode = function (buf, offset, end) {
  buf = buf.slice(offset, end)
  var length = end - offset
  var box = {
    dataReferenceIndex: buf.readUInt16BE(6),
    channelCount: buf.readUInt16BE(16),
    sampleSize: buf.readUInt16BE(18),
    sampleRate: buf.readUInt32BE(24),
    children: []
  }

  var ptr = 28
  while (length - ptr >= 8) {
    var child = Box.decode(buf, ptr, length)
    box.children.push(child)
    box[child.type] = child
    ptr += child.length
  }

  return box
}
exports.AudioSampleEntry.encodingLength = function (box) {
  var len = 28
  var children = box.children || []
  children.forEach(function (child) {
    len += Box.encodingLength(child)
  })
  return len
}

exports.esds = {}
exports.esds.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(box.buffer.length)

  box.buffer.copy(buf, 0)
  exports.esds.encode.bytes = box.buffer.length
}
exports.esds.decode = function (buf, offset, end) {
  buf = buf.slice(offset, end)

  var desc = Descriptor.Descriptor.decode(buf, 0, buf.length)
  var esd = (desc.tagName === 'ESDescriptor') ? desc : {}
  var dcd = esd.DecoderConfigDescriptor || {}
  var oti = dcd.oti || 0
  var dsi = dcd.DecoderSpecificInfo
  var audioConfig = dsi ? (dsi.buffer.readUInt8(0) & 0xf8) >> 3 : 0

  var mimeCodec = null
  if (oti) {
    mimeCodec = oti.toString(16)
    if (audioConfig) {
      mimeCodec += '.' + audioConfig
    }
  }

  return {
    mimeCodec: mimeCodec,
    buffer: bufferFrom(buf.slice(0))
  }
}
exports.esds.encodingLength = function (box) {
  return box.buffer.length
}

// TODO: integrate the two versions in a saner way
exports.stsz = {}
exports.stsz.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.stsz.encodingLength(box))

  buf.writeUInt32BE(0, 0)
  buf.writeUInt32BE(entries.length, 4)

  for (var i = 0; i < entries.length; i++) {
    buf.writeUInt32BE(entries[i], i * 4 + 8)
  }

  exports.stsz.encode.bytes = 8 + entries.length * 4
  return buf
}
exports.stsz.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var size = buf.readUInt32BE(0)
  var num = buf.readUInt32BE(4)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    if (size === 0) {
      entries[i] = buf.readUInt32BE(i * 4 + 8)
    } else {
      entries[i] = size
    }
  }

  return {
    entries: entries
  }
}
exports.stsz.encodingLength = function (box) {
  return 8 + box.entries.length * 4
}

exports.stss =
exports.stco = {}
exports.stco.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.stco.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    buf.writeUInt32BE(entries[i], i * 4 + 4)
  }

  exports.stco.encode.bytes = 4 + entries.length * 4
  return buf
}
exports.stco.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    entries[i] = buf.readUInt32BE(i * 4 + 4)
  }

  return {
    entries: entries
  }
}
exports.stco.encodingLength = function (box) {
  return 4 + box.entries.length * 4
}

exports.co64 = {}
exports.co64.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.co64.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    uint64be.encode(entries[i], buf, i * 8 + 4)
  }

  exports.co64.encode.bytes = 4 + entries.length * 8
  return buf
}
exports.co64.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    entries[i] = uint64be.decode(buf, i * 8 + 4)
  }

  return {
    entries: entries
  }
}
exports.co64.encodingLength = function (box) {
  return 4 + box.entries.length * 8
}

exports.stts = {}
exports.stts.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.stts.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    var ptr = i * 8 + 4
    buf.writeUInt32BE(entries[i].count || 0, ptr)
    buf.writeUInt32BE(entries[i].duration || 0, ptr + 4)
  }

  exports.stts.encode.bytes = 4 + box.entries.length * 8
  return buf
}
exports.stts.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    var ptr = i * 8 + 4
    entries[i] = {
      count: buf.readUInt32BE(ptr),
      duration: buf.readUInt32BE(ptr + 4)
    }
  }

  return {
    entries: entries
  }
}
exports.stts.encodingLength = function (box) {
  return 4 + box.entries.length * 8
}

exports.ctts = {}
exports.ctts.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.ctts.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    var ptr = i * 8 + 4
    buf.writeUInt32BE(entries[i].count || 0, ptr)
    buf.writeUInt32BE(entries[i].compositionOffset || 0, ptr + 4)
  }

  exports.ctts.encode.bytes = 4 + entries.length * 8
  return buf
}
exports.ctts.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    var ptr = i * 8 + 4
    entries[i] = {
      count: buf.readUInt32BE(ptr),
      compositionOffset: buf.readInt32BE(ptr + 4)
    }
  }

  return {
    entries: entries
  }
}
exports.ctts.encodingLength = function (box) {
  return 4 + box.entries.length * 8
}

exports.stsc = {}
exports.stsc.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.stsc.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    var ptr = i * 12 + 4
    buf.writeUInt32BE(entries[i].firstChunk || 0, ptr)
    buf.writeUInt32BE(entries[i].samplesPerChunk || 0, ptr + 4)
    buf.writeUInt32BE(entries[i].sampleDescriptionId || 0, ptr + 8)
  }

  exports.stsc.encode.bytes = 4 + entries.length * 12
  return buf
}
exports.stsc.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    var ptr = i * 12 + 4
    entries[i] = {
      firstChunk: buf.readUInt32BE(ptr),
      samplesPerChunk: buf.readUInt32BE(ptr + 4),
      sampleDescriptionId: buf.readUInt32BE(ptr + 8)
    }
  }

  return {
    entries: entries
  }
}
exports.stsc.encodingLength = function (box) {
  return 4 + box.entries.length * 12
}

exports.dref = {}
exports.dref.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.dref.encodingLength(box))
  var entries = box.entries || []

  buf.writeUInt32BE(entries.length, 0)

  var ptr = 4
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i]
    var size = (entry.buf ? entry.buf.length : 0) + 4 + 4

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
}
exports.dref.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)
  var ptr = 4

  for (var i = 0; i < num; i++) {
    var size = buf.readUInt32BE(ptr)
    var type = buf.toString('ascii', ptr + 4, ptr + 8)
    var tmp = buf.slice(ptr + 8, ptr + size)
    ptr += size

    entries[i] = {
      type: type,
      buf: tmp
    }
  }

  return {
    entries: entries
  }
}
exports.dref.encodingLength = function (box) {
  var totalSize = 4
  if (!box.entries) return totalSize
  for (var i = 0; i < box.entries.length; i++) {
    var buf = box.entries[i].buf
    totalSize += (buf ? buf.length : 0) + 4 + 4
  }
  return totalSize
}

exports.elst = {}
exports.elst.encode = function (box, buf, offset) {
  var entries = box.entries || []
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.elst.encodingLength(box))

  buf.writeUInt32BE(entries.length, 0)

  for (var i = 0; i < entries.length; i++) {
    var ptr = i * 12 + 4
    buf.writeUInt32BE(entries[i].trackDuration || 0, ptr)
    buf.writeUInt32BE(entries[i].mediaTime || 0, ptr + 4)
    writeFixed32(entries[i].mediaRate || 0, buf, ptr + 8)
  }

  exports.elst.encode.bytes = 4 + entries.length * 12
  return buf
}
exports.elst.decode = function (buf, offset) {
  buf = buf.slice(offset)
  var num = buf.readUInt32BE(0)
  var entries = new Array(num)

  for (var i = 0; i < num; i++) {
    var ptr = i * 12 + 4
    entries[i] = {
      trackDuration: buf.readUInt32BE(ptr),
      mediaTime: buf.readInt32BE(ptr + 4),
      mediaRate: readFixed32(buf, ptr + 8)
    }
  }

  return {
    entries: entries
  }
}
exports.elst.encodingLength = function (box) {
  return 4 + box.entries.length * 12
}

exports.hdlr = {}
exports.hdlr.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(exports.hdlr.encodingLength(box))

  var len = 21 + (box.name || '').length
  buf.fill(0, 0, len)

  buf.write(box.handlerType || '', 4, 4, 'ascii')
  writeString(box.name || '', buf, 20)

  exports.hdlr.encode.bytes = len
  return buf
}
exports.hdlr.decode = function (buf, offset, end) {
  buf = buf.slice(offset)
  return {
    handlerType: buf.toString('ascii', 4, 8),
    name: readString(buf, 20, end)
  }
}
exports.hdlr.encodingLength = function (box) {
  return 21 + (box.name || '').length
}

exports.mehd = {}
exports.mehd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(4)

  buf.writeUInt32BE(box.fragmentDuration || 0, 0)
  exports.mehd.encode.bytes = 4
  return buf
}
exports.mehd.decode = function (buf, offset) {
  buf = buf.slice(offset)
  return {
    fragmentDuration: buf.readUInt32BE(0)
  }
}
exports.mehd.encodingLength = function (box) {
  return 4
}

exports.trex = {}
exports.trex.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(20)

  buf.writeUInt32BE(box.trackId || 0, 0)
  buf.writeUInt32BE(box.defaultSampleDescriptionIndex || 0, 4)
  buf.writeUInt32BE(box.defaultSampleDuration || 0, 8)
  buf.writeUInt32BE(box.defaultSampleSize || 0, 12)
  buf.writeUInt32BE(box.defaultSampleFlags || 0, 16)
  exports.trex.encode.bytes = 20
  return buf
}
exports.trex.decode = function (buf, offset) {
  buf = buf.slice(offset)
  return {
    trackId: buf.readUInt32BE(0),
    defaultSampleDescriptionIndex: buf.readUInt32BE(4),
    defaultSampleDuration: buf.readUInt32BE(8),
    defaultSampleSize: buf.readUInt32BE(12),
    defaultSampleFlags: buf.readUInt32BE(16)
  }
}
exports.trex.encodingLength = function (box) {
  return 20
}

exports.mfhd = {}
exports.mfhd.encode = function (box, buf, offset) {
  buf = buf ? buf.slice(offset) : bufferAlloc(4)

  buf.writeUInt32BE(box.sequenceNumber || 0, 0)
  exports.mfhd.encode.bytes = 4
  return buf
}
exports.mfhd.decode = function (buf, start, _end, _headers) {
  return {
    sequenceNumber: buf.readUInt32BE(start)
  }
}
exports.mfhd.encodingLength = function (box) {
  return 4
}

var TFHD_FLAGS_BASE_DATA_OFFSET_PRESENT         = 0x00001
var TFHD_FLAGS_SAMPLE_DESCRIPTION_INDEX_PRESENT = 0x00002
var TFHD_FLAGS_DEFAULT_SAMPLE_DURATION_PRESENT  = 0x00008
var TFHD_FLAGS_DEFAULT_SAMPLE_SIZE_PRESENT      = 0x00010
var TFHD_FLAGS_DEFAULT_SAMPLE_FLAGS_PRESENT     = 0x00020

exports.tfhd = {}
exports.tfhd.encode = function (box, buf, offset) {

  var size = exports.tfhd.encodingLength(box)
  buf = buf ? buf.slice(offset) : bufferAlloc(size)
  var flags = box.flags

  var ptr = 0
  buf.writeUInt32BE(box.trackId, ptr)
  ptr += 4

  if (flags & TFHD_FLAGS_BASE_DATA_OFFSET_PRESENT) {
    uint64be.encode(box.baseDataOffsetPresent, buf, ptr)
    ptr += 8
  }
  if (flags & TFHD_FLAGS_SAMPLE_DESCRIPTION_INDEX_PRESENT) {
    buf.writeUInt32BE(box.defaultSampleDescriptionIndex, ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_DURATION_PRESENT) {
    buf.writeUInt32BE(box.defaultSampleDuration, ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_SIZE_PRESENT) {
    buf.writeInt32BE(box.defaultSampleSize, ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_FLAGS_PRESENT) {
    buf.writeUInt32BE(box.defaultSampleFlags, ptr)
    ptr += 4
  }

  exports.tfhd.encode.bytes = size
  return buf
}
exports.tfhd.decode = function (buf, start, _end, headers) {

  var flags = headers.flags
  var ptr = start
  var result = {}

  result.trackId = buf.readUInt32BE(ptr)
  ptr += 4

  if (flags & TFHD_FLAGS_BASE_DATA_OFFSET_PRESENT) {
    result.baseDataOffsetPresent = uint64be.decode(buf, ptr)
    ptr += 8
  }
  if (flags & TFHD_FLAGS_SAMPLE_DESCRIPTION_INDEX_PRESENT) {
    result.defaultSampleDescriptionIndex = buf.readUInt32BE(ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_DURATION_PRESENT) {
    result.defaultSampleDuration = buf.readUInt32BE(ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_SIZE_PRESENT) {
    result.defaultSampleSize = buf.readUInt32BE(ptr)
    ptr += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_FLAGS_PRESENT) {
    result.defaultSampleFlags = buf.readUInt32BE(ptr)
    ptr += 4
  }
  return result
}

exports.tfhd.encodingLength = function (box) {
  var flags = box.flags
  var size = 4

  if (flags & TFHD_FLAGS_BASE_DATA_OFFSET_PRESENT) {
    size += 8
  }
  if (flags & TFHD_FLAGS_SAMPLE_DESCRIPTION_INDEX_PRESENT) {
    size += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_DURATION_PRESENT) {
    size += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_SIZE_PRESENT) {
    size += 4
  }
  if (flags & TFHD_FLAGS_DEFAULT_SAMPLE_FLAGS_PRESENT) {
    size += 4
  }
  return size
}

exports.tfdt = {}
exports.tfdt.encode = function (box, buf, offset) {
  var version = box.version || 0

  if (buf) {
    buf = buf.slice(offset)
  } else {
    buf = version === 0 ? bufferAlloc(4) : bufferAlloc(8)
  }

  if (version === 0) {
    exports.tfdt.encode.bytes = 4
    buf.writeUInt32BE(box.baseMediaDecodeTime || 0, 0)
  } else {
    exports.tfdt.encode.bytes = 8
    uint64be.encode(box.baseMediaDecodeTime, buf, 0)
  }
  return buf
}
exports.tfdt.decode = function (buf, start, _end, headers) {
  var result = {};
  if ((headers.version || 0) === 0) {
    result.baseMediaDecodeTime = buf.readUInt32BE(start)
  } else {
    result.baseMediaDecodeTime = uint64be.decode(buf, start)
  }
  return result;
}
exports.tfdt.encodingLength = function (box) {
  if ((box.version || 0) === 0) {
    return 4
  } else {
    return 8
  }
}


var TRUN_FLAGS_DATA_OFFSET_PRESENT                     = 0x00001
var TRUN_FLAGS_FIRST_SAMPLE_FLAGS_PRESENT              = 0x00004
var TRUN_FLAGS_SAMPLE_DURATION_PRESENT                 = 0x00100
var TRUN_FLAGS_SAMPLE_SIZE_PRESENT                     = 0x00200
var TRUN_FLAGS_SAMPLE_FLAGS_PRESENT                    = 0x00400
var TRUN_FLAGS_SAMPLE_COMPOSITION_TIME_OFFSETS_PRESENT = 0x00800

exports.trun = {}
exports.trun.encode = function (box, buf, offset) {
  var size = exports.trun.encodingLength(box)
  buf = buf ? buf.slice(offset) : bufferAlloc(size)
  var ptr = 0
  var flags = box.flags

  buf.writeUInt32BE(box.entries.length, ptr)
  ptr += 4

  if (flags & TRUN_FLAGS_DATA_OFFSET_PRESENT) {
    buf.writeInt32BE(box.dataOffset, ptr)
    ptr += 4
  }

  if (flags & TRUN_FLAGS_FIRST_SAMPLE_FLAGS_PRESENT) {
    buf.writeUInt32BE(box.firstSampleFlags, ptr)
    ptr += 4
  }

  for (var idx = 0; idx < box.entries.length; idx++) {
    var entry = box.entries[idx]

    if (flags & TRUN_FLAGS_SAMPLE_DURATION_PRESENT) {
      buf.writeUInt32BE(entry.sampleDuration, ptr)
      ptr += 4  
    }

    if (flags & TRUN_FLAGS_SAMPLE_SIZE_PRESENT) {
      buf.writeUInt32BE(entry.sampleSize, ptr)
      ptr += 4
    }

    if (flags & TRUN_FLAGS_SAMPLE_FLAGS_PRESENT) {
      buf.writeUInt32BE(entry.sampleFlags, ptr)
      ptr += 4
    }

    if (flags & TRUN_FLAGS_SAMPLE_COMPOSITION_TIME_OFFSETS_PRESENT) {
      if ((box.version || 0) === 0) {
        buf.writeUInt32BE(entry.sampleCompositionTimeOffset, ptr)
      } else {
        buf.writeInt32BE(entry.sampleCompositionTimeOffset, ptr)
      }
      ptr += 4  
    }
  }
  exports.trun.encode.bytes = size
}
exports.trun.decode = function (buf, start, _end, headers) {
  var flags = headers.flags
  var ptr = start

  var result = { entries: [] }

  var entriesLength = buf.readUInt32BE(ptr)
  ptr += 4
  if (flags & TRUN_FLAGS_DATA_OFFSET_PRESENT) {
    result.dataOffset = buf.readInt32BE(ptr)
    ptr += 4
  }

  if (flags & TRUN_FLAGS_FIRST_SAMPLE_FLAGS_PRESENT) {
    result.firstSampleFlags = buf.readUInt32BE(ptr)
    ptr += 4
  }

  for (var idx = 0; idx < entriesLength; idx++) {
    var entry = {}
    if (flags & TRUN_FLAGS_SAMPLE_DURATION_PRESENT) {
      entry.sampleDuration = buf.readUInt32BE(ptr)
      ptr += 4  
    }

    if (flags & TRUN_FLAGS_SAMPLE_SIZE_PRESENT) {
      entry.sampleSize = buf.readUInt32BE(ptr)
      ptr += 4
    }

    if (flags & TRUN_FLAGS_SAMPLE_FLAGS_PRESENT) {
      entry.sampleFlags = buf.readUInt32BE(ptr)
      ptr += 4
    }

    if (flags & TRUN_FLAGS_SAMPLE_COMPOSITION_TIME_OFFSETS_PRESENT) {
      if ((headers.version || 0) === 0) {
        entry.sampleCompositionTimeOffset = buf.readUInt32BE(ptr)
      } else {
        entry.sampleCompositionTimeOffset = buf.writeInt32BE(ptr)
      }
      ptr += 4  
    }

    result.entries.push(entry)
  }

  return result
}
exports.trun.encodingLength = function (box) {
  var flags = box.flags

  var size = 4 // 4 bytes for sample count (mandatory first field)
  if (flags & TRUN_FLAGS_DATA_OFFSET_PRESENT) {
    size += 4
  }
  if (flags & TRUN_FLAGS_FIRST_SAMPLE_FLAGS_PRESENT) {
    size += 4
  }

  var entrySize = 0;
  if (flags & TRUN_FLAGS_SAMPLE_DURATION_PRESENT) {
    entrySize += 4
  }
  if (flags & TRUN_FLAGS_SAMPLE_SIZE_PRESENT) {
    entrySize += 4
  }
  if (flags & TRUN_FLAGS_SAMPLE_FLAGS_PRESENT) {
    entrySize += 4
  }
  if (flags & TRUN_FLAGS_SAMPLE_COMPOSITION_TIME_OFFSETS_PRESENT) {
    entrySize += 4
  }


  size += entrySize * box.entries.length
  return size
}

exports.mdat = {}
exports.mdat.encode = function (box, buf, offset) {
  if (box.buffer) {
    box.buffer.copy(buf, offset)
    exports.mdat.encode.bytes = box.buffer.length
  } else {
    exports.mdat.encode.bytes = exports.mdat.encodingLength(box)
  }
}
exports.mdat.decode = function (buf, start, end) {
  return {
    buffer: bufferFrom(buf.slice(start, end))
  }
}
exports.mdat.encodingLength = function (box) {
  return box.buffer ? box.buffer.length : box.contentLength
}

function writeReserved (buf, offset, end) {
  for (var i = offset; i < end; i++) buf[i] = 0
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
  for (var i = 0; i < list.length; i++) {
    writeFixed32(list[i], buf, offset + i * 4)
  }
}

function writeString (str, buf, offset) {
  var strBuffer = bufferFrom(str, 'utf8')
  strBuffer.copy(buf, offset)
  buf[offset + strBuffer.length] = 0
}

function readMatrix (buf) {
  var list = new Array(buf.length / 4)
  for (var i = 0; i < list.length; i++) list[i] = readFixed32(buf, i * 4)
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
  var i
  for (i = 0; i < length; i++) {
    if (buf[offset + i] === 0) {
      break
    }
  }
  return buf.toString('utf8', offset, offset + i)
}
