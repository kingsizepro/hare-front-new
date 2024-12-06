//MEMHASH MEGA TURBO MODE WORKER V1.0

//--------------------------------------------------------------------------------------------------------
//PARAMETERS
let taskData = null;
let isProcessing = false;
let nonceRanges = [];
let startNonce = 0;
let endNonce = 0;
let taskDataUpdated = false;
let megaTurboMode = self;
let superSonic = true;
//--------------------------------------------------------------------------------------------------------
// Thermal management state
let hashesProcessed = 0;
let lastMeasurement = Date.now();
let baselineHashRate = null;
let needsCooldown = false;
let isTurboMode = false;
const MEASURE_INTERVAL = 2000; // Check every 2 seconds
const COOLDOWN_TIME = 1000;    // 1 second cooldown when needed
const HASH_THRESHOLD = 0.9;    // Throttle at 70% performance drop
//--------------------------------------------------------------------------------------------------------

//MEMHASH MAIN CODE
self.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.startNonce !== undefined && data.endNonce !== undefined) {
        startNonce = data.startNonce;
        endNonce = data.endNonce;
        superSonic = 1;
        if (!isProcessing) {
            isProcessing = true;
            superSonic ? processNonceRangesTurbo() : processNonceRanges();
        } else {
            nonceRanges.push({
                startNonce,
                endNonce
            });
        }
    } else {

        if (taskData !== null) {
            taskDataUpdated = true;
            taskData = data;
        } else {
            taskData = data;
        }
    }
}
    ;
