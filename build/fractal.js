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
		reds.push((hexColor >> 16 & 255) / 255);
		greens.push((hexColor >> 8 & 255) / 255);
		blues.push((hexColor & 255) / 255);
	}

	var redInterpolant = createInterpolant(offsets, reds);
	var greenInterpolant = createInterpolant(offsets, greens);
	var blueInterpolant = createInterpolant(offsets, blues);

	var palette = [];
	var increment = 1 / numColors;

	for (var _i = 0; _i < 1; _i += increment) {
		palette.push(redInterpolant(_i), greenInterpolant(_i), blueInterpolant(_i), 255);
	}

	return palette;
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

$("#controls-dialog").dialog({
	show: "drop",
	hide: "drop",
	width: "25em",
	buttons: [{
		text: "Got it!",
		click: function click() {
			$(this).dialog("close");
		}
	}]
}).tooltip();

var SCROLL_COEFF = 0.05;
var ZOOM_COEFF = 1.1;

var maxIterations = 200;

var palette = (0, _colorGradient2.default)([[0, 0x000000], [0.1, 0x440845], [0.2, 0x7d1a48], [0.3, 0xc66f37], [0.4, 0xf0e953], [0.5, 0xffffff], [0.6, 0x98e991], [0.7, 0x57c9ae], [0.8, 0x245b9a], [0.9, 0x071146], [1, 0x000000]], 512);

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
	fractal.gl.uniform4fv(fractal.uniforms.palette, palette);
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
exports.renderGl = renderGl;
var vertexShaderSource = "\nattribute vec4 vertexPosition;\n\nvoid main() {\n\tgl_Position = vertexPosition;\n}\n";

var fragmentShaderSource = "\nprecision highp float;\n\nuniform float realMin;\nuniform float imagMin;\nuniform float overCanvas;\nuniform int maxIterations;\nconst float BAILOUT_RADIUS = 4.0;\nuniform bool isJulia;\nuniform vec2 jconstant;\nconst int NUM_COLORS = 512;\nuniform vec4 palette[NUM_COLORS];\nconst float GRADIENT_SCALE = float(NUM_COLORS) / 32.0;\n\nvec4 getFractalColor(vec2 z) {\n\tvec2 zSq;\n\tvec2 c;\n\tif (isJulia)\n\t\tc = jconstant;\n\telse\n\t\tc = z;\n\n\tfor (int i = 0; i < 10000; i++) {\n\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\tz = vec2(zSq.x - zSq.y + c.x, 2.0 * z.x * z.y + c.y);\n\n\t\tif (zSq.x + zSq.y > BAILOUT_RADIUS) {\n\t\t\tfor (int j = 0; j < 3; j++) {\n\t\t\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\t\t\tz = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;\n\t\t\t}\n\n\t\t\tfloat mu = float(i) + 1.0 - log2(log(zSq.x + zSq.y) / 2.0);\n\t\t\tint index = int(mod(mu * GRADIENT_SCALE, float(NUM_COLORS)));\n\n\t\t\tfor (int j = 0; j < NUM_COLORS; j++) {\n\t\t\t\tif (j == index) {\n\t\t\t\t\treturn palette[j];\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\n\t\tif (i > maxIterations) return vec4(0, 0, 0, 1);\n\t}\n}\n\nvoid main() {\n\tgl_FragColor = getFractalColor(vec2(realMin + gl_FragCoord.x * overCanvas, imagMin + gl_FragCoord.y * overCanvas));\n}\n";

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

