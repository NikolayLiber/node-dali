'use strict'

const HASSEB_USB_VENDOR = 0x04cc;
const HASSEB_USB_PRODUCT = 0x0802;

const HASSEB_READ_FIRMWARE_VERSION    = 0x02;
const HASSEB_CONFIGURE_DEVICE         = 0x05;
const HASSEB_DALI_FRAME               = 0X07;

const HASSEB_DRIVER_NO_DATA_AVAILABLE = 0;
const HASSEB_DRIVER_NO_ANSWER = 1;
const HASSEB_DRIVER_OK = 2;
const HASSEB_DRIVER_INVALID_ANSWER = 3;
const HASSEB_DRIVER_TOO_EARLY = 4;
const HASSEB_DRIVER_SNIFFER_BYTE = 5;
const HASSEB_DRIVER_SNIFFER_BYTE_ERROR = 6;

let frameSerial = 1;

const device = require('./driver/hasseb');
const common = require('./common');

const directAddress = (address, group = false) => {
    address <<= 1;

    if (group) {
        address &= 0x1E;
        address |= 0x80;
    }
    else
        address &= 0x7E

    return address;
}

const commandAddress = (address, group = false) => {
    address <<= 1;

    if (group) {
        address &= 0x1F;
        address |= 0x81;
    }
    else {
        address &= 0x7F;
        address |= 1;
    }

    return address;
}

const setSearchAddressHH = async (address) => {
    await device.sendFrame([0xB1, address >> 16 & 0xFF]);
}

const setSearchAddressMM = async (address) => {
    await device.sendFrame([0xB3, address >> 8 & 0xFF]);
}

const setSearchAddressLL = async (address) => {
    await device.sendFrame([0xB5, address & 0xFF]);
}

const standardCommand = async (address, command, sendTwice = false, expectReply = false) => {
    return await device.sendFrame([commandAddress(address), command], sendTwice, expectReply);
}

const storeValueInDTR = async (value) => {
    await device.sendFrame([0xA3, value]);
}

const storeDTRAsShortAddress = async (address) => {
    await standardCommand(address, 0x80, true);
}

const decodeGroups = (value, start = 0) => {
    const groups = [];
    for (let i = 0; i < 8; i++) {
        if (value & 1)
            groups.push(i + start);

        value >>= 1;
    }

    return groups;
}

const queryGroupsZeroToSeven = async (address) => {
    return await standardCommand(address, 0xC0, false, true);
}

const queryGroupsEightToFifteen = async (address) => {
    return await standardCommand(address, 0xC1, false, true);
}


module.exports = {
    addToGroup: async (address, group) => {
        await standardCommand(address, 0x60 + group, true);
    },

    changeShortAddres: async (oldAddress, newAddress = null) => {
        const value = newAddress == null ? 0xFF : commandAddress(newAddress);
        await storeValueInDTR(value);
        await storeDTRAsShortAddress(oldAddress);
    },

    close: async () => {
        await device.close();
    },

    compare: async () => {
        const reply = await device.sendFrame([0xA9, 0], false, true);
        return reply == 0xFF;
    },

    directArcPower: async (address, value, group = false) => {
        await device.sendFrame([directAddress(address, group), value]);
    },

    initialize: async (broadcast = true, address = null) => {
        let param;

        if (broadcast)
            // All ballasts
            param = 0;
        else
            if (address == null)
                // Only ballasts without short addresses
                param = 0xFF;
            else
                // Balast with exact short addrss
                param = commandAddress(address)

        await device.sendFrame([0xA5, param], true)
    },

    open: async () => {
        await device.open();
    },

    programShortAddress: async (address) => {
        await device.sendFrame([0xB7, commandAddress(address)]);
    },

    queryControlGearPresent: async (address) => {
        return await standardCommand(address, 0x91, false, true) == 0xFF;
    },

    queryGroups: async (address) => {
        let groups;
        let reply = await queryGroupsZeroToSeven(address);

        if (reply == undefined)
            return;

        groups = decodeGroups(reply);

        reply = await queryGroupsEightToFifteen(address);

        if (reply == undefined)
            return;

        return groups.concat(decodeGroups(reply, 8));
    },

    queryShortAddress: async () => {
        return await device.sendFrame([0xBB, 0], false, true);
    },

    queryVersion: async (address) => {
        return await standardCommand(address, 0x97, false, true);
    },

    randomize: async () => {
        await device.sendFrame([0xA7, 0], true);
    },

    removeFromGroup: async (address, group) => {
        await standardCommand(address, 0x70 + group, true);
    },

    sendFrame: async (frame, sendTwice = false, expectReply = false) => {
        return await device.sendFrame(frame, sendTwice, expectReply);
    },

    setSearchAddress: async (address) => {
        await setSearchAddressHH(address);
        await setSearchAddressMM(address);
        await setSearchAddressLL(address);
    },

    storeDTRAsShortAddress,
    storeValueInDTR,

    terminate: async () => {
        await device.sendFrame([0xA1, 0]);
    },

    verifyShortAddress: async (address) => {
        const reply = await device.sendFrame([0xB9, commandAddress(address)], false, true);
        return reply == 0xFF;
    },

    withdraw: async () => {
        await device.sendFrame([0xAB, 0]);
    }
}