//--------------------------------------------------------------------------------------------------------
async function processNonceRanges() {
    while (true) {

        if (taskDataUpdated) {
            nonceRanges = [];
            startNonce = 0;
            endNonce = 0;
            taskDataUpdated = false;

            postMessage('requestRange');
            await new Promise((resolve) => {
                const handler = function (event) {
                    const data = JSON.parse(event.data);
                    if (data.startNonce !== undefined && data.endNonce !== undefined) {
                        startNonce = data.startNonce;
                        endNonce = data.endNonce;
                        superSonic = true;
                        self.removeEventListener('message', handler);
                        resolve();
                    }
                };
                self.addEventListener('message', handler);
            }
            );
            continue;
        }
        
        let result = await processNonceRange(taskData, startNonce, endNonce);
        if (result) {
            postMessage(JSON.stringify(result));
            break;
        } else {
            if (nonceRanges.length > 0) {
                const nextRange = nonceRanges.shift();
                startNonce = nextRange.startNonce;
                endNonce = nextRange.endNonce;
            } else {
                postMessage('requestRange');
                await new Promise((resolve) => {
                    const handler = function (event) {
                        const data = JSON.parse(event.data);
                        if (data.startNonce !== undefined && data.endNonce !== undefined) {
                            startNonce = data.startNonce;
                            endNonce = data.endNonce;
                            self.removeEventListener('message', handler);
                            resolve();
                        }
                    };
                    self.addEventListener('message', handler);
                }
                );
            }
        }
    }
}
//--------------------------------------------------------------------------------------------------------
async function processNonceRangesTurbo() {
    while (true) {

        if (taskDataUpdated) {
            nonceRanges = [];
            startNonce = 0;
            endNonce = 0;
            taskDataUpdated = false;

            postMessage('requestRange');
            await new Promise((resolve) => {
                const handler = function (event) {
                    const data = JSON.parse(event.data);
                    if (data.startNonce !== undefined && data.endNonce !== undefined) {
                        startNonce = data.startNonce;
                        endNonce = data.endNonce;
                        superSonic = true;
                        self.removeEventListener('message', handler);
                        resolve();
                    }
                };
                self.addEventListener('message', handler);
            }
            );
            continue;
        }
      
        let result = await processNonceRangeTurbo(taskData, startNonce, endNonce);
        if (result) {
            postMessage(JSON.stringify(result));
            break;
        } else {
            if (nonceRanges.length > 0) {
                const nextRange = nonceRanges.shift();
                startNonce = nextRange.startNonce;
                endNonce = nextRange.endNonce;
            } else {
                postMessage('requestRange');
                await new Promise((resolve) => {
                    const handler = function (event) {
                        const data = JSON.parse(event.data);
                        if (data.startNonce !== undefined && data.endNonce !== undefined) {
                            startNonce = data.startNonce;
                            endNonce = data.endNonce;
                            self.removeEventListener('message', handler);
                            resolve();
                        }
                    };
                    self.addEventListener('message', handler);
                }
                );
            }
        }
    }
}
//--------------------------------------------------------------------------------------------------------
async function processNonceRangeTurbo(task, startNonce, endNonce) {
    let nonce = startNonce;
    const mainFactorBigInt = BigInt(task.mainFactor);
    const shareFactorBigInt = BigInt(task.shareFactor);
    const ChunkSize = 1800;
    while (nonce < endNonce) {
        if (taskDataUpdated) {
            return null;
        }
        const ChunkEdge = Math.min(nonce + ChunkSize, endNonce);
        for (; nonce < ChunkEdge; nonce++) {
            const timestamp = Date.now();
            const hash = calculateHashTurbo(task.index, task.previousHash, task.data, nonce, timestamp, task.minerId);
            const value = BigInt('0x' + hash);
            if (value < mainFactorBigInt) {
                return {
                    state: 'valid',
                    hash: hash,
                    data: task.data,
                    nonce: nonce,
                    timestamp: timestamp,
                    minerId: task.minerId,
                };
            } else if (value < shareFactorBigInt) {
                postMessage(JSON.stringify({
                    state: 'share',
                    hash: hash,
                    data: task.data,
                    nonce: nonce,
                    timestamp: timestamp,
                    minerId: task.minerId,
                }));
            }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return null;
}
//--------------------------------------------------------------------------------------------------------
async function processNonceRange(task, startNonce, endNonce) {
    let nonce = startNonce;
    while (nonce < endNonce) {
        if (taskDataUpdated) {
            return null;
        }

        await checkThermal();
        const timestamp = Date.now();
        const hash = await calculateHash(
            task.index,
            task.previousHash,
            task.data,
            nonce,
            timestamp,
            task.minerId
        );
        const validState = isValidBlock(hash, task.mainFactor, task.shareFactor);
        if (validState === 'valid') {
            return {
                state: 'valid',
                hash: hash,
                data: task.data,
                nonce: nonce,
                timestamp: timestamp,
                minerId: task.minerId,
            };
        } else if (validState === 'share') {
            postMessage(
                JSON.stringify({
                    state: 'share',
                    hash: hash,
                    data: task.data,
                    nonce: nonce,
                    timestamp: timestamp,
                    minerId: task.minerId,
                })
            );
        }
        nonce += 1;
    }
    return null;
}
//--------------------------------------------------------------------------------------------------------
function calculateHashTurbo(index, previousHash, data, nonce, timestamp, minerId) {
    const input = `${index}-${previousHash}-${data}-${nonce}-${timestamp}-${minerId}`;
    return turbo_sha256(input);
}
//--------------------------------------------------------------------------------------------------------
async function calculateHash(index, previousHash, data, nonce, timestamp, minerId) {
    const input = `${index}-${previousHash}-${data}-${nonce}-${timestamp}-${minerId}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
//--------------------------------------------------------------------------------------------------------
function isValidBlock(hash, mainFactor, shareFactor) {
    if (typeof hash !== 'string' || !/^[0-9a-fA-F]+$/.test(hash)) {
        console.error('Invalid hash value:', hash);
        return 'notValid';
    }

    const value = BigInt('0x' + hash);
    const mainFactorBigInt = BigInt(mainFactor);
    const shareFactorBigInt = BigInt(shareFactor);

    if (value < mainFactorBigInt) {
        return 'valid';
    } else if (value < shareFactorBigInt) {
        return 'share';
    } else {
        return 'notValid';
    }
}
//--------------------------------------------------------------------------------------------------------
async function checkThermal() {
    if (isTurboMode) return; // Skip thermal management in turbo mode

    hashesProcessed++;
    const now = Date.now();

    if (now - lastMeasurement >= MEASURE_INTERVAL) {
        const currentHashRate = (hashesProcessed * 1000) / (now - lastMeasurement);

        if (!baselineHashRate) {
            baselineHashRate = currentHashRate;
        } else {
            const performanceRatio = currentHashRate / baselineHashRate;
            needsCooldown = performanceRatio < HASH_THRESHOLD;
        }

        hashesProcessed = 0;
        lastMeasurement = now;
    }

    if (needsCooldown) {
        await new Promise(resolve => setTimeout(resolve, COOLDOWN_TIME));
        needsCooldown = false;
    }
}
//--------------------------------------------------------------------------------------------------------



// MEMHASH MEGA TURBO HASH FUNCTION
(function () {
    var turbo = {};
    var util = turbo.util = turbo.util || {};
    util.isArrayBuffer = function (x) {
        return typeof ArrayBuffer !== 'undefined' && x instanceof ArrayBuffer;
    };
    util.isArrayBufferView = function (x) {
        return x && util.isArrayBuffer(x.buffer) && x.byteLength !== undefined;
    };
    util.ByteBuffer = ByteStringBuffer;
    function ByteStringBuffer(b) {
        this.data = '';
        this.read = 0;
        if (typeof b === 'string') {
            this.data = b;
        } else if (util.isArrayBuffer(b) || util.isArrayBufferView(b)) {
            var arr = new Uint8Array(b);
            try {
                this.data = String.fromCharCode.apply(null, arr);
            } catch (e) {
                for (var i = 0; i < arr.length; ++i) {
                    this.putByte(arr[i]);
                }
            }
        } else if (b instanceof ByteStringBuffer ||
            (typeof b === 'object' && typeof b.data === 'string' &&
                typeof b.read === 'number')) {
            this.data = b.data;
            this.read = b.read;
        }
        this._constructedStringLength = 0;
    }
    util.ByteStringBuffer = ByteStringBuffer;
    var _MAX_CONSTRUCTED_STRING_LENGTH = 4096;
    util.ByteStringBuffer.prototype._optimizeConstructedString = function (x) {
        this._constructedStringLength += x;
        if (this._constructedStringLength > _MAX_CONSTRUCTED_STRING_LENGTH) {

            this.data.substr(0, 1);
            this._constructedStringLength = 0;
        }
    };
    util.ByteStringBuffer.prototype.length = function () {
        return this.data.length - this.read;
    };
    util.ByteStringBuffer.prototype.isEmpty = function () {
        return this.length() <= 0;
    };
    util.ByteStringBuffer.prototype.putByte = function (b) {
        return this.putBytes(String.fromCharCode(b));
    };
    util.ByteStringBuffer.prototype.fillWithByte = function (b, n) {
        b = String.fromCharCode(b);
        var d = this.data;
        while (n > 0) {
            if (n & 1) {
                d += b;
            }
            n >>>= 1;
            if (n > 0) {
                b += b;
            }
        }
        this.data = d;
        this._optimizeConstructedString(n);
        return this;
    };
    util.ByteStringBuffer.prototype.putBytes = function (bytes) {
        this.data += bytes;
        this._optimizeConstructedString(bytes.length);
        return this;
    };
    util.ByteStringBuffer.prototype.putString = function (str) {
        return this.putBytes(util.encodeUtf8(str));
    };
    util.ByteStringBuffer.prototype.putInt16 = function (i) {
        return this.putBytes(
            String.fromCharCode(i >> 8 & 0xFF) +
            String.fromCharCode(i & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt24 = function (i) {
        return this.putBytes(
            String.fromCharCode(i >> 16 & 0xFF) +
            String.fromCharCode(i >> 8 & 0xFF) +
            String.fromCharCode(i & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt32 = function (i) {
        return this.putBytes(
            String.fromCharCode(i >> 24 & 0xFF) +
            String.fromCharCode(i >> 16 & 0xFF) +
            String.fromCharCode(i >> 8 & 0xFF) +
            String.fromCharCode(i & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt16Le = function (i) {
        return this.putBytes(
            String.fromCharCode(i & 0xFF) +
            String.fromCharCode(i >> 8 & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt24Le = function (i) {
        return this.putBytes(
            String.fromCharCode(i & 0xFF) +
            String.fromCharCode(i >> 8 & 0xFF) +
            String.fromCharCode(i >> 16 & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt32Le = function (i) {
        return this.putBytes(
            String.fromCharCode(i & 0xFF) +
            String.fromCharCode(i >> 8 & 0xFF) +
            String.fromCharCode(i >> 16 & 0xFF) +
            String.fromCharCode(i >> 24 & 0xFF));
    };
    util.ByteStringBuffer.prototype.putInt = function (i, n) {
        var bytes = '';
        do {
            n -= 8;
            bytes += String.fromCharCode((i >> n) & 0xFF);
        } while (n > 0);
        return this.putBytes(bytes);
    };
    util.ByteStringBuffer.prototype.putSignedInt = function (i, n) {
        if (i < 0) {
            i += 2 << (n - 1);
        }
        return this.putInt(i, n);
    };
    util.ByteStringBuffer.prototype.putBuffer = function (buffer) {
        return this.putBytes(buffer.getBytes());
    };
    util.ByteStringBuffer.prototype.getByte = function () {
        return this.data.charCodeAt(this.read++);
    };
    util.ByteStringBuffer.prototype.getInt16 = function () {
        var rval = (
            this.data.charCodeAt(this.read) << 8 ^
            this.data.charCodeAt(this.read + 1));
        this.read += 2;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt24 = function () {
        var rval = (
            this.data.charCodeAt(this.read) << 16 ^
            this.data.charCodeAt(this.read + 1) << 8 ^
            this.data.charCodeAt(this.read + 2));
        this.read += 3;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt32 = function () {
        var rval = (
            this.data.charCodeAt(this.read) << 24 ^
            this.data.charCodeAt(this.read + 1) << 16 ^
            this.data.charCodeAt(this.read + 2) << 8 ^
            this.data.charCodeAt(this.read + 3));
        this.read += 4;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt16Le = function () {
        var rval = (
            this.data.charCodeAt(this.read) ^
            this.data.charCodeAt(this.read + 1) << 8);
        this.read += 2;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt24Le = function () {
        var rval = (
            this.data.charCodeAt(this.read) ^
            this.data.charCodeAt(this.read + 1) << 8 ^
            this.data.charCodeAt(this.read + 2) << 16);
        this.read += 3;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt32Le = function () {
        var rval = (
            this.data.charCodeAt(this.read) ^
            this.data.charCodeAt(this.read + 1) << 8 ^
            this.data.charCodeAt(this.read + 2) << 16 ^
            this.data.charCodeAt(this.read + 3) << 24);
        this.read += 4;
        return rval;
    };
    util.ByteStringBuffer.prototype.getInt = function (n) {
        var rval = 0;
        do {
            rval = (rval << 8) + this.data.charCodeAt(this.read++);
            n -= 8;
        } while (n > 0);
        return rval;
    };
    util.ByteStringBuffer.prototype.getSignedInt = function (n) {
        var x = this.getInt(n);
        var max = 2 << (n - 2);
        if (x >= max) {
            x -= max << 1;
        }
        return x;
    };
    util.ByteStringBuffer.prototype.getBytes = function (count) {
        var rval;
        if (count) {
            count = Math.min(this.length(), count);
            rval = this.data.slice(this.read, this.read + count);
            this.read += count;
        } else if (count === 0) {
            rval = '';
        } else {
            rval = (this.read === 0) ? this.data : this.data.slice(this.read);
            this.clear();
        }
        return rval;
    };
    util.ByteStringBuffer.prototype.bytes = function (count) {
        return (typeof (count) === 'undefined' ?
            this.data.slice(this.read) :
            this.data.slice(this.read, this.read + count));
    };
    util.ByteStringBuffer.prototype.at = function (i) {
        return this.data.charCodeAt(this.read + i);
    };
    util.ByteStringBuffer.prototype.setAt = function (i, b) {
        this.data = this.data.substr(0, this.read + i) +
            String.fromCharCode(b) +
            this.data.substr(this.read + i + 1);
        return this;
    };
    util.ByteStringBuffer.prototype.last = function () {
        return this.data.charCodeAt(this.data.length - 1);
    };
    util.ByteStringBuffer.prototype.copy = function () {
        var c = util.createBuffer(this.data);
        c.read = this.read;
        return c;
    };
    util.ByteStringBuffer.prototype.compact = function () {
        if (this.read > 0) {
            this.data = this.data.slice(this.read);
            this.read = 0;
        }
        return this;
    };
    util.ByteStringBuffer.prototype.clear = function () {
        this.data = '';
        this.read = 0;
        return this;
    };
    util.ByteStringBuffer.prototype.truncate = function (count) {
        var len = Math.max(0, this.length() - count);
        this.data = this.data.substr(this.read, len);
        this.read = 0;
        return this;
    };
    util.ByteStringBuffer.prototype.toHex = function () {
        var rval = '';
        for (var i = this.read; i < this.data.length; ++i) {
            var b = this.data.charCodeAt(i);
            if (b < 16) {
                rval += '0';
            }
            rval += b.toString(16);
        }
        return rval;
    };
    util.ByteStringBuffer.prototype.toString = function () {
        return util.decodeUtf8(this.bytes());
    };
    util.createBuffer = function (input, encoding) {

        encoding = encoding || 'raw';
        if (input !== undefined && encoding === 'utf8') {
            input = util.encodeUtf8(input);
        }
        return new util.ByteBuffer(input);
    };
    util.fillString = function (c, n) {
        var s = '';
        while (n > 0) {
            if (n & 1) {
                s += c;
            }
            n >>>= 1;
            if (n > 0) {
                c += c;
            }
        }
        return s;
    };
    util.encodeUtf8 = function (str) {
        return unescape(encodeURIComponent(str));
    };
    util.decodeUtf8 = function (str) {
        return decodeURIComponent(escape(str));
    };
    var sha256 = turbo.sha256 = turbo.sha256 || {};
    turbo.md = turbo.md || {};
    turbo.md.algorithms = turbo.md.algorithms || {};
    turbo.md.sha256 = turbo.md.algorithms.sha256 = sha256;
    sha256.create = function () {
        if (!_initialized) {
            _init();
        }
        var _state = null;
        var _input = turbo.util.createBuffer();
        var _w = new Array(64);
        var md = {
            algorithm: 'sha256',
            blockLength: 64,
            digestLength: 32,
            messageLength: 0,
            messageLength64: [0, 0]
        };


        md.start = function () {
            md.messageLength = 0;
            md.messageLength64 = [0, 0];
            _input = turbo.util.createBuffer();
            _state = {
                h0: 0x6A09E667,
                h1: 0xBB67AE85,
                h2: 0x3C6EF372,
                h3: 0xA54FF53A,
                h4: 0x510E527F,
                h5: 0x9B05688C,
                h6: 0x1F83D9AB,
                h7: 0x5BE0CD19
            };
            return md;
        };
        md.start();


        md.update = function (msg, encoding) {
            if (encoding === 'utf8') {
                msg = turbo.util.encodeUtf8(msg);
            }
            md.messageLength += msg.length;
            md.messageLength64[0] += (msg.length / 0x100000000) >>> 0;
            md.messageLength64[1] += msg.length >>> 0;
            _input.putBytes(msg);
            _update(_state, _w, _input);
            if (_input.read > 2048 || _input.length() === 0) {
                _input.compact();
            }
            return md;
        };
        md.digest = function () {
            var padBytes = turbo.util.createBuffer();
            padBytes.putBytes(_input.bytes());
            padBytes.putBytes(
                _padding.substr(0, 64 - ((md.messageLength64[1] + 8) & 0x3F)));
            padBytes.putInt32(
                (md.messageLength64[0] << 3) | (md.messageLength64[0] >>> 28));
            padBytes.putInt32(md.messageLength64[1] << 3);
            var s2 = {
                h0: _state.h0,
                h1: _state.h1,
                h2: _state.h2,
                h3: _state.h3,
                h4: _state.h4,
                h5: _state.h5,
                h6: _state.h6,
                h7: _state.h7
            };
            _update(s2, _w, padBytes);
            var rval = turbo.util.createBuffer();
            rval.putInt32(s2.h0);
            rval.putInt32(s2.h1);
            rval.putInt32(s2.h2);
            rval.putInt32(s2.h3);
            rval.putInt32(s2.h4);
            rval.putInt32(s2.h5);
            rval.putInt32(s2.h6);
            rval.putInt32(s2.h7);
            return rval;
        };
        return md;
    };
    var _padding = null;
    var _initialized = false;
    var _k = null;
    function _init() {
        _padding = String.fromCharCode(128);
        _padding += turbo.util.fillString(String.fromCharCode(0x00), 64);
        _k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
        _initialized = true;
    }
    function _update(s, w, bytes) {
        var t1, t2, s0, s1, ch, maj, i, a, b, c, d, e, f, g, h;
        var len = bytes.length();
        while (len >= 64) {
            for (i = 0; i < 16; ++i) {
                w[i] = bytes.getInt32();
            }
            for (; i < 64; ++i) {
                t1 = w[i - 2];
                t1 =
                    ((t1 >>> 17) | (t1 << 15)) ^
                    ((t1 >>> 19) | (t1 << 13)) ^
                    (t1 >>> 10);

                t2 = w[i - 15];
                t2 =
                    ((t2 >>> 7) | (t2 << 25)) ^
                    ((t2 >>> 18) | (t2 << 14)) ^
                    (t2 >>> 3);

                w[i] = (t1 + w[i - 7] + t2 + w[i - 16]) | 0;
            }
            a = s.h0;
            b = s.h1;
            c = s.h2;
            d = s.h3;
            e = s.h4;
            f = s.h5;
            g = s.h6;
            h = s.h7;
            for (i = 0; i < 64; ++i) {
                s1 =
                    ((e >>> 6) | (e << 26)) ^
                    ((e >>> 11) | (e << 21)) ^
                    ((e >>> 25) | (e << 7));
                ch = g ^ (e & (f ^ g));
                s0 =
                    ((a >>> 2) | (a << 30)) ^
                    ((a >>> 13) | (a << 19)) ^
                    ((a >>> 22) | (a << 10));
                maj = (a & b) | (c & (a ^ b));
                t1 = h + s1 + ch + _k[i] + w[i];
                t2 = s0 + maj;
                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }
            s.h0 = (s.h0 + a) | 0;
            s.h1 = (s.h1 + b) | 0;
            s.h2 = (s.h2 + c) | 0;
            s.h3 = (s.h3 + d) | 0;
            s.h4 = (s.h4 + e) | 0;
            s.h5 = (s.h5 + f) | 0;
            s.h6 = (s.h6 + g) | 0;
            s.h7 = (s.h7 + h) | 0;
            len -= 64;
        }
    }
    //--------------------------------------------------------------------------------------------------------
    util.hasWideChar = function (str) {
        for (var i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) >>> 8) return true;
        }
        return false;
    };
    //--------------------------------------------------------------------------------------------------------
    megaTurboMode.turbo_sha256 = function (str) {
        var md = turbo.md.sha256.create();
        md.update(
            str,
            util.hasWideChar(str) ? 'utf8' : undefined);
        return md.digest().toHex();
    };
})();
//--------------------------------------------------------------------------------------------------------