function renderGl(gl) {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length);
}

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvc3BsaXQuanMvc3BsaXQuanMiLCJzcmMvY29sb3ItZ3JhZGllbnQuanMiLCJzcmMvZnJhY3RhbC5qcyIsInNyYy93ZWJnbC11dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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RyxHQUFHLFdBQXBHOztBQUVBLFFBQU8sT0FBUDtBQUNBOztBQUVNLFNBQVMsV0FBVCxRQUdKLEtBSEksRUFHRztBQUFBLEtBRlQsRUFFUyxTQUZULEVBRVM7QUFBQSxLQURULE9BQ1MsU0FEVCxPQUNTOztBQUNULEtBQU0sV0FBVyxFQUFqQjtBQUNBLE1BQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxNQUFNLE1BQTFCLEVBQWtDLEdBQWxDLEVBQXVDO0FBQ3RDLE1BQU0sT0FBTyxNQUFNLENBQU4sQ0FBYjtBQUNBLFdBQVMsSUFBVCxJQUFpQixHQUFHLGtCQUFILENBQXNCLE9BQXRCLEVBQStCLElBQS9CLENBQWpCO0FBQ0E7QUFDRCxRQUFPLFFBQVA7QUFDQTs7QUFFTSxTQUFTLFFBQVQsQ0FBa0IsRUFBbEIsRUFBc0I7QUFDNUIsSUFBRyxLQUFILENBQVMsR0FBRyxnQkFBWjtBQUNBLElBQUcsVUFBSCxDQUFjLEdBQUcsWUFBakIsRUFBK0IsQ0FBL0IsRUFBa0MsU0FBUyxNQUEzQztBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qISBTcGxpdC5qcyAtIHYxLjMuNSAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwuU3BsaXQgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbi8vIFRoZSBwcm9ncmFtbWluZyBnb2FscyBvZiBTcGxpdC5qcyBhcmUgdG8gZGVsaXZlciByZWFkYWJsZSwgdW5kZXJzdGFuZGFibGUgYW5kXG4vLyBtYWludGFpbmFibGUgY29kZSwgd2hpbGUgYXQgdGhlIHNhbWUgdGltZSBtYW51YWxseSBvcHRpbWl6aW5nIGZvciB0aW55IG1pbmlmaWVkIGZpbGUgc2l6ZSxcbi8vIGJyb3dzZXIgY29tcGF0aWJpbGl0eSB3aXRob3V0IGFkZGl0aW9uYWwgcmVxdWlyZW1lbnRzLCBncmFjZWZ1bCBmYWxsYmFjayAoSUU4IGlzIHN1cHBvcnRlZClcbi8vIGFuZCB2ZXJ5IGZldyBhc3N1bXB0aW9ucyBhYm91dCB0aGUgdXNlcidzIHBhZ2UgbGF5b3V0LlxudmFyIGdsb2JhbCA9IHdpbmRvdztcbnZhciBkb2N1bWVudCA9IGdsb2JhbC5kb2N1bWVudDtcblxuLy8gU2F2ZSBhIGNvdXBsZSBsb25nIGZ1bmN0aW9uIG5hbWVzIHRoYXQgYXJlIHVzZWQgZnJlcXVlbnRseS5cbi8vIFRoaXMgb3B0aW1pemF0aW9uIHNhdmVzIGFyb3VuZCA0MDAgYnl0ZXMuXG52YXIgYWRkRXZlbnRMaXN0ZW5lciA9ICdhZGRFdmVudExpc3RlbmVyJztcbnZhciByZW1vdmVFdmVudExpc3RlbmVyID0gJ3JlbW92ZUV2ZW50TGlzdGVuZXInO1xudmFyIGdldEJvdW5kaW5nQ2xpZW50UmVjdCA9ICdnZXRCb3VuZGluZ0NsaWVudFJlY3QnO1xudmFyIE5PT1AgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZTsgfTtcblxuLy8gRmlndXJlIG91dCBpZiB3ZSdyZSBpbiBJRTggb3Igbm90LiBJRTggd2lsbCBzdGlsbCByZW5kZXIgY29ycmVjdGx5LFxuLy8gYnV0IHdpbGwgYmUgc3RhdGljIGluc3RlYWQgb2YgZHJhZ2dhYmxlLlxudmFyIGlzSUU4ID0gZ2xvYmFsLmF0dGFjaEV2ZW50ICYmICFnbG9iYWxbYWRkRXZlbnRMaXN0ZW5lcl07XG5cbi8vIFRoaXMgbGlicmFyeSBvbmx5IG5lZWRzIHR3byBoZWxwZXIgZnVuY3Rpb25zOlxuLy9cbi8vIFRoZSBmaXJzdCBkZXRlcm1pbmVzIHdoaWNoIHByZWZpeGVzIG9mIENTUyBjYWxjIHdlIG5lZWQuXG4vLyBXZSBvbmx5IG5lZWQgdG8gZG8gdGhpcyBvbmNlIG9uIHN0YXJ0dXAsIHdoZW4gdGhpcyBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgY2FsbGVkLlxuLy9cbi8vIFRlc3RzIC13ZWJraXQsIC1tb3ogYW5kIC1vIHByZWZpeGVzLiBNb2RpZmllZCBmcm9tIFN0YWNrT3ZlcmZsb3c6XG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE2NjI1MTQwL2pzLWZlYXR1cmUtZGV0ZWN0aW9uLXRvLWRldGVjdC10aGUtdXNhZ2Utb2Ytd2Via2l0LWNhbGMtb3Zlci1jYWxjLzE2NjI1MTY3IzE2NjI1MTY3XG52YXIgY2FsYyA9IChbJycsICctd2Via2l0LScsICctbW96LScsICctby0nXS5maWx0ZXIoZnVuY3Rpb24gKHByZWZpeCkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGVsLnN0eWxlLmNzc1RleHQgPSBcIndpZHRoOlwiICsgcHJlZml4ICsgXCJjYWxjKDlweClcIjtcblxuICAgIHJldHVybiAoISFlbC5zdHlsZS5sZW5ndGgpXG59KS5zaGlmdCgpKSArIFwiY2FsY1wiO1xuXG4vLyBUaGUgc2Vjb25kIGhlbHBlciBmdW5jdGlvbiBhbGxvd3MgZWxlbWVudHMgYW5kIHN0cmluZyBzZWxlY3RvcnMgdG8gYmUgdXNlZFxuLy8gaW50ZXJjaGFuZ2VhYmx5LiBJbiBlaXRoZXIgY2FzZSBhbiBlbGVtZW50IGlzIHJldHVybmVkLiBUaGlzIGFsbG93cyB1cyB0b1xuLy8gZG8gYFNwbGl0KFtlbGVtMSwgZWxlbTJdKWAgYXMgd2VsbCBhcyBgU3BsaXQoWycjaWQxJywgJyNpZDInXSlgLlxudmFyIGVsZW1lbnRPclNlbGVjdG9yID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgfHwgZWwgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgfVxuXG4gICAgcmV0dXJuIGVsXG59O1xuXG4vLyBUaGUgbWFpbiBmdW5jdGlvbiB0byBpbml0aWFsaXplIGEgc3BsaXQuIFNwbGl0LmpzIHRoaW5rcyBhYm91dCBlYWNoIHBhaXJcbi8vIG9mIGVsZW1lbnRzIGFzIGFuIGluZGVwZW5kYW50IHBhaXIuIERyYWdnaW5nIHRoZSBndXR0ZXIgYmV0d2VlbiB0d28gZWxlbWVudHNcbi8vIG9ubHkgY2hhbmdlcyB0aGUgZGltZW5zaW9ucyBvZiBlbGVtZW50cyBpbiB0aGF0IHBhaXIuIFRoaXMgaXMga2V5IHRvIHVuZGVyc3RhbmRpbmdcbi8vIGhvdyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBvcGVyYXRlLCBzaW5jZSBlYWNoIGZ1bmN0aW9uIGlzIGJvdW5kIHRvIGEgcGFpci5cbi8vXG4vLyBBIHBhaXIgb2JqZWN0IGlzIHNoYXBlZCBsaWtlIHRoaXM6XG4vL1xuLy8ge1xuLy8gICAgIGE6IERPTSBlbGVtZW50LFxuLy8gICAgIGI6IERPTSBlbGVtZW50LFxuLy8gICAgIGFNaW46IE51bWJlcixcbi8vICAgICBiTWluOiBOdW1iZXIsXG4vLyAgICAgZHJhZ2dpbmc6IEJvb2xlYW4sXG4vLyAgICAgcGFyZW50OiBET00gZWxlbWVudCxcbi8vICAgICBpc0ZpcnN0OiBCb29sZWFuLFxuLy8gICAgIGlzTGFzdDogQm9vbGVhbixcbi8vICAgICBkaXJlY3Rpb246ICdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCdcbi8vIH1cbi8vXG4vLyBUaGUgYmFzaWMgc2VxdWVuY2U6XG4vL1xuLy8gMS4gU2V0IGRlZmF1bHRzIHRvIHNvbWV0aGluZyBzYW5lLiBgb3B0aW9uc2AgZG9lc24ndCBoYXZlIHRvIGJlIHBhc3NlZCBhdCBhbGwuXG4vLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbi8vICAgIEEgbG90IG9mIHRoZSBiZWhhdmlvciBpbiB0aGUgcmVzdCBvZiB0aGUgbGlicmFyeSBpcyBwYXJhbWF0aXplZCBkb3duIHRvXG4vLyAgICByZWx5IG9uIENTUyBzdHJpbmdzIGFuZCBjbGFzc2VzLlxuLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4vLyA0LiBMb29wIHRocm91Z2ggdGhlIGVsZW1lbnRzIHdoaWxlIHBhaXJpbmcgdGhlbSBvZmYuIEV2ZXJ5IHBhaXIgZ2V0cyBhblxuLy8gICAgYHBhaXJgIG9iamVjdCwgYSBndXR0ZXIsIGFuZCBzcGVjaWFsIGlzRmlyc3QvaXNMYXN0IHByb3BlcnRpZXMuXG4vLyA1LiBBY3R1YWxseSBzaXplIHRoZSBwYWlyIGVsZW1lbnRzLCBpbnNlcnQgZ3V0dGVycyBhbmQgYXR0YWNoIGV2ZW50IGxpc3RlbmVycy5cbnZhciBTcGxpdCA9IGZ1bmN0aW9uIChpZHMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIG9wdGlvbnMgPT09IHZvaWQgMCApIG9wdGlvbnMgPSB7fTtcblxuICAgIHZhciBkaW1lbnNpb247XG4gICAgdmFyIGNsaWVudERpbWVuc2lvbjtcbiAgICB2YXIgY2xpZW50QXhpcztcbiAgICB2YXIgcG9zaXRpb247XG4gICAgdmFyIHBhZGRpbmdBO1xuICAgIHZhciBwYWRkaW5nQjtcbiAgICB2YXIgZWxlbWVudHM7XG5cbiAgICAvLyBBbGwgRE9NIGVsZW1lbnRzIGluIHRoZSBzcGxpdCBzaG91bGQgaGF2ZSBhIGNvbW1vbiBwYXJlbnQuIFdlIGNhbiBncmFiXG4gICAgLy8gdGhlIGZpcnN0IGVsZW1lbnRzIHBhcmVudCBhbmQgaG9wZSB1c2VycyByZWFkIHRoZSBkb2NzIGJlY2F1c2UgdGhlXG4gICAgLy8gYmVoYXZpb3Igd2lsbCBiZSB3aGFja3kgb3RoZXJ3aXNlLlxuICAgIHZhciBwYXJlbnQgPSBlbGVtZW50T3JTZWxlY3RvcihpZHNbMF0pLnBhcmVudE5vZGU7XG4gICAgdmFyIHBhcmVudEZsZXhEaXJlY3Rpb24gPSBnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpLmZsZXhEaXJlY3Rpb247XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBvcHRpb25zLnNpemVzIHRvIGVxdWFsIHBlcmNlbnRhZ2VzIG9mIHRoZSBwYXJlbnQgZWxlbWVudC5cbiAgICB2YXIgc2l6ZXMgPSBvcHRpb25zLnNpemVzIHx8IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gMTAwIC8gaWRzLmxlbmd0aDsgfSk7XG5cbiAgICAvLyBTdGFuZGFyZGl6ZSBtaW5TaXplIHRvIGFuIGFycmF5IGlmIGl0IGlzbid0IGFscmVhZHkuIFRoaXMgYWxsb3dzIG1pblNpemVcbiAgICAvLyB0byBiZSBwYXNzZWQgYXMgYSBudW1iZXIuXG4gICAgdmFyIG1pblNpemUgPSBvcHRpb25zLm1pblNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubWluU2l6ZSA6IDEwMDtcbiAgICB2YXIgbWluU2l6ZXMgPSBBcnJheS5pc0FycmF5KG1pblNpemUpID8gbWluU2l6ZSA6IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gbWluU2l6ZTsgfSk7XG4gICAgdmFyIGd1dHRlclNpemUgPSBvcHRpb25zLmd1dHRlclNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3V0dGVyU2l6ZSA6IDEwO1xuICAgIHZhciBzbmFwT2Zmc2V0ID0gb3B0aW9ucy5zbmFwT2Zmc2V0ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNuYXBPZmZzZXQgOiAzMDtcbiAgICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5kaXJlY3Rpb24gfHwgJ2hvcml6b250YWwnO1xuICAgIHZhciBjdXJzb3IgPSBvcHRpb25zLmN1cnNvciB8fCAoZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAnZXctcmVzaXplJyA6ICducy1yZXNpemUnKTtcbiAgICB2YXIgZ3V0dGVyID0gb3B0aW9ucy5ndXR0ZXIgfHwgKGZ1bmN0aW9uIChpLCBndXR0ZXJEaXJlY3Rpb24pIHtcbiAgICAgICAgdmFyIGd1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBndXQuY2xhc3NOYW1lID0gXCJndXR0ZXIgZ3V0dGVyLVwiICsgZ3V0dGVyRGlyZWN0aW9uO1xuICAgICAgICByZXR1cm4gZ3V0XG4gICAgfSk7XG4gICAgdmFyIGVsZW1lbnRTdHlsZSA9IG9wdGlvbnMuZWxlbWVudFN0eWxlIHx8IChmdW5jdGlvbiAoZGltLCBzaXplLCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ3N0cmluZycgJiYgIShzaXplIGluc3RhbmNlb2YgU3RyaW5nKSkge1xuICAgICAgICAgICAgaWYgKCFpc0lFOCkge1xuICAgICAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBjYWxjICsgXCIoXCIgKyBzaXplICsgXCIlIC0gXCIgKyBndXRTaXplICsgXCJweClcIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3R5bGVbZGltXSA9IHNpemUgKyBcIiVcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBzaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0eWxlXG4gICAgfSk7XG4gICAgdmFyIGd1dHRlclN0eWxlID0gb3B0aW9ucy5ndXR0ZXJTdHlsZSB8fCAoZnVuY3Rpb24gKGRpbSwgZ3V0U2l6ZSkgeyByZXR1cm4gKCggb2JqID0ge30sIG9ialtkaW1dID0gKGd1dFNpemUgKyBcInB4XCIpLCBvYmogKSlcbiAgICAgICAgdmFyIG9iajsgfSk7XG5cbiAgICAvLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbiAgICAvLyBBIGxvdCBvZiB0aGUgYmVoYXZpb3IgaW4gdGhlIHJlc3Qgb2YgdGhlIGxpYnJhcnkgaXMgcGFyYW1hdGl6ZWQgZG93biB0b1xuICAgIC8vIHJlbHkgb24gQ1NTIHN0cmluZ3MgYW5kIGNsYXNzZXMuXG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgIGRpbWVuc2lvbiA9ICd3aWR0aCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRXaWR0aCc7XG4gICAgICAgIGNsaWVudEF4aXMgPSAnY2xpZW50WCc7XG4gICAgICAgIHBvc2l0aW9uID0gJ2xlZnQnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nTGVmdCc7XG4gICAgICAgIHBhZGRpbmdCID0gJ3BhZGRpbmdSaWdodCc7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgZGltZW5zaW9uID0gJ2hlaWdodCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRIZWlnaHQnO1xuICAgICAgICBjbGllbnRBeGlzID0gJ2NsaWVudFknO1xuICAgICAgICBwb3NpdGlvbiA9ICd0b3AnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nVG9wJztcbiAgICAgICAgcGFkZGluZ0IgPSAncGFkZGluZ0JvdHRvbSc7XG4gICAgfVxuXG4gICAgLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4gICAgLy8gRWFjaCBoZWxwZXIgaXMgYm91bmQgdG8gYSBwYWlyIG9iamVjdCB0aGF0IGNvbnRhaW5zIGl0J3MgbWV0YWRhdGEuIFRoaXNcbiAgICAvLyBhbHNvIG1ha2VzIGl0IGVhc3kgdG8gc3RvcmUgcmVmZXJlbmNlcyB0byBsaXN0ZW5lcnMgdGhhdCB0aGF0IHdpbGwgYmVcbiAgICAvLyBhZGRlZCBhbmQgcmVtb3ZlZC5cbiAgICAvL1xuICAgIC8vIEV2ZW4gdGhvdWdoIHRoZXJlIGFyZSBubyBvdGhlciBmdW5jdGlvbnMgY29udGFpbmVkIGluIHRoZW0sIGFsaWFzaW5nXG4gICAgLy8gdGhpcyB0byBzZWxmIHNhdmVzIDUwIGJ5dGVzIG9yIHNvIHNpbmNlIGl0J3MgdXNlZCBzbyBmcmVxdWVudGx5LlxuICAgIC8vXG4gICAgLy8gVGhlIHBhaXIgb2JqZWN0IHNhdmVzIG1ldGFkYXRhIGxpa2UgZHJhZ2dpbmcgc3RhdGUsIHBvc2l0aW9uIGFuZFxuICAgIC8vIGV2ZW50IGxpc3RlbmVyIHJlZmVyZW5jZXMuXG5cbiAgICBmdW5jdGlvbiBzZXRFbGVtZW50U2l6ZSAoZWwsIHNpemUsIGd1dFNpemUpIHtcbiAgICAgICAgLy8gU3BsaXQuanMgYWxsb3dzIHNldHRpbmcgc2l6ZXMgdmlhIG51bWJlcnMgKGlkZWFsbHkpLCBvciBpZiB5b3UgbXVzdCxcbiAgICAgICAgLy8gYnkgc3RyaW5nLCBsaWtlICczMDBweCcuIFRoaXMgaXMgbGVzcyB0aGFuIGlkZWFsLCBiZWNhdXNlIGl0IGJyZWFrc1xuICAgICAgICAvLyB0aGUgZmx1aWQgbGF5b3V0IHRoYXQgYGNhbGMoJSAtIHB4KWAgcHJvdmlkZXMuIFlvdSdyZSBvbiB5b3VyIG93biBpZiB5b3UgZG8gdGhhdCxcbiAgICAgICAgLy8gbWFrZSBzdXJlIHlvdSBjYWxjdWxhdGUgdGhlIGd1dHRlciBzaXplIGJ5IGhhbmQuXG4gICAgICAgIHZhciBzdHlsZSA9IGVsZW1lbnRTdHlsZShkaW1lbnNpb24sIHNpemUsIGd1dFNpemUpO1xuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgICAgICBPYmplY3Qua2V5cyhzdHlsZSkuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkgeyByZXR1cm4gKGVsLnN0eWxlW3Byb3BdID0gc3R5bGVbcHJvcF0pOyB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRHdXR0ZXJTaXplIChndXR0ZXJFbGVtZW50LCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IGd1dHRlclN0eWxlKGRpbWVuc2lvbiwgZ3V0U2l6ZSk7XG5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICAgIE9iamVjdC5rZXlzKHN0eWxlKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7IHJldHVybiAoZ3V0dGVyRWxlbWVudC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTsgfSk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgYWRqdXN0IHRoZSBzaXplIG9mIGVsZW1lbnRzIGBhYCBhbmQgYGJgIHRvIGBvZmZzZXRgIHdoaWxlIGRyYWdnaW5nLlxuICAgIC8vIGNhbGMgaXMgdXNlZCB0byBhbGxvdyBjYWxjKHBlcmNlbnRhZ2UgKyBndXR0ZXJweCkgb24gdGhlIHdob2xlIHNwbGl0IGluc3RhbmNlLFxuICAgIC8vIHdoaWNoIGFsbG93cyB0aGUgdmlld3BvcnQgdG8gYmUgcmVzaXplZCB3aXRob3V0IGFkZGl0aW9uYWwgbG9naWMuXG4gICAgLy8gRWxlbWVudCBhJ3Mgc2l6ZSBpcyB0aGUgc2FtZSBhcyBvZmZzZXQuIGIncyBzaXplIGlzIHRvdGFsIHNpemUgLSBhIHNpemUuXG4gICAgLy8gQm90aCBzaXplcyBhcmUgY2FsY3VsYXRlZCBmcm9tIHRoZSBpbml0aWFsIHBhcmVudCBwZXJjZW50YWdlLFxuICAgIC8vIHRoZW4gdGhlIGd1dHRlciBzaXplIGlzIHN1YnRyYWN0ZWQuXG4gICAgZnVuY3Rpb24gYWRqdXN0IChvZmZzZXQpIHtcbiAgICAgICAgdmFyIGEgPSBlbGVtZW50c1t0aGlzLmFdO1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3RoaXMuYl07XG4gICAgICAgIHZhciBwZXJjZW50YWdlID0gYS5zaXplICsgYi5zaXplO1xuXG4gICAgICAgIGEuc2l6ZSA9IChvZmZzZXQgLyB0aGlzLnNpemUpICogcGVyY2VudGFnZTtcbiAgICAgICAgYi5zaXplID0gKHBlcmNlbnRhZ2UgLSAoKG9mZnNldCAvIHRoaXMuc2l6ZSkgKiBwZXJjZW50YWdlKSk7XG5cbiAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHRoaXMuYUd1dHRlclNpemUpO1xuICAgICAgICBzZXRFbGVtZW50U2l6ZShiLmVsZW1lbnQsIGIuc2l6ZSwgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgfVxuXG4gICAgLy8gZHJhZywgd2hlcmUgYWxsIHRoZSBtYWdpYyBoYXBwZW5zLiBUaGUgbG9naWMgaXMgcmVhbGx5IHF1aXRlIHNpbXBsZTpcbiAgICAvL1xuICAgIC8vIDEuIElnbm9yZSBpZiB0aGUgcGFpciBpcyBub3QgZHJhZ2dpbmcuXG4gICAgLy8gMi4gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50LlxuICAgIC8vIDMuIFNuYXAgb2Zmc2V0IHRvIG1pbiBpZiB3aXRoaW4gc25hcHBhYmxlIHJhbmdlICh3aXRoaW4gbWluICsgc25hcE9mZnNldCkuXG4gICAgLy8gNC4gQWN0dWFsbHkgYWRqdXN0IGVhY2ggZWxlbWVudCBpbiB0aGUgcGFpciB0byBvZmZzZXQuXG4gICAgLy9cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgIHwgPC0gYS5taW5TaXplICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgIGIubWluU2l6ZSAtPiB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgPC0gdGhpcy5zbmFwT2Zmc2V0ICAgICAgfHwgICAgIHRoaXMuc25hcE9mZnNldCAtPiB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8IDwtIHRoaXMuc3RhcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplIC0+IHxcbiAgICBmdW5jdGlvbiBkcmFnIChlKSB7XG4gICAgICAgIHZhciBvZmZzZXQ7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRyYWdnaW5nKSB7IHJldHVybiB9XG5cbiAgICAgICAgLy8gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50IGZyb20gdGhlIGZpcnN0IHNpZGUgb2YgdGhlXG4gICAgICAgIC8vIHBhaXIgYHRoaXMuc3RhcnRgLiBTdXBwb3J0cyB0b3VjaCBldmVudHMsIGJ1dCBub3QgbXVsdGl0b3VjaCwgc28gb25seSB0aGUgZmlyc3RcbiAgICAgICAgLy8gZmluZ2VyIGB0b3VjaGVzWzBdYCBpcyBjb3VudGVkLlxuICAgICAgICBpZiAoJ3RvdWNoZXMnIGluIGUpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IGUudG91Y2hlc1swXVtjbGllbnRBeGlzXSAtIHRoaXMuc3RhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlW2NsaWVudEF4aXNdIC0gdGhpcy5zdGFydDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdpdGhpbiBzbmFwT2Zmc2V0IG9mIG1pbiBvciBtYXgsIHNldCBvZmZzZXQgdG8gbWluIG9yIG1heC5cbiAgICAgICAgLy8gc25hcE9mZnNldCBidWZmZXJzIGEubWluU2l6ZSBhbmQgYi5taW5TaXplLCBzbyBsb2dpYyBpcyBvcHBvc2l0ZSBmb3IgYm90aC5cbiAgICAgICAgLy8gSW5jbHVkZSB0aGUgYXBwcm9wcmlhdGUgZ3V0dGVyIHNpemVzIHRvIHByZXZlbnQgb3ZlcmZsb3dzLlxuICAgICAgICBpZiAob2Zmc2V0IDw9IGVsZW1lbnRzW3RoaXMuYV0ubWluU2l6ZSArIHNuYXBPZmZzZXQgKyB0aGlzLmFHdXR0ZXJTaXplKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlbGVtZW50c1t0aGlzLmFdLm1pblNpemUgKyB0aGlzLmFHdXR0ZXJTaXplO1xuICAgICAgICB9IGVsc2UgaWYgKG9mZnNldCA+PSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgc25hcE9mZnNldCArIHRoaXMuYkd1dHRlclNpemUpKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBY3R1YWxseSBhZGp1c3QgdGhlIHNpemUuXG4gICAgICAgIGFkanVzdC5jYWxsKHRoaXMsIG9mZnNldCk7XG5cbiAgICAgICAgLy8gQ2FsbCB0aGUgZHJhZyBjYWxsYmFjayBjb250aW5vdXNseS4gRG9uJ3QgZG8gYW55dGhpbmcgdG9vIGludGVuc2l2ZVxuICAgICAgICAvLyBpbiB0aGlzIGNhbGxiYWNrLlxuICAgICAgICBpZiAob3B0aW9ucy5vbkRyYWcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWNoZSBzb21lIGltcG9ydGFudCBzaXplcyB3aGVuIGRyYWcgc3RhcnRzLCBzbyB3ZSBkb24ndCBoYXZlIHRvIGRvIHRoYXRcbiAgICAvLyBjb250aW5vdXNseTpcbiAgICAvL1xuICAgIC8vIGBzaXplYDogVGhlIHRvdGFsIHNpemUgb2YgdGhlIHBhaXIuIEZpcnN0ICsgc2Vjb25kICsgZmlyc3QgZ3V0dGVyICsgc2Vjb25kIGd1dHRlci5cbiAgICAvLyBgc3RhcnRgOiBUaGUgbGVhZGluZyBzaWRlIG9mIHRoZSBmaXJzdCBlbGVtZW50LlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCAgICAgIGFHdXR0ZXJTaXplIC0+IHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCA8LSBiR3V0dGVyU2l6ZSAgICAgICB8XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCA8LSBzdGFydCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZSAtPiB8XG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlU2l6ZXMgKCkge1xuICAgICAgICAvLyBGaWd1cmUgb3V0IHRoZSBwYXJlbnQgc2l6ZSBtaW51cyBwYWRkaW5nLlxuICAgICAgICB2YXIgYSA9IGVsZW1lbnRzW3RoaXMuYV0uZWxlbWVudDtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1t0aGlzLmJdLmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5zaXplID0gYVtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXSArIGJbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl0gKyB0aGlzLmFHdXR0ZXJTaXplICsgdGhpcy5iR3V0dGVyU2l6ZTtcbiAgICAgICAgdGhpcy5zdGFydCA9IGFbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW3Bvc2l0aW9uXTtcbiAgICB9XG5cbiAgICAvLyBzdG9wRHJhZ2dpbmcgaXMgdmVyeSBzaW1pbGFyIHRvIHN0YXJ0RHJhZ2dpbmcgaW4gcmV2ZXJzZS5cbiAgICBmdW5jdGlvbiBzdG9wRHJhZ2dpbmcgKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICBpZiAoc2VsZi5kcmFnZ2luZyAmJiBvcHRpb25zLm9uRHJhZ0VuZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5vbkRyYWdFbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZHJhZ2dpbmcgPSBmYWxzZTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHN0b3JlZCBldmVudCBsaXN0ZW5lcnMuIFRoaXMgaXMgd2h5IHdlIHN0b3JlIHRoZW0uXG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2V1cCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuICAgICAgICBnbG9iYWxbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoY2FuY2VsJywgc2VsZi5zdG9wKTtcblxuICAgICAgICBzZWxmLnBhcmVudFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2Vtb3ZlJywgc2VsZi5tb3ZlKTtcbiAgICAgICAgc2VsZi5wYXJlbnRbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cbiAgICAgICAgLy8gRGVsZXRlIHRoZW0gb25jZSB0aGV5IGFyZSByZW1vdmVkLiBJIHRoaW5rIHRoaXMgbWFrZXMgYSBkaWZmZXJlbmNlXG4gICAgICAgIC8vIGluIG1lbW9yeSB1c2FnZSB3aXRoIGEgbG90IG9mIHNwbGl0cyBvbiBvbmUgcGFnZS4gQnV0IEkgZG9uJ3Qga25vdyBmb3Igc3VyZS5cbiAgICAgICAgZGVsZXRlIHNlbGYuc3RvcDtcbiAgICAgICAgZGVsZXRlIHNlbGYubW92ZTtcblxuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdzZWxlY3RzdGFydCcsIE5PT1ApO1xuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG5cbiAgICAgICAgYS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGEuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgYi5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBiLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgICAgIHNlbGYucGFyZW50LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIH1cblxuICAgIC8vIHN0YXJ0RHJhZ2dpbmcgY2FsbHMgYGNhbGN1bGF0ZVNpemVzYCB0byBzdG9yZSB0aGUgaW5pdGFsIHNpemUgaW4gdGhlIHBhaXIgb2JqZWN0LlxuICAgIC8vIEl0IGFsc28gYWRkcyBldmVudCBsaXN0ZW5lcnMgZm9yIG1vdXNlL3RvdWNoIGV2ZW50cyxcbiAgICAvLyBhbmQgcHJldmVudHMgc2VsZWN0aW9uIHdoaWxlIGRyYWdnaW5nIHNvIGF2b2lkIHRoZSBzZWxlY3RpbmcgdGV4dC5cbiAgICBmdW5jdGlvbiBzdGFydERyYWdnaW5nIChlKSB7XG4gICAgICAgIC8vIEFsaWFzIGZyZXF1ZW50bHkgdXNlZCB2YXJpYWJsZXMgdG8gc2F2ZSBzcGFjZS4gMjAwIGJ5dGVzLlxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICAvLyBDYWxsIHRoZSBvbkRyYWdTdGFydCBjYWxsYmFjay5cbiAgICAgICAgaWYgKCFzZWxmLmRyYWdnaW5nICYmIG9wdGlvbnMub25EcmFnU3RhcnQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnU3RhcnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvbid0IGFjdHVhbGx5IGRyYWcgdGhlIGVsZW1lbnQuIFdlIGVtdWxhdGUgdGhhdCBpbiB0aGUgZHJhZyBmdW5jdGlvbi5cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIC8vIFNldCB0aGUgZHJhZ2dpbmcgcHJvcGVydHkgb2YgdGhlIHBhaXIgb2JqZWN0LlxuICAgICAgICBzZWxmLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBDcmVhdGUgdHdvIGV2ZW50IGxpc3RlbmVycyBib3VuZCB0byB0aGUgc2FtZSBwYWlyIG9iamVjdCBhbmQgc3RvcmVcbiAgICAgICAgLy8gdGhlbSBpbiB0aGUgcGFpciBvYmplY3QuXG4gICAgICAgIHNlbGYubW92ZSA9IGRyYWcuYmluZChzZWxmKTtcbiAgICAgICAgc2VsZi5zdG9wID0gc3RvcERyYWdnaW5nLmJpbmQoc2VsZik7XG5cbiAgICAgICAgLy8gQWxsIHRoZSBiaW5kaW5nLiBgd2luZG93YCBnZXRzIHRoZSBzdG9wIGV2ZW50cyBpbiBjYXNlIHdlIGRyYWcgb3V0IG9mIHRoZSBlbGVtZW50cy5cbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZXVwJywgc2VsZi5zdG9wKTtcbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCd0b3VjaGVuZCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hjYW5jZWwnLCBzZWxmLnN0b3ApO1xuXG4gICAgICAgIHNlbGYucGFyZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZW1vdmUnLCBzZWxmLm1vdmUpO1xuICAgICAgICBzZWxmLnBhcmVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2htb3ZlJywgc2VsZi5tb3ZlKTtcblxuICAgICAgICAvLyBEaXNhYmxlIHNlbGVjdGlvbi4gRGlzYWJsZSFcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXG4gICAgICAgIGEuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYS5zdHlsZS53ZWJraXRVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGEuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblxuICAgICAgICBiLnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYi5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBiLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBjdXJzb3IsIGJvdGggb24gdGhlIGd1dHRlciBhbmQgdGhlIHBhcmVudCBlbGVtZW50LlxuICAgICAgICAvLyBEb2luZyBvbmx5IGEsIGIgYW5kIGd1dHRlciBjYXVzZXMgZmxpY2tlcmluZy5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gY3Vyc29yO1xuICAgICAgICBzZWxmLnBhcmVudC5zdHlsZS5jdXJzb3IgPSBjdXJzb3I7XG5cbiAgICAgICAgLy8gQ2FjaGUgdGhlIGluaXRpYWwgc2l6ZXMgb2YgdGhlIHBhaXIuXG4gICAgICAgIGNhbGN1bGF0ZVNpemVzLmNhbGwoc2VsZik7XG4gICAgfVxuXG4gICAgLy8gNS4gQ3JlYXRlIHBhaXIgYW5kIGVsZW1lbnQgb2JqZWN0cy4gRWFjaCBwYWlyIGhhcyBhbiBpbmRleCByZWZlcmVuY2UgdG9cbiAgICAvLyBlbGVtZW50cyBgYWAgYW5kIGBiYCBvZiB0aGUgcGFpciAoZmlyc3QgYW5kIHNlY29uZCBlbGVtZW50cykuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBlbGVtZW50cyB3aGlsZSBwYWlyaW5nIHRoZW0gb2ZmLiBFdmVyeSBwYWlyIGdldHMgYVxuICAgIC8vIGBwYWlyYCBvYmplY3QsIGEgZ3V0dGVyLCBhbmQgaXNGaXJzdC9pc0xhc3QgcHJvcGVydGllcy5cbiAgICAvL1xuICAgIC8vIEJhc2ljIGxvZ2ljOlxuICAgIC8vXG4gICAgLy8gLSBTdGFydGluZyB3aXRoIHRoZSBzZWNvbmQgZWxlbWVudCBgaSA+IDBgLCBjcmVhdGUgYHBhaXJgIG9iamVjdHMgd2l0aFxuICAgIC8vICAgYGEgPSBpIC0gMWAgYW5kIGBiID0gaWBcbiAgICAvLyAtIFNldCBndXR0ZXIgc2l6ZXMgYmFzZWQgb24gdGhlIF9wYWlyXyBiZWluZyBmaXJzdC9sYXN0LiBUaGUgZmlyc3QgYW5kIGxhc3RcbiAgICAvLyAgIHBhaXIgaGF2ZSBndXR0ZXJTaXplIC8gMiwgc2luY2UgdGhleSBvbmx5IGhhdmUgb25lIGhhbGYgZ3V0dGVyLCBhbmQgbm90IHR3by5cbiAgICAvLyAtIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgYW5kIGFkZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgLy8gLSBTZXQgdGhlIHNpemUgb2YgdGhlIGVsZW1lbnRzLCBtaW51cyB0aGUgZ3V0dGVyIHNpemVzLlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgICBpPTAgICAgIHwgICAgICAgICBpPTEgICAgICAgICB8ICAgICAgICBpPTIgICAgICAgfCAgICAgIGk9MyAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgfCAgICAgICBpc0ZpcnN0ICAgICAgIHwgICAgICAgICAgICAgICAgICB8ICAgICBpc0xhc3QgICB8XG4gICAgLy8gfCAgICAgICAgICAgcGFpciAwICAgICAgICAgICAgICAgIHBhaXIgMSAgICAgICAgICAgICBwYWlyIDIgICAgICAgICAgIHxcbiAgICAvLyB8ICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgfFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgdmFyIHBhaXJzID0gW107XG4gICAgZWxlbWVudHMgPSBpZHMubWFwKGZ1bmN0aW9uIChpZCwgaSkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIGVsZW1lbnQgb2JqZWN0LlxuICAgICAgICB2YXIgZWxlbWVudCA9IHtcbiAgICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnRPclNlbGVjdG9yKGlkKSxcbiAgICAgICAgICAgIHNpemU6IHNpemVzW2ldLFxuICAgICAgICAgICAgbWluU2l6ZTogbWluU2l6ZXNbaV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHBhaXI7XG5cbiAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHBhaXIgb2JqZWN0IHdpdGggaXQncyBtZXRhZGF0YS5cbiAgICAgICAgICAgIHBhaXIgPSB7XG4gICAgICAgICAgICAgICAgYTogaSAtIDEsXG4gICAgICAgICAgICAgICAgYjogaSxcbiAgICAgICAgICAgICAgICBkcmFnZ2luZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNGaXJzdDogKGkgPT09IDEpLFxuICAgICAgICAgICAgICAgIGlzTGFzdDogKGkgPT09IGlkcy5sZW5ndGggLSAxKSxcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEZvciBmaXJzdCBhbmQgbGFzdCBwYWlycywgZmlyc3QgYW5kIGxhc3QgZ3V0dGVyIHdpZHRoIGlzIGhhbGYuXG4gICAgICAgICAgICBwYWlyLmFHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZTtcbiAgICAgICAgICAgIHBhaXIuYkd1dHRlclNpemUgPSBndXR0ZXJTaXplO1xuXG4gICAgICAgICAgICBpZiAocGFpci5pc0ZpcnN0KSB7XG4gICAgICAgICAgICAgICAgcGFpci5hR3V0dGVyU2l6ZSA9IGd1dHRlclNpemUgLyAyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGFpci5pc0xhc3QpIHtcbiAgICAgICAgICAgICAgICBwYWlyLmJHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZSAvIDI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBwYXJlbnQgaGFzIGEgcmV2ZXJzZSBmbGV4LWRpcmVjdGlvbiwgc3dpdGNoIHRoZSBwYWlyIGVsZW1lbnRzLlxuICAgICAgICAgICAgaWYgKHBhcmVudEZsZXhEaXJlY3Rpb24gPT09ICdyb3ctcmV2ZXJzZScgfHwgcGFyZW50RmxleERpcmVjdGlvbiA9PT0gJ2NvbHVtbi1yZXZlcnNlJykge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wID0gcGFpci5hO1xuICAgICAgICAgICAgICAgIHBhaXIuYSA9IHBhaXIuYjtcbiAgICAgICAgICAgICAgICBwYWlyLmIgPSB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBzaXplIG9mIHRoZSBjdXJyZW50IGVsZW1lbnQuIElFOCBpcyBzdXBwb3J0ZWQgYnlcbiAgICAgICAgLy8gc3RhdGljbHkgYXNzaWduaW5nIHNpemVzIHdpdGhvdXQgZHJhZ2dhYmxlIGd1dHRlcnMuIEFzc2lnbnMgYSBzdHJpbmdcbiAgICAgICAgLy8gdG8gYHNpemVgLlxuICAgICAgICAvL1xuICAgICAgICAvLyBJRTkgYW5kIGFib3ZlXG4gICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgZm9yIGVhY2ggcGFpci5cbiAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBndXR0ZXJFbGVtZW50ID0gZ3V0dGVyKGksIGRpcmVjdGlvbik7XG4gICAgICAgICAgICAgICAgc2V0R3V0dGVyU2l6ZShndXR0ZXJFbGVtZW50LCBndXR0ZXJTaXplKTtcblxuICAgICAgICAgICAgICAgIGd1dHRlckVsZW1lbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ21vdXNlZG93bicsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG4gICAgICAgICAgICAgICAgZ3V0dGVyRWxlbWVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hzdGFydCcsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG5cbiAgICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGd1dHRlckVsZW1lbnQsIGVsZW1lbnQuZWxlbWVudCk7XG5cbiAgICAgICAgICAgICAgICBwYWlyLmd1dHRlciA9IGd1dHRlckVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdGhlIGVsZW1lbnQgc2l6ZSB0byBvdXIgZGV0ZXJtaW5lZCBzaXplLlxuICAgICAgICAvLyBIYWxmLXNpemUgZ3V0dGVycyBmb3IgZmlyc3QgYW5kIGxhc3QgZWxlbWVudHMuXG4gICAgICAgIGlmIChpID09PSAwIHx8IGkgPT09IGlkcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBzZXRFbGVtZW50U2l6ZShlbGVtZW50LmVsZW1lbnQsIGVsZW1lbnQuc2l6ZSwgZ3V0dGVyU2l6ZSAvIDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoZWxlbWVudC5lbGVtZW50LCBlbGVtZW50LnNpemUsIGd1dHRlclNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbXB1dGVkU2l6ZSA9IGVsZW1lbnQuZWxlbWVudFtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXTtcblxuICAgICAgICBpZiAoY29tcHV0ZWRTaXplIDwgZWxlbWVudC5taW5TaXplKSB7XG4gICAgICAgICAgICBlbGVtZW50Lm1pblNpemUgPSBjb21wdXRlZFNpemU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZnRlciB0aGUgZmlyc3QgaXRlcmF0aW9uLCBhbmQgd2UgaGF2ZSBhIHBhaXIgb2JqZWN0LCBhcHBlbmQgaXQgdG8gdGhlXG4gICAgICAgIC8vIGxpc3Qgb2YgcGFpcnMuXG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgcGFpcnMucHVzaChwYWlyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbGVtZW50XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBzZXRTaXplcyAobmV3U2l6ZXMpIHtcbiAgICAgICAgbmV3U2l6ZXMuZm9yRWFjaChmdW5jdGlvbiAobmV3U2l6ZSwgaSkge1xuICAgICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpIC0gMV07XG4gICAgICAgICAgICAgICAgdmFyIGEgPSBlbGVtZW50c1twYWlyLmFdO1xuICAgICAgICAgICAgICAgIHZhciBiID0gZWxlbWVudHNbcGFpci5iXTtcblxuICAgICAgICAgICAgICAgIGEuc2l6ZSA9IG5ld1NpemVzW2kgLSAxXTtcbiAgICAgICAgICAgICAgICBiLnNpemUgPSBuZXdTaXplO1xuXG4gICAgICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHBhaXIuYUd1dHRlclNpemUpO1xuICAgICAgICAgICAgICAgIHNldEVsZW1lbnRTaXplKGIuZWxlbWVudCwgYi5zaXplLCBwYWlyLmJHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgICAgIHBhaXJzLmZvckVhY2goZnVuY3Rpb24gKHBhaXIpIHtcbiAgICAgICAgICAgIHBhaXIucGFyZW50LnJlbW92ZUNoaWxkKHBhaXIuZ3V0dGVyKTtcbiAgICAgICAgICAgIGVsZW1lbnRzW3BhaXIuYV0uZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gJyc7XG4gICAgICAgICAgICBlbGVtZW50c1twYWlyLmJdLmVsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9ICcnO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoaXNJRTgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNldFNpemVzOiBzZXRTaXplcyxcbiAgICAgICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzZXRTaXplczogc2V0U2l6ZXMsXG4gICAgICAgIGdldFNpemVzOiBmdW5jdGlvbiBnZXRTaXplcyAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7IHJldHVybiBlbGVtZW50LnNpemU7IH0pXG4gICAgICAgIH0sXG4gICAgICAgIGNvbGxhcHNlOiBmdW5jdGlvbiBjb2xsYXBzZSAoaSkge1xuICAgICAgICAgICAgaWYgKGkgPT09IHBhaXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaSAtIDFdO1xuXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlU2l6ZXMuY2FsbChwYWlyKTtcblxuICAgICAgICAgICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRqdXN0LmNhbGwocGFpciwgcGFpci5zaXplIC0gcGFpci5iR3V0dGVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFpciQxID0gcGFpcnNbaV07XG5cbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVTaXplcy5jYWxsKHBhaXIkMSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzSUU4KSB7XG4gICAgICAgICAgICAgICAgICAgIGFkanVzdC5jYWxsKHBhaXIkMSwgcGFpciQxLmFHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgfVxufTtcblxucmV0dXJuIFNwbGl0O1xuXG59KSkpO1xuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0UGFsZXR0ZShjb2xvclN0b3BzLCBudW1Db2xvcnMpIHtcblx0Y29uc3Qgb2Zmc2V0cyA9IFtdXG5cdGNvbnN0IHJlZHMgPSBbXVxuXHRjb25zdCBncmVlbnMgPSBbXVxuXHRjb25zdCBibHVlcyA9IFtdXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb2xvclN0b3BzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgY29sb3JTdG9wID0gY29sb3JTdG9wc1tpXVxuXG5cdFx0b2Zmc2V0cy5wdXNoKGNvbG9yU3RvcFswXSlcblxuXHRcdGNvbnN0IGhleENvbG9yID0gY29sb3JTdG9wWzFdXG5cdFx0cmVkcy5wdXNoKChoZXhDb2xvciA+PiAxNiAmIDI1NSkgLyAyNTUpXG5cdFx0Z3JlZW5zLnB1c2goKGhleENvbG9yID4+IDggJiAyNTUpIC8gMjU1KVxuXHRcdGJsdWVzLnB1c2goKGhleENvbG9yICYgMjU1KSAvIDI1NSlcblx0fVxuXG5cdGNvbnN0IHJlZEludGVycG9sYW50ID0gY3JlYXRlSW50ZXJwb2xhbnQob2Zmc2V0cywgcmVkcylcblx0Y29uc3QgZ3JlZW5JbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIGdyZWVucylcblx0Y29uc3QgYmx1ZUludGVycG9sYW50ID0gY3JlYXRlSW50ZXJwb2xhbnQob2Zmc2V0cywgYmx1ZXMpXG5cblx0Y29uc3QgcGFsZXR0ZSA9IFtdXG5cdGNvbnN0IGluY3JlbWVudCA9IDEgLyBudW1Db2xvcnNcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDE7IGkgKz0gaW5jcmVtZW50KSB7XG5cdFx0cGFsZXR0ZS5wdXNoKHJlZEludGVycG9sYW50KGkpLCBncmVlbkludGVycG9sYW50KGkpLCBibHVlSW50ZXJwb2xhbnQoaSksIDI1NSlcblx0fVxuXG5cdHJldHVybiBwYWxldHRlXG59XG5cbi8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01vbm90b25lX2N1YmljX2ludGVycG9sYXRpb25cbmZ1bmN0aW9uIGNyZWF0ZUludGVycG9sYW50KHhzLCB5cykge1xuXHRjb25zdCBsZW5ndGggPSB4cy5sZW5ndGhcblxuXHQvLyBEZWFsIHdpdGggbGVuZ3RoIGlzc3Vlc1xuXHRpZiAobGVuZ3RoICE9PSB5cy5sZW5ndGgpIHtcblx0XHR0aHJvdyBcIk5lZWQgYW4gZXF1YWwgY291bnQgb2YgeHMgYW5kIHlzLlwiXG5cdH1cblx0aWYgKGxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiAoKSA9PiAwXG5cdH1cblx0aWYgKGxlbmd0aCA9PT0gMSkge1xuXHRcdC8vIEltcGw6IFByZWNvbXB1dGluZyB0aGUgcmVzdWx0IHByZXZlbnRzIHByb2JsZW1zIGlmIHlzIGlzIG11dGF0ZWQgbGF0ZXIgYW5kIGFsbG93cyBnYXJiYWdlIGNvbGxlY3Rpb24gb2YgeXNcblx0XHQvLyBJbXBsOiBVbmFyeSBwbHVzIHByb3Blcmx5IGNvbnZlcnRzIHZhbHVlcyB0byBudW1iZXJzXG5cdFx0Y29uc3QgcmVzdWx0ID0gK3lzWzBdXG5cdFx0cmV0dXJuICgpID0+IHJlc3VsdFxuXHR9XG5cblx0Ly8gUmVhcnJhbmdlIHhzIGFuZCB5cyBzbyB0aGF0IHhzIGlzIHNvcnRlZFxuXHRjb25zdCBpbmRleGVzID0gW11cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdGluZGV4ZXMucHVzaChpKVxuXHR9XG5cdGluZGV4ZXMuc29ydCgoYSwgYikgPT4geHNbYV0gPCB4c1tiXSA/IC0xIDogMSlcblx0Y29uc3Qgb2xkWHMgPSB4cyxcblx0XHRvbGRZcyA9IHlzXG5cdC8vIEltcGw6IENyZWF0aW5nIG5ldyBhcnJheXMgYWxzbyBwcmV2ZW50cyBwcm9ibGVtcyBpZiB0aGUgaW5wdXQgYXJyYXlzIGFyZSBtdXRhdGVkIGxhdGVyXG5cdHhzID0gW11cblx0eXMgPSBbXVxuXHQvLyBJbXBsOiBVbmFyeSBwbHVzIHByb3Blcmx5IGNvbnZlcnRzIHZhbHVlcyB0byBudW1iZXJzXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHR4cy5wdXNoKCtvbGRYc1tpbmRleGVzW2ldXSlcblx0XHR5cy5wdXNoKCtvbGRZc1tpbmRleGVzW2ldXSlcblx0fVxuXG5cdC8vIEdldCBjb25zZWN1dGl2ZSBkaWZmZXJlbmNlcyBhbmQgc2xvcGVzXG5cdGNvbnN0IGR5cyA9IFtdLFxuXHRcdGR4cyA9IFtdLFxuXHRcdG1zID0gW11cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGggLSAxOyBpKyspIHtcblx0XHRjb25zdCBkeCA9IHhzW2kgKyAxXSAtIHhzW2ldLFxuXHRcdFx0ZHkgPSB5c1tpICsgMV0gLSB5c1tpXVxuXHRcdGR4cy5wdXNoKGR4KVxuXHRcdGR5cy5wdXNoKGR5KVxuXHRcdG1zLnB1c2goZHkgLyBkeClcblx0fVxuXG5cdC8vIEdldCBkZWdyZWUtMSBjb2VmZmljaWVudHNcblx0Y29uc3QgYzFzID0gW21zWzBdXVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGR4cy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRjb25zdCBtID0gbXNbaV0sXG5cdFx0XHRtTmV4dCA9IG1zW2kgKyAxXVxuXHRcdGlmIChtICogbU5leHQgPD0gMCkge1xuXHRcdFx0YzFzLnB1c2goMClcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZHhfID0gZHhzW2ldLFxuXHRcdFx0XHRkeE5leHQgPSBkeHNbaSArIDFdLFxuXHRcdFx0XHRjb21tb24gPSBkeF8gKyBkeE5leHRcblx0XHRcdGMxcy5wdXNoKDMgKiBjb21tb24gLyAoKGNvbW1vbiArIGR4TmV4dCkgLyBtICsgKGNvbW1vbiArIGR4XykgLyBtTmV4dCkpXG5cdFx0fVxuXHR9XG5cdGMxcy5wdXNoKG1zW21zLmxlbmd0aCAtIDFdKVxuXG5cdC8vIEdldCBkZWdyZWUtMiBhbmQgZGVncmVlLTMgY29lZmZpY2llbnRzXG5cdGNvbnN0IGMycyA9IFtdLFxuXHRcdGMzcyA9IFtdXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYzFzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdGNvbnN0IGMxID0gYzFzW2ldLFxuXHRcdFx0bV8gPSBtc1tpXSxcblx0XHRcdGludkR4ID0gMSAvIGR4c1tpXSxcblx0XHRcdGNvbW1vbl8gPSBjMSArIGMxc1tpICsgMV0gLSBtXyAtIG1fXG5cdFx0YzJzLnB1c2goKG1fIC0gYzEgLSBjb21tb25fKSAqIGludkR4KVxuXHRcdGMzcy5wdXNoKGNvbW1vbl8gKiBpbnZEeCAqIGludkR4KVxuXHR9XG5cblx0Ly8gUmV0dXJuIGludGVycG9sYW50IGZ1bmN0aW9uXG5cdHJldHVybiB4ID0+IHtcblx0XHQvLyBUaGUgcmlnaHRtb3N0IHBvaW50IGluIHRoZSBkYXRhc2V0IHNob3VsZCBnaXZlIGFuIGV4YWN0IHJlc3VsdFxuXHRcdGxldCBpID0geHMubGVuZ3RoIC0gMVxuXHRcdGlmICh4ID09PSB4c1tpXSkge1xuXHRcdFx0cmV0dXJuIHlzW2ldXG5cdFx0fVxuXG5cdFx0Ly8gU2VhcmNoIGZvciB0aGUgaW50ZXJ2YWwgeCBpcyBpbiwgcmV0dXJuaW5nIHRoZSBjb3JyZXNwb25kaW5nIHkgaWYgeCBpcyBvbmUgb2YgdGhlIG9yaWdpbmFsIHhzXG5cdFx0bGV0IGxvdyA9IDAsXG5cdFx0XHRtaWQsIGhpZ2ggPSBjM3MubGVuZ3RoIC0gMVxuXHRcdHdoaWxlIChsb3cgPD0gaGlnaCkge1xuXHRcdFx0bWlkID0gTWF0aC5mbG9vcigobG93ICsgaGlnaCkgLyAyKVxuXHRcdFx0Y29uc3QgeEhlcmUgPSB4c1ttaWRdXG5cdFx0XHRpZiAoeEhlcmUgPCB4KSB7XG5cdFx0XHRcdGxvdyA9IG1pZCArIDFcblx0XHRcdH0gZWxzZSBpZiAoeEhlcmUgPiB4KSB7XG5cdFx0XHRcdGhpZ2ggPSBtaWQgLSAxXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geXNbbWlkXVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpID0gTWF0aC5tYXgoMCwgaGlnaClcblxuXHRcdC8vIEludGVycG9sYXRlXG5cdFx0Y29uc3QgZGlmZiA9IHggLSB4c1tpXSxcblx0XHRcdGRpZmZTcSA9IGRpZmYgKiBkaWZmXG5cdFx0cmV0dXJuIHlzW2ldICsgYzFzW2ldICogZGlmZiArIGMyc1tpXSAqIGRpZmZTcSArIGMzc1tpXSAqIGRpZmYgKiBkaWZmU3Fcblx0fVxufVxuIiwiaW1wb3J0IGdldFBhbGV0dGUgZnJvbSBcIi4vY29sb3ItZ3JhZGllbnQuanNcIlxuaW1wb3J0IHtcblx0aW5pdEdsLFxuXHRpbml0UHJvZ3JhbSxcblx0Z2V0VW5pZm9ybXMsXG5cdHJlbmRlckdsXG59IGZyb20gXCIuL3dlYmdsLXV0aWxzLmpzXCJcbmltcG9ydCBTcGxpdCBmcm9tIFwic3BsaXQuanNcIlxuXG5jb25zdCAkd2luZG93ID0gJCh3aW5kb3cpXG5jb25zdCAkaHRtbCA9ICQoXCJodG1sXCIpXG5cbmNvbnN0ICRpdGVyYXRpb25UZXh0ID0gJChcIiNpdGVyYXRpb24tdGV4dFwiKVxuY29uc3QgJGpjb25zdGFudFRleHQgPSAkKFwiI2p1bGlhLWNvbnN0YW50LXRleHRcIilcblxuJChcIiNjb250cm9scy1kaWFsb2dcIikuZGlhbG9nKHtcblx0c2hvdzogXCJkcm9wXCIsXG5cdGhpZGU6IFwiZHJvcFwiLFxuXHR3aWR0aDogXCIyNWVtXCIsXG5cdGJ1dHRvbnM6IFt7XG5cdFx0dGV4dDogXCJHb3QgaXQhXCIsXG5cdFx0Y2xpY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0JCh0aGlzKS5kaWFsb2coXCJjbG9zZVwiKVxuXHRcdH1cblx0fV1cbn0pLnRvb2x0aXAoKVxuXG5jb25zdCBTQ1JPTExfQ09FRkYgPSAwLjA1XG5jb25zdCBaT09NX0NPRUZGID0gMS4xXG5cbmxldCBtYXhJdGVyYXRpb25zID0gMjAwXG5cbmNvbnN0IHBhbGV0dGUgPSBnZXRQYWxldHRlKFtcblx0WzAsIDB4MDAwMDAwXSxcblx0WzAuMSwgMHg0NDA4NDVdLFxuXHRbMC4yLCAweDdkMWE0OF0sXG5cdFswLjMsIDB4YzY2ZjM3XSxcblx0WzAuNCwgMHhmMGU5NTNdLFxuXHRbMC41LCAweGZmZmZmZl0sXG5cdFswLjYsIDB4OThlOTkxXSxcblx0WzAuNywgMHg1N2M5YWVdLFxuXHRbMC44LCAweDI0NWI5YV0sXG5cdFswLjksIDB4MDcxMTQ2XSxcblx0WzEsIDB4MDAwMDAwXVxuXSwgNTEyKVxuXG5jb25zdCBNYW5kZWxicm90ID0gaW5pdEZyYWN0YWwoXCIjbWFuZGVsYnJvdC1jYW52YXNcIiwge1xuXHRyZWFsOiB7XG5cdFx0bWluOiBudWxsLFxuXHRcdG1pZDogLTAuNyxcblx0XHRtYXg6IG51bGwsXG5cdFx0cmFuZ2U6IDNcblx0fSxcblx0aW1hZzoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IDAsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAyLjRcblx0fSxcblx0b3ZlckNhbnZhczogbnVsbFxufSlcblxuY29uc3QgSnVsaWEgPSBpbml0RnJhY3RhbChcIiNqdWxpYS1jYW52YXNcIiwge1xuXHRyZWFsOiB7XG5cdFx0bWluOiBudWxsLFxuXHRcdG1pZDogMCxcblx0XHRtYXg6IG51bGwsXG5cdFx0cmFuZ2U6IDMuNlxuXHR9LFxuXHRpbWFnOiB7XG5cdFx0bWluOiBudWxsLFxuXHRcdG1pZDogMCxcblx0XHRtYXg6IG51bGwsXG5cdFx0cmFuZ2U6IDMuNlxuXHR9LFxuXHRvdmVyQ2FudmFzOiBudWxsXG59LCB7XG5cdHJlYWw6IC0wLjc3LFxuXHRpbWFnOiAtMC4wOVxufSlcblxuZnVuY3Rpb24gaW5pdEZyYWN0YWwoY2FudmFzU2VsZWN0b3IsIGJvdW5kcywgamNvbnN0YW50KSB7XG5cdGNvbnN0IGZyYWN0YWwgPSB7fVxuXHRmcmFjdGFsLiRjYW52YXMgPSAkKGNhbnZhc1NlbGVjdG9yKVxuXHRmcmFjdGFsLmNhbnZhcyA9IGZyYWN0YWwuJGNhbnZhc1swXVxuXHRmcmFjdGFsLmdsID0gaW5pdEdsKGZyYWN0YWwpXG5cdGZyYWN0YWwucHJvZ3JhbSA9IGluaXRQcm9ncmFtKGZyYWN0YWwpXG5cdGZyYWN0YWwudW5pZm9ybXMgPSBnZXRVbmlmb3JtcyhmcmFjdGFsLCBbXG5cdFx0XCJyZWFsTWluXCIsXG5cdFx0XCJpbWFnTWluXCIsXG5cdFx0XCJtYXhJdGVyYXRpb25zXCIsXG5cdFx0XCJpc0p1bGlhXCIsXG5cdFx0XCJqY29uc3RhbnRcIixcblx0XHRcIm92ZXJDYW52YXNcIixcblx0XHRcInBhbGV0dGVcIlxuXHRdKVxuXHRmcmFjdGFsLmJvdW5kcyA9IGJvdW5kc1xuXHRpZiAoamNvbnN0YW50KSB7XG5cdFx0ZnJhY3RhbC5nbC51bmlmb3JtMWkoZnJhY3RhbC51bmlmb3Jtcy5pc0p1bGlhLCB0cnVlKVxuXHRcdGZyYWN0YWwuY29uc3RhbnQgPSBqY29uc3RhbnRcblx0fVxuXHRmcmFjdGFsLmdsLnVuaWZvcm00ZnYoZnJhY3RhbC51bmlmb3Jtcy5wYWxldHRlLCBwYWxldHRlKVxuXHRyZXR1cm4gZnJhY3RhbFxufVxuXG5mdW5jdGlvbiB1cGRhdGVJdGVyYXRpb25UZXh0KCkge1xuXHQkaXRlcmF0aW9uVGV4dC50ZXh0KGBJdGVyYXRpb24gY291bnQgPSAke21heEl0ZXJhdGlvbnN9YClcbn1cbnVwZGF0ZUl0ZXJhdGlvblRleHQoKVxuXG5mdW5jdGlvbiB1cGRhdGVKQ29uc3RhbnRUZXh0KCkge1xuXHQkamNvbnN0YW50VGV4dC50ZXh0KGBTaG93aW5nIEp1bGlhIHNldCBmb3IgYyA9ICR7SnVsaWEuY29uc3RhbnQucmVhbH0gKyAke0p1bGlhLmNvbnN0YW50LmltYWd9aWApXG59XG51cGRhdGVKQ29uc3RhbnRUZXh0KClcblxuZnVuY3Rpb24gcmVzaXplQ2FudmFzKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Y2FudmFzLFxuXHRcdGdsXG5cdH0gPSBmcmFjdGFsXG5cblx0Y2FudmFzLndpZHRoID0gJGNhbnZhcy53aWR0aCgpXG5cdGNhbnZhcy5oZWlnaHQgPSAkY2FudmFzLmhlaWdodCgpXG5cdGdsLnZpZXdwb3J0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodClcblx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdHJlbmRlcihmcmFjdGFsKVxufVxuXG5mdW5jdGlvbiByZXNpemVDYW52YXNlcygpIHtcblx0cmVzaXplQ2FudmFzKE1hbmRlbGJyb3QpXG5cdHJlc2l6ZUNhbnZhcyhKdWxpYSlcbn1cbiQocmVzaXplQ2FudmFzZXMpXG4kd2luZG93LnJlc2l6ZShyZXNpemVDYW52YXNlcylcblxuU3BsaXQoW1wiI21hbmRlbGJyb3QtY2FudmFzLXdyYXBwZXJcIiwgXCIjanVsaWEtY2FudmFzLXdyYXBwZXJcIl0sIHtcblx0ZGlyZWN0aW9uOiBcImhvcml6b250YWxcIixcblx0Y3Vyc29yOiBcImNvbC1yZXNpemVcIixcblx0b25EcmFnOiByZXNpemVDYW52YXNlc1xufSlcblxuZnVuY3Rpb24gY2FsY3VsYXRlQm91bmRzKHtcblx0Y2FudmFzLFxuXHRib3VuZHNcbn0pIHtcblx0Ym91bmRzLnJlYWwucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMucmVhbC5yYW5nZSlcblx0Ym91bmRzLmltYWcucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMuaW1hZy5yYW5nZSlcblxuXHRjb25zdCBib3VuZHNSYXRpbyA9IGJvdW5kcy5yZWFsLnJhbmdlIC8gYm91bmRzLmltYWcucmFuZ2Vcblx0Y29uc3QgY2FudmFzUmF0aW8gPSBjYW52YXMud2lkdGggLyBjYW52YXMuaGVpZ2h0XG5cblx0aWYgKGJvdW5kc1JhdGlvIDwgY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLnJlYWwucmFuZ2UgPSBib3VuZHMuaW1hZy5yYW5nZSAqIGNhbnZhc1JhdGlvXG5cdGVsc2UgaWYgKGJvdW5kc1JhdGlvID4gY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLmltYWcucmFuZ2UgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhc1JhdGlvXG5cblx0Ym91bmRzLnJlYWwubWluID0gYm91bmRzLnJlYWwubWlkIC0gYm91bmRzLnJlYWwucmFuZ2UgLyAyXG5cdGJvdW5kcy5yZWFsLm1heCA9IGJvdW5kcy5yZWFsLm1pZCArIGJvdW5kcy5yZWFsLnJhbmdlIC8gMlxuXHRib3VuZHMuaW1hZy5taW4gPSBib3VuZHMuaW1hZy5taWQgLSBib3VuZHMuaW1hZy5yYW5nZSAvIDJcblx0Ym91bmRzLmltYWcubWF4ID0gYm91bmRzLmltYWcubWlkICsgYm91bmRzLmltYWcucmFuZ2UgLyAyXG5cblx0Ym91bmRzLm92ZXJDYW52YXMgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhcy53aWR0aFxufVxuXG5mdW5jdGlvbiByZW5kZXIoe1xuXHRnbCxcblx0dW5pZm9ybXMsXG5cdGJvdW5kcyxcblx0Y29uc3RhbnRcbn0pIHtcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLnJlYWxNaW4sIGJvdW5kcy5yZWFsLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLmltYWdNaW4sIGJvdW5kcy5pbWFnLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLm92ZXJDYW52YXMsIGJvdW5kcy5vdmVyQ2FudmFzKVxuXHRnbC51bmlmb3JtMWkodW5pZm9ybXMubWF4SXRlcmF0aW9ucywgbWF4SXRlcmF0aW9ucylcblx0aWYgKGNvbnN0YW50KVxuXHRcdGdsLnVuaWZvcm0yZih1bmlmb3Jtcy5qY29uc3RhbnQsIGNvbnN0YW50LnJlYWwsIGNvbnN0YW50LmltYWcpXG5cblx0cmVuZGVyR2woZ2wpXG59XG5cbmZ1bmN0aW9uIGdldFpGcm9tUGl4ZWwoe1xuXHRib3VuZHNcbn0sIHgsIHkpIHtcblx0cmV0dXJuIHtcblx0XHRyZWFsOiBib3VuZHMucmVhbC5taW4gKyB4ICogYm91bmRzLm92ZXJDYW52YXMsXG5cdFx0aW1hZzogYm91bmRzLmltYWcubWF4IC0geSAqIGJvdW5kcy5vdmVyQ2FudmFzXG5cdH1cbn1cblxuZnVuY3Rpb24gaW5pdEtleWRvd25Cb3VuZHMoZnJhY3RhbCkge1xuXHRjb25zdCB7XG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JHdpbmRvdy5rZXlkb3duKGV2dCA9PiB7XG5cdFx0c3dpdGNoIChldnQud2hpY2gpIHtcblx0XHRcdGNhc2UgMzg6IC8vIHVwXG5cdFx0XHRjYXNlIDg3OiAvLyB3XG5cdFx0XHRcdGlmIChldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5taWQgKz0gYm91bmRzLmltYWcucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMzc6IC8vIGxlZnRcblx0XHRcdGNhc2UgNjU6IC8vIGFcblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkIC09IGJvdW5kcy5yZWFsLnJhbmdlICogU0NST0xMX0NPRUZGXG5cdFx0XHRcdGJyZWFrXG5cblx0XHRcdGNhc2UgNDA6IC8vIGRvd25cblx0XHRcdGNhc2UgODM6IC8vIHNcblx0XHRcdFx0aWYgKGV2dC5zaGlmdEtleSkge1xuXHRcdFx0XHRcdGJvdW5kcy5yZWFsLnJhbmdlICo9IFpPT01fQ09FRkZcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBib3VuZHMuaW1hZy5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDM5OiAvLyByaWdodFxuXHRcdFx0Y2FzZSA2ODogLy8gZFxuXHRcdFx0XHRib3VuZHMucmVhbC5taWQgKz0gYm91bmRzLnJlYWwucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRyZW5kZXIoZnJhY3RhbClcblx0fSlcbn1cbmluaXRLZXlkb3duQm91bmRzKE1hbmRlbGJyb3QpXG5pbml0S2V5ZG93bkJvdW5kcyhKdWxpYSlcblxuZnVuY3Rpb24gaW5pdEtleWRvd25JdGVyYXRpb25zKCkge1xuXHQkd2luZG93LmtleWRvd24oZXZ0ID0+IHtcblx0XHRzd2l0Y2ggKGV2dC53aGljaCkge1xuXHRcdFx0Y2FzZSA0OTpcblx0XHRcdGNhc2UgNTA6XG5cdFx0XHRjYXNlIDUxOlxuXHRcdFx0Y2FzZSA1Mjpcblx0XHRcdGNhc2UgNTM6XG5cdFx0XHRjYXNlIDU0OlxuXHRcdFx0Y2FzZSA1NTpcblx0XHRcdGNhc2UgNTY6XG5cdFx0XHRjYXNlIDU3OiAvLyAxLTlcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyA9IDEwMCAqIE1hdGgucG93KDIsIGV2dC53aGljaCAtIDUxKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAxODk6IC8vIC1cblx0XHRcdFx0bWF4SXRlcmF0aW9ucyAtPSAxMDBcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyA9IE1hdGgubWF4KG1heEl0ZXJhdGlvbnMsIDApXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDE4NzogLy8gK1xuXHRcdFx0XHRtYXhJdGVyYXRpb25zICs9IDEwMFxuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHVwZGF0ZUl0ZXJhdGlvblRleHQoKVxuXHRcdHJlbmRlcihNYW5kZWxicm90KVxuXHRcdHJlbmRlcihKdWxpYSlcblx0fSlcbn1cbmluaXRLZXlkb3duSXRlcmF0aW9ucygpXG5cbmZ1bmN0aW9uIGluaXRNb3VzZURvd24oZnJhY3RhbCkge1xuXHRjb25zdCB7XG5cdFx0JGNhbnZhcyxcblx0XHRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5tb3VzZWRvd24oZG93bmV2dCA9PiB7XG5cdFx0ZG93bmV2dC5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRjb25zdCBvZmZzZXQgPSAkY2FudmFzLm9mZnNldCgpXG5cdFx0bGV0IHBtb3VzZVggPSBkb3duZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdGxldCBwbW91c2VZID0gZG93bmV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXG5cdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdEp1bGlhLmNvbnN0YW50ID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBwbW91c2VYLCBwbW91c2VZKVxuXHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRyZW5kZXIoSnVsaWEpXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxpYXNcIilcblx0XHR9IGVsc2Vcblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxsLXNjcm9sbFwiKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2Vtb3ZlKG1vdmVldnQpIHtcblx0XHRcdG1vdmVldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHRjb25zdCBtb3VzZVggPSBtb3ZlZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdFx0Y29uc3QgbW91c2VZID0gbW92ZWV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXHRcdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0SnVsaWEuY29uc3RhbnQgPSBtb3VzZVpcblx0XHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRcdHJlbmRlcihKdWxpYSlcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHBtb3VzZVogPSBnZXRaRnJvbVBpeGVsKGZyYWN0YWwsIHBtb3VzZVgsIHBtb3VzZVkpXG5cblx0XHRcdFx0cG1vdXNlWCA9IG1vdXNlWFxuXHRcdFx0XHRwbW91c2VZID0gbW91c2VZXG5cblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkICs9IHBtb3VzZVoucmVhbCAtIG1vdXNlWi5yZWFsXG5cdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCArPSBwbW91c2VaLmltYWcgLSBtb3VzZVouaW1hZ1xuXG5cdFx0XHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXHRcdFx0XHRyZW5kZXIoZnJhY3RhbClcblx0XHRcdH1cblx0XHR9XG5cdFx0JHdpbmRvdy5tb3VzZW1vdmUobW91c2Vtb3ZlKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2V1cCh1cGV2dCkge1xuXHRcdFx0dXBldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNlbW92ZVwiLCBtb3VzZW1vdmUpXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNldXBcIiwgbW91c2V1cClcblxuXHRcdFx0JGh0bWwucmVtb3ZlQ2xhc3MoXCJhbGlhcyBhbGwtc2Nyb2xsXCIpXG5cdFx0fVxuXHRcdCR3aW5kb3cubW91c2V1cChtb3VzZXVwKVxuXHR9KVxufVxuaW5pdE1vdXNlRG93bihNYW5kZWxicm90KVxuaW5pdE1vdXNlRG93bihKdWxpYSlcblxuZnVuY3Rpb24gaW5pdFdoZWVsKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5vbihcIndoZWVsXCIsIGV2dCA9PiB7XG5cdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcblxuXHRcdGNvbnN0IG9mZnNldCA9ICRjYW52YXMub2Zmc2V0KClcblx0XHRjb25zdCBtb3VzZVggPSBldnQuY2xpZW50WCAtIG9mZnNldC5sZWZ0XG5cdFx0Y29uc3QgbW91c2VZID0gZXZ0LmNsaWVudFkgLSBvZmZzZXQudG9wXG5cblx0XHRjb25zdCBkZWx0YVkgPSBldnQub3JpZ2luYWxFdmVudC5kZWx0YVlcblxuXHRcdGlmIChkZWx0YVkgPCAwKSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAvPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1pblwiKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1vdXRcIilcblx0XHR9XG5cblx0XHRjb25zdCBwbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXG5cdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGJvdW5kcy5yZWFsLm1pZCAtPSBtb3VzZVoucmVhbCAtIHBtb3VzZVoucmVhbFxuXHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBtb3VzZVouaW1hZyAtIHBtb3VzZVouaW1hZ1xuXG5cdFx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdFx0cmVuZGVyKGZyYWN0YWwpXG5cblx0XHRjbGVhclRpbWVvdXQoJC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIikpXG5cdFx0JC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIiwgc2V0VGltZW91dCgoKSA9PiAkaHRtbC5yZW1vdmVDbGFzcyhcInpvb20taW4gem9vbS1vdXRcIiksIDI1MCkpXG5cdH0pXG59XG5pbml0V2hlZWwoTWFuZGVsYnJvdClcbmluaXRXaGVlbChKdWxpYSlcbiIsImNvbnN0IHZlcnRleFNoYWRlclNvdXJjZSA9IGBcbmF0dHJpYnV0ZSB2ZWM0IHZlcnRleFBvc2l0aW9uO1xuXG52b2lkIG1haW4oKSB7XG5cdGdsX1Bvc2l0aW9uID0gdmVydGV4UG9zaXRpb247XG59XG5gXG5cbmNvbnN0IGZyYWdtZW50U2hhZGVyU291cmNlID0gYFxucHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xuXG51bmlmb3JtIGZsb2F0IHJlYWxNaW47XG51bmlmb3JtIGZsb2F0IGltYWdNaW47XG51bmlmb3JtIGZsb2F0IG92ZXJDYW52YXM7XG51bmlmb3JtIGludCBtYXhJdGVyYXRpb25zO1xuY29uc3QgZmxvYXQgQkFJTE9VVF9SQURJVVMgPSA0LjA7XG51bmlmb3JtIGJvb2wgaXNKdWxpYTtcbnVuaWZvcm0gdmVjMiBqY29uc3RhbnQ7XG5jb25zdCBpbnQgTlVNX0NPTE9SUyA9IDUxMjtcbnVuaWZvcm0gdmVjNCBwYWxldHRlW05VTV9DT0xPUlNdO1xuY29uc3QgZmxvYXQgR1JBRElFTlRfU0NBTEUgPSBmbG9hdChOVU1fQ09MT1JTKSAvIDMyLjA7XG5cbnZlYzQgZ2V0RnJhY3RhbENvbG9yKHZlYzIgeikge1xuXHR2ZWMyIHpTcTtcblx0dmVjMiBjO1xuXHRpZiAoaXNKdWxpYSlcblx0XHRjID0gamNvbnN0YW50O1xuXHRlbHNlXG5cdFx0YyA9IHo7XG5cblx0Zm9yIChpbnQgaSA9IDA7IGkgPCAxMDAwMDsgaSsrKSB7XG5cdFx0elNxID0gdmVjMih6LnggKiB6LngsIHoueSAqIHoueSk7XG5cdFx0eiA9IHZlYzIoelNxLnggLSB6U3EueSArIGMueCwgMi4wICogei54ICogei55ICsgYy55KTtcblxuXHRcdGlmICh6U3EueCArIHpTcS55ID4gQkFJTE9VVF9SQURJVVMpIHtcblx0XHRcdGZvciAoaW50IGogPSAwOyBqIDwgMzsgaisrKSB7XG5cdFx0XHRcdHpTcSA9IHZlYzIoei54ICogei54LCB6LnkgKiB6LnkpO1xuXHRcdFx0XHR6ID0gdmVjMih6U3EueCAtIHpTcS55LCAyLjAgKiB6LnggKiB6LnkpICsgYztcblx0XHRcdH1cblxuXHRcdFx0ZmxvYXQgbXUgPSBmbG9hdChpKSArIDEuMCAtIGxvZzIobG9nKHpTcS54ICsgelNxLnkpIC8gMi4wKTtcblx0XHRcdGludCBpbmRleCA9IGludChtb2QobXUgKiBHUkFESUVOVF9TQ0FMRSwgZmxvYXQoTlVNX0NPTE9SUykpKTtcblxuXHRcdFx0Zm9yIChpbnQgaiA9IDA7IGogPCBOVU1fQ09MT1JTOyBqKyspIHtcblx0XHRcdFx0aWYgKGogPT0gaW5kZXgpIHtcblx0XHRcdFx0XHRyZXR1cm4gcGFsZXR0ZVtqXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpID4gbWF4SXRlcmF0aW9ucykgcmV0dXJuIHZlYzQoMCwgMCwgMCwgMSk7XG5cdH1cbn1cblxudm9pZCBtYWluKCkge1xuXHRnbF9GcmFnQ29sb3IgPSBnZXRGcmFjdGFsQ29sb3IodmVjMihyZWFsTWluICsgZ2xfRnJhZ0Nvb3JkLnggKiBvdmVyQ2FudmFzLCBpbWFnTWluICsgZ2xfRnJhZ0Nvb3JkLnkgKiBvdmVyQ2FudmFzKSk7XG59XG5gXG5cbmNvbnN0IHZlcnRpY2VzID0gW1xuXHRbMSwgMV0sXG5cdFsxLCAtMV0sXG5cdFstMSwgLTFdLFxuXHRbLTEsIDFdXG5dXG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0R2woe1xuXHRjYW52YXNcbn0pIHtcblx0Y29uc3QgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpIHx8IGNhbnZhcy5nZXRDb250ZXh0KFwiZXhwZXJpbWVudGFsLXdlYmdsXCIpXG5cdGlmICghZ2wpIHtcblx0XHRhbGVydChcIlVuYWJsZSB0byBpbml0aWFsaXplIFdlYkdMLiBZb3VyIGJyb3dzZXIgbWF5IG5vdCBzdXBwb3J0IGl0LlwiKVxuXHRcdHJldHVybiBudWxsXG5cdH1cblx0cmV0dXJuIGdsXG59XG5cbmZ1bmN0aW9uIGdldFNoYWRlcihnbCwgbmFtZSwgdHlwZSkge1xuXHRjb25zdCBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSlcblxuXHRsZXQgc291cmNlXG5cdGlmIChuYW1lID09PSBcImZyYWN0YWwudmVydFwiKSB7XG5cdFx0c291cmNlID0gdmVydGV4U2hhZGVyU291cmNlXG5cdH0gZWxzZSBpZiAobmFtZSA9PT0gXCJmcmFjdGFsLmZyYWdcIikge1xuXHRcdHNvdXJjZSA9IGZyYWdtZW50U2hhZGVyU291cmNlXG5cdH1cblx0aWYgKCFzb3VyY2UpIHtcblx0XHRhbGVydChcIkNvdWxkIG5vdCBmaW5kIHNoYWRlciBzb3VyY2U6IFwiICsgbmFtZSlcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cblx0Z2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKVxuXHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcilcblxuXHRpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuXHRcdGFsZXJ0KFwiQW4gZXJyb3Igb2NjdXJlZCBjb21waWxpbmcgdGhlIHNoYWRlcnM6IFwiICsgZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpKVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXHRyZXR1cm4gc2hhZGVyXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UHJvZ3JhbSh7XG5cdGdsXG59KSB7XG5cdGNvbnN0IHZlcnRleFNoYWRlciA9IGdldFNoYWRlcihnbCwgXCJmcmFjdGFsLnZlcnRcIiwgZ2wuVkVSVEVYX1NIQURFUilcblx0Y29uc3QgZnJhZ21lbnRTaGFkZXIgPSBnZXRTaGFkZXIoZ2wsIFwiZnJhY3RhbC5mcmFnXCIsIGdsLkZSQUdNRU5UX1NIQURFUilcblxuXHRjb25zdCBwcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpXG5cdGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpXG5cdGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcilcblx0Z2wubGlua1Byb2dyYW0ocHJvZ3JhbSlcblxuXHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG5cdFx0YWxlcnQoXCJVbmFibGUgdG8gaW5pdGlhbGl6ZSB0aGUgc2hhZGVyIHByb2dyYW06IFwiICsgZ2wuZ2V0UHJvZ3JhbUluZm9Mb2cocHJvZ3JhbSkpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXG5cdGdsLnVzZVByb2dyYW0ocHJvZ3JhbSlcblxuXHRjb25zdCB2ZXJ0ZXhQb3NpdGlvbkF0dHJpYiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sIFwidmVydGV4UG9zaXRpb25cIilcblx0Z2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkodmVydGV4UG9zaXRpb25BdHRyaWIpXG5cblx0Y29uc3QgdmVydGljZXNCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKVxuXHRnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmVydGljZXNCdWZmZXIpXG5cdGdsLnZlcnRleEF0dHJpYlBvaW50ZXIodmVydGV4UG9zaXRpb25BdHRyaWIsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMClcblx0Z2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkodmVydGljZXMucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjLmNvbmNhdCh2YWwpKSksIGdsLlNUQVRJQ19EUkFXKVxuXG5cdHJldHVybiBwcm9ncmFtXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlmb3Jtcyh7XG5cdGdsLFxuXHRwcm9ncmFtXG59LCBuYW1lcykge1xuXHRjb25zdCB1bmlmb3JtcyA9IHt9XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBuYW1lID0gbmFtZXNbaV1cblx0XHR1bmlmb3Jtc1tuYW1lXSA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBuYW1lKVxuXHR9XG5cdHJldHVybiB1bmlmb3Jtc1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyR2woZ2wpIHtcblx0Z2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVClcblx0Z2wuZHJhd0FycmF5cyhnbC5UUklBTkdMRV9GQU4sIDAsIHZlcnRpY2VzLmxlbmd0aClcbn1cbiJdfQ==
