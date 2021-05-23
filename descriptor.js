const tagToName = {
  0x03: 'ESDescriptor',
  0x04: 'DecoderConfigDescriptor',
  0x05: 'DecoderSpecificInfo',
  0x06: 'SLConfigDescriptor'
}

exports.Descriptor = {
  decode (buf, start, end) {
    const tag = buf.readUInt8(start)
    let ptr = start + 1
    let lenByte
    let len = 0
    do {
      lenByte = buf.readUInt8(ptr++)
      len = (len << 7) | (lenByte & 0x7f)
    } while (lenByte & 0x80)

    let obj
    const tagName = tagToName[tag] // May be undefined; that's ok
    if (exports[tagName]) {
      obj = exports[tagName].decode(buf, ptr, end)
    } else {
      obj = {
        buffer: Buffer.from(buf.slice(ptr, ptr + len))
      }
    }

    obj.tag = tag
    obj.tagName = tagName
    obj.length = (ptr - start) + len
    obj.contentsLen = len
    return obj
  }
}

exports.DescriptorArray = {
  decode (buf, start, end) {
    let ptr = start
    const obj = {}
    while (ptr + 2 <= end) {
      const descriptor = exports.Descriptor.decode(buf, ptr, end)
      ptr += descriptor.length
      const tagName = tagToName[descriptor.tag] || (`Descriptor${descriptor.tag}`)
      obj[tagName] = descriptor
    }
    return obj
  }
}

exports.ESDescriptor = {
  decode (buf, start, end) {
    const flags = buf.readUInt8(start + 2)
    let ptr = start + 3
    if (flags & 0x80) {
      ptr += 2
    }
    if (flags & 0x40) {
      const len = buf.readUInt8(ptr)
      ptr += len + 1
    }
    if (flags & 0x20) {
      ptr += 2
    }
    return exports.DescriptorArray.decode(buf, ptr, end)
  }
}

exports.DecoderConfigDescriptor = {
  decode (buf, start, end) {
    const oti = buf.readUInt8(start)
    const obj = exports.DescriptorArray.decode(buf, start + 13, end)
    obj.oti = oti
    return obj
  }
}
