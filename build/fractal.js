(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! Split.js - v1.3.5 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Split = factory());
}(this, (function () { 'use strict';

// The programming goals of Split.js are to deliver readable, understandable and
// maintainable code, while at the same time manually optimizing for tiny minified file size,
// browser compatibility without additional requirements, graceful fallback (IE8 is supported)
// and very few assumptions about the user's page layout.
var global = window;
var document = global.document;

// Save a couple long function names that are used frequently.
// This optimization saves around 400 bytes.
var addEventListener = 'addEventListener';
var removeEventListener = 'removeEventListener';
var getBoundingClientRect = 'getBoundingClientRect';
var NOOP = function () { return false; };

// Figure out if we're in IE8 or not. IE8 will still render correctly,
// but will be static instead of draggable.
var isIE8 = global.attachEvent && !global[addEventListener];

// This library only needs two helper functions:
//
// The first determines which prefixes of CSS calc we need.
// We only need to do this once on startup, when this anonymous function is called.
//
// Tests -webkit, -moz and -o prefixes. Modified from StackOverflow:
// http://stackoverflow.com/questions/16625140/js-feature-detection-to-detect-the-usage-of-webkit-calc-over-calc/16625167#16625167
var calc = (['', '-webkit-', '-moz-', '-o-'].filter(function (prefix) {
    var el = document.createElement('div');
    el.style.cssText = "width:" + prefix + "calc(9px)";

    return (!!el.style.length)
}).shift()) + "calc";

// The second helper function allows elements and string selectors to be used
// interchangeably. In either case an element is returned. This allows us to
// do `Split([elem1, elem2])` as well as `Split(['#id1', '#id2'])`.
var elementOrSelector = function (el) {
    if (typeof el === 'string' || el instanceof String) {
        return document.querySelector(el)
    }

    return el
};

// The main function to initialize a split. Split.js thinks about each pair
// of elements as an independant pair. Dragging the gutter between two elements
// only changes the dimensions of elements in that pair. This is key to understanding
// how the following functions operate, since each function is bound to a pair.
//
// A pair object is shaped like this:
//
// {
//     a: DOM element,
//     b: DOM element,
//     aMin: Number,
//     bMin: Number,
//     dragging: Boolean,
//     parent: DOM element,
//     isFirst: Boolean,
//     isLast: Boolean,
//     direction: 'horizontal' | 'vertical'
// }
//
// The basic sequence:
//
// 1. Set defaults to something sane. `options` doesn't have to be passed at all.
// 2. Initialize a bunch of strings based on the direction we're splitting.
//    A lot of the behavior in the rest of the library is paramatized down to
//    rely on CSS strings and classes.
// 3. Define the dragging helper functions, and a few helpers to go with them.
// 4. Loop through the elements while pairing them off. Every pair gets an
//    `pair` object, a gutter, and special isFirst/isLast properties.
// 5. Actually size the pair elements, insert gutters and attach event listeners.
var Split = function (ids, options) {
    if ( options === void 0 ) options = {};

    var dimension;
    var clientDimension;
    var clientAxis;
    var position;
    var paddingA;
    var paddingB;
    var elements;

    // All DOM elements in the split should have a common parent. We can grab
    // the first elements parent and hope users read the docs because the
    // behavior will be whacky otherwise.
    var parent = elementOrSelector(ids[0]).parentNode;
    var parentFlexDirection = global.getComputedStyle(parent).flexDirection;

    // Set default options.sizes to equal percentages of the parent element.
    var sizes = options.sizes || ids.map(function () { return 100 / ids.length; });

    // Standardize minSize to an array if it isn't already. This allows minSize
    // to be passed as a number.
    var minSize = options.minSize !== undefined ? options.minSize : 100;
    var minSizes = Array.isArray(minSize) ? minSize : ids.map(function () { return minSize; });
    var gutterSize = options.gutterSize !== undefined ? options.gutterSize : 10;
    var snapOffset = options.snapOffset !== undefined ? options.snapOffset : 30;
    var direction = options.direction || 'horizontal';
    var cursor = options.cursor || (direction === 'horizontal' ? 'ew-resize' : 'ns-resize');
    var gutter = options.gutter || (function (i, gutterDirection) {
        var gut = document.createElement('div');
        gut.className = "gutter gutter-" + gutterDirection;
        return gut
    });
    var elementStyle = options.elementStyle || (function (dim, size, gutSize) {
        var style = {};

        if (typeof size !== 'string' && !(size instanceof String)) {
            if (!isIE8) {
                style[dim] = calc + "(" + size + "% - " + gutSize + "px)";
            } else {
                style[dim] = size + "%";
            }
        } else {
            style[dim] = size;
        }

        return style
    });
    var gutterStyle = options.gutterStyle || (function (dim, gutSize) { return (( obj = {}, obj[dim] = (gutSize + "px"), obj ))
        var obj; });

    // 2. Initialize a bunch of strings based on the direction we're splitting.
    // A lot of the behavior in the rest of the library is paramatized down to
    // rely on CSS strings and classes.
    if (direction === 'horizontal') {
        dimension = 'width';
        clientDimension = 'clientWidth';
        clientAxis = 'clientX';
        position = 'left';
        paddingA = 'paddingLeft';
        paddingB = 'paddingRight';
    } else if (direction === 'vertical') {
        dimension = 'height';
        clientDimension = 'clientHeight';
        clientAxis = 'clientY';
        position = 'top';
        paddingA = 'paddingTop';
        paddingB = 'paddingBottom';
    }

    // 3. Define the dragging helper functions, and a few helpers to go with them.
    // Each helper is bound to a pair object that contains it's metadata. This
    // also makes it easy to store references to listeners that that will be
    // added and removed.
    //
    // Even though there are no other functions contained in them, aliasing
    // this to self saves 50 bytes or so since it's used so frequently.
    //
    // The pair object saves metadata like dragging state, position and
    // event listener references.

    function setElementSize (el, size, gutSize) {
        // Split.js allows setting sizes via numbers (ideally), or if you must,
        // by string, like '300px'. This is less than ideal, because it breaks
        // the fluid layout that `calc(% - px)` provides. You're on your own if you do that,
        // make sure you calculate the gutter size by hand.
        var style = elementStyle(dimension, size, gutSize);

        // eslint-disable-next-line no-param-reassign
        Object.keys(style).forEach(function (prop) { return (el.style[prop] = style[prop]); });
    }

    function setGutterSize (gutterElement, gutSize) {
        var style = gutterStyle(dimension, gutSize);

        // eslint-disable-next-line no-param-reassign
        Object.keys(style).forEach(function (prop) { return (gutterElement.style[prop] = style[prop]); });
    }

    // Actually adjust the size of elements `a` and `b` to `offset` while dragging.
    // calc is used to allow calc(percentage + gutterpx) on the whole split instance,
    // which allows the viewport to be resized without additional logic.
    // Element a's size is the same as offset. b's size is total size - a size.
    // Both sizes are calculated from the initial parent percentage,
    // then the gutter size is subtracted.
    function adjust (offset) {
        var a = elements[this.a];
        var b = elements[this.b];
        var percentage = a.size + b.size;

        a.size = (offset / this.size) * percentage;
        b.size = (percentage - ((offset / this.size) * percentage));

        setElementSize(a.element, a.size, this.aGutterSize);
        setElementSize(b.element, b.size, this.bGutterSize);
    }

    // drag, where all the magic happens. The logic is really quite simple:
    //
    // 1. Ignore if the pair is not dragging.
    // 2. Get the offset of the event.
    // 3. Snap offset to min if within snappable range (within min + snapOffset).
    // 4. Actually adjust each element in the pair to offset.
    //
    // ---------------------------------------------------------------------
    // |    | <- a.minSize               ||              b.minSize -> |    |
    // |    |  | <- this.snapOffset      ||     this.snapOffset -> |  |    |
    // |    |  |                         ||                        |  |    |
    // |    |  |                         ||                        |  |    |
    // ---------------------------------------------------------------------
    // | <- this.start                                        this.size -> |
    function drag (e) {
        var offset;

        if (!this.dragging) { return }

        // Get the offset of the event from the first side of the
        // pair `this.start`. Supports touch events, but not multitouch, so only the first
        // finger `touches[0]` is counted.
        if ('touches' in e) {
            offset = e.touches[0][clientAxis] - this.start;
        } else {
            offset = e[clientAxis] - this.start;
        }

        // If within snapOffset of min or max, set offset to min or max.
        // snapOffset buffers a.minSize and b.minSize, so logic is opposite for both.
        // Include the appropriate gutter sizes to prevent overflows.
        if (offset <= elements[this.a].minSize + snapOffset + this.aGutterSize) {
            offset = elements[this.a].minSize + this.aGutterSize;
        } else if (offset >= this.size - (elements[this.b].minSize + snapOffset + this.bGutterSize)) {
            offset = this.size - (elements[this.b].minSize + this.bGutterSize);
        }

        // Actually adjust the size.
        adjust.call(this, offset);

        // Call the drag callback continously. Don't do anything too intensive
        // in this callback.
        if (options.onDrag) {
            options.onDrag();
        }
    }

    // Cache some important sizes when drag starts, so we don't have to do that
    // continously:
    //
    // `size`: The total size of the pair. First + second + first gutter + second gutter.
    // `start`: The leading side of the first element.
    //
    // ------------------------------------------------
    // |      aGutterSize -> |||                      |
    // |                     |||                      |
    // |                     |||                      |
    // |                     ||| <- bGutterSize       |
    // ------------------------------------------------
    // | <- start                             size -> |
    function calculateSizes () {
        // Figure out the parent size minus padding.
        var a = elements[this.a].element;
        var b = elements[this.b].element;

        this.size = a[getBoundingClientRect]()[dimension] + b[getBoundingClientRect]()[dimension] + this.aGutterSize + this.bGutterSize;
        this.start = a[getBoundingClientRect]()[position];
    }

    // stopDragging is very similar to startDragging in reverse.
    function stopDragging () {
        var self = this;
        var a = elements[self.a].element;
        var b = elements[self.b].element;

        if (self.dragging && options.onDragEnd) {
            options.onDragEnd();
        }

        self.dragging = false;

        // Remove the stored event listeners. This is why we store them.
        global[removeEventListener]('mouseup', self.stop);
        global[removeEventListener]('touchend', self.stop);
        global[removeEventListener]('touchcancel', self.stop);

        self.parent[removeEventListener]('mousemove', self.move);
        self.parent[removeEventListener]('touchmove', self.move);

        // Delete them once they are removed. I think this makes a difference
        // in memory usage with a lot of splits on one page. But I don't know for sure.
        delete self.stop;
        delete self.move;

        a[removeEventListener]('selectstart', NOOP);
        a[removeEventListener]('dragstart', NOOP);
        b[removeEventListener]('selectstart', NOOP);
        b[removeEventListener]('dragstart', NOOP);

        a.style.userSelect = '';
        a.style.webkitUserSelect = '';
        a.style.MozUserSelect = '';
        a.style.pointerEvents = '';

        b.style.userSelect = '';
        b.style.webkitUserSelect = '';
        b.style.MozUserSelect = '';
        b.style.pointerEvents = '';

        self.gutter.style.cursor = '';
        self.parent.style.cursor = '';
    }

    // startDragging calls `calculateSizes` to store the inital size in the pair object.
    // It also adds event listeners for mouse/touch events,
    // and prevents selection while dragging so avoid the selecting text.
    function startDragging (e) {
        // Alias frequently used variables to save space. 200 bytes.
        var self = this;
        var a = elements[self.a].element;
        var b = elements[self.b].element;

        // Call the onDragStart callback.
        if (!self.dragging && options.onDragStart) {
            options.onDragStart();
        }

        // Don't actually drag the element. We emulate that in the drag function.
        e.preventDefault();

        // Set the dragging property of the pair object.
        self.dragging = true;

        // Create two event listeners bound to the same pair object and store
        // them in the pair object.
        self.move = drag.bind(self);
        self.stop = stopDragging.bind(self);

        // All the binding. `window` gets the stop events in case we drag out of the elements.
        global[addEventListener]('mouseup', self.stop);
        global[addEventListener]('touchend', self.stop);
        global[addEventListener]('touchcancel', self.stop);

        self.parent[addEventListener]('mousemove', self.move);
        self.parent[addEventListener]('touchmove', self.move);

        // Disable selection. Disable!
        a[addEventListener]('selectstart', NOOP);
        a[addEventListener]('dragstart', NOOP);
        b[addEventListener]('selectstart', NOOP);
        b[addEventListener]('dragstart', NOOP);

        a.style.userSelect = 'none';
        a.style.webkitUserSelect = 'none';
        a.style.MozUserSelect = 'none';
        a.style.pointerEvents = 'none';

        b.style.userSelect = 'none';
        b.style.webkitUserSelect = 'none';
        b.style.MozUserSelect = 'none';
        b.style.pointerEvents = 'none';

        // Set the cursor, both on the gutter and the parent element.
        // Doing only a, b and gutter causes flickering.
        self.gutter.style.cursor = cursor;
        self.parent.style.cursor = cursor;

        // Cache the initial sizes of the pair.
        calculateSizes.call(self);
    }

    // 5. Create pair and element objects. Each pair has an index reference to
    // elements `a` and `b` of the pair (first and second elements).
    // Loop through the elements while pairing them off. Every pair gets a
    // `pair` object, a gutter, and isFirst/isLast properties.
    //
    // Basic logic:
    //
    // - Starting with the second element `i > 0`, create `pair` objects with
    //   `a = i - 1` and `b = i`
    // - Set gutter sizes based on the _pair_ being first/last. The first and last
    //   pair have gutterSize / 2, since they only have one half gutter, and not two.
    // - Create gutter elements and add event listeners.
    // - Set the size of the elements, minus the gutter sizes.
    //
    // -----------------------------------------------------------------------
    // |     i=0     |         i=1         |        i=2       |      i=3     |
    // |             |       isFirst       |                  |     isLast   |
    // |           pair 0                pair 1             pair 2           |
    // |             |                     |                  |              |
    // -----------------------------------------------------------------------
    var pairs = [];
    elements = ids.map(function (id, i) {
        // Create the element object.
        var element = {
            element: elementOrSelector(id),
            size: sizes[i],
            minSize: minSizes[i],
        };

        var pair;

        if (i > 0) {
            // Create the pair object with it's metadata.
            pair = {
                a: i - 1,
                b: i,
                dragging: false,
                isFirst: (i === 1),
                isLast: (i === ids.length - 1),
                direction: direction,
                parent: parent,
            };

            // For first and last pairs, first and last gutter width is half.
            pair.aGutterSize = gutterSize;
            pair.bGutterSize = gutterSize;

            if (pair.isFirst) {
                pair.aGutterSize = gutterSize / 2;
            }

            if (pair.isLast) {
                pair.bGutterSize = gutterSize / 2;
            }

            // if the parent has a reverse flex-direction, switch the pair elements.
            if (parentFlexDirection === 'row-reverse' || parentFlexDirection === 'column-reverse') {
                var temp = pair.a;
                pair.a = pair.b;
                pair.b = temp;
            }
        }

        // Determine the size of the current element. IE8 is supported by
        // staticly assigning sizes without draggable gutters. Assigns a string
        // to `size`.
        //
        // IE9 and above
        if (!isIE8) {
            // Create gutter elements for each pair.
            if (i > 0) {
                var gutterElement = gutter(i, direction);
                setGutterSize(gutterElement, gutterSize);

                gutterElement[addEventListener]('mousedown', startDragging.bind(pair));
                gutterElement[addEventListener]('touchstart', startDragging.bind(pair));

                parent.insertBefore(gutterElement, element.element);

                pair.gutter = gutterElement;
            }
        }

        // Set the element size to our determined size.
        // Half-size gutters for first and last elements.
        if (i === 0 || i === ids.length - 1) {
            setElementSize(element.element, element.size, gutterSize / 2);
        } else {
            setElementSize(element.element, element.size, gutterSize);
        }

        var computedSize = element.element[getBoundingClientRect]()[dimension];

        if (computedSize < element.minSize) {
            element.minSize = computedSize;
        }

        // After the first iteration, and we have a pair object, append it to the
        // list of pairs.
        if (i > 0) {
            pairs.push(pair);
        }

        return element
    });

    function setSizes (newSizes) {
        newSizes.forEach(function (newSize, i) {
            if (i > 0) {
                var pair = pairs[i - 1];
                var a = elements[pair.a];
                var b = elements[pair.b];

                a.size = newSizes[i - 1];
                b.size = newSize;

                setElementSize(a.element, a.size, pair.aGutterSize);
                setElementSize(b.element, b.size, pair.bGutterSize);
            }
        });
    }

    function destroy () {
        pairs.forEach(function (pair) {
            pair.parent.removeChild(pair.gutter);
            elements[pair.a].element.style[dimension] = '';
            elements[pair.b].element.style[dimension] = '';
        });
    }

    if (isIE8) {
        return {
            setSizes: setSizes,
            destroy: destroy,
        }
    }

    return {
        setSizes: setSizes,
        getSizes: function getSizes () {
            return elements.map(function (element) { return element.size; })
        },
        collapse: function collapse (i) {
            if (i === pairs.length) {
                var pair = pairs[i - 1];

                calculateSizes.call(pair);

                if (!isIE8) {
                    adjust.call(pair, pair.size - pair.bGutterSize);
                }
            } else {
                var pair$1 = pairs[i];

                calculateSizes.call(pair$1);

                if (!isIE8) {
                    adjust.call(pair$1, pair$1.aGutterSize);
                }
            }
        },
        destroy: destroy,
    }
};

return Split;

})));

},{}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getPalette;
function getPalette(colorStops, numColors) {
	var offsets = [];
	var reds = [];
	var greens = [];
	var blues = [];

	for (var i = 0; i < colorStops.length; i++) {
		var colorStop = colorStops[i];

		offsets.push(colorStop[0]);

		var hexColor = colorStop[1];
		reds.push(hexColor >> 16 & 255);
		greens.push(hexColor >> 8 & 255);
		blues.push(hexColor & 255);
	}

	var redInterpolant = createInterpolant(offsets, reds);
	var greenInterpolant = createInterpolant(offsets, greens);
	var blueInterpolant = createInterpolant(offsets, blues);

	var palette = [];
	var increment = 1 / numColors;

	for (var _i = 0; _i < 1; _i += increment) {
		palette.push(redInterpolant(_i), greenInterpolant(_i), blueInterpolant(_i));
	}

	return new Uint8Array(palette);
}

