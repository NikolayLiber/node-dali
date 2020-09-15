'use strict';

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

const RESPONSE_TYPE = 1;
const RESPONSE_SERIAL = 2;
const RESPONSE_STATUS = 3;
const RESPONSE_SIZE = 4;
const RESPONSE_FRAME = 5;

const HID = require('node-hid');
const common = require('../../common');
const exceptions = require('./exceptions');

let device;
let frameSerial = 0;
let lastFrameTime = 0;
const receiveQueue = {};

const receiveFrame = data => {
    if (data[RESPONSE_TYPE] == HASSEB_DRIVER_NO_DATA_AVAILABLE)
        return;

    // console.log("Read:", data);
    lastFrameTime = Date.now();

    if (data[RESPONSE_TYPE] == HASSEB_DALI_FRAME) {
        const caller = receiveQueue[data[RESPONSE_SERIAL]];
        if (caller == undefined)
            return;

        delete receiveQueue[data[RESPONSE_SERIAL]];

        switch(data[RESPONSE_STATUS]) {
            case HASSEB_DRIVER_NO_ANSWER:
                return caller.resolve();

            case HASSEB_DRIVER_INVALID_ANSWER:
                return caller.resolve(0xFF);

            case HASSEB_DRIVER_TOO_EARLY:
                return caller.reject(new exceptions.AnswerTooEarly());

            case HASSEB_DRIVER_OK:
                if (data[RESPONSE_SIZE] == 1)
                    return caller.resolve(data[RESPONSE_FRAME]);
        }

        return caller.resolve(new exceptions.InvaldFrame(data));
    }
}

const getFrameSerial = () => {
    if (frameSerial > 255)
        frameSerial = 0

    return frameSerial++;
}

const waitSettlingTime = async () => {
    const settling = Date.now() - lastFrameTime;

    if (settling < 20)
        await common.sleep(20 - settling);
}

const constructBasicFrame = (frameType, serial) => {
    return [0xAA, frameType, serial];
}

const constructHassebFrame = (frame, serial, sendTwice = false, expectReply = false) => {
    return Buffer.from(constructBasicFrame(HASSEB_DALI_FRAME, serial).concat([16, expectReply && 1 || 0, 0, sendTwice && 10 || 0, frame[0], frame[1], frame.length == 3 ? frame[2] : 0]));
}

const open = async () => {
    device = new HID.HID(HASSEB_USB_VENDOR, HASSEB_USB_PRODUCT);
    device.on('data', receiveFrame);
}

const sendFrame = async (frame, sendTwice = false, expectReply = false) => {
    const serial = getFrameSerial();
    const hassebFrame = constructHassebFrame(frame, serial, sendTwice, expectReply);

    await waitSettlingTime();

    // console.log("Writing:", hassebFrame);
    device.write(hassebFrame);
    lastFrameTime = Date.now();

    if (!expectReply)
        return;

    const reply = await new Promise((resolve, reject) => {
        receiveQueue[serial] = { resolve, reject };
    });

    return reply;
}

const close = async () => {
    device.close();
}


module.exports = {
    open,
    sendFrame,
    close
}
