// var assert = require('assert')
const uint64be = require('uint64be')

const boxes = require('./boxes.js')

const UINT32_MAX = 4294967295

const Box = exports

/*
 * Lists the proper order for boxes inside containers.
 * Five-character names ending in 's' indicate arrays instead of single elements.
 */
const containers = exports.containers = {
  moov: ['mvhd', 'meta', 'traks', 'mvex'],
  trak: ['tkhd', 'tref', 'trgr', 'edts', 'meta', 'mdia', 'udta'],
  edts: ['elst'],
  mdia: ['mdhd', 'hdlr', 'elng', 'minf'],
  minf: ['vmhd', 'smhd', 'hmhd', 'sthd', 'nmhd', 'dinf', 'stbl'],
  dinf: ['dref'],
  stbl: ['stsd', 'stts', 'ctts', 'cslg', 'stsc', 'stsz', 'stz2', 'stco', 'co64', 'stss', 'stsh', 'padb', 'stdp', 'sdtp', 'sbgps', 'sgpds', 'subss', 'saizs', 'saios'],
  mvex: ['mehd', 'trexs', 'leva'],
  moof: ['mfhd', 'meta', 'trafs'],
  traf: ['tfhd', 'tfdt', 'trun', 'sbgps', 'sgpds', 'subss', 'saizs', 'saios', 'meta']
}

Box.encode = (obj, buffer, offset) => {
  Box.encodingLength(obj) // sets every level appropriately
  offset = offset || 0
  buffer = buffer || Buffer.alloc(obj.length)
  return Box._encode(obj, buffer, offset)
}

Box._encode = (obj, buffer, offset) => {
  const type = obj.type
  let len = obj.length
  if (len > UINT32_MAX) {
    len = 1
  }
  buffer.writeUInt32BE(len, offset)
  buffer.write(obj.type, offset + 4, 4, 'ascii')
  let ptr = offset + 8
  if (len === 1) {
    uint64be.encode(obj.length, buffer, ptr)
    ptr += 8
  }
  if (boxes.fullBoxes[type]) {
    buffer.writeUInt32BE(obj.flags || 0, ptr)
    buffer.writeUInt8(obj.version || 0, ptr)
    ptr += 4
  }

  if (containers[type]) {
    const contents = containers[type]
    contents.forEach(childType => {
      if (childType.length === 5) {
        const entry = obj[childType] || []
        childType = childType.substr(0, 4)
        entry.forEach(child => {
          Box._encode(child, buffer, ptr)
          ptr += Box.encode.bytes
        })
      } else if (obj[childType]) {
        Box._encode(obj[childType], buffer, ptr)
        ptr += Box.encode.bytes
      }
    })
    if (obj.otherBoxes) {
      obj.otherBoxes.forEach(child => {
        Box._encode(child, buffer, ptr)
        ptr += Box.encode.bytes
      })
    }
  } else if (boxes[type]) {
    const encode = boxes[type].encode
    encode(obj, buffer, ptr)
    ptr += encode.bytes
  } else if (obj.buffer) {
    obj.buffer.copy(buffer, ptr)
    ptr += obj.buffer.length
  } else {
    throw new Error(`Either "type" must be set to a known type (not"${type}") or "buffer" must be set`)
  }

  Box.encode.bytes = ptr - offset
  // assert.equal(ptr - offset, obj.length, 'Error encoding \'' + type + '\': wrote ' + ptr - offset + ' bytes, expecting ' + obj.length)
  return buffer
}

/*
 * Returns an object with `type` and `size` fields,
 * or if there isn't enough data, returns the total
 * number of bytes needed to read the headers
 */
Box.readHeaders = (buffer, start = 0, end = buffer.length) => {
  if (end - start < 8) {
    return 8
  }

  let length = buffer.readUInt32BE(start)
  const type = buffer.toString('ascii', start + 4, start + 8)
  let ptr = start + 8

  if (length === 1) {
    if (end - start < 16) {
      return 16
    }

    length = uint64be.decode(buffer, ptr)
    ptr += 8
  }

  let version
  let flags
  if (boxes.fullBoxes[type]) {
    version = buffer.readUInt8(ptr)
    flags = buffer.readUInt32BE(ptr) & 0xffffff
    ptr += 4
  }

  return {
    length,
    headersLen: ptr - start,
    contentLen: length - (ptr - start),
    type,
    version,
    flags
  }
}

Box.decode = (buffer, start = 0, end = buffer.length) => {
  const headers = Box.readHeaders(buffer, start, end)
  if (!headers || headers.length > end - start) {
    throw new Error('Data too short')
  }

  return Box.decodeWithoutHeaders(headers, buffer, start + headers.headersLen, start + headers.length)
}

Box.decodeWithoutHeaders = (headers, buffer, start = 0, end = buffer.length) => {
  const type = headers.type
  let obj = {}
  if (containers[type]) {
    obj.otherBoxes = []
    const contents = containers[type]
    let ptr = start
    while (end - ptr >= 8) {
      const child = Box.decode(buffer, ptr, end)
      ptr += child.length
      if (contents.includes(child.type)) {
        obj[child.type] = child
      } else if (contents.includes(child.type + 's')) {
        const childType = child.type + 's'
        const entry = obj[childType] = obj[childType] || []
        entry.push(child)
      } else {
        obj.otherBoxes.push(child)
      }
    }
  } else if (boxes[type]) {
    const decode = boxes[type].decode
    obj = decode(buffer, start, end)
  } else {
    obj.buffer = Buffer.from(buffer.slice(start, end))
  }
  obj.length = headers.length
  obj.contentLen = headers.contentLen
  obj.type = headers.type
  obj.version = headers.version
  obj.flags = headers.flags
  return obj
}

Box.encodingLength = obj => {
  const type = obj.type

  let len = 8
  if (boxes.fullBoxes[type]) {
    len += 4
  }

  if (containers[type]) {
    const contents = containers[type]
    contents.forEach(childType => {
      if (childType.length === 5) {
        const entry = obj[childType] || []
        childType = childType.substr(0, 4)
        entry.forEach(child => {
          child.type = childType
          len += Box.encodingLength(child)
        })
      } else if (obj[childType]) {
        const child = obj[childType]
        child.type = childType
        len += Box.encodingLength(child)
      }
    })
    if (obj.otherBoxes) {
      obj.otherBoxes.forEach(child => {
        len += Box.encodingLength(child)
      })
    }
  } else if (boxes[type]) {
    len += boxes[type].encodingLength(obj)
  } else if (obj.buffer) {
    len += obj.buffer.length
  } else {
    throw new Error(`Either "type" must be set to a known type (not"${type}") or "buffer" must be set`)
  }

  if (len > UINT32_MAX) {
    len += 8
  }

  obj.length = len
  return len
}