// https://en.wikipedia.org/wiki/Monotone_cubic_interpolation
function createInterpolant(xs, ys) {
	var length = xs.length;

	// Deal with length issues
	if (length !== ys.length) {
		throw "Need an equal count of xs and ys.";
	}
	if (length === 0) {
		return function () {
			return 0;
		};
	}
	if (length === 1) {
		// Impl: Precomputing the result prevents problems if ys is mutated later and allows garbage collection of ys
		// Impl: Unary plus properly converts values to numbers
		var result = +ys[0];
		return function () {
			return result;
		};
	}

	// Rearrange xs and ys so that xs is sorted
	var indexes = [];
	for (var i = 0; i < length; i++) {
		indexes.push(i);
	}
	indexes.sort(function (a, b) {
		return xs[a] < xs[b] ? -1 : 1;
	});
	var oldXs = xs,
	    oldYs = ys;
	// Impl: Creating new arrays also prevents problems if the input arrays are mutated later
	xs = [];
	ys = [];
	// Impl: Unary plus properly converts values to numbers
	for (var _i2 = 0; _i2 < length; _i2++) {
		xs.push(+oldXs[indexes[_i2]]);
		ys.push(+oldYs[indexes[_i2]]);
	}

	// Get consecutive differences and slopes
	var dys = [],
	    dxs = [],
	    ms = [];
	for (var _i3 = 0; _i3 < length - 1; _i3++) {
		var dx = xs[_i3 + 1] - xs[_i3],
		    dy = ys[_i3 + 1] - ys[_i3];
		dxs.push(dx);
		dys.push(dy);
		ms.push(dy / dx);
	}

	// Get degree-1 coefficients
	var c1s = [ms[0]];
	for (var _i4 = 0; _i4 < dxs.length - 1; _i4++) {
		var m = ms[_i4],
		    mNext = ms[_i4 + 1];
		if (m * mNext <= 0) {
			c1s.push(0);
		} else {
			var dx_ = dxs[_i4],
			    dxNext = dxs[_i4 + 1],
			    common = dx_ + dxNext;
			c1s.push(3 * common / ((common + dxNext) / m + (common + dx_) / mNext));
		}
	}
	c1s.push(ms[ms.length - 1]);

	// Get degree-2 and degree-3 coefficients
	var c2s = [],
	    c3s = [];
	for (var _i5 = 0; _i5 < c1s.length - 1; _i5++) {
		var c1 = c1s[_i5],
		    m_ = ms[_i5],
		    invDx = 1 / dxs[_i5],
		    common_ = c1 + c1s[_i5 + 1] - m_ - m_;
		c2s.push((m_ - c1 - common_) * invDx);
		c3s.push(common_ * invDx * invDx);
	}

	// Return interpolant function
	return function (x) {
		// The rightmost point in the dataset should give an exact result
		var i = xs.length - 1;
		if (x === xs[i]) {
			return ys[i];
		}

		// Search for the interval x is in, returning the corresponding y if x is one of the original xs
		var low = 0,
		    mid = void 0,
		    high = c3s.length - 1;
		while (low <= high) {
			mid = Math.floor((low + high) / 2);
			var xHere = xs[mid];
			if (xHere < x) {
				low = mid + 1;
			} else if (xHere > x) {
				high = mid - 1;
			} else {
				return ys[mid];
			}
		}
		i = Math.max(0, high);

		// Interpolate
		var diff = x - xs[i],
		    diffSq = diff * diff;
		return ys[i] + c1s[i] * diff + c2s[i] * diffSq + c3s[i] * diff * diffSq;
	};
}

},{}],3:[function(require,module,exports){
"use strict";

var _colorGradient = require("./color-gradient.js");

var _colorGradient2 = _interopRequireDefault(_colorGradient);

var _webglUtils = require("./webgl-utils.js");

var _split = require("split.js");

var _split2 = _interopRequireDefault(_split);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $window = $(window);
var $html = $("html");

var $iterationText = $("#iteration-text");
var $jconstantText = $("#julia-constant-text");

var $controlsDialog = $("#controls-dialog");
setTimeout(function () {
	$controlsDialog.dialog({
		width: "25em",
		buttons: [{
			text: "Got it!",
			click: function click() {
				$controlsDialog.dialog("close");
			}
		}],
		show: "scale",
		hide: "puff"
	}).tooltip();
}, 500);

var SCROLL_COEFF = 0.05;
var ZOOM_COEFF = 1.1;

var maxIterations = 200;

var palette = (0, _colorGradient2.default)([[0, 0x000000], [0.1, 0x440845], [0.2, 0x7d1a48], [0.3, 0xc66f37], [0.4, 0xf0e953], [0.5, 0xffffff], [0.6, 0x98e991], [0.7, 0x57c9ae], [0.8, 0x245b9a], [0.9, 0x071146], [1, 0x000000]], 2048);

var Mandelbrot = initFractal("#mandelbrot-canvas", {
	real: {
		min: null,
		mid: -0.7,
		max: null,
		range: 3
	},
	imag: {
		min: null,
		mid: 0,
		max: null,
		range: 2.4
	},
	overCanvas: null
});

var Julia = initFractal("#julia-canvas", {
	real: {
		min: null,
		mid: 0,
		max: null,
		range: 3.6
	},
	imag: {
		min: null,
		mid: 0,
		max: null,
		range: 3.6
	},
	overCanvas: null
}, {
	real: -0.77,
	imag: -0.09
});

function initFractal(canvasSelector, bounds, jconstant) {
	var fractal = {};
	fractal.$canvas = $(canvasSelector);
	fractal.canvas = fractal.$canvas[0];
	fractal.gl = (0, _webglUtils.initGl)(fractal);
	fractal.program = (0, _webglUtils.initProgram)(fractal);
	fractal.uniforms = (0, _webglUtils.getUniforms)(fractal, ["realMin", "imagMin", "maxIterations", "isJulia", "jconstant", "overCanvas", "palette"]);
	fractal.bounds = bounds;
	if (jconstant) {
		fractal.gl.uniform1i(fractal.uniforms.isJulia, true);
		fractal.constant = jconstant;
	}
	(0, _webglUtils.initTexture)(fractal, palette);
	fractal.gl.uniform1i(fractal.uniforms.palette, 0);
	return fractal;
}

function updateIterationText() {
	$iterationText.text("Iteration count = " + maxIterations);
}
updateIterationText();

function updateJConstantText() {
	$jconstantText.text("Showing Julia set for c = " + Julia.constant.real + " + " + Julia.constant.imag + "i");
}
updateJConstantText();

function resizeCanvas(fractal) {
	var $canvas = fractal.$canvas,
	    canvas = fractal.canvas,
	    gl = fractal.gl;


	canvas.width = $canvas.width();
	canvas.height = $canvas.height();
	gl.viewport(0, 0, canvas.width, canvas.height);
	calculateBounds(fractal);
	render(fractal);
}

function resizeCanvases() {
	resizeCanvas(Mandelbrot);
	resizeCanvas(Julia);
}
$(resizeCanvases);
$window.resize(resizeCanvases);

(0, _split2.default)(["#mandelbrot-canvas-wrapper", "#julia-canvas-wrapper"], {
	direction: "horizontal",
	cursor: "col-resize",
	onDrag: resizeCanvases
});

function calculateBounds(_ref) {
	var canvas = _ref.canvas,
	    bounds = _ref.bounds;

	bounds.real.range = Math.abs(bounds.real.range);
	bounds.imag.range = Math.abs(bounds.imag.range);

	var boundsRatio = bounds.real.range / bounds.imag.range;
	var canvasRatio = canvas.width / canvas.height;

	if (boundsRatio < canvasRatio) bounds.real.range = bounds.imag.range * canvasRatio;else if (boundsRatio > canvasRatio) bounds.imag.range = bounds.real.range / canvasRatio;

	bounds.real.min = bounds.real.mid - bounds.real.range / 2;
	bounds.real.max = bounds.real.mid + bounds.real.range / 2;
	bounds.imag.min = bounds.imag.mid - bounds.imag.range / 2;
	bounds.imag.max = bounds.imag.mid + bounds.imag.range / 2;

	bounds.overCanvas = bounds.real.range / canvas.width;
}

function render(_ref2) {
	var gl = _ref2.gl,
	    uniforms = _ref2.uniforms,
	    bounds = _ref2.bounds,
	    constant = _ref2.constant;

	gl.uniform1f(uniforms.realMin, bounds.real.min);
	gl.uniform1f(uniforms.imagMin, bounds.imag.min);
	gl.uniform1f(uniforms.overCanvas, bounds.overCanvas);
	gl.uniform1i(uniforms.maxIterations, maxIterations);
	if (constant) gl.uniform2f(uniforms.jconstant, constant.real, constant.imag);

	(0, _webglUtils.renderGl)(gl);
}

function getZFromPixel(_ref3, x, y) {
	var bounds = _ref3.bounds;

	return {
		real: bounds.real.min + x * bounds.overCanvas,
		imag: bounds.imag.max - y * bounds.overCanvas
	};
}

function initKeydownBounds(fractal) {
	var bounds = fractal.bounds;


	$window.keydown(function (evt) {
		switch (evt.which) {
			case 38: // up
			case 87:
				// w
				if (evt.shiftKey) {
					bounds.real.range /= ZOOM_COEFF;
					bounds.imag.range /= ZOOM_COEFF;
				} else bounds.imag.mid += bounds.imag.range * SCROLL_COEFF;
				break;
			case 37: // left
			case 65:
				// a
				bounds.real.mid -= bounds.real.range * SCROLL_COEFF;
				break;

			case 40: // down
			case 83:
				// s
				if (evt.shiftKey) {
					bounds.real.range *= ZOOM_COEFF;
					bounds.imag.range *= ZOOM_COEFF;
				} else bounds.imag.mid -= bounds.imag.range * SCROLL_COEFF;

				break;
			case 39: // right
			case 68:
				// d
				bounds.real.mid += bounds.real.range * SCROLL_COEFF;
				break;
		}

		calculateBounds(fractal);
		render(fractal);
	});
}
initKeydownBounds(Mandelbrot);
initKeydownBounds(Julia);

function initKeydownIterations() {
	$window.keydown(function (evt) {
		switch (evt.which) {
			case 49:
			case 50:
			case 51:
			case 52:
			case 53:
			case 54:
			case 55:
			case 56:
			case 57:
				// 1-9
				maxIterations = 100 * Math.pow(2, evt.which - 51);
				break;
			case 189:
				// -
				maxIterations -= 100;
				maxIterations = Math.max(maxIterations, 0);
				break;
			case 187:
				// +
				maxIterations += 100;
				break;
		}

		updateIterationText();
		render(Mandelbrot);
		render(Julia);
	});
}
initKeydownIterations();

function initMouseDown(fractal) {
	var $canvas = fractal.$canvas,
	    canvas = fractal.canvas,
	    bounds = fractal.bounds;


	$canvas.mousedown(function (downevt) {
		downevt.preventDefault();

		var offset = $canvas.offset();
		var pmouseX = downevt.clientX - offset.left;
		var pmouseY = downevt.clientY - offset.top;

		if (downevt.shiftKey) {
			Julia.constant = getZFromPixel(fractal, pmouseX, pmouseY);
			updateJConstantText();
			render(Julia);

			$html.addClass("alias");
		} else $html.addClass("all-scroll");

		function mousemove(moveevt) {
			moveevt.preventDefault();

			var mouseX = moveevt.clientX - offset.left;
			var mouseY = moveevt.clientY - offset.top;
			var mouseZ = getZFromPixel(fractal, mouseX, mouseY);

			if (downevt.shiftKey) {
				Julia.constant = mouseZ;
				updateJConstantText();
				render(Julia);
			} else {
				var pmouseZ = getZFromPixel(fractal, pmouseX, pmouseY);

				pmouseX = mouseX;
				pmouseY = mouseY;

				bounds.real.mid += pmouseZ.real - mouseZ.real;
				bounds.imag.mid += pmouseZ.imag - mouseZ.imag;

				calculateBounds(fractal);
				render(fractal);
			}
		}
		$window.mousemove(mousemove);

		function mouseup(upevt) {
			upevt.preventDefault();

			$window.off("mousemove", mousemove);
			$window.off("mouseup", mouseup);

			$html.removeClass("alias all-scroll");
		}
		$window.mouseup(mouseup);
	});
}
initMouseDown(Mandelbrot);
initMouseDown(Julia);

function initWheel(fractal) {
	var $canvas = fractal.$canvas,
	    bounds = fractal.bounds;


	$canvas.on("wheel", function (evt) {
		evt.preventDefault();

		var offset = $canvas.offset();
		var mouseX = evt.clientX - offset.left;
		var mouseY = evt.clientY - offset.top;

		var deltaY = evt.originalEvent.deltaY;

		if (deltaY < 0) {
			bounds.real.range /= ZOOM_COEFF;
			bounds.imag.range /= ZOOM_COEFF;

			$html.addClass("zoom-in");
		} else {
			bounds.real.range *= ZOOM_COEFF;
			bounds.imag.range *= ZOOM_COEFF;

			$html.addClass("zoom-out");
		}

		var pmouseZ = getZFromPixel(fractal, mouseX, mouseY);

		calculateBounds(fractal);

		var mouseZ = getZFromPixel(fractal, mouseX, mouseY);

		bounds.real.mid -= mouseZ.real - pmouseZ.real;
		bounds.imag.mid -= mouseZ.imag - pmouseZ.imag;

		calculateBounds(fractal);
		render(fractal);

		clearTimeout($.data($canvas, "scrollTimer"));
		$.data($canvas, "scrollTimer", setTimeout(function () {
			return $html.removeClass("zoom-in zoom-out");
		}, 250));
	});
}
initWheel(Mandelbrot);
initWheel(Julia);

},{"./color-gradient.js":2,"./webgl-utils.js":4,"split.js":1}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.initGl = initGl;
exports.initProgram = initProgram;
exports.getUniforms = getUniforms;
exports.initTexture = initTexture;
exports.renderGl = renderGl;
var vertexShaderSource = "\nattribute vec4 vertexPosition;\n\nvoid main() {\n\tgl_Position = vertexPosition;\n}\n";

var fragmentShaderSource = "\nprecision highp float;\n\nuniform float realMin;\nuniform float imagMin;\nuniform float overCanvas;\nuniform int maxIterations;\nconst float BAILOUT_RADIUS = 4.0;\nuniform bool isJulia;\nuniform vec2 jconstant;\nuniform sampler2D palette;\nconst float GRADIENT_SCALE = 0.03125;\n\nvec4 getFractalColor(vec2 z) {\n\tvec2 zSq;\n\tvec2 c;\n\tif (isJulia)\n\t\tc = jconstant;\n\telse\n\t\tc = z;\n\n\tfor (int i = 0; i < 10000; i++) {\n\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\tz = vec2(zSq.x - zSq.y + c.x, 2.0 * z.x * z.y + c.y);\n\n\t\tif (zSq.x + zSq.y > BAILOUT_RADIUS) {\n\t\t\tfor (int j = 0; j < 3; j++) {\n\t\t\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\t\t\tz = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;\n\t\t\t}\n\n\t\t\tfloat mu = float(i) + 1.0 - log2(log(zSq.x + zSq.y) / 2.0);\n\t\t\treturn texture2D(palette, vec2(mu * GRADIENT_SCALE, 0.0));\n\t\t}\n\n\t\tif (i > maxIterations) return vec4(0, 0, 0, 1);\n\t}\n}\n\nvoid main() {\n\tgl_FragColor = getFractalColor(vec2(realMin + gl_FragCoord.x * overCanvas, imagMin + gl_FragCoord.y * overCanvas));\n}\n";

var vertices = [[1, 1], [1, -1], [-1, -1], [-1, 1]];

function initGl(_ref) {
	var canvas = _ref.canvas;

	var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser may not support it.");
		return null;
	}
	return gl;
}

