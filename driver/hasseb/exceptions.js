'use strict';

function AnswerTooEarly() {
    Error.call(this);
    this.name = "AnswerTooEarly";
    this.message = "Hasseb driver: Answer too early";

    Error.captureStackTrace(this, AnswerTooEarly);
}

AnswerTooEarly.prototype = Object.create(Error.prototype);


function InvalidFrame(frame) {
    Error.call(this);
    this.name = "InvalidFrame";
    this.message = "Hasseb driver: Invalid frame";
    this.frame = frame;

    Error.captureStackTrace(this, InvalidFrame);
}

InvalidFrame.prototype = Object.create(Error.prototype);
