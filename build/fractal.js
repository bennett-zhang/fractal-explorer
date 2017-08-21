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
}, 250);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvc3BsaXQuanMvc3BsaXQuanMiLCJzcmMvY29sb3ItZ3JhZGllbnQuanMiLCJzcmMvZnJhY3RhbC5qcyIsInNyYy93ZWJnbC11dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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SUFBSSxNQUFKLENBQVcsR0FBWCxDQUFkO0FBQUEsRUFBaEIsQ0FBakIsQ0FBL0IsRUFBaUcsR0FBRyxXQUFwRzs7QUFFQSxRQUFPLE9BQVA7QUFDQTs7QUFFTSxTQUFTLFdBQVQsUUFHSixLQUhJLEVBR0c7QUFBQSxLQUZULEVBRVMsU0FGVCxFQUVTO0FBQUEsS0FEVCxPQUNTLFNBRFQsT0FDUzs7QUFDVCxLQUFNLFdBQVcsRUFBakI7QUFDQSxNQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksTUFBTSxNQUExQixFQUFrQyxHQUFsQyxFQUF1QztBQUN0QyxNQUFNLE9BQU8sTUFBTSxDQUFOLENBQWI7QUFDQSxXQUFTLElBQVQsSUFBaUIsR0FBRyxrQkFBSCxDQUFzQixPQUF0QixFQUErQixJQUEvQixDQUFqQjtBQUNBO0FBQ0QsUUFBTyxRQUFQO0FBQ0E7O0FBRU0sU0FBUyxRQUFULENBQWtCLEVBQWxCLEVBQXNCO0FBQzVCLElBQUcsS0FBSCxDQUFTLEdBQUcsZ0JBQVo7QUFDQSxJQUFHLFVBQUgsQ0FBYyxHQUFHLFlBQWpCLEVBQStCLENBQS9CLEVBQWtDLFNBQVMsTUFBM0M7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiEgU3BsaXQuanMgLSB2MS4zLjUgKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLlNwbGl0ID0gZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG4vLyBUaGUgcHJvZ3JhbW1pbmcgZ29hbHMgb2YgU3BsaXQuanMgYXJlIHRvIGRlbGl2ZXIgcmVhZGFibGUsIHVuZGVyc3RhbmRhYmxlIGFuZFxuLy8gbWFpbnRhaW5hYmxlIGNvZGUsIHdoaWxlIGF0IHRoZSBzYW1lIHRpbWUgbWFudWFsbHkgb3B0aW1pemluZyBmb3IgdGlueSBtaW5pZmllZCBmaWxlIHNpemUsXG4vLyBicm93c2VyIGNvbXBhdGliaWxpdHkgd2l0aG91dCBhZGRpdGlvbmFsIHJlcXVpcmVtZW50cywgZ3JhY2VmdWwgZmFsbGJhY2sgKElFOCBpcyBzdXBwb3J0ZWQpXG4vLyBhbmQgdmVyeSBmZXcgYXNzdW1wdGlvbnMgYWJvdXQgdGhlIHVzZXIncyBwYWdlIGxheW91dC5cbnZhciBnbG9iYWwgPSB3aW5kb3c7XG52YXIgZG9jdW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbi8vIFNhdmUgYSBjb3VwbGUgbG9uZyBmdW5jdGlvbiBuYW1lcyB0aGF0IGFyZSB1c2VkIGZyZXF1ZW50bHkuXG4vLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyBhcm91bmQgNDAwIGJ5dGVzLlxudmFyIGFkZEV2ZW50TGlzdGVuZXIgPSAnYWRkRXZlbnRMaXN0ZW5lcic7XG52YXIgcmVtb3ZlRXZlbnRMaXN0ZW5lciA9ICdyZW1vdmVFdmVudExpc3RlbmVyJztcbnZhciBnZXRCb3VuZGluZ0NsaWVudFJlY3QgPSAnZ2V0Qm91bmRpbmdDbGllbnRSZWN0JztcbnZhciBOT09QID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gZmFsc2U7IH07XG5cbi8vIEZpZ3VyZSBvdXQgaWYgd2UncmUgaW4gSUU4IG9yIG5vdC4gSUU4IHdpbGwgc3RpbGwgcmVuZGVyIGNvcnJlY3RseSxcbi8vIGJ1dCB3aWxsIGJlIHN0YXRpYyBpbnN0ZWFkIG9mIGRyYWdnYWJsZS5cbnZhciBpc0lFOCA9IGdsb2JhbC5hdHRhY2hFdmVudCAmJiAhZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdO1xuXG4vLyBUaGlzIGxpYnJhcnkgb25seSBuZWVkcyB0d28gaGVscGVyIGZ1bmN0aW9uczpcbi8vXG4vLyBUaGUgZmlyc3QgZGV0ZXJtaW5lcyB3aGljaCBwcmVmaXhlcyBvZiBDU1MgY2FsYyB3ZSBuZWVkLlxuLy8gV2Ugb25seSBuZWVkIHRvIGRvIHRoaXMgb25jZSBvbiBzdGFydHVwLCB3aGVuIHRoaXMgYW5vbnltb3VzIGZ1bmN0aW9uIGlzIGNhbGxlZC5cbi8vXG4vLyBUZXN0cyAtd2Via2l0LCAtbW96IGFuZCAtbyBwcmVmaXhlcy4gTW9kaWZpZWQgZnJvbSBTdGFja092ZXJmbG93OlxuLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNjYyNTE0MC9qcy1mZWF0dXJlLWRldGVjdGlvbi10by1kZXRlY3QtdGhlLXVzYWdlLW9mLXdlYmtpdC1jYWxjLW92ZXItY2FsYy8xNjYyNTE2NyMxNjYyNTE2N1xudmFyIGNhbGMgPSAoWycnLCAnLXdlYmtpdC0nLCAnLW1vei0nLCAnLW8tJ10uZmlsdGVyKGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBlbC5zdHlsZS5jc3NUZXh0ID0gXCJ3aWR0aDpcIiArIHByZWZpeCArIFwiY2FsYyg5cHgpXCI7XG5cbiAgICByZXR1cm4gKCEhZWwuc3R5bGUubGVuZ3RoKVxufSkuc2hpZnQoKSkgKyBcImNhbGNcIjtcblxuLy8gVGhlIHNlY29uZCBoZWxwZXIgZnVuY3Rpb24gYWxsb3dzIGVsZW1lbnRzIGFuZCBzdHJpbmcgc2VsZWN0b3JzIHRvIGJlIHVzZWRcbi8vIGludGVyY2hhbmdlYWJseS4gSW4gZWl0aGVyIGNhc2UgYW4gZWxlbWVudCBpcyByZXR1cm5lZC4gVGhpcyBhbGxvd3MgdXMgdG9cbi8vIGRvIGBTcGxpdChbZWxlbTEsIGVsZW0yXSlgIGFzIHdlbGwgYXMgYFNwbGl0KFsnI2lkMScsICcjaWQyJ10pYC5cbnZhciBlbGVtZW50T3JTZWxlY3RvciA9IGZ1bmN0aW9uIChlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnIHx8IGVsIGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgIH1cblxuICAgIHJldHVybiBlbFxufTtcblxuLy8gVGhlIG1haW4gZnVuY3Rpb24gdG8gaW5pdGlhbGl6ZSBhIHNwbGl0LiBTcGxpdC5qcyB0aGlua3MgYWJvdXQgZWFjaCBwYWlyXG4vLyBvZiBlbGVtZW50cyBhcyBhbiBpbmRlcGVuZGFudCBwYWlyLiBEcmFnZ2luZyB0aGUgZ3V0dGVyIGJldHdlZW4gdHdvIGVsZW1lbnRzXG4vLyBvbmx5IGNoYW5nZXMgdGhlIGRpbWVuc2lvbnMgb2YgZWxlbWVudHMgaW4gdGhhdCBwYWlyLiBUaGlzIGlzIGtleSB0byB1bmRlcnN0YW5kaW5nXG4vLyBob3cgdGhlIGZvbGxvd2luZyBmdW5jdGlvbnMgb3BlcmF0ZSwgc2luY2UgZWFjaCBmdW5jdGlvbiBpcyBib3VuZCB0byBhIHBhaXIuXG4vL1xuLy8gQSBwYWlyIG9iamVjdCBpcyBzaGFwZWQgbGlrZSB0aGlzOlxuLy9cbi8vIHtcbi8vICAgICBhOiBET00gZWxlbWVudCxcbi8vICAgICBiOiBET00gZWxlbWVudCxcbi8vICAgICBhTWluOiBOdW1iZXIsXG4vLyAgICAgYk1pbjogTnVtYmVyLFxuLy8gICAgIGRyYWdnaW5nOiBCb29sZWFuLFxuLy8gICAgIHBhcmVudDogRE9NIGVsZW1lbnQsXG4vLyAgICAgaXNGaXJzdDogQm9vbGVhbixcbi8vICAgICBpc0xhc3Q6IEJvb2xlYW4sXG4vLyAgICAgZGlyZWN0aW9uOiAnaG9yaXpvbnRhbCcgfCAndmVydGljYWwnXG4vLyB9XG4vL1xuLy8gVGhlIGJhc2ljIHNlcXVlbmNlOlxuLy9cbi8vIDEuIFNldCBkZWZhdWx0cyB0byBzb21ldGhpbmcgc2FuZS4gYG9wdGlvbnNgIGRvZXNuJ3QgaGF2ZSB0byBiZSBwYXNzZWQgYXQgYWxsLlxuLy8gMi4gSW5pdGlhbGl6ZSBhIGJ1bmNoIG9mIHN0cmluZ3MgYmFzZWQgb24gdGhlIGRpcmVjdGlvbiB3ZSdyZSBzcGxpdHRpbmcuXG4vLyAgICBBIGxvdCBvZiB0aGUgYmVoYXZpb3IgaW4gdGhlIHJlc3Qgb2YgdGhlIGxpYnJhcnkgaXMgcGFyYW1hdGl6ZWQgZG93biB0b1xuLy8gICAgcmVseSBvbiBDU1Mgc3RyaW5ncyBhbmQgY2xhc3Nlcy5cbi8vIDMuIERlZmluZSB0aGUgZHJhZ2dpbmcgaGVscGVyIGZ1bmN0aW9ucywgYW5kIGEgZmV3IGhlbHBlcnMgdG8gZ28gd2l0aCB0aGVtLlxuLy8gNC4gTG9vcCB0aHJvdWdoIHRoZSBlbGVtZW50cyB3aGlsZSBwYWlyaW5nIHRoZW0gb2ZmLiBFdmVyeSBwYWlyIGdldHMgYW5cbi8vICAgIGBwYWlyYCBvYmplY3QsIGEgZ3V0dGVyLCBhbmQgc3BlY2lhbCBpc0ZpcnN0L2lzTGFzdCBwcm9wZXJ0aWVzLlxuLy8gNS4gQWN0dWFsbHkgc2l6ZSB0aGUgcGFpciBlbGVtZW50cywgaW5zZXJ0IGd1dHRlcnMgYW5kIGF0dGFjaCBldmVudCBsaXN0ZW5lcnMuXG52YXIgU3BsaXQgPSBmdW5jdGlvbiAoaWRzLCBvcHRpb25zKSB7XG4gICAgaWYgKCBvcHRpb25zID09PSB2b2lkIDAgKSBvcHRpb25zID0ge307XG5cbiAgICB2YXIgZGltZW5zaW9uO1xuICAgIHZhciBjbGllbnREaW1lbnNpb247XG4gICAgdmFyIGNsaWVudEF4aXM7XG4gICAgdmFyIHBvc2l0aW9uO1xuICAgIHZhciBwYWRkaW5nQTtcbiAgICB2YXIgcGFkZGluZ0I7XG4gICAgdmFyIGVsZW1lbnRzO1xuXG4gICAgLy8gQWxsIERPTSBlbGVtZW50cyBpbiB0aGUgc3BsaXQgc2hvdWxkIGhhdmUgYSBjb21tb24gcGFyZW50LiBXZSBjYW4gZ3JhYlxuICAgIC8vIHRoZSBmaXJzdCBlbGVtZW50cyBwYXJlbnQgYW5kIGhvcGUgdXNlcnMgcmVhZCB0aGUgZG9jcyBiZWNhdXNlIHRoZVxuICAgIC8vIGJlaGF2aW9yIHdpbGwgYmUgd2hhY2t5IG90aGVyd2lzZS5cbiAgICB2YXIgcGFyZW50ID0gZWxlbWVudE9yU2VsZWN0b3IoaWRzWzBdKS5wYXJlbnROb2RlO1xuICAgIHZhciBwYXJlbnRGbGV4RGlyZWN0aW9uID0gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUocGFyZW50KS5mbGV4RGlyZWN0aW9uO1xuXG4gICAgLy8gU2V0IGRlZmF1bHQgb3B0aW9ucy5zaXplcyB0byBlcXVhbCBwZXJjZW50YWdlcyBvZiB0aGUgcGFyZW50IGVsZW1lbnQuXG4gICAgdmFyIHNpemVzID0gb3B0aW9ucy5zaXplcyB8fCBpZHMubWFwKGZ1bmN0aW9uICgpIHsgcmV0dXJuIDEwMCAvIGlkcy5sZW5ndGg7IH0pO1xuXG4gICAgLy8gU3RhbmRhcmRpemUgbWluU2l6ZSB0byBhbiBhcnJheSBpZiBpdCBpc24ndCBhbHJlYWR5LiBUaGlzIGFsbG93cyBtaW5TaXplXG4gICAgLy8gdG8gYmUgcGFzc2VkIGFzIGEgbnVtYmVyLlxuICAgIHZhciBtaW5TaXplID0gb3B0aW9ucy5taW5TaXplICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm1pblNpemUgOiAxMDA7XG4gICAgdmFyIG1pblNpemVzID0gQXJyYXkuaXNBcnJheShtaW5TaXplKSA/IG1pblNpemUgOiBpZHMubWFwKGZ1bmN0aW9uICgpIHsgcmV0dXJuIG1pblNpemU7IH0pO1xuICAgIHZhciBndXR0ZXJTaXplID0gb3B0aW9ucy5ndXR0ZXJTaXplICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmd1dHRlclNpemUgOiAxMDtcbiAgICB2YXIgc25hcE9mZnNldCA9IG9wdGlvbnMuc25hcE9mZnNldCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5zbmFwT2Zmc2V0IDogMzA7XG4gICAgdmFyIGRpcmVjdGlvbiA9IG9wdGlvbnMuZGlyZWN0aW9uIHx8ICdob3Jpem9udGFsJztcbiAgICB2YXIgY3Vyc29yID0gb3B0aW9ucy5jdXJzb3IgfHwgKGRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnID8gJ2V3LXJlc2l6ZScgOiAnbnMtcmVzaXplJyk7XG4gICAgdmFyIGd1dHRlciA9IG9wdGlvbnMuZ3V0dGVyIHx8IChmdW5jdGlvbiAoaSwgZ3V0dGVyRGlyZWN0aW9uKSB7XG4gICAgICAgIHZhciBndXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZ3V0LmNsYXNzTmFtZSA9IFwiZ3V0dGVyIGd1dHRlci1cIiArIGd1dHRlckRpcmVjdGlvbjtcbiAgICAgICAgcmV0dXJuIGd1dFxuICAgIH0pO1xuICAgIHZhciBlbGVtZW50U3R5bGUgPSBvcHRpb25zLmVsZW1lbnRTdHlsZSB8fCAoZnVuY3Rpb24gKGRpbSwgc2l6ZSwgZ3V0U2l6ZSkge1xuICAgICAgICB2YXIgc3R5bGUgPSB7fTtcblxuICAgICAgICBpZiAodHlwZW9mIHNpemUgIT09ICdzdHJpbmcnICYmICEoc2l6ZSBpbnN0YW5jZW9mIFN0cmluZykpIHtcbiAgICAgICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgICAgICBzdHlsZVtkaW1dID0gY2FsYyArIFwiKFwiICsgc2l6ZSArIFwiJSAtIFwiICsgZ3V0U2l6ZSArIFwicHgpXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBzaXplICsgXCIlXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdHlsZVtkaW1dID0gc2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdHlsZVxuICAgIH0pO1xuICAgIHZhciBndXR0ZXJTdHlsZSA9IG9wdGlvbnMuZ3V0dGVyU3R5bGUgfHwgKGZ1bmN0aW9uIChkaW0sIGd1dFNpemUpIHsgcmV0dXJuICgoIG9iaiA9IHt9LCBvYmpbZGltXSA9IChndXRTaXplICsgXCJweFwiKSwgb2JqICkpXG4gICAgICAgIHZhciBvYmo7IH0pO1xuXG4gICAgLy8gMi4gSW5pdGlhbGl6ZSBhIGJ1bmNoIG9mIHN0cmluZ3MgYmFzZWQgb24gdGhlIGRpcmVjdGlvbiB3ZSdyZSBzcGxpdHRpbmcuXG4gICAgLy8gQSBsb3Qgb2YgdGhlIGJlaGF2aW9yIGluIHRoZSByZXN0IG9mIHRoZSBsaWJyYXJ5IGlzIHBhcmFtYXRpemVkIGRvd24gdG9cbiAgICAvLyByZWx5IG9uIENTUyBzdHJpbmdzIGFuZCBjbGFzc2VzLlxuICAgIGlmIChkaXJlY3Rpb24gPT09ICdob3Jpem9udGFsJykge1xuICAgICAgICBkaW1lbnNpb24gPSAnd2lkdGgnO1xuICAgICAgICBjbGllbnREaW1lbnNpb24gPSAnY2xpZW50V2lkdGgnO1xuICAgICAgICBjbGllbnRBeGlzID0gJ2NsaWVudFgnO1xuICAgICAgICBwb3NpdGlvbiA9ICdsZWZ0JztcbiAgICAgICAgcGFkZGluZ0EgPSAncGFkZGluZ0xlZnQnO1xuICAgICAgICBwYWRkaW5nQiA9ICdwYWRkaW5nUmlnaHQnO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndmVydGljYWwnKSB7XG4gICAgICAgIGRpbWVuc2lvbiA9ICdoZWlnaHQnO1xuICAgICAgICBjbGllbnREaW1lbnNpb24gPSAnY2xpZW50SGVpZ2h0JztcbiAgICAgICAgY2xpZW50QXhpcyA9ICdjbGllbnRZJztcbiAgICAgICAgcG9zaXRpb24gPSAndG9wJztcbiAgICAgICAgcGFkZGluZ0EgPSAncGFkZGluZ1RvcCc7XG4gICAgICAgIHBhZGRpbmdCID0gJ3BhZGRpbmdCb3R0b20nO1xuICAgIH1cblxuICAgIC8vIDMuIERlZmluZSB0aGUgZHJhZ2dpbmcgaGVscGVyIGZ1bmN0aW9ucywgYW5kIGEgZmV3IGhlbHBlcnMgdG8gZ28gd2l0aCB0aGVtLlxuICAgIC8vIEVhY2ggaGVscGVyIGlzIGJvdW5kIHRvIGEgcGFpciBvYmplY3QgdGhhdCBjb250YWlucyBpdCdzIG1ldGFkYXRhLiBUaGlzXG4gICAgLy8gYWxzbyBtYWtlcyBpdCBlYXN5IHRvIHN0b3JlIHJlZmVyZW5jZXMgdG8gbGlzdGVuZXJzIHRoYXQgdGhhdCB3aWxsIGJlXG4gICAgLy8gYWRkZWQgYW5kIHJlbW92ZWQuXG4gICAgLy9cbiAgICAvLyBFdmVuIHRob3VnaCB0aGVyZSBhcmUgbm8gb3RoZXIgZnVuY3Rpb25zIGNvbnRhaW5lZCBpbiB0aGVtLCBhbGlhc2luZ1xuICAgIC8vIHRoaXMgdG8gc2VsZiBzYXZlcyA1MCBieXRlcyBvciBzbyBzaW5jZSBpdCdzIHVzZWQgc28gZnJlcXVlbnRseS5cbiAgICAvL1xuICAgIC8vIFRoZSBwYWlyIG9iamVjdCBzYXZlcyBtZXRhZGF0YSBsaWtlIGRyYWdnaW5nIHN0YXRlLCBwb3NpdGlvbiBhbmRcbiAgICAvLyBldmVudCBsaXN0ZW5lciByZWZlcmVuY2VzLlxuXG4gICAgZnVuY3Rpb24gc2V0RWxlbWVudFNpemUgKGVsLCBzaXplLCBndXRTaXplKSB7XG4gICAgICAgIC8vIFNwbGl0LmpzIGFsbG93cyBzZXR0aW5nIHNpemVzIHZpYSBudW1iZXJzIChpZGVhbGx5KSwgb3IgaWYgeW91IG11c3QsXG4gICAgICAgIC8vIGJ5IHN0cmluZywgbGlrZSAnMzAwcHgnLiBUaGlzIGlzIGxlc3MgdGhhbiBpZGVhbCwgYmVjYXVzZSBpdCBicmVha3NcbiAgICAgICAgLy8gdGhlIGZsdWlkIGxheW91dCB0aGF0IGBjYWxjKCUgLSBweClgIHByb3ZpZGVzLiBZb3UncmUgb24geW91ciBvd24gaWYgeW91IGRvIHRoYXQsXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB5b3UgY2FsY3VsYXRlIHRoZSBndXR0ZXIgc2l6ZSBieSBoYW5kLlxuICAgICAgICB2YXIgc3R5bGUgPSBlbGVtZW50U3R5bGUoZGltZW5zaW9uLCBzaXplLCBndXRTaXplKTtcblxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgICAgICAgT2JqZWN0LmtleXMoc3R5bGUpLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHsgcmV0dXJuIChlbC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTsgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0R3V0dGVyU2l6ZSAoZ3V0dGVyRWxlbWVudCwgZ3V0U2l6ZSkge1xuICAgICAgICB2YXIgc3R5bGUgPSBndXR0ZXJTdHlsZShkaW1lbnNpb24sIGd1dFNpemUpO1xuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgICAgICBPYmplY3Qua2V5cyhzdHlsZSkuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkgeyByZXR1cm4gKGd1dHRlckVsZW1lbnQuc3R5bGVbcHJvcF0gPSBzdHlsZVtwcm9wXSk7IH0pO1xuICAgIH1cblxuICAgIC8vIEFjdHVhbGx5IGFkanVzdCB0aGUgc2l6ZSBvZiBlbGVtZW50cyBgYWAgYW5kIGBiYCB0byBgb2Zmc2V0YCB3aGlsZSBkcmFnZ2luZy5cbiAgICAvLyBjYWxjIGlzIHVzZWQgdG8gYWxsb3cgY2FsYyhwZXJjZW50YWdlICsgZ3V0dGVycHgpIG9uIHRoZSB3aG9sZSBzcGxpdCBpbnN0YW5jZSxcbiAgICAvLyB3aGljaCBhbGxvd3MgdGhlIHZpZXdwb3J0IHRvIGJlIHJlc2l6ZWQgd2l0aG91dCBhZGRpdGlvbmFsIGxvZ2ljLlxuICAgIC8vIEVsZW1lbnQgYSdzIHNpemUgaXMgdGhlIHNhbWUgYXMgb2Zmc2V0LiBiJ3Mgc2l6ZSBpcyB0b3RhbCBzaXplIC0gYSBzaXplLlxuICAgIC8vIEJvdGggc2l6ZXMgYXJlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgaW5pdGlhbCBwYXJlbnQgcGVyY2VudGFnZSxcbiAgICAvLyB0aGVuIHRoZSBndXR0ZXIgc2l6ZSBpcyBzdWJ0cmFjdGVkLlxuICAgIGZ1bmN0aW9uIGFkanVzdCAob2Zmc2V0KSB7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbdGhpcy5hXTtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1t0aGlzLmJdO1xuICAgICAgICB2YXIgcGVyY2VudGFnZSA9IGEuc2l6ZSArIGIuc2l6ZTtcblxuICAgICAgICBhLnNpemUgPSAob2Zmc2V0IC8gdGhpcy5zaXplKSAqIHBlcmNlbnRhZ2U7XG4gICAgICAgIGIuc2l6ZSA9IChwZXJjZW50YWdlIC0gKChvZmZzZXQgLyB0aGlzLnNpemUpICogcGVyY2VudGFnZSkpO1xuXG4gICAgICAgIHNldEVsZW1lbnRTaXplKGEuZWxlbWVudCwgYS5zaXplLCB0aGlzLmFHdXR0ZXJTaXplKTtcbiAgICAgICAgc2V0RWxlbWVudFNpemUoYi5lbGVtZW50LCBiLnNpemUsIHRoaXMuYkd1dHRlclNpemUpO1xuICAgIH1cblxuICAgIC8vIGRyYWcsIHdoZXJlIGFsbCB0aGUgbWFnaWMgaGFwcGVucy4gVGhlIGxvZ2ljIGlzIHJlYWxseSBxdWl0ZSBzaW1wbGU6XG4gICAgLy9cbiAgICAvLyAxLiBJZ25vcmUgaWYgdGhlIHBhaXIgaXMgbm90IGRyYWdnaW5nLlxuICAgIC8vIDIuIEdldCB0aGUgb2Zmc2V0IG9mIHRoZSBldmVudC5cbiAgICAvLyAzLiBTbmFwIG9mZnNldCB0byBtaW4gaWYgd2l0aGluIHNuYXBwYWJsZSByYW5nZSAod2l0aGluIG1pbiArIHNuYXBPZmZzZXQpLlxuICAgIC8vIDQuIEFjdHVhbGx5IGFkanVzdCBlYWNoIGVsZW1lbnQgaW4gdGhlIHBhaXIgdG8gb2Zmc2V0LlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCAgICB8IDwtIGEubWluU2l6ZSAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICBiLm1pblNpemUgLT4gfCAgICB8XG4gICAgLy8gfCAgICB8ICB8IDwtIHRoaXMuc25hcE9mZnNldCAgICAgIHx8ICAgICB0aGlzLnNuYXBPZmZzZXQgLT4gfCAgfCAgICB8XG4gICAgLy8gfCAgICB8ICB8ICAgICAgICAgICAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgfCAgICB8XG4gICAgLy8gfCAgICB8ICB8ICAgICAgICAgICAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgfCAgICB8XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCA8LSB0aGlzLnN0YXJ0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZSAtPiB8XG4gICAgZnVuY3Rpb24gZHJhZyAoZSkge1xuICAgICAgICB2YXIgb2Zmc2V0O1xuXG4gICAgICAgIGlmICghdGhpcy5kcmFnZ2luZykgeyByZXR1cm4gfVxuXG4gICAgICAgIC8vIEdldCB0aGUgb2Zmc2V0IG9mIHRoZSBldmVudCBmcm9tIHRoZSBmaXJzdCBzaWRlIG9mIHRoZVxuICAgICAgICAvLyBwYWlyIGB0aGlzLnN0YXJ0YC4gU3VwcG9ydHMgdG91Y2ggZXZlbnRzLCBidXQgbm90IG11bHRpdG91Y2gsIHNvIG9ubHkgdGhlIGZpcnN0XG4gICAgICAgIC8vIGZpbmdlciBgdG91Y2hlc1swXWAgaXMgY291bnRlZC5cbiAgICAgICAgaWYgKCd0b3VjaGVzJyBpbiBlKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlLnRvdWNoZXNbMF1bY2xpZW50QXhpc10gLSB0aGlzLnN0YXJ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb2Zmc2V0ID0gZVtjbGllbnRBeGlzXSAtIHRoaXMuc3RhcnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiB3aXRoaW4gc25hcE9mZnNldCBvZiBtaW4gb3IgbWF4LCBzZXQgb2Zmc2V0IHRvIG1pbiBvciBtYXguXG4gICAgICAgIC8vIHNuYXBPZmZzZXQgYnVmZmVycyBhLm1pblNpemUgYW5kIGIubWluU2l6ZSwgc28gbG9naWMgaXMgb3Bwb3NpdGUgZm9yIGJvdGguXG4gICAgICAgIC8vIEluY2x1ZGUgdGhlIGFwcHJvcHJpYXRlIGd1dHRlciBzaXplcyB0byBwcmV2ZW50IG92ZXJmbG93cy5cbiAgICAgICAgaWYgKG9mZnNldCA8PSBlbGVtZW50c1t0aGlzLmFdLm1pblNpemUgKyBzbmFwT2Zmc2V0ICsgdGhpcy5hR3V0dGVyU2l6ZSkge1xuICAgICAgICAgICAgb2Zmc2V0ID0gZWxlbWVudHNbdGhpcy5hXS5taW5TaXplICsgdGhpcy5hR3V0dGVyU2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmIChvZmZzZXQgPj0gdGhpcy5zaXplIC0gKGVsZW1lbnRzW3RoaXMuYl0ubWluU2l6ZSArIHNuYXBPZmZzZXQgKyB0aGlzLmJHdXR0ZXJTaXplKSkge1xuICAgICAgICAgICAgb2Zmc2V0ID0gdGhpcy5zaXplIC0gKGVsZW1lbnRzW3RoaXMuYl0ubWluU2l6ZSArIHRoaXMuYkd1dHRlclNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWN0dWFsbHkgYWRqdXN0IHRoZSBzaXplLlxuICAgICAgICBhZGp1c3QuY2FsbCh0aGlzLCBvZmZzZXQpO1xuXG4gICAgICAgIC8vIENhbGwgdGhlIGRyYWcgY2FsbGJhY2sgY29udGlub3VzbHkuIERvbid0IGRvIGFueXRoaW5nIHRvbyBpbnRlbnNpdmVcbiAgICAgICAgLy8gaW4gdGhpcyBjYWxsYmFjay5cbiAgICAgICAgaWYgKG9wdGlvbnMub25EcmFnKSB7XG4gICAgICAgICAgICBvcHRpb25zLm9uRHJhZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2FjaGUgc29tZSBpbXBvcnRhbnQgc2l6ZXMgd2hlbiBkcmFnIHN0YXJ0cywgc28gd2UgZG9uJ3QgaGF2ZSB0byBkbyB0aGF0XG4gICAgLy8gY29udGlub3VzbHk6XG4gICAgLy9cbiAgICAvLyBgc2l6ZWA6IFRoZSB0b3RhbCBzaXplIG9mIHRoZSBwYWlyLiBGaXJzdCArIHNlY29uZCArIGZpcnN0IGd1dHRlciArIHNlY29uZCBndXR0ZXIuXG4gICAgLy8gYHN0YXJ0YDogVGhlIGxlYWRpbmcgc2lkZSBvZiB0aGUgZmlyc3QgZWxlbWVudC5cbiAgICAvL1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIHwgICAgICBhR3V0dGVyU2l6ZSAtPiB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgPC0gYkd1dHRlclNpemUgICAgICAgfFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIHwgPC0gc3RhcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemUgLT4gfFxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZVNpemVzICgpIHtcbiAgICAgICAgLy8gRmlndXJlIG91dCB0aGUgcGFyZW50IHNpemUgbWludXMgcGFkZGluZy5cbiAgICAgICAgdmFyIGEgPSBlbGVtZW50c1t0aGlzLmFdLmVsZW1lbnQ7XG4gICAgICAgIHZhciBiID0gZWxlbWVudHNbdGhpcy5iXS5lbGVtZW50O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IGFbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl0gKyBiW2dldEJvdW5kaW5nQ2xpZW50UmVjdF0oKVtkaW1lbnNpb25dICsgdGhpcy5hR3V0dGVyU2l6ZSArIHRoaXMuYkd1dHRlclNpemU7XG4gICAgICAgIHRoaXMuc3RhcnQgPSBhW2dldEJvdW5kaW5nQ2xpZW50UmVjdF0oKVtwb3NpdGlvbl07XG4gICAgfVxuXG4gICAgLy8gc3RvcERyYWdnaW5nIGlzIHZlcnkgc2ltaWxhciB0byBzdGFydERyYWdnaW5nIGluIHJldmVyc2UuXG4gICAgZnVuY3Rpb24gc3RvcERyYWdnaW5nICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgYSA9IGVsZW1lbnRzW3NlbGYuYV0uZWxlbWVudDtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1tzZWxmLmJdLmVsZW1lbnQ7XG5cbiAgICAgICAgaWYgKHNlbGYuZHJhZ2dpbmcgJiYgb3B0aW9ucy5vbkRyYWdFbmQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnRW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLmRyYWdnaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBzdG9yZWQgZXZlbnQgbGlzdGVuZXJzLiBUaGlzIGlzIHdoeSB3ZSBzdG9yZSB0aGVtLlxuICAgICAgICBnbG9iYWxbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ21vdXNldXAnLCBzZWxmLnN0b3ApO1xuICAgICAgICBnbG9iYWxbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoZW5kJywgc2VsZi5zdG9wKTtcbiAgICAgICAgZ2xvYmFsW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCd0b3VjaGNhbmNlbCcsIHNlbGYuc3RvcCk7XG5cbiAgICAgICAgc2VsZi5wYXJlbnRbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ21vdXNlbW92ZScsIHNlbGYubW92ZSk7XG4gICAgICAgIHNlbGYucGFyZW50W3JlbW92ZUV2ZW50TGlzdGVuZXJdKCd0b3VjaG1vdmUnLCBzZWxmLm1vdmUpO1xuXG4gICAgICAgIC8vIERlbGV0ZSB0aGVtIG9uY2UgdGhleSBhcmUgcmVtb3ZlZC4gSSB0aGluayB0aGlzIG1ha2VzIGEgZGlmZmVyZW5jZVxuICAgICAgICAvLyBpbiBtZW1vcnkgdXNhZ2Ugd2l0aCBhIGxvdCBvZiBzcGxpdHMgb24gb25lIHBhZ2UuIEJ1dCBJIGRvbid0IGtub3cgZm9yIHN1cmUuXG4gICAgICAgIGRlbGV0ZSBzZWxmLnN0b3A7XG4gICAgICAgIGRlbGV0ZSBzZWxmLm1vdmU7XG5cbiAgICAgICAgYVtyZW1vdmVFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYVtyZW1vdmVFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXG4gICAgICAgIGEuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBhLnN0eWxlLndlYmtpdFVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYS5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGEuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuXG4gICAgICAgIGIuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBiLnN0eWxlLndlYmtpdFVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYi5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuXG4gICAgICAgIHNlbGYuZ3V0dGVyLnN0eWxlLmN1cnNvciA9ICcnO1xuICAgICAgICBzZWxmLnBhcmVudC5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICB9XG5cbiAgICAvLyBzdGFydERyYWdnaW5nIGNhbGxzIGBjYWxjdWxhdGVTaXplc2AgdG8gc3RvcmUgdGhlIGluaXRhbCBzaXplIGluIHRoZSBwYWlyIG9iamVjdC5cbiAgICAvLyBJdCBhbHNvIGFkZHMgZXZlbnQgbGlzdGVuZXJzIGZvciBtb3VzZS90b3VjaCBldmVudHMsXG4gICAgLy8gYW5kIHByZXZlbnRzIHNlbGVjdGlvbiB3aGlsZSBkcmFnZ2luZyBzbyBhdm9pZCB0aGUgc2VsZWN0aW5nIHRleHQuXG4gICAgZnVuY3Rpb24gc3RhcnREcmFnZ2luZyAoZSkge1xuICAgICAgICAvLyBBbGlhcyBmcmVxdWVudGx5IHVzZWQgdmFyaWFibGVzIHRvIHNhdmUgc3BhY2UuIDIwMCBieXRlcy5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgYSA9IGVsZW1lbnRzW3NlbGYuYV0uZWxlbWVudDtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1tzZWxmLmJdLmVsZW1lbnQ7XG5cbiAgICAgICAgLy8gQ2FsbCB0aGUgb25EcmFnU3RhcnQgY2FsbGJhY2suXG4gICAgICAgIGlmICghc2VsZi5kcmFnZ2luZyAmJiBvcHRpb25zLm9uRHJhZ1N0YXJ0KSB7XG4gICAgICAgICAgICBvcHRpb25zLm9uRHJhZ1N0YXJ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb24ndCBhY3R1YWxseSBkcmFnIHRoZSBlbGVtZW50LiBXZSBlbXVsYXRlIHRoYXQgaW4gdGhlIGRyYWcgZnVuY3Rpb24uXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAvLyBTZXQgdGhlIGRyYWdnaW5nIHByb3BlcnR5IG9mIHRoZSBwYWlyIG9iamVjdC5cbiAgICAgICAgc2VsZi5kcmFnZ2luZyA9IHRydWU7XG5cbiAgICAgICAgLy8gQ3JlYXRlIHR3byBldmVudCBsaXN0ZW5lcnMgYm91bmQgdG8gdGhlIHNhbWUgcGFpciBvYmplY3QgYW5kIHN0b3JlXG4gICAgICAgIC8vIHRoZW0gaW4gdGhlIHBhaXIgb2JqZWN0LlxuICAgICAgICBzZWxmLm1vdmUgPSBkcmFnLmJpbmQoc2VsZik7XG4gICAgICAgIHNlbGYuc3RvcCA9IHN0b3BEcmFnZ2luZy5iaW5kKHNlbGYpO1xuXG4gICAgICAgIC8vIEFsbCB0aGUgYmluZGluZy4gYHdpbmRvd2AgZ2V0cyB0aGUgc3RvcCBldmVudHMgaW4gY2FzZSB3ZSBkcmFnIG91dCBvZiB0aGUgZWxlbWVudHMuXG4gICAgICAgIGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgnbW91c2V1cCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuICAgICAgICBnbG9iYWxbYWRkRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoY2FuY2VsJywgc2VsZi5zdG9wKTtcblxuICAgICAgICBzZWxmLnBhcmVudFthZGRFdmVudExpc3RlbmVyXSgnbW91c2Vtb3ZlJywgc2VsZi5tb3ZlKTtcbiAgICAgICAgc2VsZi5wYXJlbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cbiAgICAgICAgLy8gRGlzYWJsZSBzZWxlY3Rpb24uIERpc2FibGUhXG4gICAgICAgIGFbYWRkRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG4gICAgICAgIGFbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuICAgICAgICBiW2FkZEV2ZW50TGlzdGVuZXJdKCdzZWxlY3RzdGFydCcsIE5PT1ApO1xuICAgICAgICBiW2FkZEV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcblxuICAgICAgICBhLnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGEuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYS5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBhLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cbiAgICAgICAgYi5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBiLnN0eWxlLndlYmtpdFVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGIuc3R5bGUuTW96VXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXG4gICAgICAgIC8vIFNldCB0aGUgY3Vyc29yLCBib3RoIG9uIHRoZSBndXR0ZXIgYW5kIHRoZSBwYXJlbnQgZWxlbWVudC5cbiAgICAgICAgLy8gRG9pbmcgb25seSBhLCBiIGFuZCBndXR0ZXIgY2F1c2VzIGZsaWNrZXJpbmcuXG4gICAgICAgIHNlbGYuZ3V0dGVyLnN0eWxlLmN1cnNvciA9IGN1cnNvcjtcbiAgICAgICAgc2VsZi5wYXJlbnQuc3R5bGUuY3Vyc29yID0gY3Vyc29yO1xuXG4gICAgICAgIC8vIENhY2hlIHRoZSBpbml0aWFsIHNpemVzIG9mIHRoZSBwYWlyLlxuICAgICAgICBjYWxjdWxhdGVTaXplcy5jYWxsKHNlbGYpO1xuICAgIH1cblxuICAgIC8vIDUuIENyZWF0ZSBwYWlyIGFuZCBlbGVtZW50IG9iamVjdHMuIEVhY2ggcGFpciBoYXMgYW4gaW5kZXggcmVmZXJlbmNlIHRvXG4gICAgLy8gZWxlbWVudHMgYGFgIGFuZCBgYmAgb2YgdGhlIHBhaXIgKGZpcnN0IGFuZCBzZWNvbmQgZWxlbWVudHMpLlxuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgZWxlbWVudHMgd2hpbGUgcGFpcmluZyB0aGVtIG9mZi4gRXZlcnkgcGFpciBnZXRzIGFcbiAgICAvLyBgcGFpcmAgb2JqZWN0LCBhIGd1dHRlciwgYW5kIGlzRmlyc3QvaXNMYXN0IHByb3BlcnRpZXMuXG4gICAgLy9cbiAgICAvLyBCYXNpYyBsb2dpYzpcbiAgICAvL1xuICAgIC8vIC0gU3RhcnRpbmcgd2l0aCB0aGUgc2Vjb25kIGVsZW1lbnQgYGkgPiAwYCwgY3JlYXRlIGBwYWlyYCBvYmplY3RzIHdpdGhcbiAgICAvLyAgIGBhID0gaSAtIDFgIGFuZCBgYiA9IGlgXG4gICAgLy8gLSBTZXQgZ3V0dGVyIHNpemVzIGJhc2VkIG9uIHRoZSBfcGFpcl8gYmVpbmcgZmlyc3QvbGFzdC4gVGhlIGZpcnN0IGFuZCBsYXN0XG4gICAgLy8gICBwYWlyIGhhdmUgZ3V0dGVyU2l6ZSAvIDIsIHNpbmNlIHRoZXkgb25seSBoYXZlIG9uZSBoYWxmIGd1dHRlciwgYW5kIG5vdCB0d28uXG4gICAgLy8gLSBDcmVhdGUgZ3V0dGVyIGVsZW1lbnRzIGFuZCBhZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIC8vIC0gU2V0IHRoZSBzaXplIG9mIHRoZSBlbGVtZW50cywgbWludXMgdGhlIGd1dHRlciBzaXplcy5cbiAgICAvL1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCAgICAgaT0wICAgICB8ICAgICAgICAgaT0xICAgICAgICAgfCAgICAgICAgaT0yICAgICAgIHwgICAgICBpPTMgICAgIHxcbiAgICAvLyB8ICAgICAgICAgICAgIHwgICAgICAgaXNGaXJzdCAgICAgICB8ICAgICAgICAgICAgICAgICAgfCAgICAgaXNMYXN0ICAgfFxuICAgIC8vIHwgICAgICAgICAgIHBhaXIgMCAgICAgICAgICAgICAgICBwYWlyIDEgICAgICAgICAgICAgcGFpciAyICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgIHwgICAgICAgICAgICAgIHxcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIHZhciBwYWlycyA9IFtdO1xuICAgIGVsZW1lbnRzID0gaWRzLm1hcChmdW5jdGlvbiAoaWQsIGkpIHtcbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBlbGVtZW50IG9iamVjdC5cbiAgICAgICAgdmFyIGVsZW1lbnQgPSB7XG4gICAgICAgICAgICBlbGVtZW50OiBlbGVtZW50T3JTZWxlY3RvcihpZCksXG4gICAgICAgICAgICBzaXplOiBzaXplc1tpXSxcbiAgICAgICAgICAgIG1pblNpemU6IG1pblNpemVzW2ldLFxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBwYWlyO1xuXG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBwYWlyIG9iamVjdCB3aXRoIGl0J3MgbWV0YWRhdGEuXG4gICAgICAgICAgICBwYWlyID0ge1xuICAgICAgICAgICAgICAgIGE6IGkgLSAxLFxuICAgICAgICAgICAgICAgIGI6IGksXG4gICAgICAgICAgICAgICAgZHJhZ2dpbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGlzRmlyc3Q6IChpID09PSAxKSxcbiAgICAgICAgICAgICAgICBpc0xhc3Q6IChpID09PSBpZHMubGVuZ3RoIC0gMSksXG4gICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb24sXG4gICAgICAgICAgICAgICAgcGFyZW50OiBwYXJlbnQsXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBGb3IgZmlyc3QgYW5kIGxhc3QgcGFpcnMsIGZpcnN0IGFuZCBsYXN0IGd1dHRlciB3aWR0aCBpcyBoYWxmLlxuICAgICAgICAgICAgcGFpci5hR3V0dGVyU2l6ZSA9IGd1dHRlclNpemU7XG4gICAgICAgICAgICBwYWlyLmJHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZTtcblxuICAgICAgICAgICAgaWYgKHBhaXIuaXNGaXJzdCkge1xuICAgICAgICAgICAgICAgIHBhaXIuYUd1dHRlclNpemUgPSBndXR0ZXJTaXplIC8gMjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBhaXIuaXNMYXN0KSB7XG4gICAgICAgICAgICAgICAgcGFpci5iR3V0dGVyU2l6ZSA9IGd1dHRlclNpemUgLyAyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgcGFyZW50IGhhcyBhIHJldmVyc2UgZmxleC1kaXJlY3Rpb24sIHN3aXRjaCB0aGUgcGFpciBlbGVtZW50cy5cbiAgICAgICAgICAgIGlmIChwYXJlbnRGbGV4RGlyZWN0aW9uID09PSAncm93LXJldmVyc2UnIHx8IHBhcmVudEZsZXhEaXJlY3Rpb24gPT09ICdjb2x1bW4tcmV2ZXJzZScpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGVtcCA9IHBhaXIuYTtcbiAgICAgICAgICAgICAgICBwYWlyLmEgPSBwYWlyLmI7XG4gICAgICAgICAgICAgICAgcGFpci5iID0gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERldGVybWluZSB0aGUgc2l6ZSBvZiB0aGUgY3VycmVudCBlbGVtZW50LiBJRTggaXMgc3VwcG9ydGVkIGJ5XG4gICAgICAgIC8vIHN0YXRpY2x5IGFzc2lnbmluZyBzaXplcyB3aXRob3V0IGRyYWdnYWJsZSBndXR0ZXJzLiBBc3NpZ25zIGEgc3RyaW5nXG4gICAgICAgIC8vIHRvIGBzaXplYC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSUU5IGFuZCBhYm92ZVxuICAgICAgICBpZiAoIWlzSUU4KSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgZ3V0dGVyIGVsZW1lbnRzIGZvciBlYWNoIHBhaXIuXG4gICAgICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgZ3V0dGVyRWxlbWVudCA9IGd1dHRlcihpLCBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgICAgIHNldEd1dHRlclNpemUoZ3V0dGVyRWxlbWVudCwgZ3V0dGVyU2l6ZSk7XG5cbiAgICAgICAgICAgICAgICBndXR0ZXJFbGVtZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZWRvd24nLCBzdGFydERyYWdnaW5nLmJpbmQocGFpcikpO1xuICAgICAgICAgICAgICAgIGd1dHRlckVsZW1lbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoc3RhcnQnLCBzdGFydERyYWdnaW5nLmJpbmQocGFpcikpO1xuXG4gICAgICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShndXR0ZXJFbGVtZW50LCBlbGVtZW50LmVsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgcGFpci5ndXR0ZXIgPSBndXR0ZXJFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHRoZSBlbGVtZW50IHNpemUgdG8gb3VyIGRldGVybWluZWQgc2l6ZS5cbiAgICAgICAgLy8gSGFsZi1zaXplIGd1dHRlcnMgZm9yIGZpcnN0IGFuZCBsYXN0IGVsZW1lbnRzLlxuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpID09PSBpZHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoZWxlbWVudC5lbGVtZW50LCBlbGVtZW50LnNpemUsIGd1dHRlclNpemUgLyAyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldEVsZW1lbnRTaXplKGVsZW1lbnQuZWxlbWVudCwgZWxlbWVudC5zaXplLCBndXR0ZXJTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb21wdXRlZFNpemUgPSBlbGVtZW50LmVsZW1lbnRbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl07XG5cbiAgICAgICAgaWYgKGNvbXB1dGVkU2l6ZSA8IGVsZW1lbnQubWluU2l6ZSkge1xuICAgICAgICAgICAgZWxlbWVudC5taW5TaXplID0gY29tcHV0ZWRTaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWZ0ZXIgdGhlIGZpcnN0IGl0ZXJhdGlvbiwgYW5kIHdlIGhhdmUgYSBwYWlyIG9iamVjdCwgYXBwZW5kIGl0IHRvIHRoZVxuICAgICAgICAvLyBsaXN0IG9mIHBhaXJzLlxuICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgIHBhaXJzLnB1c2gocGFpcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWxlbWVudFxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gc2V0U2l6ZXMgKG5ld1NpemVzKSB7XG4gICAgICAgIG5ld1NpemVzLmZvckVhY2goZnVuY3Rpb24gKG5ld1NpemUsIGkpIHtcbiAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaSAtIDFdO1xuICAgICAgICAgICAgICAgIHZhciBhID0gZWxlbWVudHNbcGFpci5hXTtcbiAgICAgICAgICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3BhaXIuYl07XG5cbiAgICAgICAgICAgICAgICBhLnNpemUgPSBuZXdTaXplc1tpIC0gMV07XG4gICAgICAgICAgICAgICAgYi5zaXplID0gbmV3U2l6ZTtcblxuICAgICAgICAgICAgICAgIHNldEVsZW1lbnRTaXplKGEuZWxlbWVudCwgYS5zaXplLCBwYWlyLmFHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgICAgICBzZXRFbGVtZW50U2l6ZShiLmVsZW1lbnQsIGIuc2l6ZSwgcGFpci5iR3V0dGVyU2l6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgICAgICBwYWlycy5mb3JFYWNoKGZ1bmN0aW9uIChwYWlyKSB7XG4gICAgICAgICAgICBwYWlyLnBhcmVudC5yZW1vdmVDaGlsZChwYWlyLmd1dHRlcik7XG4gICAgICAgICAgICBlbGVtZW50c1twYWlyLmFdLmVsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9ICcnO1xuICAgICAgICAgICAgZWxlbWVudHNbcGFpci5iXS5lbGVtZW50LnN0eWxlW2RpbWVuc2lvbl0gPSAnJztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKGlzSUU4KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXRTaXplczogc2V0U2l6ZXMsXG4gICAgICAgICAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc2V0U2l6ZXM6IHNldFNpemVzLFxuICAgICAgICBnZXRTaXplczogZnVuY3Rpb24gZ2V0U2l6ZXMgKCkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnRzLm1hcChmdW5jdGlvbiAoZWxlbWVudCkgeyByZXR1cm4gZWxlbWVudC5zaXplOyB9KVxuICAgICAgICB9LFxuICAgICAgICBjb2xsYXBzZTogZnVuY3Rpb24gY29sbGFwc2UgKGkpIHtcbiAgICAgICAgICAgIGlmIChpID09PSBwYWlycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFpciA9IHBhaXJzW2kgLSAxXTtcblxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVNpemVzLmNhbGwocGFpcik7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzSUU4KSB7XG4gICAgICAgICAgICAgICAgICAgIGFkanVzdC5jYWxsKHBhaXIsIHBhaXIuc2l6ZSAtIHBhaXIuYkd1dHRlclNpemUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIkMSA9IHBhaXJzW2ldO1xuXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlU2l6ZXMuY2FsbChwYWlyJDEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFpc0lFOCkge1xuICAgICAgICAgICAgICAgICAgICBhZGp1c3QuY2FsbChwYWlyJDEsIHBhaXIkMS5hR3V0dGVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIH1cbn07XG5cbnJldHVybiBTcGxpdDtcblxufSkpKTtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFBhbGV0dGUoY29sb3JTdG9wcywgbnVtQ29sb3JzKSB7XG5cdGNvbnN0IG9mZnNldHMgPSBbXVxuXHRjb25zdCByZWRzID0gW11cblx0Y29uc3QgZ3JlZW5zID0gW11cblx0Y29uc3QgYmx1ZXMgPSBbXVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JTdG9wcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNvbG9yU3RvcCA9IGNvbG9yU3RvcHNbaV1cblxuXHRcdG9mZnNldHMucHVzaChjb2xvclN0b3BbMF0pXG5cblx0XHRjb25zdCBoZXhDb2xvciA9IGNvbG9yU3RvcFsxXVxuXHRcdHJlZHMucHVzaCgoaGV4Q29sb3IgPj4gMTYgJiAyNTUpIC8gMjU1KVxuXHRcdGdyZWVucy5wdXNoKChoZXhDb2xvciA+PiA4ICYgMjU1KSAvIDI1NSlcblx0XHRibHVlcy5wdXNoKChoZXhDb2xvciAmIDI1NSkgLyAyNTUpXG5cdH1cblxuXHRjb25zdCByZWRJbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIHJlZHMpXG5cdGNvbnN0IGdyZWVuSW50ZXJwb2xhbnQgPSBjcmVhdGVJbnRlcnBvbGFudChvZmZzZXRzLCBncmVlbnMpXG5cdGNvbnN0IGJsdWVJbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIGJsdWVzKVxuXG5cdGNvbnN0IHBhbGV0dGUgPSBbXVxuXHRjb25zdCBpbmNyZW1lbnQgPSAxIC8gbnVtQ29sb3JzXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxOyBpICs9IGluY3JlbWVudCkge1xuXHRcdHBhbGV0dGUucHVzaChyZWRJbnRlcnBvbGFudChpKSwgZ3JlZW5JbnRlcnBvbGFudChpKSwgYmx1ZUludGVycG9sYW50KGkpLCAyNTUpXG5cdH1cblxuXHRyZXR1cm4gcGFsZXR0ZVxufVxuXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Nb25vdG9uZV9jdWJpY19pbnRlcnBvbGF0aW9uXG5mdW5jdGlvbiBjcmVhdGVJbnRlcnBvbGFudCh4cywgeXMpIHtcblx0Y29uc3QgbGVuZ3RoID0geHMubGVuZ3RoXG5cblx0Ly8gRGVhbCB3aXRoIGxlbmd0aCBpc3N1ZXNcblx0aWYgKGxlbmd0aCAhPT0geXMubGVuZ3RoKSB7XG5cdFx0dGhyb3cgXCJOZWVkIGFuIGVxdWFsIGNvdW50IG9mIHhzIGFuZCB5cy5cIlxuXHR9XG5cdGlmIChsZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gKCkgPT4gMFxuXHR9XG5cdGlmIChsZW5ndGggPT09IDEpIHtcblx0XHQvLyBJbXBsOiBQcmVjb21wdXRpbmcgdGhlIHJlc3VsdCBwcmV2ZW50cyBwcm9ibGVtcyBpZiB5cyBpcyBtdXRhdGVkIGxhdGVyIGFuZCBhbGxvd3MgZ2FyYmFnZSBjb2xsZWN0aW9uIG9mIHlzXG5cdFx0Ly8gSW1wbDogVW5hcnkgcGx1cyBwcm9wZXJseSBjb252ZXJ0cyB2YWx1ZXMgdG8gbnVtYmVyc1xuXHRcdGNvbnN0IHJlc3VsdCA9ICt5c1swXVxuXHRcdHJldHVybiAoKSA9PiByZXN1bHRcblx0fVxuXG5cdC8vIFJlYXJyYW5nZSB4cyBhbmQgeXMgc28gdGhhdCB4cyBpcyBzb3J0ZWRcblx0Y29uc3QgaW5kZXhlcyA9IFtdXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRpbmRleGVzLnB1c2goaSlcblx0fVxuXHRpbmRleGVzLnNvcnQoKGEsIGIpID0+IHhzW2FdIDwgeHNbYl0gPyAtMSA6IDEpXG5cdGNvbnN0IG9sZFhzID0geHMsXG5cdFx0b2xkWXMgPSB5c1xuXHQvLyBJbXBsOiBDcmVhdGluZyBuZXcgYXJyYXlzIGFsc28gcHJldmVudHMgcHJvYmxlbXMgaWYgdGhlIGlucHV0IGFycmF5cyBhcmUgbXV0YXRlZCBsYXRlclxuXHR4cyA9IFtdXG5cdHlzID0gW11cblx0Ly8gSW1wbDogVW5hcnkgcGx1cyBwcm9wZXJseSBjb252ZXJ0cyB2YWx1ZXMgdG8gbnVtYmVyc1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0eHMucHVzaCgrb2xkWHNbaW5kZXhlc1tpXV0pXG5cdFx0eXMucHVzaCgrb2xkWXNbaW5kZXhlc1tpXV0pXG5cdH1cblxuXHQvLyBHZXQgY29uc2VjdXRpdmUgZGlmZmVyZW5jZXMgYW5kIHNsb3Blc1xuXHRjb25zdCBkeXMgPSBbXSxcblx0XHRkeHMgPSBbXSxcblx0XHRtcyA9IFtdXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0Y29uc3QgZHggPSB4c1tpICsgMV0gLSB4c1tpXSxcblx0XHRcdGR5ID0geXNbaSArIDFdIC0geXNbaV1cblx0XHRkeHMucHVzaChkeClcblx0XHRkeXMucHVzaChkeSlcblx0XHRtcy5wdXNoKGR5IC8gZHgpXG5cdH1cblxuXHQvLyBHZXQgZGVncmVlLTEgY29lZmZpY2llbnRzXG5cdGNvbnN0IGMxcyA9IFttc1swXV1cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkeHMubGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0Y29uc3QgbSA9IG1zW2ldLFxuXHRcdFx0bU5leHQgPSBtc1tpICsgMV1cblx0XHRpZiAobSAqIG1OZXh0IDw9IDApIHtcblx0XHRcdGMxcy5wdXNoKDApXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGR4XyA9IGR4c1tpXSxcblx0XHRcdFx0ZHhOZXh0ID0gZHhzW2kgKyAxXSxcblx0XHRcdFx0Y29tbW9uID0gZHhfICsgZHhOZXh0XG5cdFx0XHRjMXMucHVzaCgzICogY29tbW9uIC8gKChjb21tb24gKyBkeE5leHQpIC8gbSArIChjb21tb24gKyBkeF8pIC8gbU5leHQpKVxuXHRcdH1cblx0fVxuXHRjMXMucHVzaChtc1ttcy5sZW5ndGggLSAxXSlcblxuXHQvLyBHZXQgZGVncmVlLTIgYW5kIGRlZ3JlZS0zIGNvZWZmaWNpZW50c1xuXHRjb25zdCBjMnMgPSBbXSxcblx0XHRjM3MgPSBbXVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGMxcy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRjb25zdCBjMSA9IGMxc1tpXSxcblx0XHRcdG1fID0gbXNbaV0sXG5cdFx0XHRpbnZEeCA9IDEgLyBkeHNbaV0sXG5cdFx0XHRjb21tb25fID0gYzEgKyBjMXNbaSArIDFdIC0gbV8gLSBtX1xuXHRcdGMycy5wdXNoKChtXyAtIGMxIC0gY29tbW9uXykgKiBpbnZEeClcblx0XHRjM3MucHVzaChjb21tb25fICogaW52RHggKiBpbnZEeClcblx0fVxuXG5cdC8vIFJldHVybiBpbnRlcnBvbGFudCBmdW5jdGlvblxuXHRyZXR1cm4geCA9PiB7XG5cdFx0Ly8gVGhlIHJpZ2h0bW9zdCBwb2ludCBpbiB0aGUgZGF0YXNldCBzaG91bGQgZ2l2ZSBhbiBleGFjdCByZXN1bHRcblx0XHRsZXQgaSA9IHhzLmxlbmd0aCAtIDFcblx0XHRpZiAoeCA9PT0geHNbaV0pIHtcblx0XHRcdHJldHVybiB5c1tpXVxuXHRcdH1cblxuXHRcdC8vIFNlYXJjaCBmb3IgdGhlIGludGVydmFsIHggaXMgaW4sIHJldHVybmluZyB0aGUgY29ycmVzcG9uZGluZyB5IGlmIHggaXMgb25lIG9mIHRoZSBvcmlnaW5hbCB4c1xuXHRcdGxldCBsb3cgPSAwLFxuXHRcdFx0bWlkLCBoaWdoID0gYzNzLmxlbmd0aCAtIDFcblx0XHR3aGlsZSAobG93IDw9IGhpZ2gpIHtcblx0XHRcdG1pZCA9IE1hdGguZmxvb3IoKGxvdyArIGhpZ2gpIC8gMilcblx0XHRcdGNvbnN0IHhIZXJlID0geHNbbWlkXVxuXHRcdFx0aWYgKHhIZXJlIDwgeCkge1xuXHRcdFx0XHRsb3cgPSBtaWQgKyAxXG5cdFx0XHR9IGVsc2UgaWYgKHhIZXJlID4geCkge1xuXHRcdFx0XHRoaWdoID0gbWlkIC0gMVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHlzW21pZF1cblx0XHRcdH1cblx0XHR9XG5cdFx0aSA9IE1hdGgubWF4KDAsIGhpZ2gpXG5cblx0XHQvLyBJbnRlcnBvbGF0ZVxuXHRcdGNvbnN0IGRpZmYgPSB4IC0geHNbaV0sXG5cdFx0XHRkaWZmU3EgPSBkaWZmICogZGlmZlxuXHRcdHJldHVybiB5c1tpXSArIGMxc1tpXSAqIGRpZmYgKyBjMnNbaV0gKiBkaWZmU3EgKyBjM3NbaV0gKiBkaWZmICogZGlmZlNxXG5cdH1cbn1cbiIsImltcG9ydCBnZXRQYWxldHRlIGZyb20gXCIuL2NvbG9yLWdyYWRpZW50LmpzXCJcbmltcG9ydCB7XG5cdGluaXRHbCxcblx0aW5pdFByb2dyYW0sXG5cdGdldFVuaWZvcm1zLFxuXHRyZW5kZXJHbFxufSBmcm9tIFwiLi93ZWJnbC11dGlscy5qc1wiXG5pbXBvcnQgU3BsaXQgZnJvbSBcInNwbGl0LmpzXCJcblxuY29uc3QgJHdpbmRvdyA9ICQod2luZG93KVxuY29uc3QgJGh0bWwgPSAkKFwiaHRtbFwiKVxuXG5jb25zdCAkaXRlcmF0aW9uVGV4dCA9ICQoXCIjaXRlcmF0aW9uLXRleHRcIilcbmNvbnN0ICRqY29uc3RhbnRUZXh0ID0gJChcIiNqdWxpYS1jb25zdGFudC10ZXh0XCIpXG5cbmNvbnN0ICRjb250cm9sc0RpYWxvZyA9ICQoXCIjY29udHJvbHMtZGlhbG9nXCIpXG5zZXRUaW1lb3V0KCgpID0+IHtcblx0JGNvbnRyb2xzRGlhbG9nLmRpYWxvZyh7XG5cdFx0d2lkdGg6IFwiMjVlbVwiLFxuXHRcdGJ1dHRvbnM6IFt7XG5cdFx0XHR0ZXh0OiBcIkdvdCBpdCFcIixcblx0XHRcdGNsaWNrOiAoKSA9PiB7XG5cdFx0XHRcdCRjb250cm9sc0RpYWxvZy5kaWFsb2coXCJjbG9zZVwiKVxuXHRcdFx0fVxuXHRcdH1dLFxuXHRcdHNob3c6IFwic2NhbGVcIixcblx0XHRoaWRlOiBcInB1ZmZcIlxuXHR9KS50b29sdGlwKClcbn0sIDI1MClcblxuY29uc3QgU0NST0xMX0NPRUZGID0gMC4wNVxuY29uc3QgWk9PTV9DT0VGRiA9IDEuMVxuXG5sZXQgbWF4SXRlcmF0aW9ucyA9IDIwMFxuXG5jb25zdCBwYWxldHRlID0gZ2V0UGFsZXR0ZShbXG5cdFswLCAweDAwMDAwMF0sXG5cdFswLjEsIDB4NDQwODQ1XSxcblx0WzAuMiwgMHg3ZDFhNDhdLFxuXHRbMC4zLCAweGM2NmYzN10sXG5cdFswLjQsIDB4ZjBlOTUzXSxcblx0WzAuNSwgMHhmZmZmZmZdLFxuXHRbMC42LCAweDk4ZTk5MV0sXG5cdFswLjcsIDB4NTdjOWFlXSxcblx0WzAuOCwgMHgyNDViOWFdLFxuXHRbMC45LCAweDA3MTE0Nl0sXG5cdFsxLCAweDAwMDAwMF1cbl0sIDUxMilcblxuY29uc3QgTWFuZGVsYnJvdCA9IGluaXRGcmFjdGFsKFwiI21hbmRlbGJyb3QtY2FudmFzXCIsIHtcblx0cmVhbDoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IC0wLjcsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzXG5cdH0sXG5cdGltYWc6IHtcblx0XHRtaW46IG51bGwsXG5cdFx0bWlkOiAwLFxuXHRcdG1heDogbnVsbCxcblx0XHRyYW5nZTogMi40XG5cdH0sXG5cdG92ZXJDYW52YXM6IG51bGxcbn0pXG5cbmNvbnN0IEp1bGlhID0gaW5pdEZyYWN0YWwoXCIjanVsaWEtY2FudmFzXCIsIHtcblx0cmVhbDoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IDAsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzLjZcblx0fSxcblx0aW1hZzoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IDAsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzLjZcblx0fSxcblx0b3ZlckNhbnZhczogbnVsbFxufSwge1xuXHRyZWFsOiAtMC43Nyxcblx0aW1hZzogLTAuMDlcbn0pXG5cbmZ1bmN0aW9uIGluaXRGcmFjdGFsKGNhbnZhc1NlbGVjdG9yLCBib3VuZHMsIGpjb25zdGFudCkge1xuXHRjb25zdCBmcmFjdGFsID0ge31cblx0ZnJhY3RhbC4kY2FudmFzID0gJChjYW52YXNTZWxlY3Rvcilcblx0ZnJhY3RhbC5jYW52YXMgPSBmcmFjdGFsLiRjYW52YXNbMF1cblx0ZnJhY3RhbC5nbCA9IGluaXRHbChmcmFjdGFsKVxuXHRmcmFjdGFsLnByb2dyYW0gPSBpbml0UHJvZ3JhbShmcmFjdGFsKVxuXHRmcmFjdGFsLnVuaWZvcm1zID0gZ2V0VW5pZm9ybXMoZnJhY3RhbCwgW1xuXHRcdFwicmVhbE1pblwiLFxuXHRcdFwiaW1hZ01pblwiLFxuXHRcdFwibWF4SXRlcmF0aW9uc1wiLFxuXHRcdFwiaXNKdWxpYVwiLFxuXHRcdFwiamNvbnN0YW50XCIsXG5cdFx0XCJvdmVyQ2FudmFzXCIsXG5cdFx0XCJwYWxldHRlXCJcblx0XSlcblx0ZnJhY3RhbC5ib3VuZHMgPSBib3VuZHNcblx0aWYgKGpjb25zdGFudCkge1xuXHRcdGZyYWN0YWwuZ2wudW5pZm9ybTFpKGZyYWN0YWwudW5pZm9ybXMuaXNKdWxpYSwgdHJ1ZSlcblx0XHRmcmFjdGFsLmNvbnN0YW50ID0gamNvbnN0YW50XG5cdH1cblx0ZnJhY3RhbC5nbC51bmlmb3JtNGZ2KGZyYWN0YWwudW5pZm9ybXMucGFsZXR0ZSwgcGFsZXR0ZSlcblx0cmV0dXJuIGZyYWN0YWxcbn1cblxuZnVuY3Rpb24gdXBkYXRlSXRlcmF0aW9uVGV4dCgpIHtcblx0JGl0ZXJhdGlvblRleHQudGV4dChgSXRlcmF0aW9uIGNvdW50ID0gJHttYXhJdGVyYXRpb25zfWApXG59XG51cGRhdGVJdGVyYXRpb25UZXh0KClcblxuZnVuY3Rpb24gdXBkYXRlSkNvbnN0YW50VGV4dCgpIHtcblx0JGpjb25zdGFudFRleHQudGV4dChgU2hvd2luZyBKdWxpYSBzZXQgZm9yIGMgPSAke0p1bGlhLmNvbnN0YW50LnJlYWx9ICsgJHtKdWxpYS5jb25zdGFudC5pbWFnfWlgKVxufVxudXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cbmZ1bmN0aW9uIHJlc2l6ZUNhbnZhcyhmcmFjdGFsKSB7XG5cdGNvbnN0IHtcblx0XHQkY2FudmFzLFxuXHRcdGNhbnZhcyxcblx0XHRnbFxuXHR9ID0gZnJhY3RhbFxuXG5cdGNhbnZhcy53aWR0aCA9ICRjYW52YXMud2lkdGgoKVxuXHRjYW52YXMuaGVpZ2h0ID0gJGNhbnZhcy5oZWlnaHQoKVxuXHRnbC52aWV3cG9ydCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpXG5cdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXHRyZW5kZXIoZnJhY3RhbClcbn1cblxuZnVuY3Rpb24gcmVzaXplQ2FudmFzZXMoKSB7XG5cdHJlc2l6ZUNhbnZhcyhNYW5kZWxicm90KVxuXHRyZXNpemVDYW52YXMoSnVsaWEpXG59XG4kKHJlc2l6ZUNhbnZhc2VzKVxuJHdpbmRvdy5yZXNpemUocmVzaXplQ2FudmFzZXMpXG5cblNwbGl0KFtcIiNtYW5kZWxicm90LWNhbnZhcy13cmFwcGVyXCIsIFwiI2p1bGlhLWNhbnZhcy13cmFwcGVyXCJdLCB7XG5cdGRpcmVjdGlvbjogXCJob3Jpem9udGFsXCIsXG5cdGN1cnNvcjogXCJjb2wtcmVzaXplXCIsXG5cdG9uRHJhZzogcmVzaXplQ2FudmFzZXNcbn0pXG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZUJvdW5kcyh7XG5cdGNhbnZhcyxcblx0Ym91bmRzXG59KSB7XG5cdGJvdW5kcy5yZWFsLnJhbmdlID0gTWF0aC5hYnMoYm91bmRzLnJlYWwucmFuZ2UpXG5cdGJvdW5kcy5pbWFnLnJhbmdlID0gTWF0aC5hYnMoYm91bmRzLmltYWcucmFuZ2UpXG5cblx0Y29uc3QgYm91bmRzUmF0aW8gPSBib3VuZHMucmVhbC5yYW5nZSAvIGJvdW5kcy5pbWFnLnJhbmdlXG5cdGNvbnN0IGNhbnZhc1JhdGlvID0gY2FudmFzLndpZHRoIC8gY2FudmFzLmhlaWdodFxuXG5cdGlmIChib3VuZHNSYXRpbyA8IGNhbnZhc1JhdGlvKVxuXHRcdGJvdW5kcy5yZWFsLnJhbmdlID0gYm91bmRzLmltYWcucmFuZ2UgKiBjYW52YXNSYXRpb1xuXHRlbHNlIGlmIChib3VuZHNSYXRpbyA+IGNhbnZhc1JhdGlvKVxuXHRcdGJvdW5kcy5pbWFnLnJhbmdlID0gYm91bmRzLnJlYWwucmFuZ2UgLyBjYW52YXNSYXRpb1xuXG5cdGJvdW5kcy5yZWFsLm1pbiA9IGJvdW5kcy5yZWFsLm1pZCAtIGJvdW5kcy5yZWFsLnJhbmdlIC8gMlxuXHRib3VuZHMucmVhbC5tYXggPSBib3VuZHMucmVhbC5taWQgKyBib3VuZHMucmVhbC5yYW5nZSAvIDJcblx0Ym91bmRzLmltYWcubWluID0gYm91bmRzLmltYWcubWlkIC0gYm91bmRzLmltYWcucmFuZ2UgLyAyXG5cdGJvdW5kcy5pbWFnLm1heCA9IGJvdW5kcy5pbWFnLm1pZCArIGJvdW5kcy5pbWFnLnJhbmdlIC8gMlxuXG5cdGJvdW5kcy5vdmVyQ2FudmFzID0gYm91bmRzLnJlYWwucmFuZ2UgLyBjYW52YXMud2lkdGhcbn1cblxuZnVuY3Rpb24gcmVuZGVyKHtcblx0Z2wsXG5cdHVuaWZvcm1zLFxuXHRib3VuZHMsXG5cdGNvbnN0YW50XG59KSB7XG5cdGdsLnVuaWZvcm0xZih1bmlmb3Jtcy5yZWFsTWluLCBib3VuZHMucmVhbC5taW4pXG5cdGdsLnVuaWZvcm0xZih1bmlmb3Jtcy5pbWFnTWluLCBib3VuZHMuaW1hZy5taW4pXG5cdGdsLnVuaWZvcm0xZih1bmlmb3Jtcy5vdmVyQ2FudmFzLCBib3VuZHMub3ZlckNhbnZhcylcblx0Z2wudW5pZm9ybTFpKHVuaWZvcm1zLm1heEl0ZXJhdGlvbnMsIG1heEl0ZXJhdGlvbnMpXG5cdGlmIChjb25zdGFudClcblx0XHRnbC51bmlmb3JtMmYodW5pZm9ybXMuamNvbnN0YW50LCBjb25zdGFudC5yZWFsLCBjb25zdGFudC5pbWFnKVxuXG5cdHJlbmRlckdsKGdsKVxufVxuXG5mdW5jdGlvbiBnZXRaRnJvbVBpeGVsKHtcblx0Ym91bmRzXG59LCB4LCB5KSB7XG5cdHJldHVybiB7XG5cdFx0cmVhbDogYm91bmRzLnJlYWwubWluICsgeCAqIGJvdW5kcy5vdmVyQ2FudmFzLFxuXHRcdGltYWc6IGJvdW5kcy5pbWFnLm1heCAtIHkgKiBib3VuZHMub3ZlckNhbnZhc1xuXHR9XG59XG5cbmZ1bmN0aW9uIGluaXRLZXlkb3duQm91bmRzKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdGJvdW5kc1xuXHR9ID0gZnJhY3RhbFxuXG5cdCR3aW5kb3cua2V5ZG93bihldnQgPT4ge1xuXHRcdHN3aXRjaCAoZXZ0LndoaWNoKSB7XG5cdFx0XHRjYXNlIDM4OiAvLyB1cFxuXHRcdFx0Y2FzZSA4NzogLy8gd1xuXHRcdFx0XHRpZiAoZXZ0LnNoaWZ0S2V5KSB7XG5cdFx0XHRcdFx0Ym91bmRzLnJlYWwucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXHRcdFx0XHRcdGJvdW5kcy5pbWFnLnJhbmdlIC89IFpPT01fQ09FRkZcblx0XHRcdFx0fSBlbHNlXG5cdFx0XHRcdFx0Ym91bmRzLmltYWcubWlkICs9IGJvdW5kcy5pbWFnLnJhbmdlICogU0NST0xMX0NPRUZGXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDM3OiAvLyBsZWZ0XG5cdFx0XHRjYXNlIDY1OiAvLyBhXG5cdFx0XHRcdGJvdW5kcy5yZWFsLm1pZCAtPSBib3VuZHMucmVhbC5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXHRcdFx0XHRicmVha1xuXG5cdFx0XHRjYXNlIDQwOiAvLyBkb3duXG5cdFx0XHRjYXNlIDgzOiAvLyBzXG5cdFx0XHRcdGlmIChldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRib3VuZHMucmVhbC5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgKj0gWk9PTV9DT0VGRlxuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5taWQgLT0gYm91bmRzLmltYWcucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblxuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAzOTogLy8gcmlnaHRcblx0XHRcdGNhc2UgNjg6IC8vIGRcblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkICs9IGJvdW5kcy5yZWFsLnJhbmdlICogU0NST0xMX0NPRUZGXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdFx0cmVuZGVyKGZyYWN0YWwpXG5cdH0pXG59XG5pbml0S2V5ZG93bkJvdW5kcyhNYW5kZWxicm90KVxuaW5pdEtleWRvd25Cb3VuZHMoSnVsaWEpXG5cbmZ1bmN0aW9uIGluaXRLZXlkb3duSXRlcmF0aW9ucygpIHtcblx0JHdpbmRvdy5rZXlkb3duKGV2dCA9PiB7XG5cdFx0c3dpdGNoIChldnQud2hpY2gpIHtcblx0XHRcdGNhc2UgNDk6XG5cdFx0XHRjYXNlIDUwOlxuXHRcdFx0Y2FzZSA1MTpcblx0XHRcdGNhc2UgNTI6XG5cdFx0XHRjYXNlIDUzOlxuXHRcdFx0Y2FzZSA1NDpcblx0XHRcdGNhc2UgNTU6XG5cdFx0XHRjYXNlIDU2OlxuXHRcdFx0Y2FzZSA1NzogLy8gMS05XG5cdFx0XHRcdG1heEl0ZXJhdGlvbnMgPSAxMDAgKiBNYXRoLnBvdygyLCBldnQud2hpY2ggLSA1MSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMTg5OiAvLyAtXG5cdFx0XHRcdG1heEl0ZXJhdGlvbnMgLT0gMTAwXG5cdFx0XHRcdG1heEl0ZXJhdGlvbnMgPSBNYXRoLm1heChtYXhJdGVyYXRpb25zLCAwKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAxODc6IC8vICtcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyArPSAxMDBcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHR1cGRhdGVJdGVyYXRpb25UZXh0KClcblx0XHRyZW5kZXIoTWFuZGVsYnJvdClcblx0XHRyZW5kZXIoSnVsaWEpXG5cdH0pXG59XG5pbml0S2V5ZG93bkl0ZXJhdGlvbnMoKVxuXG5mdW5jdGlvbiBpbml0TW91c2VEb3duKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Y2FudmFzLFxuXHRcdGJvdW5kc1xuXHR9ID0gZnJhY3RhbFxuXG5cdCRjYW52YXMubW91c2Vkb3duKGRvd25ldnQgPT4ge1xuXHRcdGRvd25ldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gJGNhbnZhcy5vZmZzZXQoKVxuXHRcdGxldCBwbW91c2VYID0gZG93bmV2dC5jbGllbnRYIC0gb2Zmc2V0LmxlZnRcblx0XHRsZXQgcG1vdXNlWSA9IGRvd25ldnQuY2xpZW50WSAtIG9mZnNldC50b3BcblxuXHRcdGlmIChkb3duZXZ0LnNoaWZ0S2V5KSB7XG5cdFx0XHRKdWxpYS5jb25zdGFudCA9IGdldFpGcm9tUGl4ZWwoZnJhY3RhbCwgcG1vdXNlWCwgcG1vdXNlWSlcblx0XHRcdHVwZGF0ZUpDb25zdGFudFRleHQoKVxuXHRcdFx0cmVuZGVyKEp1bGlhKVxuXG5cdFx0XHQkaHRtbC5hZGRDbGFzcyhcImFsaWFzXCIpXG5cdFx0fSBlbHNlXG5cdFx0XHQkaHRtbC5hZGRDbGFzcyhcImFsbC1zY3JvbGxcIilcblxuXHRcdGZ1bmN0aW9uIG1vdXNlbW92ZShtb3ZlZXZ0KSB7XG5cdFx0XHRtb3ZlZXZ0LnByZXZlbnREZWZhdWx0KClcblxuXHRcdFx0Y29uc3QgbW91c2VYID0gbW92ZWV2dC5jbGllbnRYIC0gb2Zmc2V0LmxlZnRcblx0XHRcdGNvbnN0IG1vdXNlWSA9IG1vdmVldnQuY2xpZW50WSAtIG9mZnNldC50b3Bcblx0XHRcdGNvbnN0IG1vdXNlWiA9IGdldFpGcm9tUGl4ZWwoZnJhY3RhbCwgbW91c2VYLCBtb3VzZVkpXG5cblx0XHRcdGlmIChkb3duZXZ0LnNoaWZ0S2V5KSB7XG5cdFx0XHRcdEp1bGlhLmNvbnN0YW50ID0gbW91c2VaXG5cdFx0XHRcdHVwZGF0ZUpDb25zdGFudFRleHQoKVxuXHRcdFx0XHRyZW5kZXIoSnVsaWEpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBwbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBwbW91c2VYLCBwbW91c2VZKVxuXG5cdFx0XHRcdHBtb3VzZVggPSBtb3VzZVhcblx0XHRcdFx0cG1vdXNlWSA9IG1vdXNlWVxuXG5cdFx0XHRcdGJvdW5kcy5yZWFsLm1pZCArPSBwbW91c2VaLnJlYWwgLSBtb3VzZVoucmVhbFxuXHRcdFx0XHRib3VuZHMuaW1hZy5taWQgKz0gcG1vdXNlWi5pbWFnIC0gbW91c2VaLmltYWdcblxuXHRcdFx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRcdFx0cmVuZGVyKGZyYWN0YWwpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdCR3aW5kb3cubW91c2Vtb3ZlKG1vdXNlbW92ZSlcblxuXHRcdGZ1bmN0aW9uIG1vdXNldXAodXBldnQpIHtcblx0XHRcdHVwZXZ0LnByZXZlbnREZWZhdWx0KClcblxuXHRcdFx0JHdpbmRvdy5vZmYoXCJtb3VzZW1vdmVcIiwgbW91c2Vtb3ZlKVxuXHRcdFx0JHdpbmRvdy5vZmYoXCJtb3VzZXVwXCIsIG1vdXNldXApXG5cblx0XHRcdCRodG1sLnJlbW92ZUNsYXNzKFwiYWxpYXMgYWxsLXNjcm9sbFwiKVxuXHRcdH1cblx0XHQkd2luZG93Lm1vdXNldXAobW91c2V1cClcblx0fSlcbn1cbmluaXRNb3VzZURvd24oTWFuZGVsYnJvdClcbmluaXRNb3VzZURvd24oSnVsaWEpXG5cbmZ1bmN0aW9uIGluaXRXaGVlbChmcmFjdGFsKSB7XG5cdGNvbnN0IHtcblx0XHQkY2FudmFzLFxuXHRcdGJvdW5kc1xuXHR9ID0gZnJhY3RhbFxuXG5cdCRjYW52YXMub24oXCJ3aGVlbFwiLCBldnQgPT4ge1xuXHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRjb25zdCBvZmZzZXQgPSAkY2FudmFzLm9mZnNldCgpXG5cdFx0Y29uc3QgbW91c2VYID0gZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdGNvbnN0IG1vdXNlWSA9IGV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXG5cdFx0Y29uc3QgZGVsdGFZID0gZXZ0Lm9yaWdpbmFsRXZlbnQuZGVsdGFZXG5cblx0XHRpZiAoZGVsdGFZIDwgMCkge1xuXHRcdFx0Ym91bmRzLnJlYWwucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXG5cdFx0XHQkaHRtbC5hZGRDbGFzcyhcInpvb20taW5cIilcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ym91bmRzLnJlYWwucmFuZ2UgKj0gWk9PTV9DT0VGRlxuXHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgKj0gWk9PTV9DT0VGRlxuXG5cdFx0XHQkaHRtbC5hZGRDbGFzcyhcInpvb20tb3V0XCIpXG5cdFx0fVxuXG5cdFx0Y29uc3QgcG1vdXNlWiA9IGdldFpGcm9tUGl4ZWwoZnJhY3RhbCwgbW91c2VYLCBtb3VzZVkpXG5cblx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblxuXHRcdGNvbnN0IG1vdXNlWiA9IGdldFpGcm9tUGl4ZWwoZnJhY3RhbCwgbW91c2VYLCBtb3VzZVkpXG5cblx0XHRib3VuZHMucmVhbC5taWQgLT0gbW91c2VaLnJlYWwgLSBwbW91c2VaLnJlYWxcblx0XHRib3VuZHMuaW1hZy5taWQgLT0gbW91c2VaLmltYWcgLSBwbW91c2VaLmltYWdcblxuXHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXHRcdHJlbmRlcihmcmFjdGFsKVxuXG5cdFx0Y2xlYXJUaW1lb3V0KCQuZGF0YSgkY2FudmFzLCBcInNjcm9sbFRpbWVyXCIpKVxuXHRcdCQuZGF0YSgkY2FudmFzLCBcInNjcm9sbFRpbWVyXCIsIHNldFRpbWVvdXQoKCkgPT4gJGh0bWwucmVtb3ZlQ2xhc3MoXCJ6b29tLWluIHpvb20tb3V0XCIpLCAyNTApKVxuXHR9KVxufVxuaW5pdFdoZWVsKE1hbmRlbGJyb3QpXG5pbml0V2hlZWwoSnVsaWEpXG4iLCJjb25zdCB2ZXJ0ZXhTaGFkZXJTb3VyY2UgPSBgXG5hdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhQb3NpdGlvbjtcblxudm9pZCBtYWluKCkge1xuXHRnbF9Qb3NpdGlvbiA9IHZlcnRleFBvc2l0aW9uO1xufVxuYFxuXG5jb25zdCBmcmFnbWVudFNoYWRlclNvdXJjZSA9IGBcbnByZWNpc2lvbiBoaWdocCBmbG9hdDtcblxudW5pZm9ybSBmbG9hdCByZWFsTWluO1xudW5pZm9ybSBmbG9hdCBpbWFnTWluO1xudW5pZm9ybSBmbG9hdCBvdmVyQ2FudmFzO1xudW5pZm9ybSBpbnQgbWF4SXRlcmF0aW9ucztcbmNvbnN0IGZsb2F0IEJBSUxPVVRfUkFESVVTID0gNC4wO1xudW5pZm9ybSBib29sIGlzSnVsaWE7XG51bmlmb3JtIHZlYzIgamNvbnN0YW50O1xuY29uc3QgaW50IE5VTV9DT0xPUlMgPSA1MTI7XG51bmlmb3JtIHZlYzQgcGFsZXR0ZVtOVU1fQ09MT1JTXTtcbmNvbnN0IGZsb2F0IEdSQURJRU5UX1NDQUxFID0gZmxvYXQoTlVNX0NPTE9SUykgLyAzMi4wO1xuXG52ZWM0IGdldEZyYWN0YWxDb2xvcih2ZWMyIHopIHtcblx0dmVjMiB6U3E7XG5cdHZlYzIgYztcblx0aWYgKGlzSnVsaWEpXG5cdFx0YyA9IGpjb25zdGFudDtcblx0ZWxzZVxuXHRcdGMgPSB6O1xuXG5cdGZvciAoaW50IGkgPSAwOyBpIDwgMTAwMDA7IGkrKykge1xuXHRcdHpTcSA9IHZlYzIoei54ICogei54LCB6LnkgKiB6LnkpO1xuXHRcdHogPSB2ZWMyKHpTcS54IC0gelNxLnkgKyBjLngsIDIuMCAqIHoueCAqIHoueSArIGMueSk7XG5cblx0XHRpZiAoelNxLnggKyB6U3EueSA+IEJBSUxPVVRfUkFESVVTKSB7XG5cdFx0XHRmb3IgKGludCBqID0gMDsgaiA8IDM7IGorKykge1xuXHRcdFx0XHR6U3EgPSB2ZWMyKHoueCAqIHoueCwgei55ICogei55KTtcblx0XHRcdFx0eiA9IHZlYzIoelNxLnggLSB6U3EueSwgMi4wICogei54ICogei55KSArIGM7XG5cdFx0XHR9XG5cblx0XHRcdGZsb2F0IG11ID0gZmxvYXQoaSkgKyAxLjAgLSBsb2cyKGxvZyh6U3EueCArIHpTcS55KSAvIDIuMCk7XG5cdFx0XHRpbnQgaW5kZXggPSBpbnQobW9kKG11ICogR1JBRElFTlRfU0NBTEUsIGZsb2F0KE5VTV9DT0xPUlMpKSk7XG5cblx0XHRcdGZvciAoaW50IGogPSAwOyBqIDwgTlVNX0NPTE9SUzsgaisrKSB7XG5cdFx0XHRcdGlmIChqID09IGluZGV4KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHBhbGV0dGVbal07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaSA+IG1heEl0ZXJhdGlvbnMpIHJldHVybiB2ZWM0KDAsIDAsIDAsIDEpO1xuXHR9XG59XG5cbnZvaWQgbWFpbigpIHtcblx0Z2xfRnJhZ0NvbG9yID0gZ2V0RnJhY3RhbENvbG9yKHZlYzIocmVhbE1pbiArIGdsX0ZyYWdDb29yZC54ICogb3ZlckNhbnZhcywgaW1hZ01pbiArIGdsX0ZyYWdDb29yZC55ICogb3ZlckNhbnZhcykpO1xufVxuYFxuXG5jb25zdCB2ZXJ0aWNlcyA9IFtcblx0WzEsIDFdLFxuXHRbMSwgLTFdLFxuXHRbLTEsIC0xXSxcblx0Wy0xLCAxXVxuXVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdEdsKHtcblx0Y2FudmFzXG59KSB7XG5cdGNvbnN0IGdsID0gY2FudmFzLmdldENvbnRleHQoXCJ3ZWJnbFwiKSB8fCBjYW52YXMuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiKVxuXHRpZiAoIWdsKSB7XG5cdFx0YWxlcnQoXCJVbmFibGUgdG8gaW5pdGlhbGl6ZSBXZWJHTC4gWW91ciBicm93c2VyIG1heSBub3Qgc3VwcG9ydCBpdC5cIilcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cdHJldHVybiBnbFxufVxuXG5mdW5jdGlvbiBnZXRTaGFkZXIoZ2wsIG5hbWUsIHR5cGUpIHtcblx0Y29uc3Qgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpXG5cblx0bGV0IHNvdXJjZVxuXHRpZiAobmFtZSA9PT0gXCJmcmFjdGFsLnZlcnRcIikge1xuXHRcdHNvdXJjZSA9IHZlcnRleFNoYWRlclNvdXJjZVxuXHR9IGVsc2UgaWYgKG5hbWUgPT09IFwiZnJhY3RhbC5mcmFnXCIpIHtcblx0XHRzb3VyY2UgPSBmcmFnbWVudFNoYWRlclNvdXJjZVxuXHR9XG5cdGlmICghc291cmNlKSB7XG5cdFx0YWxlcnQoXCJDb3VsZCBub3QgZmluZCBzaGFkZXIgc291cmNlOiBcIiArIG5hbWUpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXG5cdGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSlcblx0Z2wuY29tcGlsZVNoYWRlcihzaGFkZXIpXG5cblx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcblx0XHRhbGVydChcIkFuIGVycm9yIG9jY3VyZWQgY29tcGlsaW5nIHRoZSBzaGFkZXJzOiBcIiArIGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSlcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cblx0cmV0dXJuIHNoYWRlclxufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdFByb2dyYW0oe1xuXHRnbFxufSkge1xuXHRjb25zdCB2ZXJ0ZXhTaGFkZXIgPSBnZXRTaGFkZXIoZ2wsIFwiZnJhY3RhbC52ZXJ0XCIsIGdsLlZFUlRFWF9TSEFERVIpXG5cdGNvbnN0IGZyYWdtZW50U2hhZGVyID0gZ2V0U2hhZGVyKGdsLCBcImZyYWN0YWwuZnJhZ1wiLCBnbC5GUkFHTUVOVF9TSEFERVIpXG5cblx0Y29uc3QgcHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKVxuXHRnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgdmVydGV4U2hhZGVyKVxuXHRnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgZnJhZ21lbnRTaGFkZXIpXG5cdGdsLmxpbmtQcm9ncmFtKHByb2dyYW0pXG5cblx0aWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkge1xuXHRcdGFsZXJ0KFwiVW5hYmxlIHRvIGluaXRpYWxpemUgdGhlIHNoYWRlciBwcm9ncmFtOiBcIiArIGdsLmdldFByb2dyYW1JbmZvTG9nKHByb2dyYW0pKVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXHRnbC51c2VQcm9ncmFtKHByb2dyYW0pXG5cblx0Y29uc3QgdmVydGV4UG9zaXRpb25BdHRyaWIgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCBcInZlcnRleFBvc2l0aW9uXCIpXG5cdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHZlcnRleFBvc2l0aW9uQXR0cmliKVxuXG5cdGNvbnN0IHZlcnRpY2VzQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKClcblx0Z2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRpY2VzQnVmZmVyKVxuXHRnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHZlcnRleFBvc2l0aW9uQXR0cmliLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApXG5cdGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KHZlcnRpY2VzLnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYy5jb25jYXQodmFsKSkpLCBnbC5TVEFUSUNfRFJBVylcblxuXHRyZXR1cm4gcHJvZ3JhbVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pZm9ybXMoe1xuXHRnbCxcblx0cHJvZ3JhbVxufSwgbmFtZXMpIHtcblx0Y29uc3QgdW5pZm9ybXMgPSB7fVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbmFtZSA9IG5hbWVzW2ldXG5cdFx0dW5pZm9ybXNbbmFtZV0gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgbmFtZSlcblx0fVxuXHRyZXR1cm4gdW5pZm9ybXNcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckdsKGdsKSB7XG5cdGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpXG5cdGdsLmRyYXdBcnJheXMoZ2wuVFJJQU5HTEVfRkFOLCAwLCB2ZXJ0aWNlcy5sZW5ndGgpXG59XG4iXX0=