function getShader(gl, name, type) {
	var shader = gl.createShader(type);

	var source = void 0;
	if (name === "fractal.vert") {
		source = vertexShaderSource;
	} else if (name === "fractal.frag") {
		source = fragmentShaderSource;
	}
	if (!source) {
		alert("Could not find shader source: " + name);
		return null;
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("An error occured compiling the shaders: " + gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function initProgram(_ref2) {
	var gl = _ref2.gl;

	var vertexShader = getShader(gl, "fractal.vert", gl.VERTEX_SHADER);
	var fragmentShader = getShader(gl, "fractal.frag", gl.FRAGMENT_SHADER);

	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
		return null;
	}

	gl.useProgram(program);

	var vertexPositionAttrib = gl.getAttribLocation(program, "vertexPosition");
	gl.enableVertexAttribArray(vertexPositionAttrib);

	var verticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
	gl.vertexAttribPointer(vertexPositionAttrib, 2, gl.FLOAT, false, 0, 0);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.reduce(function (acc, val) {
		return acc.concat(val);
	})), gl.STATIC_DRAW);

	return program;
}

function getUniforms(_ref3, names) {
	var gl = _ref3.gl,
	    program = _ref3.program;

	var uniforms = {};
	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		uniforms[name] = gl.getUniformLocation(program, name);
	}
	return uniforms;
}

function initTexture(_ref4, palette) {
	var gl = _ref4.gl;

	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, palette.length / 3, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, palette);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	return texture;
}

function renderGl(gl) {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length);
}

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvc3BsaXQuanMvc3BsaXQuanMiLCJzcmMvY29sb3ItZ3JhZGllbnQuanMiLCJzcmMvZnJhY3RhbC5qcyIsInNyYy93ZWJnbC11dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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LEdBQUcsWUFBakIsRUFBK0IsQ0FBL0IsRUFBa0MsU0FBUyxNQUEzQztBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qISBTcGxpdC5qcyAtIHYxLjMuNSAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwuU3BsaXQgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbi8vIFRoZSBwcm9ncmFtbWluZyBnb2FscyBvZiBTcGxpdC5qcyBhcmUgdG8gZGVsaXZlciByZWFkYWJsZSwgdW5kZXJzdGFuZGFibGUgYW5kXG4vLyBtYWludGFpbmFibGUgY29kZSwgd2hpbGUgYXQgdGhlIHNhbWUgdGltZSBtYW51YWxseSBvcHRpbWl6aW5nIGZvciB0aW55IG1pbmlmaWVkIGZpbGUgc2l6ZSxcbi8vIGJyb3dzZXIgY29tcGF0aWJpbGl0eSB3aXRob3V0IGFkZGl0aW9uYWwgcmVxdWlyZW1lbnRzLCBncmFjZWZ1bCBmYWxsYmFjayAoSUU4IGlzIHN1cHBvcnRlZClcbi8vIGFuZCB2ZXJ5IGZldyBhc3N1bXB0aW9ucyBhYm91dCB0aGUgdXNlcidzIHBhZ2UgbGF5b3V0LlxudmFyIGdsb2JhbCA9IHdpbmRvdztcbnZhciBkb2N1bWVudCA9IGdsb2JhbC5kb2N1bWVudDtcblxuLy8gU2F2ZSBhIGNvdXBsZSBsb25nIGZ1bmN0aW9uIG5hbWVzIHRoYXQgYXJlIHVzZWQgZnJlcXVlbnRseS5cbi8vIFRoaXMgb3B0aW1pemF0aW9uIHNhdmVzIGFyb3VuZCA0MDAgYnl0ZXMuXG52YXIgYWRkRXZlbnRMaXN0ZW5lciA9ICdhZGRFdmVudExpc3RlbmVyJztcbnZhciByZW1vdmVFdmVudExpc3RlbmVyID0gJ3JlbW92ZUV2ZW50TGlzdGVuZXInO1xudmFyIGdldEJvdW5kaW5nQ2xpZW50UmVjdCA9ICdnZXRCb3VuZGluZ0NsaWVudFJlY3QnO1xudmFyIE5PT1AgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZTsgfTtcblxuLy8gRmlndXJlIG91dCBpZiB3ZSdyZSBpbiBJRTggb3Igbm90LiBJRTggd2lsbCBzdGlsbCByZW5kZXIgY29ycmVjdGx5LFxuLy8gYnV0IHdpbGwgYmUgc3RhdGljIGluc3RlYWQgb2YgZHJhZ2dhYmxlLlxudmFyIGlzSUU4ID0gZ2xvYmFsLmF0dGFjaEV2ZW50ICYmICFnbG9iYWxbYWRkRXZlbnRMaXN0ZW5lcl07XG5cbi8vIFRoaXMgbGlicmFyeSBvbmx5IG5lZWRzIHR3byBoZWxwZXIgZnVuY3Rpb25zOlxuLy9cbi8vIFRoZSBmaXJzdCBkZXRlcm1pbmVzIHdoaWNoIHByZWZpeGVzIG9mIENTUyBjYWxjIHdlIG5lZWQuXG4vLyBXZSBvbmx5IG5lZWQgdG8gZG8gdGhpcyBvbmNlIG9uIHN0YXJ0dXAsIHdoZW4gdGhpcyBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgY2FsbGVkLlxuLy9cbi8vIFRlc3RzIC13ZWJraXQsIC1tb3ogYW5kIC1vIHByZWZpeGVzLiBNb2RpZmllZCBmcm9tIFN0YWNrT3ZlcmZsb3c6XG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE2NjI1MTQwL2pzLWZlYXR1cmUtZGV0ZWN0aW9uLXRvLWRldGVjdC10aGUtdXNhZ2Utb2Ytd2Via2l0LWNhbGMtb3Zlci1jYWxjLzE2NjI1MTY3IzE2NjI1MTY3XG52YXIgY2FsYyA9IChbJycsICctd2Via2l0LScsICctbW96LScsICctby0nXS5maWx0ZXIoZnVuY3Rpb24gKHByZWZpeCkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGVsLnN0eWxlLmNzc1RleHQgPSBcIndpZHRoOlwiICsgcHJlZml4ICsgXCJjYWxjKDlweClcIjtcblxuICAgIHJldHVybiAoISFlbC5zdHlsZS5sZW5ndGgpXG59KS5zaGlmdCgpKSArIFwiY2FsY1wiO1xuXG4vLyBUaGUgc2Vjb25kIGhlbHBlciBmdW5jdGlvbiBhbGxvd3MgZWxlbWVudHMgYW5kIHN0cmluZyBzZWxlY3RvcnMgdG8gYmUgdXNlZFxuLy8gaW50ZXJjaGFuZ2VhYmx5LiBJbiBlaXRoZXIgY2FzZSBhbiBlbGVtZW50IGlzIHJldHVybmVkLiBUaGlzIGFsbG93cyB1cyB0b1xuLy8gZG8gYFNwbGl0KFtlbGVtMSwgZWxlbTJdKWAgYXMgd2VsbCBhcyBgU3BsaXQoWycjaWQxJywgJyNpZDInXSlgLlxudmFyIGVsZW1lbnRPclNlbGVjdG9yID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgfHwgZWwgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgfVxuXG4gICAgcmV0dXJuIGVsXG59O1xuXG4vLyBUaGUgbWFpbiBmdW5jdGlvbiB0byBpbml0aWFsaXplIGEgc3BsaXQuIFNwbGl0LmpzIHRoaW5rcyBhYm91dCBlYWNoIHBhaXJcbi8vIG9mIGVsZW1lbnRzIGFzIGFuIGluZGVwZW5kYW50IHBhaXIuIERyYWdnaW5nIHRoZSBndXR0ZXIgYmV0d2VlbiB0d28gZWxlbWVudHNcbi8vIG9ubHkgY2hhbmdlcyB0aGUgZGltZW5zaW9ucyBvZiBlbGVtZW50cyBpbiB0aGF0IHBhaXIuIFRoaXMgaXMga2V5IHRvIHVuZGVyc3RhbmRpbmdcbi8vIGhvdyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBvcGVyYXRlLCBzaW5jZSBlYWNoIGZ1bmN0aW9uIGlzIGJvdW5kIHRvIGEgcGFpci5cbi8vXG4vLyBBIHBhaXIgb2JqZWN0IGlzIHNoYXBlZCBsaWtlIHRoaXM6XG4vL1xuLy8ge1xuLy8gICAgIGE6IERPTSBlbGVtZW50LFxuLy8gICAgIGI6IERPTSBlbGVtZW50LFxuLy8gICAgIGFNaW46IE51bWJlcixcbi8vICAgICBiTWluOiBOdW1iZXIsXG4vLyAgICAgZHJhZ2dpbmc6IEJvb2xlYW4sXG4vLyAgICAgcGFyZW50OiBET00gZWxlbWVudCxcbi8vICAgICBpc0ZpcnN0OiBCb29sZWFuLFxuLy8gICAgIGlzTGFzdDogQm9vbGVhbixcbi8vICAgICBkaXJlY3Rpb246ICdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCdcbi8vIH1cbi8vXG4vLyBUaGUgYmFzaWMgc2VxdWVuY2U6XG4vL1xuLy8gMS4gU2V0IGRlZmF1bHRzIHRvIHNvbWV0aGluZyBzYW5lLiBgb3B0aW9uc2AgZG9lc24ndCBoYXZlIHRvIGJlIHBhc3NlZCBhdCBhbGwuXG4vLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbi8vICAgIEEgbG90IG9mIHRoZSBiZWhhdmlvciBpbiB0aGUgcmVzdCBvZiB0aGUgbGlicmFyeSBpcyBwYXJhbWF0aXplZCBkb3duIHRvXG4vLyAgICByZWx5IG9uIENTUyBzdHJpbmdzIGFuZCBjbGFzc2VzLlxuLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4vLyA0LiBMb29wIHRocm91Z2ggdGhlIGVsZW1lbnRzIHdoaWxlIHBhaXJpbmcgdGhlbSBvZmYuIEV2ZXJ5IHBhaXIgZ2V0cyBhblxuLy8gICAgYHBhaXJgIG9iamVjdCwgYSBndXR0ZXIsIGFuZCBzcGVjaWFsIGlzRmlyc3QvaXNMYXN0IHByb3BlcnRpZXMuXG4vLyA1LiBBY3R1YWxseSBzaXplIHRoZSBwYWlyIGVsZW1lbnRzLCBpbnNlcnQgZ3V0dGVycyBhbmQgYXR0YWNoIGV2ZW50IGxpc3RlbmVycy5cbnZhciBTcGxpdCA9IGZ1bmN0aW9uIChpZHMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIG9wdGlvbnMgPT09IHZvaWQgMCApIG9wdGlvbnMgPSB7fTtcblxuICAgIHZhciBkaW1lbnNpb247XG4gICAgdmFyIGNsaWVudERpbWVuc2lvbjtcbiAgICB2YXIgY2xpZW50QXhpcztcbiAgICB2YXIgcG9zaXRpb247XG4gICAgdmFyIHBhZGRpbmdBO1xuICAgIHZhciBwYWRkaW5nQjtcbiAgICB2YXIgZWxlbWVudHM7XG5cbiAgICAvLyBBbGwgRE9NIGVsZW1lbnRzIGluIHRoZSBzcGxpdCBzaG91bGQgaGF2ZSBhIGNvbW1vbiBwYXJlbnQuIFdlIGNhbiBncmFiXG4gICAgLy8gdGhlIGZpcnN0IGVsZW1lbnRzIHBhcmVudCBhbmQgaG9wZSB1c2VycyByZWFkIHRoZSBkb2NzIGJlY2F1c2UgdGhlXG4gICAgLy8gYmVoYXZpb3Igd2lsbCBiZSB3aGFja3kgb3RoZXJ3aXNlLlxuICAgIHZhciBwYXJlbnQgPSBlbGVtZW50T3JTZWxlY3RvcihpZHNbMF0pLnBhcmVudE5vZGU7XG4gICAgdmFyIHBhcmVudEZsZXhEaXJlY3Rpb24gPSBnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpLmZsZXhEaXJlY3Rpb247XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBvcHRpb25zLnNpemVzIHRvIGVxdWFsIHBlcmNlbnRhZ2VzIG9mIHRoZSBwYXJlbnQgZWxlbWVudC5cbiAgICB2YXIgc2l6ZXMgPSBvcHRpb25zLnNpemVzIHx8IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gMTAwIC8gaWRzLmxlbmd0aDsgfSk7XG5cbiAgICAvLyBTdGFuZGFyZGl6ZSBtaW5TaXplIHRvIGFuIGFycmF5IGlmIGl0IGlzbid0IGFscmVhZHkuIFRoaXMgYWxsb3dzIG1pblNpemVcbiAgICAvLyB0byBiZSBwYXNzZWQgYXMgYSBudW1iZXIuXG4gICAgdmFyIG1pblNpemUgPSBvcHRpb25zLm1pblNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubWluU2l6ZSA6IDEwMDtcbiAgICB2YXIgbWluU2l6ZXMgPSBBcnJheS5pc0FycmF5KG1pblNpemUpID8gbWluU2l6ZSA6IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gbWluU2l6ZTsgfSk7XG4gICAgdmFyIGd1dHRlclNpemUgPSBvcHRpb25zLmd1dHRlclNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3V0dGVyU2l6ZSA6IDEwO1xuICAgIHZhciBzbmFwT2Zmc2V0ID0gb3B0aW9ucy5zbmFwT2Zmc2V0ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNuYXBPZmZzZXQgOiAzMDtcbiAgICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5kaXJlY3Rpb24gfHwgJ2hvcml6b250YWwnO1xuICAgIHZhciBjdXJzb3IgPSBvcHRpb25zLmN1cnNvciB8fCAoZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAnZXctcmVzaXplJyA6ICducy1yZXNpemUnKTtcbiAgICB2YXIgZ3V0dGVyID0gb3B0aW9ucy5ndXR0ZXIgfHwgKGZ1bmN0aW9uIChpLCBndXR0ZXJEaXJlY3Rpb24pIHtcbiAgICAgICAgdmFyIGd1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBndXQuY2xhc3NOYW1lID0gXCJndXR0ZXIgZ3V0dGVyLVwiICsgZ3V0dGVyRGlyZWN0aW9uO1xuICAgICAgICByZXR1cm4gZ3V0XG4gICAgfSk7XG4gICAgdmFyIGVsZW1lbnRTdHlsZSA9IG9wdGlvbnMuZWxlbWVudFN0eWxlIHx8IChmdW5jdGlvbiAoZGltLCBzaXplLCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ3N0cmluZycgJiYgIShzaXplIGluc3RhbmNlb2YgU3RyaW5nKSkge1xuICAgICAgICAgICAgaWYgKCFpc0lFOCkge1xuICAgICAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBjYWxjICsgXCIoXCIgKyBzaXplICsgXCIlIC0gXCIgKyBndXRTaXplICsgXCJweClcIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3R5bGVbZGltXSA9IHNpemUgKyBcIiVcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBzaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0eWxlXG4gICAgfSk7XG4gICAgdmFyIGd1dHRlclN0eWxlID0gb3B0aW9ucy5ndXR0ZXJTdHlsZSB8fCAoZnVuY3Rpb24gKGRpbSwgZ3V0U2l6ZSkgeyByZXR1cm4gKCggb2JqID0ge30sIG9ialtkaW1dID0gKGd1dFNpemUgKyBcInB4XCIpLCBvYmogKSlcbiAgICAgICAgdmFyIG9iajsgfSk7XG5cbiAgICAvLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbiAgICAvLyBBIGxvdCBvZiB0aGUgYmVoYXZpb3IgaW4gdGhlIHJlc3Qgb2YgdGhlIGxpYnJhcnkgaXMgcGFyYW1hdGl6ZWQgZG93biB0b1xuICAgIC8vIHJlbHkgb24gQ1NTIHN0cmluZ3MgYW5kIGNsYXNzZXMuXG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgIGRpbWVuc2lvbiA9ICd3aWR0aCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRXaWR0aCc7XG4gICAgICAgIGNsaWVudEF4aXMgPSAnY2xpZW50WCc7XG4gICAgICAgIHBvc2l0aW9uID0gJ2xlZnQnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nTGVmdCc7XG4gICAgICAgIHBhZGRpbmdCID0gJ3BhZGRpbmdSaWdodCc7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgZGltZW5zaW9uID0gJ2hlaWdodCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRIZWlnaHQnO1xuICAgICAgICBjbGllbnRBeGlzID0gJ2NsaWVudFknO1xuICAgICAgICBwb3NpdGlvbiA9ICd0b3AnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nVG9wJztcbiAgICAgICAgcGFkZGluZ0IgPSAncGFkZGluZ0JvdHRvbSc7XG4gICAgfVxuXG4gICAgLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4gICAgLy8gRWFjaCBoZWxwZXIgaXMgYm91bmQgdG8gYSBwYWlyIG9iamVjdCB0aGF0IGNvbnRhaW5zIGl0J3MgbWV0YWRhdGEuIFRoaXNcbiAgICAvLyBhbHNvIG1ha2VzIGl0IGVhc3kgdG8gc3RvcmUgcmVmZXJlbmNlcyB0byBsaXN0ZW5lcnMgdGhhdCB0aGF0IHdpbGwgYmVcbiAgICAvLyBhZGRlZCBhbmQgcmVtb3ZlZC5cbiAgICAvL1xuICAgIC8vIEV2ZW4gdGhvdWdoIHRoZXJlIGFyZSBubyBvdGhlciBmdW5jdGlvbnMgY29udGFpbmVkIGluIHRoZW0sIGFsaWFzaW5nXG4gICAgLy8gdGhpcyB0byBzZWxmIHNhdmVzIDUwIGJ5dGVzIG9yIHNvIHNpbmNlIGl0J3MgdXNlZCBzbyBmcmVxdWVudGx5LlxuICAgIC8vXG4gICAgLy8gVGhlIHBhaXIgb2JqZWN0IHNhdmVzIG1ldGFkYXRhIGxpa2UgZHJhZ2dpbmcgc3RhdGUsIHBvc2l0aW9uIGFuZFxuICAgIC8vIGV2ZW50IGxpc3RlbmVyIHJlZmVyZW5jZXMuXG5cbiAgICBmdW5jdGlvbiBzZXRFbGVtZW50U2l6ZSAoZWwsIHNpemUsIGd1dFNpemUpIHtcbiAgICAgICAgLy8gU3BsaXQuanMgYWxsb3dzIHNldHRpbmcgc2l6ZXMgdmlhIG51bWJlcnMgKGlkZWFsbHkpLCBvciBpZiB5b3UgbXVzdCxcbiAgICAgICAgLy8gYnkgc3RyaW5nLCBsaWtlICczMDBweCcuIFRoaXMgaXMgbGVzcyB0aGFuIGlkZWFsLCBiZWNhdXNlIGl0IGJyZWFrc1xuICAgICAgICAvLyB0aGUgZmx1aWQgbGF5b3V0IHRoYXQgYGNhbGMoJSAtIHB4KWAgcHJvdmlkZXMuIFlvdSdyZSBvbiB5b3VyIG93biBpZiB5b3UgZG8gdGhhdCxcbiAgICAgICAgLy8gbWFrZSBzdXJlIHlvdSBjYWxjdWxhdGUgdGhlIGd1dHRlciBzaXplIGJ5IGhhbmQuXG4gICAgICAgIHZhciBzdHlsZSA9IGVsZW1lbnRTdHlsZShkaW1lbnNpb24sIHNpemUsIGd1dFNpemUpO1xuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgICAgICBPYmplY3Qua2V5cyhzdHlsZSkuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkgeyByZXR1cm4gKGVsLnN0eWxlW3Byb3BdID0gc3R5bGVbcHJvcF0pOyB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRHdXR0ZXJTaXplIChndXR0ZXJFbGVtZW50LCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IGd1dHRlclN0eWxlKGRpbWVuc2lvbiwgZ3V0U2l6ZSk7XG5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICAgIE9iamVjdC5rZXlzKHN0eWxlKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7IHJldHVybiAoZ3V0dGVyRWxlbWVudC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTsgfSk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgYWRqdXN0IHRoZSBzaXplIG9mIGVsZW1lbnRzIGBhYCBhbmQgYGJgIHRvIGBvZmZzZXRgIHdoaWxlIGRyYWdnaW5nLlxuICAgIC8vIGNhbGMgaXMgdXNlZCB0byBhbGxvdyBjYWxjKHBlcmNlbnRhZ2UgKyBndXR0ZXJweCkgb24gdGhlIHdob2xlIHNwbGl0IGluc3RhbmNlLFxuICAgIC8vIHdoaWNoIGFsbG93cyB0aGUgdmlld3BvcnQgdG8gYmUgcmVzaXplZCB3aXRob3V0IGFkZGl0aW9uYWwgbG9naWMuXG4gICAgLy8gRWxlbWVudCBhJ3Mgc2l6ZSBpcyB0aGUgc2FtZSBhcyBvZmZzZXQuIGIncyBzaXplIGlzIHRvdGFsIHNpemUgLSBhIHNpemUuXG4gICAgLy8gQm90aCBzaXplcyBhcmUgY2FsY3VsYXRlZCBmcm9tIHRoZSBpbml0aWFsIHBhcmVudCBwZXJjZW50YWdlLFxuICAgIC8vIHRoZW4gdGhlIGd1dHRlciBzaXplIGlzIHN1YnRyYWN0ZWQuXG4gICAgZnVuY3Rpb24gYWRqdXN0IChvZmZzZXQpIHtcbiAgICAgICAgdmFyIGEgPSBlbGVtZW50c1t0aGlzLmFdO1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3RoaXMuYl07XG4gICAgICAgIHZhciBwZXJjZW50YWdlID0gYS5zaXplICsgYi5zaXplO1xuXG4gICAgICAgIGEuc2l6ZSA9IChvZmZzZXQgLyB0aGlzLnNpemUpICogcGVyY2VudGFnZTtcbiAgICAgICAgYi5zaXplID0gKHBlcmNlbnRhZ2UgLSAoKG9mZnNldCAvIHRoaXMuc2l6ZSkgKiBwZXJjZW50YWdlKSk7XG5cbiAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHRoaXMuYUd1dHRlclNpemUpO1xuICAgICAgICBzZXRFbGVtZW50U2l6ZShiLmVsZW1lbnQsIGIuc2l6ZSwgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgfVxuXG4gICAgLy8gZHJhZywgd2hlcmUgYWxsIHRoZSBtYWdpYyBoYXBwZW5zLiBUaGUgbG9naWMgaXMgcmVhbGx5IHF1aXRlIHNpbXBsZTpcbiAgICAvL1xuICAgIC8vIDEuIElnbm9yZSBpZiB0aGUgcGFpciBpcyBub3QgZHJhZ2dpbmcuXG4gICAgLy8gMi4gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50LlxuICAgIC8vIDMuIFNuYXAgb2Zmc2V0IHRvIG1pbiBpZiB3aXRoaW4gc25hcHBhYmxlIHJhbmdlICh3aXRoaW4gbWluICsgc25hcE9mZnNldCkuXG4gICAgLy8gNC4gQWN0dWFsbHkgYWRqdXN0IGVhY2ggZWxlbWVudCBpbiB0aGUgcGFpciB0byBvZmZzZXQuXG4gICAgLy9cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgIHwgPC0gYS5taW5TaXplICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgIGIubWluU2l6ZSAtPiB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgPC0gdGhpcy5zbmFwT2Zmc2V0ICAgICAgfHwgICAgIHRoaXMuc25hcE9mZnNldCAtPiB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8IDwtIHRoaXMuc3RhcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplIC0+IHxcbiAgICBmdW5jdGlvbiBkcmFnIChlKSB7XG4gICAgICAgIHZhciBvZmZzZXQ7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRyYWdnaW5nKSB7IHJldHVybiB9XG5cbiAgICAgICAgLy8gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50IGZyb20gdGhlIGZpcnN0IHNpZGUgb2YgdGhlXG4gICAgICAgIC8vIHBhaXIgYHRoaXMuc3RhcnRgLiBTdXBwb3J0cyB0b3VjaCBldmVudHMsIGJ1dCBub3QgbXVsdGl0b3VjaCwgc28gb25seSB0aGUgZmlyc3RcbiAgICAgICAgLy8gZmluZ2VyIGB0b3VjaGVzWzBdYCBpcyBjb3VudGVkLlxuICAgICAgICBpZiAoJ3RvdWNoZXMnIGluIGUpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IGUudG91Y2hlc1swXVtjbGllbnRBeGlzXSAtIHRoaXMuc3RhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlW2NsaWVudEF4aXNdIC0gdGhpcy5zdGFydDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdpdGhpbiBzbmFwT2Zmc2V0IG9mIG1pbiBvciBtYXgsIHNldCBvZmZzZXQgdG8gbWluIG9yIG1heC5cbiAgICAgICAgLy8gc25hcE9mZnNldCBidWZmZXJzIGEubWluU2l6ZSBhbmQgYi5taW5TaXplLCBzbyBsb2dpYyBpcyBvcHBvc2l0ZSBmb3IgYm90aC5cbiAgICAgICAgLy8gSW5jbHVkZSB0aGUgYXBwcm9wcmlhdGUgZ3V0dGVyIHNpemVzIHRvIHByZXZlbnQgb3ZlcmZsb3dzLlxuICAgICAgICBpZiAob2Zmc2V0IDw9IGVsZW1lbnRzW3RoaXMuYV0ubWluU2l6ZSArIHNuYXBPZmZzZXQgKyB0aGlzLmFHdXR0ZXJTaXplKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlbGVtZW50c1t0aGlzLmFdLm1pblNpemUgKyB0aGlzLmFHdXR0ZXJTaXplO1xuICAgICAgICB9IGVsc2UgaWYgKG9mZnNldCA+PSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgc25hcE9mZnNldCArIHRoaXMuYkd1dHRlclNpemUpKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBY3R1YWxseSBhZGp1c3QgdGhlIHNpemUuXG4gICAgICAgIGFkanVzdC5jYWxsKHRoaXMsIG9mZnNldCk7XG5cbiAgICAgICAgLy8gQ2FsbCB0aGUgZHJhZyBjYWxsYmFjayBjb250aW5vdXNseS4gRG9uJ3QgZG8gYW55dGhpbmcgdG9vIGludGVuc2l2ZVxuICAgICAgICAvLyBpbiB0aGlzIGNhbGxiYWNrLlxuICAgICAgICBpZiAob3B0aW9ucy5vbkRyYWcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWNoZSBzb21lIGltcG9ydGFudCBzaXplcyB3aGVuIGRyYWcgc3RhcnRzLCBzbyB3ZSBkb24ndCBoYXZlIHRvIGRvIHRoYXRcbiAgICAvLyBjb250aW5vdXNseTpcbiAgICAvL1xuICAgIC8vIGBzaXplYDogVGhlIHRvdGFsIHNpemUgb2YgdGhlIHBhaXIuIEZpcnN0ICsgc2Vjb25kICsgZmlyc3QgZ3V0dGVyICsgc2Vjb25kIGd1dHRlci5cbiAgICAvLyBgc3RhcnRgOiBUaGUgbGVhZGluZyBzaWRlIG9mIHRoZSBmaXJzdCBlbGVtZW50LlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCAgICAgIGFHdXR0ZXJTaXplIC0+IHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCA8LSBiR3V0dGVyU2l6ZSAgICAgICB8XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCA8LSBzdGFydCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZSAtPiB8XG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlU2l6ZXMgKCkge1xuICAgICAgICAvLyBGaWd1cmUgb3V0IHRoZSBwYXJlbnQgc2l6ZSBtaW51cyBwYWRkaW5nLlxuICAgICAgICB2YXIgYSA9IGVsZW1lbnRzW3RoaXMuYV0uZWxlbWVudDtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1t0aGlzLmJdLmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5zaXplID0gYVtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXSArIGJbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl0gKyB0aGlzLmFHdXR0ZXJTaXplICsgdGhpcy5iR3V0dGVyU2l6ZTtcbiAgICAgICAgdGhpcy5zdGFydCA9IGFbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW3Bvc2l0aW9uXTtcbiAgICB9XG5cbiAgICAvLyBzdG9wRHJhZ2dpbmcgaXMgdmVyeSBzaW1pbGFyIHRvIHN0YXJ0RHJhZ2dpbmcgaW4gcmV2ZXJzZS5cbiAgICBmdW5jdGlvbiBzdG9wRHJhZ2dpbmcgKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICBpZiAoc2VsZi5kcmFnZ2luZyAmJiBvcHRpb25zLm9uRHJhZ0VuZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5vbkRyYWdFbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZHJhZ2dpbmcgPSBmYWxzZTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHN0b3JlZCBldmVudCBsaXN0ZW5lcnMuIFRoaXMgaXMgd2h5IHdlIHN0b3JlIHRoZW0uXG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2V1cCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuICAgICAgICBnbG9iYWxbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoY2FuY2VsJywgc2VsZi5zdG9wKTtcblxuICAgICAgICBzZWxmLnBhcmVudFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2Vtb3ZlJywgc2VsZi5tb3ZlKTtcbiAgICAgICAgc2VsZi5wYXJlbnRbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cbiAgICAgICAgLy8gRGVsZXRlIHRoZW0gb25jZSB0aGV5IGFyZSByZW1vdmVkLiBJIHRoaW5rIHRoaXMgbWFrZXMgYSBkaWZmZXJlbmNlXG4gICAgICAgIC8vIGluIG1lbW9yeSB1c2FnZSB3aXRoIGEgbG90IG9mIHNwbGl0cyBvbiBvbmUgcGFnZS4gQnV0IEkgZG9uJ3Qga25vdyBmb3Igc3VyZS5cbiAgICAgICAgZGVsZXRlIHNlbGYuc3RvcDtcbiAgICAgICAgZGVsZXRlIHNlbGYubW92ZTtcblxuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdzZWxlY3RzdGFydCcsIE5PT1ApO1xuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG5cbiAgICAgICAgYS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGEuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgYi5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBiLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgICAgIHNlbGYucGFyZW50LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIH1cblxuICAgIC8vIHN0YXJ0RHJhZ2dpbmcgY2FsbHMgYGNhbGN1bGF0ZVNpemVzYCB0byBzdG9yZSB0aGUgaW5pdGFsIHNpemUgaW4gdGhlIHBhaXIgb2JqZWN0LlxuICAgIC8vIEl0IGFsc28gYWRkcyBldmVudCBsaXN0ZW5lcnMgZm9yIG1vdXNlL3RvdWNoIGV2ZW50cyxcbiAgICAvLyBhbmQgcHJldmVudHMgc2VsZWN0aW9uIHdoaWxlIGRyYWdnaW5nIHNvIGF2b2lkIHRoZSBzZWxlY3RpbmcgdGV4dC5cbiAgICBmdW5jdGlvbiBzdGFydERyYWdnaW5nIChlKSB7XG4gICAgICAgIC8vIEFsaWFzIGZyZXF1ZW50bHkgdXNlZCB2YXJpYWJsZXMgdG8gc2F2ZSBzcGFjZS4gMjAwIGJ5dGVzLlxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICAvLyBDYWxsIHRoZSBvbkRyYWdTdGFydCBjYWxsYmFjay5cbiAgICAgICAgaWYgKCFzZWxmLmRyYWdnaW5nICYmIG9wdGlvbnMub25EcmFnU3RhcnQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnU3RhcnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvbid0IGFjdHVhbGx5IGRyYWcgdGhlIGVsZW1lbnQuIFdlIGVtdWxhdGUgdGhhdCBpbiB0aGUgZHJhZyBmdW5jdGlvbi5cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIC8vIFNldCB0aGUgZHJhZ2dpbmcgcHJvcGVydHkgb2YgdGhlIHBhaXIgb2JqZWN0LlxuICAgICAgICBzZWxmLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBDcmVhdGUgdHdvIGV2ZW50IGxpc3RlbmVycyBib3VuZCB0byB0aGUgc2FtZSBwYWlyIG9iamVjdCBhbmQgc3RvcmVcbiAgICAgICAgLy8gdGhlbSBpbiB0aGUgcGFpciBvYmplY3QuXG4gICAgICAgIHNlbGYubW92ZSA9IGRyYWcuYmluZChzZWxmKTtcbiAgICAgICAgc2VsZi5zdG9wID0gc3RvcERyYWdnaW5nLmJpbmQoc2VsZik7XG5cbiAgICAgICAgLy8gQWxsIHRoZSBiaW5kaW5nLiBgd2luZG93YCBnZXRzIHRoZSBzdG9wIGV2ZW50cyBpbiBjYXNlIHdlIGRyYWcgb3V0IG9mIHRoZSBlbGVtZW50cy5cbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZXVwJywgc2VsZi5zdG9wKTtcbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCd0b3VjaGVuZCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hjYW5jZWwnLCBzZWxmLnN0b3ApO1xuXG4gICAgICAgIHNlbGYucGFyZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZW1vdmUnLCBzZWxmLm1vdmUpO1xuICAgICAgICBzZWxmLnBhcmVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2htb3ZlJywgc2VsZi5tb3ZlKTtcblxuICAgICAgICAvLyBEaXNhYmxlIHNlbGVjdGlvbi4gRGlzYWJsZSFcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXG4gICAgICAgIGEuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYS5zdHlsZS53ZWJraXRVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGEuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblxuICAgICAgICBiLnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYi5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBiLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBjdXJzb3IsIGJvdGggb24gdGhlIGd1dHRlciBhbmQgdGhlIHBhcmVudCBlbGVtZW50LlxuICAgICAgICAvLyBEb2luZyBvbmx5IGEsIGIgYW5kIGd1dHRlciBjYXVzZXMgZmxpY2tlcmluZy5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gY3Vyc29yO1xuICAgICAgICBzZWxmLnBhcmVudC5zdHlsZS5jdXJzb3IgPSBjdXJzb3I7XG5cbiAgICAgICAgLy8gQ2FjaGUgdGhlIGluaXRpYWwgc2l6ZXMgb2YgdGhlIHBhaXIuXG4gICAgICAgIGNhbGN1bGF0ZVNpemVzLmNhbGwoc2VsZik7XG4gICAgfVxuXG4gICAgLy8gNS4gQ3JlYXRlIHBhaXIgYW5kIGVsZW1lbnQgb2JqZWN0cy4gRWFjaCBwYWlyIGhhcyBhbiBpbmRleCByZWZlcmVuY2UgdG9cbiAgICAvLyBlbGVtZW50cyBgYWAgYW5kIGBiYCBvZiB0aGUgcGFpciAoZmlyc3QgYW5kIHNlY29uZCBlbGVtZW50cykuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBlbGVtZW50cyB3aGlsZSBwYWlyaW5nIHRoZW0gb2ZmLiBFdmVyeSBwYWlyIGdldHMgYVxuICAgIC8vIGBwYWlyYCBvYmplY3QsIGEgZ3V0dGVyLCBhbmQgaXNGaXJzdC9pc0xhc3QgcHJvcGVydGllcy5cbiAgICAvL1xuICAgIC8vIEJhc2ljIGxvZ2ljOlxuICAgIC8vXG4gICAgLy8gLSBTdGFydGluZyB3aXRoIHRoZSBzZWNvbmQgZWxlbWVudCBgaSA+IDBgLCBjcmVhdGUgYHBhaXJgIG9iamVjdHMgd2l0aFxuICAgIC8vICAgYGEgPSBpIC0gMWAgYW5kIGBiID0gaWBcbiAgICAvLyAtIFNldCBndXR0ZXIgc2l6ZXMgYmFzZWQgb24gdGhlIF9wYWlyXyBiZWluZyBmaXJzdC9sYXN0LiBUaGUgZmlyc3QgYW5kIGxhc3RcbiAgICAvLyAgIHBhaXIgaGF2ZSBndXR0ZXJTaXplIC8gMiwgc2luY2UgdGhleSBvbmx5IGhhdmUgb25lIGhhbGYgZ3V0dGVyLCBhbmQgbm90IHR3by5cbiAgICAvLyAtIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgYW5kIGFkZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgLy8gLSBTZXQgdGhlIHNpemUgb2YgdGhlIGVsZW1lbnRzLCBtaW51cyB0aGUgZ3V0dGVyIHNpemVzLlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgICBpPTAgICAgIHwgICAgICAgICBpPTEgICAgICAgICB8ICAgICAgICBpPTIgICAgICAgfCAgICAgIGk9MyAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgfCAgICAgICBpc0ZpcnN0ICAgICAgIHwgICAgICAgICAgICAgICAgICB8ICAgICBpc0xhc3QgICB8XG4gICAgLy8gfCAgICAgICAgICAgcGFpciAwICAgICAgICAgICAgICAgIHBhaXIgMSAgICAgICAgICAgICBwYWlyIDIgICAgICAgICAgIHxcbiAgICAvLyB8ICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgfFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgdmFyIHBhaXJzID0gW107XG4gICAgZWxlbWVudHMgPSBpZHMubWFwKGZ1bmN0aW9uIChpZCwgaSkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIGVsZW1lbnQgb2JqZWN0LlxuICAgICAgICB2YXIgZWxlbWVudCA9IHtcbiAgICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnRPclNlbGVjdG9yKGlkKSxcbiAgICAgICAgICAgIHNpemU6IHNpemVzW2ldLFxuICAgICAgICAgICAgbWluU2l6ZTogbWluU2l6ZXNbaV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHBhaXI7XG5cbiAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHBhaXIgb2JqZWN0IHdpdGggaXQncyBtZXRhZGF0YS5cbiAgICAgICAgICAgIHBhaXIgPSB7XG4gICAgICAgICAgICAgICAgYTogaSAtIDEsXG4gICAgICAgICAgICAgICAgYjogaSxcbiAgICAgICAgICAgICAgICBkcmFnZ2luZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNGaXJzdDogKGkgPT09IDEpLFxuICAgICAgICAgICAgICAgIGlzTGFzdDogKGkgPT09IGlkcy5sZW5ndGggLSAxKSxcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEZvciBmaXJzdCBhbmQgbGFzdCBwYWlycywgZmlyc3QgYW5kIGxhc3QgZ3V0dGVyIHdpZHRoIGlzIGhhbGYuXG4gICAgICAgICAgICBwYWlyLmFHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZTtcbiAgICAgICAgICAgIHBhaXIuYkd1dHRlclNpemUgPSBndXR0ZXJTaXplO1xuXG4gICAgICAgICAgICBpZiAocGFpci5pc0ZpcnN0KSB7XG4gICAgICAgICAgICAgICAgcGFpci5hR3V0dGVyU2l6ZSA9IGd1dHRlclNpemUgLyAyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGFpci5pc0xhc3QpIHtcbiAgICAgICAgICAgICAgICBwYWlyLmJHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZSAvIDI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBwYXJlbnQgaGFzIGEgcmV2ZXJzZSBmbGV4LWRpcmVjdGlvbiwgc3dpdGNoIHRoZSBwYWlyIGVsZW1lbnRzLlxuICAgICAgICAgICAgaWYgKHBhcmVudEZsZXhEaXJlY3Rpb24gPT09ICdyb3ctcmV2ZXJzZScgfHwgcGFyZW50RmxleERpcmVjdGlvbiA9PT0gJ2NvbHVtbi1yZXZlcnNlJykge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wID0gcGFpci5hO1xuICAgICAgICAgICAgICAgIHBhaXIuYSA9IHBhaXIuYjtcbiAgICAgICAgICAgICAgICBwYWlyLmIgPSB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBzaXplIG9mIHRoZSBjdXJyZW50IGVsZW1lbnQuIElFOCBpcyBzdXBwb3J0ZWQgYnlcbiAgICAgICAgLy8gc3RhdGljbHkgYXNzaWduaW5nIHNpemVzIHdpdGhvdXQgZHJhZ2dhYmxlIGd1dHRlcnMuIEFzc2lnbnMgYSBzdHJpbmdcbiAgICAgICAgLy8gdG8gYHNpemVgLlxuICAgICAgICAvL1xuICAgICAgICAvLyBJRTkgYW5kIGFib3ZlXG4gICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgZm9yIGVhY2ggcGFpci5cbiAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBndXR0ZXJFbGVtZW50ID0gZ3V0dGVyKGksIGRpcmVjdGlvbik7XG4gICAgICAgICAgICAgICAgc2V0R3V0dGVyU2l6ZShndXR0ZXJFbGVtZW50LCBndXR0ZXJTaXplKTtcblxuICAgICAgICAgICAgICAgIGd1dHRlckVsZW1lbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ21vdXNlZG93bicsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG4gICAgICAgICAgICAgICAgZ3V0dGVyRWxlbWVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hzdGFydCcsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG5cbiAgICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGd1dHRlckVsZW1lbnQsIGVsZW1lbnQuZWxlbWVudCk7XG5cbiAgICAgICAgICAgICAgICBwYWlyLmd1dHRlciA9IGd1dHRlckVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdGhlIGVsZW1lbnQgc2l6ZSB0byBvdXIgZGV0ZXJtaW5lZCBzaXplLlxuICAgICAgICAvLyBIYWxmLXNpemUgZ3V0dGVycyBmb3IgZmlyc3QgYW5kIGxhc3QgZWxlbWVudHMuXG4gICAgICAgIGlmIChpID09PSAwIHx8IGkgPT09IGlkcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBzZXRFbGVtZW50U2l6ZShlbGVtZW50LmVsZW1lbnQsIGVsZW1lbnQuc2l6ZSwgZ3V0dGVyU2l6ZSAvIDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoZWxlbWVudC5lbGVtZW50LCBlbGVtZW50LnNpemUsIGd1dHRlclNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbXB1dGVkU2l6ZSA9IGVsZW1lbnQuZWxlbWVudFtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXTtcblxuICAgICAgICBpZiAoY29tcHV0ZWRTaXplIDwgZWxlbWVudC5taW5TaXplKSB7XG4gICAgICAgICAgICBlbGVtZW50Lm1pblNpemUgPSBjb21wdXRlZFNpemU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZnRlciB0aGUgZmlyc3QgaXRlcmF0aW9uLCBhbmQgd2UgaGF2ZSBhIHBhaXIgb2JqZWN0LCBhcHBlbmQgaXQgdG8gdGhlXG4gICAgICAgIC8vIGxpc3Qgb2YgcGFpcnMuXG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgcGFpcnMucHVzaChwYWlyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbGVtZW50XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBzZXRTaXplcyAobmV3U2l6ZXMpIHtcbiAgICAgICAgbmV3U2l6ZXMuZm9yRWFjaChmdW5jdGlvbiAobmV3U2l6ZSwgaSkge1xuICAgICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpIC0gMV07XG4gICAgICAgICAgICAgICAgdmFyIGEgPSBlbGVtZW50c1twYWlyLmFdO1xuICAgICAgICAgICAgICAgIHZhciBiID0gZWxlbWVudHNbcGFpci5iXTtcblxuICAgICAgICAgICAgICAgIGEuc2l6ZSA9IG5ld1NpemVzW2kgLSAxXTtcbiAgICAgICAgICAgICAgICBiLnNpemUgPSBuZXdTaXplO1xuXG4gICAgICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHBhaXIuYUd1dHRlclNpemUpO1xuICAgICAgICAgICAgICAgIHNldEVsZW1lbnRTaXplKGIuZWxlbWVudCwgYi5zaXplLCBwYWlyLmJHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgICAgIHBhaXJzLmZvckVhY2goZnVuY3Rpb24gKHBhaXIpIHtcbiAgICAgICAgICAgIHBhaXIucGFyZW50LnJlbW92ZUNoaWxkKHBhaXIuZ3V0dGVyKTtcbiAgICAgICAgICAgIGVsZW1lbnRzW3BhaXIuYV0uZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gJyc7XG4gICAgICAgICAgICBlbGVtZW50c1twYWlyLmJdLmVsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9ICcnO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoaXNJRTgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNldFNpemVzOiBzZXRTaXplcyxcbiAgICAgICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzZXRTaXplczogc2V0U2l6ZXMsXG4gICAgICAgIGdldFNpemVzOiBmdW5jdGlvbiBnZXRTaXplcyAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7IHJldHVybiBlbGVtZW50LnNpemU7IH0pXG4gICAgICAgIH0sXG4gICAgICAgIGNvbGxhcHNlOiBmdW5jdGlvbiBjb2xsYXBzZSAoaSkge1xuICAgICAgICAgICAgaWYgKGkgPT09IHBhaXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaSAtIDFdO1xuXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlU2l6ZXMuY2FsbChwYWlyKTtcblxuICAgICAgICAgICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRqdXN0LmNhbGwocGFpciwgcGFpci5zaXplIC0gcGFpci5iR3V0dGVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFpciQxID0gcGFpcnNbaV07XG5cbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVTaXplcy5jYWxsKHBhaXIkMSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzSUU4KSB7XG4gICAgICAgICAgICAgICAgICAgIGFkanVzdC5jYWxsKHBhaXIkMSwgcGFpciQxLmFHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgfVxufTtcblxucmV0dXJuIFNwbGl0O1xuXG59KSkpO1xuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0UGFsZXR0ZShjb2xvclN0b3BzLCBudW1Db2xvcnMpIHtcblx0Y29uc3Qgb2Zmc2V0cyA9IFtdXG5cdGNvbnN0IHJlZHMgPSBbXVxuXHRjb25zdCBncmVlbnMgPSBbXVxuXHRjb25zdCBibHVlcyA9IFtdXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb2xvclN0b3BzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgY29sb3JTdG9wID0gY29sb3JTdG9wc1tpXVxuXG5cdFx0b2Zmc2V0cy5wdXNoKGNvbG9yU3RvcFswXSlcblxuXHRcdGNvbnN0IGhleENvbG9yID0gY29sb3JTdG9wWzFdXG5cdFx0cmVkcy5wdXNoKGhleENvbG9yID4+IDE2ICYgMjU1KVxuXHRcdGdyZWVucy5wdXNoKGhleENvbG9yID4+IDggJiAyNTUpXG5cdFx0Ymx1ZXMucHVzaChoZXhDb2xvciAmIDI1NSlcblx0fVxuXG5cdGNvbnN0IHJlZEludGVycG9sYW50ID0gY3JlYXRlSW50ZXJwb2xhbnQob2Zmc2V0cywgcmVkcylcblx0Y29uc3QgZ3JlZW5JbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIGdyZWVucylcblx0Y29uc3QgYmx1ZUludGVycG9sYW50ID0gY3JlYXRlSW50ZXJwb2xhbnQob2Zmc2V0cywgYmx1ZXMpXG5cblx0Y29uc3QgcGFsZXR0ZSA9IFtdXG5cdGNvbnN0IGluY3JlbWVudCA9IDEgLyBudW1Db2xvcnNcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDE7IGkgKz0gaW5jcmVtZW50KSB7XG5cdFx0cGFsZXR0ZS5wdXNoKHJlZEludGVycG9sYW50KGkpLCBncmVlbkludGVycG9sYW50KGkpLCBibHVlSW50ZXJwb2xhbnQoaSkpXG5cdH1cblxuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkocGFsZXR0ZSlcbn1cblxuLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTW9ub3RvbmVfY3ViaWNfaW50ZXJwb2xhdGlvblxuZnVuY3Rpb24gY3JlYXRlSW50ZXJwb2xhbnQoeHMsIHlzKSB7XG5cdGNvbnN0IGxlbmd0aCA9IHhzLmxlbmd0aFxuXG5cdC8vIERlYWwgd2l0aCBsZW5ndGggaXNzdWVzXG5cdGlmIChsZW5ndGggIT09IHlzLmxlbmd0aCkge1xuXHRcdHRocm93IFwiTmVlZCBhbiBlcXVhbCBjb3VudCBvZiB4cyBhbmQgeXMuXCJcblx0fVxuXHRpZiAobGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuICgpID0+IDBcblx0fVxuXHRpZiAobGVuZ3RoID09PSAxKSB7XG5cdFx0Ly8gSW1wbDogUHJlY29tcHV0aW5nIHRoZSByZXN1bHQgcHJldmVudHMgcHJvYmxlbXMgaWYgeXMgaXMgbXV0YXRlZCBsYXRlciBhbmQgYWxsb3dzIGdhcmJhZ2UgY29sbGVjdGlvbiBvZiB5c1xuXHRcdC8vIEltcGw6IFVuYXJ5IHBsdXMgcHJvcGVybHkgY29udmVydHMgdmFsdWVzIHRvIG51bWJlcnNcblx0XHRjb25zdCByZXN1bHQgPSAreXNbMF1cblx0XHRyZXR1cm4gKCkgPT4gcmVzdWx0XG5cdH1cblxuXHQvLyBSZWFycmFuZ2UgeHMgYW5kIHlzIHNvIHRoYXQgeHMgaXMgc29ydGVkXG5cdGNvbnN0IGluZGV4ZXMgPSBbXVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0aW5kZXhlcy5wdXNoKGkpXG5cdH1cblx0aW5kZXhlcy5zb3J0KChhLCBiKSA9PiB4c1thXSA8IHhzW2JdID8gLTEgOiAxKVxuXHRjb25zdCBvbGRYcyA9IHhzLFxuXHRcdG9sZFlzID0geXNcblx0Ly8gSW1wbDogQ3JlYXRpbmcgbmV3IGFycmF5cyBhbHNvIHByZXZlbnRzIHByb2JsZW1zIGlmIHRoZSBpbnB1dCBhcnJheXMgYXJlIG11dGF0ZWQgbGF0ZXJcblx0eHMgPSBbXVxuXHR5cyA9IFtdXG5cdC8vIEltcGw6IFVuYXJ5IHBsdXMgcHJvcGVybHkgY29udmVydHMgdmFsdWVzIHRvIG51bWJlcnNcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdHhzLnB1c2goK29sZFhzW2luZGV4ZXNbaV1dKVxuXHRcdHlzLnB1c2goK29sZFlzW2luZGV4ZXNbaV1dKVxuXHR9XG5cblx0Ly8gR2V0IGNvbnNlY3V0aXZlIGRpZmZlcmVuY2VzIGFuZCBzbG9wZXNcblx0Y29uc3QgZHlzID0gW10sXG5cdFx0ZHhzID0gW10sXG5cdFx0bXMgPSBbXVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aCAtIDE7IGkrKykge1xuXHRcdGNvbnN0IGR4ID0geHNbaSArIDFdIC0geHNbaV0sXG5cdFx0XHRkeSA9IHlzW2kgKyAxXSAtIHlzW2ldXG5cdFx0ZHhzLnB1c2goZHgpXG5cdFx0ZHlzLnB1c2goZHkpXG5cdFx0bXMucHVzaChkeSAvIGR4KVxuXHR9XG5cblx0Ly8gR2V0IGRlZ3JlZS0xIGNvZWZmaWNpZW50c1xuXHRjb25zdCBjMXMgPSBbbXNbMF1dXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZHhzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdGNvbnN0IG0gPSBtc1tpXSxcblx0XHRcdG1OZXh0ID0gbXNbaSArIDFdXG5cdFx0aWYgKG0gKiBtTmV4dCA8PSAwKSB7XG5cdFx0XHRjMXMucHVzaCgwKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkeF8gPSBkeHNbaV0sXG5cdFx0XHRcdGR4TmV4dCA9IGR4c1tpICsgMV0sXG5cdFx0XHRcdGNvbW1vbiA9IGR4XyArIGR4TmV4dFxuXHRcdFx0YzFzLnB1c2goMyAqIGNvbW1vbiAvICgoY29tbW9uICsgZHhOZXh0KSAvIG0gKyAoY29tbW9uICsgZHhfKSAvIG1OZXh0KSlcblx0XHR9XG5cdH1cblx0YzFzLnB1c2gobXNbbXMubGVuZ3RoIC0gMV0pXG5cblx0Ly8gR2V0IGRlZ3JlZS0yIGFuZCBkZWdyZWUtMyBjb2VmZmljaWVudHNcblx0Y29uc3QgYzJzID0gW10sXG5cdFx0YzNzID0gW11cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjMXMubGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0Y29uc3QgYzEgPSBjMXNbaV0sXG5cdFx0XHRtXyA9IG1zW2ldLFxuXHRcdFx0aW52RHggPSAxIC8gZHhzW2ldLFxuXHRcdFx0Y29tbW9uXyA9IGMxICsgYzFzW2kgKyAxXSAtIG1fIC0gbV9cblx0XHRjMnMucHVzaCgobV8gLSBjMSAtIGNvbW1vbl8pICogaW52RHgpXG5cdFx0YzNzLnB1c2goY29tbW9uXyAqIGludkR4ICogaW52RHgpXG5cdH1cblxuXHQvLyBSZXR1cm4gaW50ZXJwb2xhbnQgZnVuY3Rpb25cblx0cmV0dXJuIHggPT4ge1xuXHRcdC8vIFRoZSByaWdodG1vc3QgcG9pbnQgaW4gdGhlIGRhdGFzZXQgc2hvdWxkIGdpdmUgYW4gZXhhY3QgcmVzdWx0XG5cdFx0bGV0IGkgPSB4cy5sZW5ndGggLSAxXG5cdFx0aWYgKHggPT09IHhzW2ldKSB7XG5cdFx0XHRyZXR1cm4geXNbaV1cblx0XHR9XG5cblx0XHQvLyBTZWFyY2ggZm9yIHRoZSBpbnRlcnZhbCB4IGlzIGluLCByZXR1cm5pbmcgdGhlIGNvcnJlc3BvbmRpbmcgeSBpZiB4IGlzIG9uZSBvZiB0aGUgb3JpZ2luYWwgeHNcblx0XHRsZXQgbG93ID0gMCxcblx0XHRcdG1pZCwgaGlnaCA9IGMzcy5sZW5ndGggLSAxXG5cdFx0d2hpbGUgKGxvdyA8PSBoaWdoKSB7XG5cdFx0XHRtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpXG5cdFx0XHRjb25zdCB4SGVyZSA9IHhzW21pZF1cblx0XHRcdGlmICh4SGVyZSA8IHgpIHtcblx0XHRcdFx0bG93ID0gbWlkICsgMVxuXHRcdFx0fSBlbHNlIGlmICh4SGVyZSA+IHgpIHtcblx0XHRcdFx0aGlnaCA9IG1pZCAtIDFcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB5c1ttaWRdXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGkgPSBNYXRoLm1heCgwLCBoaWdoKVxuXG5cdFx0Ly8gSW50ZXJwb2xhdGVcblx0XHRjb25zdCBkaWZmID0geCAtIHhzW2ldLFxuXHRcdFx0ZGlmZlNxID0gZGlmZiAqIGRpZmZcblx0XHRyZXR1cm4geXNbaV0gKyBjMXNbaV0gKiBkaWZmICsgYzJzW2ldICogZGlmZlNxICsgYzNzW2ldICogZGlmZiAqIGRpZmZTcVxuXHR9XG59XG4iLCJpbXBvcnQgZ2V0UGFsZXR0ZSBmcm9tIFwiLi9jb2xvci1ncmFkaWVudC5qc1wiXG5pbXBvcnQge1xuXHRpbml0R2wsXG5cdGluaXRQcm9ncmFtLFxuXHRnZXRVbmlmb3Jtcyxcblx0aW5pdFRleHR1cmUsXG5cdHJlbmRlckdsXG59IGZyb20gXCIuL3dlYmdsLXV0aWxzLmpzXCJcbmltcG9ydCBTcGxpdCBmcm9tIFwic3BsaXQuanNcIlxuXG5jb25zdCAkd2luZG93ID0gJCh3aW5kb3cpXG5jb25zdCAkaHRtbCA9ICQoXCJodG1sXCIpXG5cbmNvbnN0ICRpdGVyYXRpb25UZXh0ID0gJChcIiNpdGVyYXRpb24tdGV4dFwiKVxuY29uc3QgJGpjb25zdGFudFRleHQgPSAkKFwiI2p1bGlhLWNvbnN0YW50LXRleHRcIilcblxuY29uc3QgJGNvbnRyb2xzRGlhbG9nID0gJChcIiNjb250cm9scy1kaWFsb2dcIilcbnNldFRpbWVvdXQoKCkgPT4ge1xuXHQkY29udHJvbHNEaWFsb2cuZGlhbG9nKHtcblx0XHR3aWR0aDogXCIyNWVtXCIsXG5cdFx0YnV0dG9uczogW3tcblx0XHRcdHRleHQ6IFwiR290IGl0IVwiLFxuXHRcdFx0Y2xpY2s6ICgpID0+IHtcblx0XHRcdFx0JGNvbnRyb2xzRGlhbG9nLmRpYWxvZyhcImNsb3NlXCIpXG5cdFx0XHR9XG5cdFx0fV0sXG5cdFx0c2hvdzogXCJzY2FsZVwiLFxuXHRcdGhpZGU6IFwicHVmZlwiXG5cdH0pLnRvb2x0aXAoKVxufSwgNTAwKVxuXG5jb25zdCBTQ1JPTExfQ09FRkYgPSAwLjA1XG5jb25zdCBaT09NX0NPRUZGID0gMS4xXG5cbmxldCBtYXhJdGVyYXRpb25zID0gMjAwXG5cbmNvbnN0IHBhbGV0dGUgPSBnZXRQYWxldHRlKFtcblx0WzAsIDB4MDAwMDAwXSxcblx0WzAuMSwgMHg0NDA4NDVdLFxuXHRbMC4yLCAweDdkMWE0OF0sXG5cdFswLjMsIDB4YzY2ZjM3XSxcblx0WzAuNCwgMHhmMGU5NTNdLFxuXHRbMC41LCAweGZmZmZmZl0sXG5cdFswLjYsIDB4OThlOTkxXSxcblx0WzAuNywgMHg1N2M5YWVdLFxuXHRbMC44LCAweDI0NWI5YV0sXG5cdFswLjksIDB4MDcxMTQ2XSxcblx0WzEsIDB4MDAwMDAwXVxuXSwgMjA0OClcblxuY29uc3QgTWFuZGVsYnJvdCA9IGluaXRGcmFjdGFsKFwiI21hbmRlbGJyb3QtY2FudmFzXCIsIHtcblx0cmVhbDoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IC0wLjcsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzXG5cdH0sXG5cdGltYWc6IHtcblx0XHRtaW46IG51bGwsXG5cdFx0bWlkOiAwLFxuXHRcdG1heDogbnVsbCxcblx0XHRyYW5nZTogMi40XG5cdH0sXG5cdG92ZXJDYW52YXM6IG51bGxcbn0pXG5cbmNvbnN0IEp1bGlhID0gaW5pdEZyYWN0YWwoXCIjanVsaWEtY2FudmFzXCIsIHtcblx0cmVhbDoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IDAsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzLjZcblx0fSxcblx0aW1hZzoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IDAsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzLjZcblx0fSxcblx0b3ZlckNhbnZhczogbnVsbFxufSwge1xuXHRyZWFsOiAtMC43Nyxcblx0aW1hZzogLTAuMDlcbn0pXG5cbmZ1bmN0aW9uIGluaXRGcmFjdGFsKGNhbnZhc1NlbGVjdG9yLCBib3VuZHMsIGpjb25zdGFudCkge1xuXHRjb25zdCBmcmFjdGFsID0ge31cblx0ZnJhY3RhbC4kY2FudmFzID0gJChjYW52YXNTZWxlY3Rvcilcblx0ZnJhY3RhbC5jYW52YXMgPSBmcmFjdGFsLiRjYW52YXNbMF1cblx0ZnJhY3RhbC5nbCA9IGluaXRHbChmcmFjdGFsKVxuXHRmcmFjdGFsLnByb2dyYW0gPSBpbml0UHJvZ3JhbShmcmFjdGFsKVxuXHRmcmFjdGFsLnVuaWZvcm1zID0gZ2V0VW5pZm9ybXMoZnJhY3RhbCwgW1xuXHRcdFwicmVhbE1pblwiLFxuXHRcdFwiaW1hZ01pblwiLFxuXHRcdFwibWF4SXRlcmF0aW9uc1wiLFxuXHRcdFwiaXNKdWxpYVwiLFxuXHRcdFwiamNvbnN0YW50XCIsXG5cdFx0XCJvdmVyQ2FudmFzXCIsXG5cdFx0XCJwYWxldHRlXCJcblx0XSlcblx0ZnJhY3RhbC5ib3VuZHMgPSBib3VuZHNcblx0aWYgKGpjb25zdGFudCkge1xuXHRcdGZyYWN0YWwuZ2wudW5pZm9ybTFpKGZyYWN0YWwudW5pZm9ybXMuaXNKdWxpYSwgdHJ1ZSlcblx0XHRmcmFjdGFsLmNvbnN0YW50ID0gamNvbnN0YW50XG5cdH1cblx0aW5pdFRleHR1cmUoZnJhY3RhbCwgcGFsZXR0ZSlcblx0ZnJhY3RhbC5nbC51bmlmb3JtMWkoZnJhY3RhbC51bmlmb3Jtcy5wYWxldHRlLCAwKVxuXHRyZXR1cm4gZnJhY3RhbFxufVxuXG5mdW5jdGlvbiB1cGRhdGVJdGVyYXRpb25UZXh0KCkge1xuXHQkaXRlcmF0aW9uVGV4dC50ZXh0KGBJdGVyYXRpb24gY291bnQgPSAke21heEl0ZXJhdGlvbnN9YClcbn1cbnVwZGF0ZUl0ZXJhdGlvblRleHQoKVxuXG5mdW5jdGlvbiB1cGRhdGVKQ29uc3RhbnRUZXh0KCkge1xuXHQkamNvbnN0YW50VGV4dC50ZXh0KGBTaG93aW5nIEp1bGlhIHNldCBmb3IgYyA9ICR7SnVsaWEuY29uc3RhbnQucmVhbH0gKyAke0p1bGlhLmNvbnN0YW50LmltYWd9aWApXG59XG51cGRhdGVKQ29uc3RhbnRUZXh0KClcblxuZnVuY3Rpb24gcmVzaXplQ2FudmFzKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Y2FudmFzLFxuXHRcdGdsXG5cdH0gPSBmcmFjdGFsXG5cblx0Y2FudmFzLndpZHRoID0gJGNhbnZhcy53aWR0aCgpXG5cdGNhbnZhcy5oZWlnaHQgPSAkY2FudmFzLmhlaWdodCgpXG5cdGdsLnZpZXdwb3J0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodClcblx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdHJlbmRlcihmcmFjdGFsKVxufVxuXG5mdW5jdGlvbiByZXNpemVDYW52YXNlcygpIHtcblx0cmVzaXplQ2FudmFzKE1hbmRlbGJyb3QpXG5cdHJlc2l6ZUNhbnZhcyhKdWxpYSlcbn1cbiQocmVzaXplQ2FudmFzZXMpXG4kd2luZG93LnJlc2l6ZShyZXNpemVDYW52YXNlcylcblxuU3BsaXQoW1wiI21hbmRlbGJyb3QtY2FudmFzLXdyYXBwZXJcIiwgXCIjanVsaWEtY2FudmFzLXdyYXBwZXJcIl0sIHtcblx0ZGlyZWN0aW9uOiBcImhvcml6b250YWxcIixcblx0Y3Vyc29yOiBcImNvbC1yZXNpemVcIixcblx0b25EcmFnOiByZXNpemVDYW52YXNlc1xufSlcblxuZnVuY3Rpb24gY2FsY3VsYXRlQm91bmRzKHtcblx0Y2FudmFzLFxuXHRib3VuZHNcbn0pIHtcblx0Ym91bmRzLnJlYWwucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMucmVhbC5yYW5nZSlcblx0Ym91bmRzLmltYWcucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMuaW1hZy5yYW5nZSlcblxuXHRjb25zdCBib3VuZHNSYXRpbyA9IGJvdW5kcy5yZWFsLnJhbmdlIC8gYm91bmRzLmltYWcucmFuZ2Vcblx0Y29uc3QgY2FudmFzUmF0aW8gPSBjYW52YXMud2lkdGggLyBjYW52YXMuaGVpZ2h0XG5cblx0aWYgKGJvdW5kc1JhdGlvIDwgY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLnJlYWwucmFuZ2UgPSBib3VuZHMuaW1hZy5yYW5nZSAqIGNhbnZhc1JhdGlvXG5cdGVsc2UgaWYgKGJvdW5kc1JhdGlvID4gY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLmltYWcucmFuZ2UgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhc1JhdGlvXG5cblx0Ym91bmRzLnJlYWwubWluID0gYm91bmRzLnJlYWwubWlkIC0gYm91bmRzLnJlYWwucmFuZ2UgLyAyXG5cdGJvdW5kcy5yZWFsLm1heCA9IGJvdW5kcy5yZWFsLm1pZCArIGJvdW5kcy5yZWFsLnJhbmdlIC8gMlxuXHRib3VuZHMuaW1hZy5taW4gPSBib3VuZHMuaW1hZy5taWQgLSBib3VuZHMuaW1hZy5yYW5nZSAvIDJcblx0Ym91bmRzLmltYWcubWF4ID0gYm91bmRzLmltYWcubWlkICsgYm91bmRzLmltYWcucmFuZ2UgLyAyXG5cblx0Ym91bmRzLm92ZXJDYW52YXMgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhcy53aWR0aFxufVxuXG5mdW5jdGlvbiByZW5kZXIoe1xuXHRnbCxcblx0dW5pZm9ybXMsXG5cdGJvdW5kcyxcblx0Y29uc3RhbnRcbn0pIHtcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLnJlYWxNaW4sIGJvdW5kcy5yZWFsLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLmltYWdNaW4sIGJvdW5kcy5pbWFnLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLm92ZXJDYW52YXMsIGJvdW5kcy5vdmVyQ2FudmFzKVxuXHRnbC51bmlmb3JtMWkodW5pZm9ybXMubWF4SXRlcmF0aW9ucywgbWF4SXRlcmF0aW9ucylcblx0aWYgKGNvbnN0YW50KVxuXHRcdGdsLnVuaWZvcm0yZih1bmlmb3Jtcy5qY29uc3RhbnQsIGNvbnN0YW50LnJlYWwsIGNvbnN0YW50LmltYWcpXG5cblx0cmVuZGVyR2woZ2wpXG59XG5cbmZ1bmN0aW9uIGdldFpGcm9tUGl4ZWwoe1xuXHRib3VuZHNcbn0sIHgsIHkpIHtcblx0cmV0dXJuIHtcblx0XHRyZWFsOiBib3VuZHMucmVhbC5taW4gKyB4ICogYm91bmRzLm92ZXJDYW52YXMsXG5cdFx0aW1hZzogYm91bmRzLmltYWcubWF4IC0geSAqIGJvdW5kcy5vdmVyQ2FudmFzXG5cdH1cbn1cblxuZnVuY3Rpb24gaW5pdEtleWRvd25Cb3VuZHMoZnJhY3RhbCkge1xuXHRjb25zdCB7XG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JHdpbmRvdy5rZXlkb3duKGV2dCA9PiB7XG5cdFx0c3dpdGNoIChldnQud2hpY2gpIHtcblx0XHRcdGNhc2UgMzg6IC8vIHVwXG5cdFx0XHRjYXNlIDg3OiAvLyB3XG5cdFx0XHRcdGlmIChldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5taWQgKz0gYm91bmRzLmltYWcucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMzc6IC8vIGxlZnRcblx0XHRcdGNhc2UgNjU6IC8vIGFcblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkIC09IGJvdW5kcy5yZWFsLnJhbmdlICogU0NST0xMX0NPRUZGXG5cdFx0XHRcdGJyZWFrXG5cblx0XHRcdGNhc2UgNDA6IC8vIGRvd25cblx0XHRcdGNhc2UgODM6IC8vIHNcblx0XHRcdFx0aWYgKGV2dC5zaGlmdEtleSkge1xuXHRcdFx0XHRcdGJvdW5kcy5yZWFsLnJhbmdlICo9IFpPT01fQ09FRkZcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBib3VuZHMuaW1hZy5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDM5OiAvLyByaWdodFxuXHRcdFx0Y2FzZSA2ODogLy8gZFxuXHRcdFx0XHRib3VuZHMucmVhbC5taWQgKz0gYm91bmRzLnJlYWwucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRyZW5kZXIoZnJhY3RhbClcblx0fSlcbn1cbmluaXRLZXlkb3duQm91bmRzKE1hbmRlbGJyb3QpXG5pbml0S2V5ZG93bkJvdW5kcyhKdWxpYSlcblxuZnVuY3Rpb24gaW5pdEtleWRvd25JdGVyYXRpb25zKCkge1xuXHQkd2luZG93LmtleWRvd24oZXZ0ID0+IHtcblx0XHRzd2l0Y2ggKGV2dC53aGljaCkge1xuXHRcdFx0Y2FzZSA0OTpcblx0XHRcdGNhc2UgNTA6XG5cdFx0XHRjYXNlIDUxOlxuXHRcdFx0Y2FzZSA1Mjpcblx0XHRcdGNhc2UgNTM6XG5cdFx0XHRjYXNlIDU0OlxuXHRcdFx0Y2FzZSA1NTpcblx0XHRcdGNhc2UgNTY6XG5cdFx0XHRjYXNlIDU3OiAvLyAxLTlcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyA9IDEwMCAqIE1hdGgucG93KDIsIGV2dC53aGljaCAtIDUxKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAxODk6IC8vIC1cblx0XHRcdFx0bWF4SXRlcmF0aW9ucyAtPSAxMDBcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyA9IE1hdGgubWF4KG1heEl0ZXJhdGlvbnMsIDApXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDE4NzogLy8gK1xuXHRcdFx0XHRtYXhJdGVyYXRpb25zICs9IDEwMFxuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHVwZGF0ZUl0ZXJhdGlvblRleHQoKVxuXHRcdHJlbmRlcihNYW5kZWxicm90KVxuXHRcdHJlbmRlcihKdWxpYSlcblx0fSlcbn1cbmluaXRLZXlkb3duSXRlcmF0aW9ucygpXG5cbmZ1bmN0aW9uIGluaXRNb3VzZURvd24oZnJhY3RhbCkge1xuXHRjb25zdCB7XG5cdFx0JGNhbnZhcyxcblx0XHRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5tb3VzZWRvd24oZG93bmV2dCA9PiB7XG5cdFx0ZG93bmV2dC5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRjb25zdCBvZmZzZXQgPSAkY2FudmFzLm9mZnNldCgpXG5cdFx0bGV0IHBtb3VzZVggPSBkb3duZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdGxldCBwbW91c2VZID0gZG93bmV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXG5cdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdEp1bGlhLmNvbnN0YW50ID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBwbW91c2VYLCBwbW91c2VZKVxuXHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRyZW5kZXIoSnVsaWEpXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxpYXNcIilcblx0XHR9IGVsc2Vcblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxsLXNjcm9sbFwiKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2Vtb3ZlKG1vdmVldnQpIHtcblx0XHRcdG1vdmVldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHRjb25zdCBtb3VzZVggPSBtb3ZlZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdFx0Y29uc3QgbW91c2VZID0gbW92ZWV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXHRcdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0SnVsaWEuY29uc3RhbnQgPSBtb3VzZVpcblx0XHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRcdHJlbmRlcihKdWxpYSlcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHBtb3VzZVogPSBnZXRaRnJvbVBpeGVsKGZyYWN0YWwsIHBtb3VzZVgsIHBtb3VzZVkpXG5cblx0XHRcdFx0cG1vdXNlWCA9IG1vdXNlWFxuXHRcdFx0XHRwbW91c2VZID0gbW91c2VZXG5cblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkICs9IHBtb3VzZVoucmVhbCAtIG1vdXNlWi5yZWFsXG5cdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCArPSBwbW91c2VaLmltYWcgLSBtb3VzZVouaW1hZ1xuXG5cdFx0XHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXHRcdFx0XHRyZW5kZXIoZnJhY3RhbClcblx0XHRcdH1cblx0XHR9XG5cdFx0JHdpbmRvdy5tb3VzZW1vdmUobW91c2Vtb3ZlKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2V1cCh1cGV2dCkge1xuXHRcdFx0dXBldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNlbW92ZVwiLCBtb3VzZW1vdmUpXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNldXBcIiwgbW91c2V1cClcblxuXHRcdFx0JGh0bWwucmVtb3ZlQ2xhc3MoXCJhbGlhcyBhbGwtc2Nyb2xsXCIpXG5cdFx0fVxuXHRcdCR3aW5kb3cubW91c2V1cChtb3VzZXVwKVxuXHR9KVxufVxuaW5pdE1vdXNlRG93bihNYW5kZWxicm90KVxuaW5pdE1vdXNlRG93bihKdWxpYSlcblxuZnVuY3Rpb24gaW5pdFdoZWVsKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5vbihcIndoZWVsXCIsIGV2dCA9PiB7XG5cdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcblxuXHRcdGNvbnN0IG9mZnNldCA9ICRjYW52YXMub2Zmc2V0KClcblx0XHRjb25zdCBtb3VzZVggPSBldnQuY2xpZW50WCAtIG9mZnNldC5sZWZ0XG5cdFx0Y29uc3QgbW91c2VZID0gZXZ0LmNsaWVudFkgLSBvZmZzZXQudG9wXG5cblx0XHRjb25zdCBkZWx0YVkgPSBldnQub3JpZ2luYWxFdmVudC5kZWx0YVlcblxuXHRcdGlmIChkZWx0YVkgPCAwKSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAvPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1pblwiKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1vdXRcIilcblx0XHR9XG5cblx0XHRjb25zdCBwbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXG5cdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGJvdW5kcy5yZWFsLm1pZCAtPSBtb3VzZVoucmVhbCAtIHBtb3VzZVoucmVhbFxuXHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBtb3VzZVouaW1hZyAtIHBtb3VzZVouaW1hZ1xuXG5cdFx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdFx0cmVuZGVyKGZyYWN0YWwpXG5cblx0XHRjbGVhclRpbWVvdXQoJC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIikpXG5cdFx0JC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIiwgc2V0VGltZW91dCgoKSA9PiAkaHRtbC5yZW1vdmVDbGFzcyhcInpvb20taW4gem9vbS1vdXRcIiksIDI1MCkpXG5cdH0pXG59XG5pbml0V2hlZWwoTWFuZGVsYnJvdClcbmluaXRXaGVlbChKdWxpYSlcbiIsImNvbnN0IHZlcnRleFNoYWRlclNvdXJjZSA9IGBcbmF0dHJpYnV0ZSB2ZWM0IHZlcnRleFBvc2l0aW9uO1xuXG52b2lkIG1haW4oKSB7XG5cdGdsX1Bvc2l0aW9uID0gdmVydGV4UG9zaXRpb247XG59XG5gXG5cbmNvbnN0IGZyYWdtZW50U2hhZGVyU291cmNlID0gYFxucHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xuXG51bmlmb3JtIGZsb2F0IHJlYWxNaW47XG51bmlmb3JtIGZsb2F0IGltYWdNaW47XG51bmlmb3JtIGZsb2F0IG92ZXJDYW52YXM7XG51bmlmb3JtIGludCBtYXhJdGVyYXRpb25zO1xuY29uc3QgZmxvYXQgQkFJTE9VVF9SQURJVVMgPSA0LjA7XG51bmlmb3JtIGJvb2wgaXNKdWxpYTtcbnVuaWZvcm0gdmVjMiBqY29uc3RhbnQ7XG51bmlmb3JtIHNhbXBsZXIyRCBwYWxldHRlO1xuY29uc3QgZmxvYXQgR1JBRElFTlRfU0NBTEUgPSAwLjAzMTI1O1xuXG52ZWM0IGdldEZyYWN0YWxDb2xvcih2ZWMyIHopIHtcblx0dmVjMiB6U3E7XG5cdHZlYzIgYztcblx0aWYgKGlzSnVsaWEpXG5cdFx0YyA9IGpjb25zdGFudDtcblx0ZWxzZVxuXHRcdGMgPSB6O1xuXG5cdGZvciAoaW50IGkgPSAwOyBpIDwgMTAwMDA7IGkrKykge1xuXHRcdHpTcSA9IHZlYzIoei54ICogei54LCB6LnkgKiB6LnkpO1xuXHRcdHogPSB2ZWMyKHpTcS54IC0gelNxLnkgKyBjLngsIDIuMCAqIHoueCAqIHoueSArIGMueSk7XG5cblx0XHRpZiAoelNxLnggKyB6U3EueSA+IEJBSUxPVVRfUkFESVVTKSB7XG5cdFx0XHRmb3IgKGludCBqID0gMDsgaiA8IDM7IGorKykge1xuXHRcdFx0XHR6U3EgPSB2ZWMyKHoueCAqIHoueCwgei55ICogei55KTtcblx0XHRcdFx0eiA9IHZlYzIoelNxLnggLSB6U3EueSwgMi4wICogei54ICogei55KSArIGM7XG5cdFx0XHR9XG5cblx0XHRcdGZsb2F0IG11ID0gZmxvYXQoaSkgKyAxLjAgLSBsb2cyKGxvZyh6U3EueCArIHpTcS55KSAvIDIuMCk7XG5cdFx0XHRyZXR1cm4gdGV4dHVyZTJEKHBhbGV0dGUsIHZlYzIobXUgKiBHUkFESUVOVF9TQ0FMRSwgMC4wKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGkgPiBtYXhJdGVyYXRpb25zKSByZXR1cm4gdmVjNCgwLCAwLCAwLCAxKTtcblx0fVxufVxuXG52b2lkIG1haW4oKSB7XG5cdGdsX0ZyYWdDb2xvciA9IGdldEZyYWN0YWxDb2xvcih2ZWMyKHJlYWxNaW4gKyBnbF9GcmFnQ29vcmQueCAqIG92ZXJDYW52YXMsIGltYWdNaW4gKyBnbF9GcmFnQ29vcmQueSAqIG92ZXJDYW52YXMpKTtcbn1cbmBcblxuY29uc3QgdmVydGljZXMgPSBbXG5cdFsxLCAxXSxcblx0WzEsIC0xXSxcblx0Wy0xLCAtMV0sXG5cdFstMSwgMV1cbl1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRHbCh7XG5cdGNhbnZhc1xufSkge1xuXHRjb25zdCBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIikgfHwgY2FudmFzLmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIilcblx0aWYgKCFnbCkge1xuXHRcdGFsZXJ0KFwiVW5hYmxlIHRvIGluaXRpYWxpemUgV2ViR0wuIFlvdXIgYnJvd3NlciBtYXkgbm90IHN1cHBvcnQgaXQuXCIpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXHRyZXR1cm4gZ2xcbn1cblxuZnVuY3Rpb24gZ2V0U2hhZGVyKGdsLCBuYW1lLCB0eXBlKSB7XG5cdGNvbnN0IHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcih0eXBlKVxuXG5cdGxldCBzb3VyY2Vcblx0aWYgKG5hbWUgPT09IFwiZnJhY3RhbC52ZXJ0XCIpIHtcblx0XHRzb3VyY2UgPSB2ZXJ0ZXhTaGFkZXJTb3VyY2Vcblx0fSBlbHNlIGlmIChuYW1lID09PSBcImZyYWN0YWwuZnJhZ1wiKSB7XG5cdFx0c291cmNlID0gZnJhZ21lbnRTaGFkZXJTb3VyY2Vcblx0fVxuXHRpZiAoIXNvdXJjZSkge1xuXHRcdGFsZXJ0KFwiQ291bGQgbm90IGZpbmQgc2hhZGVyIHNvdXJjZTogXCIgKyBuYW1lKVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXHRnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzb3VyY2UpXG5cdGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKVxuXG5cdGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG5cdFx0YWxlcnQoXCJBbiBlcnJvciBvY2N1cmVkIGNvbXBpbGluZyB0aGUgc2hhZGVyczogXCIgKyBnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXG5cdHJldHVybiBzaGFkZXJcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRQcm9ncmFtKHtcblx0Z2xcbn0pIHtcblx0Y29uc3QgdmVydGV4U2hhZGVyID0gZ2V0U2hhZGVyKGdsLCBcImZyYWN0YWwudmVydFwiLCBnbC5WRVJURVhfU0hBREVSKVxuXHRjb25zdCBmcmFnbWVudFNoYWRlciA9IGdldFNoYWRlcihnbCwgXCJmcmFjdGFsLmZyYWdcIiwgZ2wuRlJBR01FTlRfU0hBREVSKVxuXG5cdGNvbnN0IHByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKClcblx0Z2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIHZlcnRleFNoYWRlcilcblx0Z2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKVxuXHRnbC5saW5rUHJvZ3JhbShwcm9ncmFtKVxuXG5cdGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRhbGVydChcIlVuYWJsZSB0byBpbml0aWFsaXplIHRoZSBzaGFkZXIgcHJvZ3JhbTogXCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyhwcm9ncmFtKSlcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cblx0Z2wudXNlUHJvZ3JhbShwcm9ncmFtKVxuXG5cdGNvbnN0IHZlcnRleFBvc2l0aW9uQXR0cmliID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgXCJ2ZXJ0ZXhQb3NpdGlvblwiKVxuXHRnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheSh2ZXJ0ZXhQb3NpdGlvbkF0dHJpYilcblxuXHRjb25zdCB2ZXJ0aWNlc0J1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpXG5cdGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0aWNlc0J1ZmZlcilcblx0Z2wudmVydGV4QXR0cmliUG9pbnRlcih2ZXJ0ZXhQb3NpdGlvbkF0dHJpYiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKVxuXHRnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgbmV3IEZsb2F0MzJBcnJheSh2ZXJ0aWNlcy5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MuY29uY2F0KHZhbCkpKSwgZ2wuU1RBVElDX0RSQVcpXG5cblx0cmV0dXJuIHByb2dyYW1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaWZvcm1zKHtcblx0Z2wsXG5cdHByb2dyYW1cbn0sIG5hbWVzKSB7XG5cdGNvbnN0IHVuaWZvcm1zID0ge31cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IG5hbWUgPSBuYW1lc1tpXVxuXHRcdHVuaWZvcm1zW25hbWVdID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIG5hbWUpXG5cdH1cblx0cmV0dXJuIHVuaWZvcm1zXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0VGV4dHVyZSh7XG5cdGdsXG59LCBwYWxldHRlKSB7XG5cdGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKClcblx0Z2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSlcblx0Z2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0IsIHBhbGV0dGUubGVuZ3RoIC8gMywgMSwgMCwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBwYWxldHRlKVxuXHRnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVClcblx0Z2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpXG5cdHJldHVybiB0ZXh0dXJlXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJHbChnbCkge1xuXHRnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKVxuXHRnbC5kcmF3QXJyYXlzKGdsLlRSSUFOR0xFX0ZBTiwgMCwgdmVydGljZXMubGVuZ3RoKVxufVxuIl19
