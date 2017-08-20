(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
"use strict";

var _colorGradient = require("./color-gradient.js");

var _colorGradient2 = _interopRequireDefault(_colorGradient);

var _webglUtils = require("./webgl-utils.js");

var _split = require("./split.js");

var _split2 = _interopRequireDefault(_split);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $window = $(window);
var $html = $("html");

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

var $jconstantText = $("#julia-constant-text");

function updateJConstantText() {
	$jconstantText.text("Showing Julia set for c = " + Julia.constant.real + " + " + Julia.constant.imag + "i");
}

var maxIterations = 200;
var SCROLL_COEFF = 0.05;
var ZOOM_COEFF = 1.1;

var $iterationText = $("#iteration-text");

function updateIterationText() {
	$iterationText.text("Iteration count = " + maxIterations);
}
updateIterationText();

var palette = (0, _colorGradient2.default)([[0, 0x000000], [0.1, 0x440845], [0.2, 0x7d1a48], [0.3, 0xc66f37], [0.4, 0xf0e953], [0.5, 0xffffff], [0.6, 0x98e991], [0.7, 0x57c9ae], [0.8, 0x245b9a], [0.9, 0x071146], [1, 0x000000]], 512);

function initFractal(fractal, canvasSelector, bounds, jconstant) {
	fractal.$canvas = $(canvasSelector);
	fractal.canvas = fractal.$canvas[0];
	fractal.gl = (0, _webglUtils.initGl)(fractal);
	fractal.program = (0, _webglUtils.initProgram)(fractal);
	fractal.uniforms = (0, _webglUtils.getUniforms)(fractal, ["realMin", "imagMin", "isJulia", "jconstant", "overCanvas", "maxIterations", "palette"]);
	fractal.bounds = bounds;
	if (jconstant) {
		fractal.gl.uniform1i(fractal.uniforms.isJulia, true);
		fractal.constant = jconstant;
		updateJConstantText();
	}
	fractal.gl.uniform4fv(fractal.uniforms.palette, palette);
}

var Mandelbrot = {};
initFractal(Mandelbrot, "#mandelbrot-canvas", {
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

var Julia = {};
initFractal(Julia, "#julia-canvas", {
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
	if (constant) gl.uniform2f(uniforms.jconstant, constant.real, constant.imag);
	gl.uniform1i(uniforms.maxIterations, maxIterations);

	(0, _webglUtils.renderGl)(gl);
}

function getZFromPixel(_ref3, x, y) {
	var bounds = _ref3.bounds;

	return {
		real: bounds.real.min + x * bounds.overCanvas,
		imag: bounds.imag.max - y * bounds.overCanvas
	};
}

// @bug iteration count increases for each fractal
function initKeydown(fractal) {
	var bounds = fractal.bounds;


	$window.keydown(function (evt) {
		switch (evt.which) {
			case 37: // left
			case 65:
				// a
				bounds.real.mid -= bounds.real.range * SCROLL_COEFF;
				calculateBounds(fractal);
				break;
			case 38: // up
			case 87:
				// w
				if (evt.shiftKey) {
					bounds.real.range /= ZOOM_COEFF;
					bounds.imag.range /= ZOOM_COEFF;
				} else bounds.imag.mid += bounds.imag.range * SCROLL_COEFF;
				calculateBounds(fractal);
				break;
			case 39: // right
			case 68:
				//d
				bounds.real.mid += bounds.real.range * SCROLL_COEFF;
				calculateBounds(fractal);
				break;
			case 40: // down
			case 83:
				// s
				if (evt.shiftKey) {
					bounds.real.range *= ZOOM_COEFF;
					bounds.imag.range *= ZOOM_COEFF;
				} else bounds.imag.mid -= bounds.imag.range * SCROLL_COEFF;
				calculateBounds(fractal);
				break;
			case 48:
				// 0
				maxIterations = 1000;
				updateIterationText();
				break;
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
				maxIterations = (evt.which - 48) * 100;
				updateIterationText();
				break;
			case 187:
				// +
				maxIterations += 100;
				console.log(maxIterations);
				updateIterationText();
				break;
			case 189:
				// -
				maxIterations -= 100;
				updateIterationText();
				break;
		}

		render(fractal);
	});
}
initKeydown(Mandelbrot);
initKeydown(Julia);

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

},{"./color-gradient.js":1,"./split.js":3,"./webgl-utils.js":4}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/*Copyright (c) 2017 Nathan Cahill

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.*/

/*! Split.js - v1.3.5 */

exports.default = Split;


var Split;

(function (global, factory) {
	(typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : global.Split = factory();
})(undefined, function () {
	'use strict';

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
	var NOOP = function NOOP() {
		return false;
	};

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
	var calc = ['', '-webkit-', '-moz-', '-o-'].filter(function (prefix) {
		var el = document.createElement('div');
		el.style.cssText = "width:" + prefix + "calc(9px)";

		return !!el.style.length;
	}).shift() + "calc";

	// The second helper function allows elements and string selectors to be used
	// interchangeably. In either case an element is returned. This allows us to
	// do `Split([elem1, elem2])` as well as `Split(['#id1', '#id2'])`.
	var elementOrSelector = function elementOrSelector(el) {
		if (typeof el === 'string' || el instanceof String) {
			return document.querySelector(el);
		}

		return el;
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
	exports.default = Split = function Split(ids, options) {
		if (options === void 0) options = {};

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
		var sizes = options.sizes || ids.map(function () {
			return 100 / ids.length;
		});

		// Standardize minSize to an array if it isn't already. This allows minSize
		// to be passed as a number.
		var minSize = options.minSize !== undefined ? options.minSize : 100;
		var minSizes = Array.isArray(minSize) ? minSize : ids.map(function () {
			return minSize;
		});
		var gutterSize = options.gutterSize !== undefined ? options.gutterSize : 10;
		var snapOffset = options.snapOffset !== undefined ? options.snapOffset : 30;
		var direction = options.direction || 'horizontal';
		var cursor = options.cursor || (direction === 'horizontal' ? 'ew-resize' : 'ns-resize');
		var gutter = options.gutter || function (i, gutterDirection) {
			var gut = document.createElement('div');
			gut.className = "gutter gutter-" + gutterDirection;
			return gut;
		};
		var elementStyle = options.elementStyle || function (dim, size, gutSize) {
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

			return style;
		};
		var gutterStyle = options.gutterStyle || function (dim, gutSize) {
			return obj = {}, obj[dim] = gutSize + "px", obj;
			var obj;
		};

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

		function setElementSize(el, size, gutSize) {
			// Split.js allows setting sizes via numbers (ideally), or if you must,
			// by string, like '300px'. This is less than ideal, because it breaks
			// the fluid layout that `calc(% - px)` provides. You're on your own if you do that,
			// make sure you calculate the gutter size by hand.
			var style = elementStyle(dimension, size, gutSize);

			// eslint-disable-next-line no-param-reassign
			Object.keys(style).forEach(function (prop) {
				return el.style[prop] = style[prop];
			});
		}

		function setGutterSize(gutterElement, gutSize) {
			var style = gutterStyle(dimension, gutSize);

			// eslint-disable-next-line no-param-reassign
			Object.keys(style).forEach(function (prop) {
				return gutterElement.style[prop] = style[prop];
			});
		}

		// Actually adjust the size of elements `a` and `b` to `offset` while dragging.
		// calc is used to allow calc(percentage + gutterpx) on the whole split instance,
		// which allows the viewport to be resized without additional logic.
		// Element a's size is the same as offset. b's size is total size - a size.
		// Both sizes are calculated from the initial parent percentage,
		// then the gutter size is subtracted.
		function adjust(offset) {
			var a = elements[this.a];
			var b = elements[this.b];
			var percentage = a.size + b.size;

			a.size = offset / this.size * percentage;
			b.size = percentage - offset / this.size * percentage;

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
		function drag(e) {
			var offset;

			if (!this.dragging) {
				return;
			}

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
		function calculateSizes() {
			// Figure out the parent size minus padding.
			var a = elements[this.a].element;
			var b = elements[this.b].element;

			this.size = a[getBoundingClientRect]()[dimension] + b[getBoundingClientRect]()[dimension] + this.aGutterSize + this.bGutterSize;
			this.start = a[getBoundingClientRect]()[position];
		}

		// stopDragging is very similar to startDragging in reverse.
		function stopDragging() {
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
		function startDragging(e) {
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
				minSize: minSizes[i]
			};

			var pair;

			if (i > 0) {
				// Create the pair object with it's metadata.
				pair = {
					a: i - 1,
					b: i,
					dragging: false,
					isFirst: i === 1,
					isLast: i === ids.length - 1,
					direction: direction,
					parent: parent
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

			return element;
		});

		function setSizes(newSizes) {
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

		function destroy() {
			pairs.forEach(function (pair) {
				pair.parent.removeChild(pair.gutter);
				elements[pair.a].element.style[dimension] = '';
				elements[pair.b].element.style[dimension] = '';
			});
		}

		if (isIE8) {
			return {
				setSizes: setSizes,
				destroy: destroy
			};
		}

		return {
			setSizes: setSizes,
			getSizes: function getSizes() {
				return elements.map(function (element) {
					return element.size;
				});
			},
			collapse: function collapse(i) {
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
			destroy: destroy
		};
	};

	return Split;
});

},{}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.initGl = initGl;
exports.initProgram = initProgram;
exports.getUniforms = getUniforms;
exports.renderGl = renderGl;
var vertexShaderSource = "\nattribute vec4 vertexPosition;\n\nvoid main() {\n\tgl_Position = vertexPosition;\n}\n";

var fragmentShaderSource = "\nprecision highp float;\n\nuniform float realMin;\nuniform float imagMin;\nuniform float overCanvas;\nuniform bool isJulia;\nuniform vec2 jconstant;\nuniform int maxIterations;\nconst float BAILOUT_RADIUS = 4.0;\nconst int NUM_COLORS = 512;\nuniform vec4 palette[NUM_COLORS];\nconst float GRADIENT_SCALE = float(NUM_COLORS) / 32.0;\n\nvec4 getFractalColor(vec2 z) {\n\tvec2 zSq;\n\tvec2 c;\n\tif (isJulia)\n\t\tc = jconstant;\n\telse\n\t\tc = z;\n\n\tfor (int i = 0; i < 10000; i++) {\n\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\tz = vec2(zSq.x - zSq.y + c.x, 2.0 * z.x * z.y + c.y);\n\n\t\tif (zSq.x + zSq.y > BAILOUT_RADIUS) {\n\t\t\tfor (int j = 0; j < 3; j++) {\n\t\t\t\tzSq = vec2(z.x * z.x, z.y * z.y);\n\t\t\t\tz = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;\n\t\t\t}\n\n\t\t\tfloat mu = float(i) + 1.0 - log2(log(zSq.x + zSq.y) / 2.0);\n\t\t\tint index = int(mod(mu * GRADIENT_SCALE, float(NUM_COLORS)));\n\n\t\t\tfor (int j = 0; j < NUM_COLORS; j++) {\n\t\t\t\tif (j == index) {\n\t\t\t\t\treturn palette[j];\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\n\t\tif (i > maxIterations) return vec4(0, 0, 0, 1);\n\t}\n}\n\nvoid main() {\n\tgl_FragColor = getFractalColor(vec2(realMin + gl_FragCoord.x * overCanvas, imagMin + gl_FragCoord.y * overCanvas));\n}\n";

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

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29sb3ItZ3JhZGllbnQuanMiLCJzcmMvZnJhY3RhbC5qcyIsInNyYy9zcGxpdC5qcyIsInNyYy93ZWJnbC11dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O2tCQ0F3QixVO0FBQVQsU0FBUyxVQUFULENBQW9CLFVBQXBCLEVBQWdDLFNBQWhDLEVBQTJDO0FBQ3pELEtBQU0sVUFBVSxFQUFoQjtBQUNBLEtBQU0sT0FBTyxFQUFiO0FBQ0EsS0FBTSxTQUFTLEVBQWY7QUFDQSxLQUFNLFFBQVEsRUFBZDs7QUFFQSxNQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksV0FBVyxNQUEvQixFQUF1QyxHQUF2QyxFQUE0QztBQUMzQyxNQUFNLFlBQVksV0FBVyxDQUFYLENBQWxCOztBQUVBLFVBQVEsSUFBUixDQUFhLFVBQVUsQ0FBVixDQUFiOztBQUVBLE1BQU0sV0FBVyxVQUFVLENBQVYsQ0FBakI7QUFDQSxPQUFLLElBQUwsQ0FBVSxDQUFDLFlBQVksRUFBWixHQUFpQixHQUFsQixJQUF5QixHQUFuQztBQUNBLFNBQU8sSUFBUCxDQUFZLENBQUMsWUFBWSxDQUFaLEdBQWdCLEdBQWpCLElBQXdCLEdBQXBDO0FBQ0EsUUFBTSxJQUFOLENBQVcsQ0FBQyxXQUFXLEdBQVosSUFBbUIsR0FBOUI7QUFDQTs7QUFFRCxLQUFNLGlCQUFpQixrQkFBa0IsT0FBbEIsRUFBMkIsSUFBM0IsQ0FBdkI7QUFDQSxLQUFNLG1CQUFtQixrQkFBa0IsT0FBbEIsRUFBMkIsTUFBM0IsQ0FBekI7QUFDQSxLQUFNLGtCQUFrQixrQkFBa0IsT0FBbEIsRUFBMkIsS0FBM0IsQ0FBeEI7O0FBRUEsS0FBTSxVQUFVLEVBQWhCO0FBQ0EsS0FBTSxZQUFZLElBQUksU0FBdEI7O0FBRUEsTUFBSyxJQUFJLEtBQUksQ0FBYixFQUFnQixLQUFJLENBQXBCLEVBQXVCLE1BQUssU0FBNUIs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QUE4QixnQkFBOUIsQ0FBN0I7QUFDQSxJQUFHLHVCQUFILENBQTJCLG9CQUEzQjs7QUFFQSxLQUFNLGlCQUFpQixHQUFHLFlBQUgsRUFBdkI7QUFDQSxJQUFHLFVBQUgsQ0FBYyxHQUFHLFlBQWpCLEVBQStCLGNBQS9CO0FBQ0EsSUFBRyxtQkFBSCxDQUF1QixvQkFBdkIsRUFBNkMsQ0FBN0MsRUFBZ0QsR0FBRyxLQUFuRCxFQUEwRCxLQUExRCxFQUFpRSxDQUFqRSxFQUFvRSxDQUFwRTtBQUNBLElBQUcsVUFBSCxDQUFjLEdBQUcsWUFBakIsRUFBK0IsSUFBSSxZQUFKLENBQWlCLFNBQVMsTUFBVCxDQUFnQixVQUFDLEdBQUQsRUFBTSxHQUFOO0FBQUEsU0FBYyxJQUFJLE1BQUosQ0FBVyxHQUFYLENBQWQ7QUFBQSxFQUFoQixDQUFqQixDQUEvQixFQUFpRyxHQUFHLFdBQXBHOztBQUVBLFFBQU8sT0FBUDtBQUNBOztBQUVNLFNBQVMsV0FBVCxRQUdKLEtBSEksRUFHRztBQUFBLEtBRlQsRUFFUyxTQUZULEVBRVM7QUFBQSxLQURULE9BQ1MsU0FEVCxPQUNTOztBQUNULEtBQU0sV0FBVyxFQUFqQjtBQUNBLE1BQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxNQUFNLE1BQTFCLEVBQWtDLEdBQWxDLEVBQXVDO0FBQ3RDLE1BQU0sT0FBTyxNQUFNLENBQU4sQ0FBYjtBQUNBLFdBQVMsSUFBVCxJQUFpQixHQUFHLGtCQUFILENBQXNCLE9BQXRCLEVBQStCLElBQS9CLENBQWpCO0FBQ0E7QUFDRCxRQUFPLFFBQVA7QUFDQTs7QUFFTSxTQUFTLFFBQVQsQ0FBa0IsRUFBbEIsRUFBc0I7QUFDNUIsSUFBRyxLQUFILENBQVMsR0FBRyxnQkFBWjtBQUNBLElBQUcsVUFBSCxDQUFjLEdBQUcsWUFBakIsRUFBK0IsQ0FBL0IsRUFBa0MsU0FBUyxNQUEzQztBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFBhbGV0dGUoY29sb3JTdG9wcywgbnVtQ29sb3JzKSB7XG5cdGNvbnN0IG9mZnNldHMgPSBbXVxuXHRjb25zdCByZWRzID0gW11cblx0Y29uc3QgZ3JlZW5zID0gW11cblx0Y29uc3QgYmx1ZXMgPSBbXVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JTdG9wcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNvbG9yU3RvcCA9IGNvbG9yU3RvcHNbaV1cblxuXHRcdG9mZnNldHMucHVzaChjb2xvclN0b3BbMF0pXG5cblx0XHRjb25zdCBoZXhDb2xvciA9IGNvbG9yU3RvcFsxXVxuXHRcdHJlZHMucHVzaCgoaGV4Q29sb3IgPj4gMTYgJiAyNTUpIC8gMjU1KVxuXHRcdGdyZWVucy5wdXNoKChoZXhDb2xvciA+PiA4ICYgMjU1KSAvIDI1NSlcblx0XHRibHVlcy5wdXNoKChoZXhDb2xvciAmIDI1NSkgLyAyNTUpXG5cdH1cblxuXHRjb25zdCByZWRJbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIHJlZHMpXG5cdGNvbnN0IGdyZWVuSW50ZXJwb2xhbnQgPSBjcmVhdGVJbnRlcnBvbGFudChvZmZzZXRzLCBncmVlbnMpXG5cdGNvbnN0IGJsdWVJbnRlcnBvbGFudCA9IGNyZWF0ZUludGVycG9sYW50KG9mZnNldHMsIGJsdWVzKVxuXG5cdGNvbnN0IHBhbGV0dGUgPSBbXVxuXHRjb25zdCBpbmNyZW1lbnQgPSAxIC8gbnVtQ29sb3JzXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxOyBpICs9IGluY3JlbWVudCkge1xuXHRcdHBhbGV0dGUucHVzaChyZWRJbnRlcnBvbGFudChpKSwgZ3JlZW5JbnRlcnBvbGFudChpKSwgYmx1ZUludGVycG9sYW50KGkpLCAyNTUpXG5cdH1cblxuXHRyZXR1cm4gcGFsZXR0ZVxufVxuXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Nb25vdG9uZV9jdWJpY19pbnRlcnBvbGF0aW9uXG5mdW5jdGlvbiBjcmVhdGVJbnRlcnBvbGFudCh4cywgeXMpIHtcblx0Y29uc3QgbGVuZ3RoID0geHMubGVuZ3RoXG5cblx0Ly8gRGVhbCB3aXRoIGxlbmd0aCBpc3N1ZXNcblx0aWYgKGxlbmd0aCAhPT0geXMubGVuZ3RoKSB7XG5cdFx0dGhyb3cgXCJOZWVkIGFuIGVxdWFsIGNvdW50IG9mIHhzIGFuZCB5cy5cIlxuXHR9XG5cdGlmIChsZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gKCkgPT4gMFxuXHR9XG5cdGlmIChsZW5ndGggPT09IDEpIHtcblx0XHQvLyBJbXBsOiBQcmVjb21wdXRpbmcgdGhlIHJlc3VsdCBwcmV2ZW50cyBwcm9ibGVtcyBpZiB5cyBpcyBtdXRhdGVkIGxhdGVyIGFuZCBhbGxvd3MgZ2FyYmFnZSBjb2xsZWN0aW9uIG9mIHlzXG5cdFx0Ly8gSW1wbDogVW5hcnkgcGx1cyBwcm9wZXJseSBjb252ZXJ0cyB2YWx1ZXMgdG8gbnVtYmVyc1xuXHRcdGNvbnN0IHJlc3VsdCA9ICt5c1swXVxuXHRcdHJldHVybiAoKSA9PiByZXN1bHRcblx0fVxuXG5cdC8vIFJlYXJyYW5nZSB4cyBhbmQgeXMgc28gdGhhdCB4cyBpcyBzb3J0ZWRcblx0Y29uc3QgaW5kZXhlcyA9IFtdXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRpbmRleGVzLnB1c2goaSlcblx0fVxuXHRpbmRleGVzLnNvcnQoKGEsIGIpID0+IHhzW2FdIDwgeHNbYl0gPyAtMSA6IDEpXG5cdGNvbnN0IG9sZFhzID0geHMsXG5cdFx0b2xkWXMgPSB5c1xuXHQvLyBJbXBsOiBDcmVhdGluZyBuZXcgYXJyYXlzIGFsc28gcHJldmVudHMgcHJvYmxlbXMgaWYgdGhlIGlucHV0IGFycmF5cyBhcmUgbXV0YXRlZCBsYXRlclxuXHR4cyA9IFtdXG5cdHlzID0gW11cblx0Ly8gSW1wbDogVW5hcnkgcGx1cyBwcm9wZXJseSBjb252ZXJ0cyB2YWx1ZXMgdG8gbnVtYmVyc1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0eHMucHVzaCgrb2xkWHNbaW5kZXhlc1tpXV0pXG5cdFx0eXMucHVzaCgrb2xkWXNbaW5kZXhlc1tpXV0pXG5cdH1cblxuXHQvLyBHZXQgY29uc2VjdXRpdmUgZGlmZmVyZW5jZXMgYW5kIHNsb3Blc1xuXHRjb25zdCBkeXMgPSBbXSxcblx0XHRkeHMgPSBbXSxcblx0XHRtcyA9IFtdXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0Y29uc3QgZHggPSB4c1tpICsgMV0gLSB4c1tpXSxcblx0XHRcdGR5ID0geXNbaSArIDFdIC0geXNbaV1cblx0XHRkeHMucHVzaChkeClcblx0XHRkeXMucHVzaChkeSlcblx0XHRtcy5wdXNoKGR5IC8gZHgpXG5cdH1cblxuXHQvLyBHZXQgZGVncmVlLTEgY29lZmZpY2llbnRzXG5cdGNvbnN0IGMxcyA9IFttc1swXV1cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkeHMubGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0Y29uc3QgbSA9IG1zW2ldLFxuXHRcdFx0bU5leHQgPSBtc1tpICsgMV1cblx0XHRpZiAobSAqIG1OZXh0IDw9IDApIHtcblx0XHRcdGMxcy5wdXNoKDApXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGR4XyA9IGR4c1tpXSxcblx0XHRcdFx0ZHhOZXh0ID0gZHhzW2kgKyAxXSxcblx0XHRcdFx0Y29tbW9uID0gZHhfICsgZHhOZXh0XG5cdFx0XHRjMXMucHVzaCgzICogY29tbW9uIC8gKChjb21tb24gKyBkeE5leHQpIC8gbSArIChjb21tb24gKyBkeF8pIC8gbU5leHQpKVxuXHRcdH1cblx0fVxuXHRjMXMucHVzaChtc1ttcy5sZW5ndGggLSAxXSlcblxuXHQvLyBHZXQgZGVncmVlLTIgYW5kIGRlZ3JlZS0zIGNvZWZmaWNpZW50c1xuXHRjb25zdCBjMnMgPSBbXSxcblx0XHRjM3MgPSBbXVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGMxcy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRjb25zdCBjMSA9IGMxc1tpXSxcblx0XHRcdG1fID0gbXNbaV0sXG5cdFx0XHRpbnZEeCA9IDEgLyBkeHNbaV0sXG5cdFx0XHRjb21tb25fID0gYzEgKyBjMXNbaSArIDFdIC0gbV8gLSBtX1xuXHRcdGMycy5wdXNoKChtXyAtIGMxIC0gY29tbW9uXykgKiBpbnZEeClcblx0XHRjM3MucHVzaChjb21tb25fICogaW52RHggKiBpbnZEeClcblx0fVxuXG5cdC8vIFJldHVybiBpbnRlcnBvbGFudCBmdW5jdGlvblxuXHRyZXR1cm4geCA9PiB7XG5cdFx0Ly8gVGhlIHJpZ2h0bW9zdCBwb2ludCBpbiB0aGUgZGF0YXNldCBzaG91bGQgZ2l2ZSBhbiBleGFjdCByZXN1bHRcblx0XHRsZXQgaSA9IHhzLmxlbmd0aCAtIDFcblx0XHRpZiAoeCA9PT0geHNbaV0pIHtcblx0XHRcdHJldHVybiB5c1tpXVxuXHRcdH1cblxuXHRcdC8vIFNlYXJjaCBmb3IgdGhlIGludGVydmFsIHggaXMgaW4sIHJldHVybmluZyB0aGUgY29ycmVzcG9uZGluZyB5IGlmIHggaXMgb25lIG9mIHRoZSBvcmlnaW5hbCB4c1xuXHRcdGxldCBsb3cgPSAwLFxuXHRcdFx0bWlkLCBoaWdoID0gYzNzLmxlbmd0aCAtIDFcblx0XHR3aGlsZSAobG93IDw9IGhpZ2gpIHtcblx0XHRcdG1pZCA9IE1hdGguZmxvb3IoKGxvdyArIGhpZ2gpIC8gMilcblx0XHRcdGNvbnN0IHhIZXJlID0geHNbbWlkXVxuXHRcdFx0aWYgKHhIZXJlIDwgeCkge1xuXHRcdFx0XHRsb3cgPSBtaWQgKyAxXG5cdFx0XHR9IGVsc2UgaWYgKHhIZXJlID4geCkge1xuXHRcdFx0XHRoaWdoID0gbWlkIC0gMVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHlzW21pZF1cblx0XHRcdH1cblx0XHR9XG5cdFx0aSA9IE1hdGgubWF4KDAsIGhpZ2gpXG5cblx0XHQvLyBJbnRlcnBvbGF0ZVxuXHRcdGNvbnN0IGRpZmYgPSB4IC0geHNbaV0sXG5cdFx0XHRkaWZmU3EgPSBkaWZmICogZGlmZlxuXHRcdHJldHVybiB5c1tpXSArIGMxc1tpXSAqIGRpZmYgKyBjMnNbaV0gKiBkaWZmU3EgKyBjM3NbaV0gKiBkaWZmICogZGlmZlNxXG5cdH1cbn1cbiIsImltcG9ydCBnZXRQYWxldHRlIGZyb20gXCIuL2NvbG9yLWdyYWRpZW50LmpzXCJcbmltcG9ydCB7XG5cdGluaXRHbCxcblx0aW5pdFByb2dyYW0sXG5cdGdldFVuaWZvcm1zLFxuXHRyZW5kZXJHbFxufSBmcm9tIFwiLi93ZWJnbC11dGlscy5qc1wiXG5pbXBvcnQgU3BsaXQgZnJvbSBcIi4vc3BsaXQuanNcIlxuXG5jb25zdCAkd2luZG93ID0gJCh3aW5kb3cpXG5jb25zdCAkaHRtbCA9ICQoXCJodG1sXCIpXG5cbiQoXCIjY29udHJvbHMtZGlhbG9nXCIpLmRpYWxvZyh7XG5cdHNob3c6IFwiZHJvcFwiLFxuXHRoaWRlOiBcImRyb3BcIixcblx0d2lkdGg6IFwiMjVlbVwiLFxuXHRidXR0b25zOiBbe1xuXHRcdHRleHQ6IFwiR290IGl0IVwiLFxuXHRcdGNsaWNrOiBmdW5jdGlvbigpIHtcblx0XHRcdCQodGhpcykuZGlhbG9nKFwiY2xvc2VcIilcblx0XHR9XG5cdH1dXG59KS50b29sdGlwKClcblxuY29uc3QgJGpjb25zdGFudFRleHQgPSAkKFwiI2p1bGlhLWNvbnN0YW50LXRleHRcIilcblxuZnVuY3Rpb24gdXBkYXRlSkNvbnN0YW50VGV4dCgpIHtcblx0JGpjb25zdGFudFRleHQudGV4dChgU2hvd2luZyBKdWxpYSBzZXQgZm9yIGMgPSAke0p1bGlhLmNvbnN0YW50LnJlYWx9ICsgJHtKdWxpYS5jb25zdGFudC5pbWFnfWlgKVxufVxuXG5sZXQgbWF4SXRlcmF0aW9ucyA9IDIwMFxuY29uc3QgU0NST0xMX0NPRUZGID0gMC4wNVxuY29uc3QgWk9PTV9DT0VGRiA9IDEuMVxuXG5jb25zdCAkaXRlcmF0aW9uVGV4dCA9ICQoXCIjaXRlcmF0aW9uLXRleHRcIilcblxuZnVuY3Rpb24gdXBkYXRlSXRlcmF0aW9uVGV4dCgpIHtcblx0JGl0ZXJhdGlvblRleHQudGV4dChgSXRlcmF0aW9uIGNvdW50ID0gJHttYXhJdGVyYXRpb25zfWApXG59XG51cGRhdGVJdGVyYXRpb25UZXh0KClcblxuY29uc3QgcGFsZXR0ZSA9IGdldFBhbGV0dGUoW1xuXHRbMCwgMHgwMDAwMDBdLFxuXHRbMC4xLCAweDQ0MDg0NV0sXG5cdFswLjIsIDB4N2QxYTQ4XSxcblx0WzAuMywgMHhjNjZmMzddLFxuXHRbMC40LCAweGYwZTk1M10sXG5cdFswLjUsIDB4ZmZmZmZmXSxcblx0WzAuNiwgMHg5OGU5OTFdLFxuXHRbMC43LCAweDU3YzlhZV0sXG5cdFswLjgsIDB4MjQ1YjlhXSxcblx0WzAuOSwgMHgwNzExNDZdLFxuXHRbMSwgMHgwMDAwMDBdXG5dLCA1MTIpXG5cbmZ1bmN0aW9uIGluaXRGcmFjdGFsKGZyYWN0YWwsIGNhbnZhc1NlbGVjdG9yLCBib3VuZHMsIGpjb25zdGFudCkge1xuXHRmcmFjdGFsLiRjYW52YXMgPSAkKGNhbnZhc1NlbGVjdG9yKVxuXHRmcmFjdGFsLmNhbnZhcyA9IGZyYWN0YWwuJGNhbnZhc1swXVxuXHRmcmFjdGFsLmdsID0gaW5pdEdsKGZyYWN0YWwpXG5cdGZyYWN0YWwucHJvZ3JhbSA9IGluaXRQcm9ncmFtKGZyYWN0YWwpXG5cdGZyYWN0YWwudW5pZm9ybXMgPSBnZXRVbmlmb3JtcyhmcmFjdGFsLCBbXG5cdFx0XCJyZWFsTWluXCIsXG5cdFx0XCJpbWFnTWluXCIsXG5cdFx0XCJpc0p1bGlhXCIsXG5cdFx0XCJqY29uc3RhbnRcIixcblx0XHRcIm92ZXJDYW52YXNcIixcblx0XHRcIm1heEl0ZXJhdGlvbnNcIixcblx0XHRcInBhbGV0dGVcIlxuXHRdKVxuXHRmcmFjdGFsLmJvdW5kcyA9IGJvdW5kc1xuXHRpZiAoamNvbnN0YW50KSB7XG5cdFx0ZnJhY3RhbC5nbC51bmlmb3JtMWkoZnJhY3RhbC51bmlmb3Jtcy5pc0p1bGlhLCB0cnVlKVxuXHRcdGZyYWN0YWwuY29uc3RhbnQgPSBqY29uc3RhbnRcblx0XHR1cGRhdGVKQ29uc3RhbnRUZXh0KClcblx0fVxuXHRmcmFjdGFsLmdsLnVuaWZvcm00ZnYoZnJhY3RhbC51bmlmb3Jtcy5wYWxldHRlLCBwYWxldHRlKVxufVxuXG5jb25zdCBNYW5kZWxicm90ID0ge31cbmluaXRGcmFjdGFsKE1hbmRlbGJyb3QsIFwiI21hbmRlbGJyb3QtY2FudmFzXCIsIHtcblx0cmVhbDoge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtaWQ6IC0wLjcsXG5cdFx0bWF4OiBudWxsLFxuXHRcdHJhbmdlOiAzXG5cdH0sXG5cdGltYWc6IHtcblx0XHRtaW46IG51bGwsXG5cdFx0bWlkOiAwLFxuXHRcdG1heDogbnVsbCxcblx0XHRyYW5nZTogMi40XG5cdH0sXG5cdG92ZXJDYW52YXM6IG51bGxcbn0pXG5cbmNvbnN0IEp1bGlhID0ge31cbmluaXRGcmFjdGFsKEp1bGlhLCBcIiNqdWxpYS1jYW52YXNcIiwge1xuXHRyZWFsOiB7XG5cdFx0bWluOiBudWxsLFxuXHRcdG1pZDogMCxcblx0XHRtYXg6IG51bGwsXG5cdFx0cmFuZ2U6IDMuNlxuXHR9LFxuXHRpbWFnOiB7XG5cdFx0bWluOiBudWxsLFxuXHRcdG1pZDogMCxcblx0XHRtYXg6IG51bGwsXG5cdFx0cmFuZ2U6IDMuNlxuXHR9LFxuXHRvdmVyQ2FudmFzOiBudWxsXG59LCB7XG5cdHJlYWw6IC0wLjc3LFxuXHRpbWFnOiAtMC4wOVxufSlcblxuZnVuY3Rpb24gcmVzaXplQ2FudmFzKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Y2FudmFzLFxuXHRcdGdsXG5cdH0gPSBmcmFjdGFsXG5cblx0Y2FudmFzLndpZHRoID0gJGNhbnZhcy53aWR0aCgpXG5cdGNhbnZhcy5oZWlnaHQgPSAkY2FudmFzLmhlaWdodCgpXG5cdGdsLnZpZXdwb3J0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodClcblx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdHJlbmRlcihmcmFjdGFsKVxufVxuXG5mdW5jdGlvbiByZXNpemVDYW52YXNlcygpIHtcblx0cmVzaXplQ2FudmFzKE1hbmRlbGJyb3QpXG5cdHJlc2l6ZUNhbnZhcyhKdWxpYSlcbn1cbiQocmVzaXplQ2FudmFzZXMpXG4kd2luZG93LnJlc2l6ZShyZXNpemVDYW52YXNlcylcblxuU3BsaXQoW1wiI21hbmRlbGJyb3QtY2FudmFzLXdyYXBwZXJcIiwgXCIjanVsaWEtY2FudmFzLXdyYXBwZXJcIl0sIHtcblx0ZGlyZWN0aW9uOiBcImhvcml6b250YWxcIixcblx0Y3Vyc29yOiBcImNvbC1yZXNpemVcIixcblx0b25EcmFnOiByZXNpemVDYW52YXNlc1xufSlcblxuZnVuY3Rpb24gY2FsY3VsYXRlQm91bmRzKHtcblx0Y2FudmFzLFxuXHRib3VuZHNcbn0pIHtcblx0Ym91bmRzLnJlYWwucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMucmVhbC5yYW5nZSlcblx0Ym91bmRzLmltYWcucmFuZ2UgPSBNYXRoLmFicyhib3VuZHMuaW1hZy5yYW5nZSlcblxuXHRjb25zdCBib3VuZHNSYXRpbyA9IGJvdW5kcy5yZWFsLnJhbmdlIC8gYm91bmRzLmltYWcucmFuZ2Vcblx0Y29uc3QgY2FudmFzUmF0aW8gPSBjYW52YXMud2lkdGggLyBjYW52YXMuaGVpZ2h0XG5cblx0aWYgKGJvdW5kc1JhdGlvIDwgY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLnJlYWwucmFuZ2UgPSBib3VuZHMuaW1hZy5yYW5nZSAqIGNhbnZhc1JhdGlvXG5cdGVsc2UgaWYgKGJvdW5kc1JhdGlvID4gY2FudmFzUmF0aW8pXG5cdFx0Ym91bmRzLmltYWcucmFuZ2UgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhc1JhdGlvXG5cblx0Ym91bmRzLnJlYWwubWluID0gYm91bmRzLnJlYWwubWlkIC0gYm91bmRzLnJlYWwucmFuZ2UgLyAyXG5cdGJvdW5kcy5yZWFsLm1heCA9IGJvdW5kcy5yZWFsLm1pZCArIGJvdW5kcy5yZWFsLnJhbmdlIC8gMlxuXHRib3VuZHMuaW1hZy5taW4gPSBib3VuZHMuaW1hZy5taWQgLSBib3VuZHMuaW1hZy5yYW5nZSAvIDJcblx0Ym91bmRzLmltYWcubWF4ID0gYm91bmRzLmltYWcubWlkICsgYm91bmRzLmltYWcucmFuZ2UgLyAyXG5cblx0Ym91bmRzLm92ZXJDYW52YXMgPSBib3VuZHMucmVhbC5yYW5nZSAvIGNhbnZhcy53aWR0aFxufVxuXG5mdW5jdGlvbiByZW5kZXIoe1xuXHRnbCxcblx0dW5pZm9ybXMsXG5cdGJvdW5kcyxcblx0Y29uc3RhbnRcbn0pIHtcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLnJlYWxNaW4sIGJvdW5kcy5yZWFsLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLmltYWdNaW4sIGJvdW5kcy5pbWFnLm1pbilcblx0Z2wudW5pZm9ybTFmKHVuaWZvcm1zLm92ZXJDYW52YXMsIGJvdW5kcy5vdmVyQ2FudmFzKVxuXHRpZiAoY29uc3RhbnQpXG5cdFx0Z2wudW5pZm9ybTJmKHVuaWZvcm1zLmpjb25zdGFudCwgY29uc3RhbnQucmVhbCwgY29uc3RhbnQuaW1hZylcblx0Z2wudW5pZm9ybTFpKHVuaWZvcm1zLm1heEl0ZXJhdGlvbnMsIG1heEl0ZXJhdGlvbnMpXG5cblx0cmVuZGVyR2woZ2wpXG59XG5cbmZ1bmN0aW9uIGdldFpGcm9tUGl4ZWwoe1xuXHRib3VuZHNcbn0sIHgsIHkpIHtcblx0cmV0dXJuIHtcblx0XHRyZWFsOiBib3VuZHMucmVhbC5taW4gKyB4ICogYm91bmRzLm92ZXJDYW52YXMsXG5cdFx0aW1hZzogYm91bmRzLmltYWcubWF4IC0geSAqIGJvdW5kcy5vdmVyQ2FudmFzXG5cdH1cbn1cblxuLy8gQGJ1ZyBpdGVyYXRpb24gY291bnQgaW5jcmVhc2VzIGZvciBlYWNoIGZyYWN0YWxcbmZ1bmN0aW9uIGluaXRLZXlkb3duKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdGJvdW5kc1xuXHR9ID0gZnJhY3RhbFxuXG5cdCR3aW5kb3cua2V5ZG93bihldnQgPT4ge1xuXHRcdHN3aXRjaCAoZXZ0LndoaWNoKSB7XG5cdFx0XHRjYXNlIDM3OiAvLyBsZWZ0XG5cdFx0XHRjYXNlIDY1OiAvLyBhXG5cdFx0XHRcdGJvdW5kcy5yZWFsLm1pZCAtPSBib3VuZHMucmVhbC5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXHRcdFx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMzg6IC8vIHVwXG5cdFx0XHRjYXNlIDg3OiAvLyB3XG5cdFx0XHRcdGlmIChldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRcdFx0Ym91bmRzLmltYWcucmFuZ2UgLz0gWk9PTV9DT0VGRlxuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5taWQgKz0gYm91bmRzLmltYWcucmFuZ2UgKiBTQ1JPTExfQ09FRkZcblx0XHRcdFx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDM5OiAvLyByaWdodFxuXHRcdFx0Y2FzZSA2ODogLy9kXG5cdFx0XHRcdGJvdW5kcy5yZWFsLm1pZCArPSBib3VuZHMucmVhbC5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXHRcdFx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgNDA6IC8vIGRvd25cblx0XHRcdGNhc2UgODM6IC8vIHNcblx0XHRcdFx0aWYgKGV2dC5zaGlmdEtleSkge1xuXHRcdFx0XHRcdGJvdW5kcy5yZWFsLnJhbmdlICo9IFpPT01fQ09FRkZcblx0XHRcdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBib3VuZHMuaW1hZy5yYW5nZSAqIFNDUk9MTF9DT0VGRlxuXHRcdFx0XHRjYWxjdWxhdGVCb3VuZHMoZnJhY3RhbClcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgNDg6IC8vIDBcblx0XHRcdFx0bWF4SXRlcmF0aW9ucyA9IDEwMDBcblx0XHRcdFx0dXBkYXRlSXRlcmF0aW9uVGV4dCgpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDQ5OlxuXHRcdFx0Y2FzZSA1MDpcblx0XHRcdGNhc2UgNTE6XG5cdFx0XHRjYXNlIDUyOlxuXHRcdFx0Y2FzZSA1Mzpcblx0XHRcdGNhc2UgNTQ6XG5cdFx0XHRjYXNlIDU1OlxuXHRcdFx0Y2FzZSA1Njpcblx0XHRcdGNhc2UgNTc6IC8vIDEtOVxuXHRcdFx0XHRtYXhJdGVyYXRpb25zID0gKGV2dC53aGljaCAtIDQ4KSAqIDEwMFxuXHRcdFx0XHR1cGRhdGVJdGVyYXRpb25UZXh0KClcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMTg3OiAvLyArXG5cdFx0XHRcdG1heEl0ZXJhdGlvbnMgKz0gMTAwXG5cdFx0XHRcdGNvbnNvbGUubG9nKG1heEl0ZXJhdGlvbnMpXG5cdFx0XHRcdHVwZGF0ZUl0ZXJhdGlvblRleHQoKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAxODk6IC8vIC1cblx0XHRcdFx0bWF4SXRlcmF0aW9ucyAtPSAxMDBcblx0XHRcdFx0dXBkYXRlSXRlcmF0aW9uVGV4dCgpXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmVuZGVyKGZyYWN0YWwpXG5cdH0pXG59XG5pbml0S2V5ZG93bihNYW5kZWxicm90KVxuaW5pdEtleWRvd24oSnVsaWEpXG5cbmZ1bmN0aW9uIGluaXRNb3VzZURvd24oZnJhY3RhbCkge1xuXHRjb25zdCB7XG5cdFx0JGNhbnZhcyxcblx0XHRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5tb3VzZWRvd24oZG93bmV2dCA9PiB7XG5cdFx0ZG93bmV2dC5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRjb25zdCBvZmZzZXQgPSAkY2FudmFzLm9mZnNldCgpXG5cdFx0bGV0IHBtb3VzZVggPSBkb3duZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdGxldCBwbW91c2VZID0gZG93bmV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXG5cdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdEp1bGlhLmNvbnN0YW50ID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBwbW91c2VYLCBwbW91c2VZKVxuXHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRyZW5kZXIoSnVsaWEpXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxpYXNcIilcblx0XHR9IGVsc2Vcblx0XHRcdCRodG1sLmFkZENsYXNzKFwiYWxsLXNjcm9sbFwiKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2Vtb3ZlKG1vdmVldnQpIHtcblx0XHRcdG1vdmVldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHRjb25zdCBtb3VzZVggPSBtb3ZlZXZ0LmNsaWVudFggLSBvZmZzZXQubGVmdFxuXHRcdFx0Y29uc3QgbW91c2VZID0gbW92ZWV2dC5jbGllbnRZIC0gb2Zmc2V0LnRvcFxuXHRcdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdFx0aWYgKGRvd25ldnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0SnVsaWEuY29uc3RhbnQgPSBtb3VzZVpcblx0XHRcdFx0dXBkYXRlSkNvbnN0YW50VGV4dCgpXG5cdFx0XHRcdHJlbmRlcihKdWxpYSlcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHBtb3VzZVogPSBnZXRaRnJvbVBpeGVsKGZyYWN0YWwsIHBtb3VzZVgsIHBtb3VzZVkpXG5cblx0XHRcdFx0cG1vdXNlWCA9IG1vdXNlWFxuXHRcdFx0XHRwbW91c2VZID0gbW91c2VZXG5cblx0XHRcdFx0Ym91bmRzLnJlYWwubWlkICs9IHBtb3VzZVoucmVhbCAtIG1vdXNlWi5yZWFsXG5cdFx0XHRcdGJvdW5kcy5pbWFnLm1pZCArPSBwbW91c2VaLmltYWcgLSBtb3VzZVouaW1hZ1xuXG5cdFx0XHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXHRcdFx0XHRyZW5kZXIoZnJhY3RhbClcblx0XHRcdH1cblx0XHR9XG5cdFx0JHdpbmRvdy5tb3VzZW1vdmUobW91c2Vtb3ZlKVxuXG5cdFx0ZnVuY3Rpb24gbW91c2V1cCh1cGV2dCkge1xuXHRcdFx0dXBldnQucHJldmVudERlZmF1bHQoKVxuXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNlbW92ZVwiLCBtb3VzZW1vdmUpXG5cdFx0XHQkd2luZG93Lm9mZihcIm1vdXNldXBcIiwgbW91c2V1cClcblxuXHRcdFx0JGh0bWwucmVtb3ZlQ2xhc3MoXCJhbGlhcyBhbGwtc2Nyb2xsXCIpXG5cdFx0fVxuXHRcdCR3aW5kb3cubW91c2V1cChtb3VzZXVwKVxuXHR9KVxufVxuaW5pdE1vdXNlRG93bihNYW5kZWxicm90KVxuaW5pdE1vdXNlRG93bihKdWxpYSlcblxuZnVuY3Rpb24gaW5pdFdoZWVsKGZyYWN0YWwpIHtcblx0Y29uc3Qge1xuXHRcdCRjYW52YXMsXG5cdFx0Ym91bmRzXG5cdH0gPSBmcmFjdGFsXG5cblx0JGNhbnZhcy5vbihcIndoZWVsXCIsIGV2dCA9PiB7XG5cdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcblxuXHRcdGNvbnN0IG9mZnNldCA9ICRjYW52YXMub2Zmc2V0KClcblx0XHRjb25zdCBtb3VzZVggPSBldnQuY2xpZW50WCAtIG9mZnNldC5sZWZ0XG5cdFx0Y29uc3QgbW91c2VZID0gZXZ0LmNsaWVudFkgLSBvZmZzZXQudG9wXG5cblx0XHRjb25zdCBkZWx0YVkgPSBldnQub3JpZ2luYWxFdmVudC5kZWx0YVlcblxuXHRcdGlmIChkZWx0YVkgPCAwKSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAvPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAvPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1pblwiKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRib3VuZHMucmVhbC5yYW5nZSAqPSBaT09NX0NPRUZGXG5cdFx0XHRib3VuZHMuaW1hZy5yYW5nZSAqPSBaT09NX0NPRUZGXG5cblx0XHRcdCRodG1sLmFkZENsYXNzKFwiem9vbS1vdXRcIilcblx0XHR9XG5cblx0XHRjb25zdCBwbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGNhbGN1bGF0ZUJvdW5kcyhmcmFjdGFsKVxuXG5cdFx0Y29uc3QgbW91c2VaID0gZ2V0WkZyb21QaXhlbChmcmFjdGFsLCBtb3VzZVgsIG1vdXNlWSlcblxuXHRcdGJvdW5kcy5yZWFsLm1pZCAtPSBtb3VzZVoucmVhbCAtIHBtb3VzZVoucmVhbFxuXHRcdGJvdW5kcy5pbWFnLm1pZCAtPSBtb3VzZVouaW1hZyAtIHBtb3VzZVouaW1hZ1xuXG5cdFx0Y2FsY3VsYXRlQm91bmRzKGZyYWN0YWwpXG5cdFx0cmVuZGVyKGZyYWN0YWwpXG5cblx0XHRjbGVhclRpbWVvdXQoJC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIikpXG5cdFx0JC5kYXRhKCRjYW52YXMsIFwic2Nyb2xsVGltZXJcIiwgc2V0VGltZW91dCgoKSA9PiAkaHRtbC5yZW1vdmVDbGFzcyhcInpvb20taW4gem9vbS1vdXRcIiksIDI1MCkpXG5cdH0pXG59XG5pbml0V2hlZWwoTWFuZGVsYnJvdClcbmluaXRXaGVlbChKdWxpYSlcbiIsIi8qQ29weXJpZ2h0IChjKSAyMDE3IE5hdGhhbiBDYWhpbGxcblxuUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxub2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xudG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG5mdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXG5UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbklNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG5BVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG5MSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuVEhFIFNPRlRXQVJFLiovXG5cbi8qISBTcGxpdC5qcyAtIHYxLjMuNSAqL1xuXG5leHBvcnQge1xuXHRTcGxpdCBhc1xuXHRkZWZhdWx0XG59O1xuXG52YXIgU3BsaXQ7XG5cbihmdW5jdGlvbihnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHRcdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdFx0KGdsb2JhbC5TcGxpdCA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdC8vIFRoZSBwcm9ncmFtbWluZyBnb2FscyBvZiBTcGxpdC5qcyBhcmUgdG8gZGVsaXZlciByZWFkYWJsZSwgdW5kZXJzdGFuZGFibGUgYW5kXG5cdC8vIG1haW50YWluYWJsZSBjb2RlLCB3aGlsZSBhdCB0aGUgc2FtZSB0aW1lIG1hbnVhbGx5IG9wdGltaXppbmcgZm9yIHRpbnkgbWluaWZpZWQgZmlsZSBzaXplLFxuXHQvLyBicm93c2VyIGNvbXBhdGliaWxpdHkgd2l0aG91dCBhZGRpdGlvbmFsIHJlcXVpcmVtZW50cywgZ3JhY2VmdWwgZmFsbGJhY2sgKElFOCBpcyBzdXBwb3J0ZWQpXG5cdC8vIGFuZCB2ZXJ5IGZldyBhc3N1bXB0aW9ucyBhYm91dCB0aGUgdXNlcidzIHBhZ2UgbGF5b3V0LlxuXHR2YXIgZ2xvYmFsID0gd2luZG93O1xuXHR2YXIgZG9jdW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cblx0Ly8gU2F2ZSBhIGNvdXBsZSBsb25nIGZ1bmN0aW9uIG5hbWVzIHRoYXQgYXJlIHVzZWQgZnJlcXVlbnRseS5cblx0Ly8gVGhpcyBvcHRpbWl6YXRpb24gc2F2ZXMgYXJvdW5kIDQwMCBieXRlcy5cblx0dmFyIGFkZEV2ZW50TGlzdGVuZXIgPSAnYWRkRXZlbnRMaXN0ZW5lcic7XG5cdHZhciByZW1vdmVFdmVudExpc3RlbmVyID0gJ3JlbW92ZUV2ZW50TGlzdGVuZXInO1xuXHR2YXIgZ2V0Qm91bmRpbmdDbGllbnRSZWN0ID0gJ2dldEJvdW5kaW5nQ2xpZW50UmVjdCc7XG5cdHZhciBOT09QID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9O1xuXG5cdC8vIEZpZ3VyZSBvdXQgaWYgd2UncmUgaW4gSUU4IG9yIG5vdC4gSUU4IHdpbGwgc3RpbGwgcmVuZGVyIGNvcnJlY3RseSxcblx0Ly8gYnV0IHdpbGwgYmUgc3RhdGljIGluc3RlYWQgb2YgZHJhZ2dhYmxlLlxuXHR2YXIgaXNJRTggPSBnbG9iYWwuYXR0YWNoRXZlbnQgJiYgIWdsb2JhbFthZGRFdmVudExpc3RlbmVyXTtcblxuXHQvLyBUaGlzIGxpYnJhcnkgb25seSBuZWVkcyB0d28gaGVscGVyIGZ1bmN0aW9uczpcblx0Ly9cblx0Ly8gVGhlIGZpcnN0IGRldGVybWluZXMgd2hpY2ggcHJlZml4ZXMgb2YgQ1NTIGNhbGMgd2UgbmVlZC5cblx0Ly8gV2Ugb25seSBuZWVkIHRvIGRvIHRoaXMgb25jZSBvbiBzdGFydHVwLCB3aGVuIHRoaXMgYW5vbnltb3VzIGZ1bmN0aW9uIGlzIGNhbGxlZC5cblx0Ly9cblx0Ly8gVGVzdHMgLXdlYmtpdCwgLW1veiBhbmQgLW8gcHJlZml4ZXMuIE1vZGlmaWVkIGZyb20gU3RhY2tPdmVyZmxvdzpcblx0Ly8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNjYyNTE0MC9qcy1mZWF0dXJlLWRldGVjdGlvbi10by1kZXRlY3QtdGhlLXVzYWdlLW9mLXdlYmtpdC1jYWxjLW92ZXItY2FsYy8xNjYyNTE2NyMxNjYyNTE2N1xuXHR2YXIgY2FsYyA9IChbJycsICctd2Via2l0LScsICctbW96LScsICctby0nXS5maWx0ZXIoZnVuY3Rpb24ocHJlZml4KSB7XG5cdFx0dmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZWwuc3R5bGUuY3NzVGV4dCA9IFwid2lkdGg6XCIgKyBwcmVmaXggKyBcImNhbGMoOXB4KVwiO1xuXG5cdFx0cmV0dXJuICghIWVsLnN0eWxlLmxlbmd0aClcblx0fSkuc2hpZnQoKSkgKyBcImNhbGNcIjtcblxuXHQvLyBUaGUgc2Vjb25kIGhlbHBlciBmdW5jdGlvbiBhbGxvd3MgZWxlbWVudHMgYW5kIHN0cmluZyBzZWxlY3RvcnMgdG8gYmUgdXNlZFxuXHQvLyBpbnRlcmNoYW5nZWFibHkuIEluIGVpdGhlciBjYXNlIGFuIGVsZW1lbnQgaXMgcmV0dXJuZWQuIFRoaXMgYWxsb3dzIHVzIHRvXG5cdC8vIGRvIGBTcGxpdChbZWxlbTEsIGVsZW0yXSlgIGFzIHdlbGwgYXMgYFNwbGl0KFsnI2lkMScsICcjaWQyJ10pYC5cblx0dmFyIGVsZW1lbnRPclNlbGVjdG9yID0gZnVuY3Rpb24oZWwpIHtcblx0XHRpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJyB8fCBlbCBpbnN0YW5jZW9mIFN0cmluZykge1xuXHRcdFx0cmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsXG5cdH07XG5cblx0Ly8gVGhlIG1haW4gZnVuY3Rpb24gdG8gaW5pdGlhbGl6ZSBhIHNwbGl0LiBTcGxpdC5qcyB0aGlua3MgYWJvdXQgZWFjaCBwYWlyXG5cdC8vIG9mIGVsZW1lbnRzIGFzIGFuIGluZGVwZW5kYW50IHBhaXIuIERyYWdnaW5nIHRoZSBndXR0ZXIgYmV0d2VlbiB0d28gZWxlbWVudHNcblx0Ly8gb25seSBjaGFuZ2VzIHRoZSBkaW1lbnNpb25zIG9mIGVsZW1lbnRzIGluIHRoYXQgcGFpci4gVGhpcyBpcyBrZXkgdG8gdW5kZXJzdGFuZGluZ1xuXHQvLyBob3cgdGhlIGZvbGxvd2luZyBmdW5jdGlvbnMgb3BlcmF0ZSwgc2luY2UgZWFjaCBmdW5jdGlvbiBpcyBib3VuZCB0byBhIHBhaXIuXG5cdC8vXG5cdC8vIEEgcGFpciBvYmplY3QgaXMgc2hhcGVkIGxpa2UgdGhpczpcblx0Ly9cblx0Ly8ge1xuXHQvLyAgICAgYTogRE9NIGVsZW1lbnQsXG5cdC8vICAgICBiOiBET00gZWxlbWVudCxcblx0Ly8gICAgIGFNaW46IE51bWJlcixcblx0Ly8gICAgIGJNaW46IE51bWJlcixcblx0Ly8gICAgIGRyYWdnaW5nOiBCb29sZWFuLFxuXHQvLyAgICAgcGFyZW50OiBET00gZWxlbWVudCxcblx0Ly8gICAgIGlzRmlyc3Q6IEJvb2xlYW4sXG5cdC8vICAgICBpc0xhc3Q6IEJvb2xlYW4sXG5cdC8vICAgICBkaXJlY3Rpb246ICdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCdcblx0Ly8gfVxuXHQvL1xuXHQvLyBUaGUgYmFzaWMgc2VxdWVuY2U6XG5cdC8vXG5cdC8vIDEuIFNldCBkZWZhdWx0cyB0byBzb21ldGhpbmcgc2FuZS4gYG9wdGlvbnNgIGRvZXNuJ3QgaGF2ZSB0byBiZSBwYXNzZWQgYXQgYWxsLlxuXHQvLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cblx0Ly8gICAgQSBsb3Qgb2YgdGhlIGJlaGF2aW9yIGluIHRoZSByZXN0IG9mIHRoZSBsaWJyYXJ5IGlzIHBhcmFtYXRpemVkIGRvd24gdG9cblx0Ly8gICAgcmVseSBvbiBDU1Mgc3RyaW5ncyBhbmQgY2xhc3Nlcy5cblx0Ly8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG5cdC8vIDQuIExvb3AgdGhyb3VnaCB0aGUgZWxlbWVudHMgd2hpbGUgcGFpcmluZyB0aGVtIG9mZi4gRXZlcnkgcGFpciBnZXRzIGFuXG5cdC8vICAgIGBwYWlyYCBvYmplY3QsIGEgZ3V0dGVyLCBhbmQgc3BlY2lhbCBpc0ZpcnN0L2lzTGFzdCBwcm9wZXJ0aWVzLlxuXHQvLyA1LiBBY3R1YWxseSBzaXplIHRoZSBwYWlyIGVsZW1lbnRzLCBpbnNlcnQgZ3V0dGVycyBhbmQgYXR0YWNoIGV2ZW50IGxpc3RlbmVycy5cblx0U3BsaXQgPSBmdW5jdGlvbihpZHMsIG9wdGlvbnMpIHtcblx0XHRpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSBvcHRpb25zID0ge307XG5cblx0XHR2YXIgZGltZW5zaW9uO1xuXHRcdHZhciBjbGllbnREaW1lbnNpb247XG5cdFx0dmFyIGNsaWVudEF4aXM7XG5cdFx0dmFyIHBvc2l0aW9uO1xuXHRcdHZhciBwYWRkaW5nQTtcblx0XHR2YXIgcGFkZGluZ0I7XG5cdFx0dmFyIGVsZW1lbnRzO1xuXG5cdFx0Ly8gQWxsIERPTSBlbGVtZW50cyBpbiB0aGUgc3BsaXQgc2hvdWxkIGhhdmUgYSBjb21tb24gcGFyZW50LiBXZSBjYW4gZ3JhYlxuXHRcdC8vIHRoZSBmaXJzdCBlbGVtZW50cyBwYXJlbnQgYW5kIGhvcGUgdXNlcnMgcmVhZCB0aGUgZG9jcyBiZWNhdXNlIHRoZVxuXHRcdC8vIGJlaGF2aW9yIHdpbGwgYmUgd2hhY2t5IG90aGVyd2lzZS5cblx0XHR2YXIgcGFyZW50ID0gZWxlbWVudE9yU2VsZWN0b3IoaWRzWzBdKS5wYXJlbnROb2RlO1xuXHRcdHZhciBwYXJlbnRGbGV4RGlyZWN0aW9uID0gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUocGFyZW50KS5mbGV4RGlyZWN0aW9uO1xuXG5cdFx0Ly8gU2V0IGRlZmF1bHQgb3B0aW9ucy5zaXplcyB0byBlcXVhbCBwZXJjZW50YWdlcyBvZiB0aGUgcGFyZW50IGVsZW1lbnQuXG5cdFx0dmFyIHNpemVzID0gb3B0aW9ucy5zaXplcyB8fCBpZHMubWFwKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIDEwMCAvIGlkcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHQvLyBTdGFuZGFyZGl6ZSBtaW5TaXplIHRvIGFuIGFycmF5IGlmIGl0IGlzbid0IGFscmVhZHkuIFRoaXMgYWxsb3dzIG1pblNpemVcblx0XHQvLyB0byBiZSBwYXNzZWQgYXMgYSBudW1iZXIuXG5cdFx0dmFyIG1pblNpemUgPSBvcHRpb25zLm1pblNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubWluU2l6ZSA6IDEwMDtcblx0XHR2YXIgbWluU2l6ZXMgPSBBcnJheS5pc0FycmF5KG1pblNpemUpID8gbWluU2l6ZSA6IGlkcy5tYXAoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gbWluU2l6ZTtcblx0XHR9KTtcblx0XHR2YXIgZ3V0dGVyU2l6ZSA9IG9wdGlvbnMuZ3V0dGVyU2l6ZSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ndXR0ZXJTaXplIDogMTA7XG5cdFx0dmFyIHNuYXBPZmZzZXQgPSBvcHRpb25zLnNuYXBPZmZzZXQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc25hcE9mZnNldCA6IDMwO1xuXHRcdHZhciBkaXJlY3Rpb24gPSBvcHRpb25zLmRpcmVjdGlvbiB8fCAnaG9yaXpvbnRhbCc7XG5cdFx0dmFyIGN1cnNvciA9IG9wdGlvbnMuY3Vyc29yIHx8IChkaXJlY3Rpb24gPT09ICdob3Jpem9udGFsJyA/ICdldy1yZXNpemUnIDogJ25zLXJlc2l6ZScpO1xuXHRcdHZhciBndXR0ZXIgPSBvcHRpb25zLmd1dHRlciB8fCAoZnVuY3Rpb24oaSwgZ3V0dGVyRGlyZWN0aW9uKSB7XG5cdFx0XHR2YXIgZ3V0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRndXQuY2xhc3NOYW1lID0gXCJndXR0ZXIgZ3V0dGVyLVwiICsgZ3V0dGVyRGlyZWN0aW9uO1xuXHRcdFx0cmV0dXJuIGd1dFxuXHRcdH0pO1xuXHRcdHZhciBlbGVtZW50U3R5bGUgPSBvcHRpb25zLmVsZW1lbnRTdHlsZSB8fCAoZnVuY3Rpb24oZGltLCBzaXplLCBndXRTaXplKSB7XG5cdFx0XHR2YXIgc3R5bGUgPSB7fTtcblxuXHRcdFx0aWYgKHR5cGVvZiBzaXplICE9PSAnc3RyaW5nJyAmJiAhKHNpemUgaW5zdGFuY2VvZiBTdHJpbmcpKSB7XG5cdFx0XHRcdGlmICghaXNJRTgpIHtcblx0XHRcdFx0XHRzdHlsZVtkaW1dID0gY2FsYyArIFwiKFwiICsgc2l6ZSArIFwiJSAtIFwiICsgZ3V0U2l6ZSArIFwicHgpXCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3R5bGVbZGltXSA9IHNpemUgKyBcIiVcIjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3R5bGVbZGltXSA9IHNpemU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzdHlsZVxuXHRcdH0pO1xuXHRcdHZhciBndXR0ZXJTdHlsZSA9IG9wdGlvbnMuZ3V0dGVyU3R5bGUgfHwgKGZ1bmN0aW9uKGRpbSwgZ3V0U2l6ZSkge1xuXHRcdFx0cmV0dXJuICgob2JqID0ge30sIG9ialtkaW1dID0gKGd1dFNpemUgKyBcInB4XCIpLCBvYmopKVxuXHRcdFx0dmFyIG9iajtcblx0XHR9KTtcblxuXHRcdC8vIDIuIEluaXRpYWxpemUgYSBidW5jaCBvZiBzdHJpbmdzIGJhc2VkIG9uIHRoZSBkaXJlY3Rpb24gd2UncmUgc3BsaXR0aW5nLlxuXHRcdC8vIEEgbG90IG9mIHRoZSBiZWhhdmlvciBpbiB0aGUgcmVzdCBvZiB0aGUgbGlicmFyeSBpcyBwYXJhbWF0aXplZCBkb3duIHRvXG5cdFx0Ly8gcmVseSBvbiBDU1Mgc3RyaW5ncyBhbmQgY2xhc3Nlcy5cblx0XHRpZiAoZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcpIHtcblx0XHRcdGRpbWVuc2lvbiA9ICd3aWR0aCc7XG5cdFx0XHRjbGllbnREaW1lbnNpb24gPSAnY2xpZW50V2lkdGgnO1xuXHRcdFx0Y2xpZW50QXhpcyA9ICdjbGllbnRYJztcblx0XHRcdHBvc2l0aW9uID0gJ2xlZnQnO1xuXHRcdFx0cGFkZGluZ0EgPSAncGFkZGluZ0xlZnQnO1xuXHRcdFx0cGFkZGluZ0IgPSAncGFkZGluZ1JpZ2h0Jztcblx0XHR9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3ZlcnRpY2FsJykge1xuXHRcdFx0ZGltZW5zaW9uID0gJ2hlaWdodCc7XG5cdFx0XHRjbGllbnREaW1lbnNpb24gPSAnY2xpZW50SGVpZ2h0Jztcblx0XHRcdGNsaWVudEF4aXMgPSAnY2xpZW50WSc7XG5cdFx0XHRwb3NpdGlvbiA9ICd0b3AnO1xuXHRcdFx0cGFkZGluZ0EgPSAncGFkZGluZ1RvcCc7XG5cdFx0XHRwYWRkaW5nQiA9ICdwYWRkaW5nQm90dG9tJztcblx0XHR9XG5cblx0XHQvLyAzLiBEZWZpbmUgdGhlIGRyYWdnaW5nIGhlbHBlciBmdW5jdGlvbnMsIGFuZCBhIGZldyBoZWxwZXJzIHRvIGdvIHdpdGggdGhlbS5cblx0XHQvLyBFYWNoIGhlbHBlciBpcyBib3VuZCB0byBhIHBhaXIgb2JqZWN0IHRoYXQgY29udGFpbnMgaXQncyBtZXRhZGF0YS4gVGhpc1xuXHRcdC8vIGFsc28gbWFrZXMgaXQgZWFzeSB0byBzdG9yZSByZWZlcmVuY2VzIHRvIGxpc3RlbmVycyB0aGF0IHRoYXQgd2lsbCBiZVxuXHRcdC8vIGFkZGVkIGFuZCByZW1vdmVkLlxuXHRcdC8vXG5cdFx0Ly8gRXZlbiB0aG91Z2ggdGhlcmUgYXJlIG5vIG90aGVyIGZ1bmN0aW9ucyBjb250YWluZWQgaW4gdGhlbSwgYWxpYXNpbmdcblx0XHQvLyB0aGlzIHRvIHNlbGYgc2F2ZXMgNTAgYnl0ZXMgb3Igc28gc2luY2UgaXQncyB1c2VkIHNvIGZyZXF1ZW50bHkuXG5cdFx0Ly9cblx0XHQvLyBUaGUgcGFpciBvYmplY3Qgc2F2ZXMgbWV0YWRhdGEgbGlrZSBkcmFnZ2luZyBzdGF0ZSwgcG9zaXRpb24gYW5kXG5cdFx0Ly8gZXZlbnQgbGlzdGVuZXIgcmVmZXJlbmNlcy5cblxuXHRcdGZ1bmN0aW9uIHNldEVsZW1lbnRTaXplKGVsLCBzaXplLCBndXRTaXplKSB7XG5cdFx0XHQvLyBTcGxpdC5qcyBhbGxvd3Mgc2V0dGluZyBzaXplcyB2aWEgbnVtYmVycyAoaWRlYWxseSksIG9yIGlmIHlvdSBtdXN0LFxuXHRcdFx0Ly8gYnkgc3RyaW5nLCBsaWtlICczMDBweCcuIFRoaXMgaXMgbGVzcyB0aGFuIGlkZWFsLCBiZWNhdXNlIGl0IGJyZWFrc1xuXHRcdFx0Ly8gdGhlIGZsdWlkIGxheW91dCB0aGF0IGBjYWxjKCUgLSBweClgIHByb3ZpZGVzLiBZb3UncmUgb24geW91ciBvd24gaWYgeW91IGRvIHRoYXQsXG5cdFx0XHQvLyBtYWtlIHN1cmUgeW91IGNhbGN1bGF0ZSB0aGUgZ3V0dGVyIHNpemUgYnkgaGFuZC5cblx0XHRcdHZhciBzdHlsZSA9IGVsZW1lbnRTdHlsZShkaW1lbnNpb24sIHNpemUsIGd1dFNpemUpO1xuXG5cdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cblx0XHRcdE9iamVjdC5rZXlzKHN0eWxlKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcblx0XHRcdFx0cmV0dXJuIChlbC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNldEd1dHRlclNpemUoZ3V0dGVyRWxlbWVudCwgZ3V0U2l6ZSkge1xuXHRcdFx0dmFyIHN0eWxlID0gZ3V0dGVyU3R5bGUoZGltZW5zaW9uLCBndXRTaXplKTtcblxuXHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG5cdFx0XHRPYmplY3Qua2V5cyhzdHlsZSkuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG5cdFx0XHRcdHJldHVybiAoZ3V0dGVyRWxlbWVudC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIEFjdHVhbGx5IGFkanVzdCB0aGUgc2l6ZSBvZiBlbGVtZW50cyBgYWAgYW5kIGBiYCB0byBgb2Zmc2V0YCB3aGlsZSBkcmFnZ2luZy5cblx0XHQvLyBjYWxjIGlzIHVzZWQgdG8gYWxsb3cgY2FsYyhwZXJjZW50YWdlICsgZ3V0dGVycHgpIG9uIHRoZSB3aG9sZSBzcGxpdCBpbnN0YW5jZSxcblx0XHQvLyB3aGljaCBhbGxvd3MgdGhlIHZpZXdwb3J0IHRvIGJlIHJlc2l6ZWQgd2l0aG91dCBhZGRpdGlvbmFsIGxvZ2ljLlxuXHRcdC8vIEVsZW1lbnQgYSdzIHNpemUgaXMgdGhlIHNhbWUgYXMgb2Zmc2V0LiBiJ3Mgc2l6ZSBpcyB0b3RhbCBzaXplIC0gYSBzaXplLlxuXHRcdC8vIEJvdGggc2l6ZXMgYXJlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgaW5pdGlhbCBwYXJlbnQgcGVyY2VudGFnZSxcblx0XHQvLyB0aGVuIHRoZSBndXR0ZXIgc2l6ZSBpcyBzdWJ0cmFjdGVkLlxuXHRcdGZ1bmN0aW9uIGFkanVzdChvZmZzZXQpIHtcblx0XHRcdHZhciBhID0gZWxlbWVudHNbdGhpcy5hXTtcblx0XHRcdHZhciBiID0gZWxlbWVudHNbdGhpcy5iXTtcblx0XHRcdHZhciBwZXJjZW50YWdlID0gYS5zaXplICsgYi5zaXplO1xuXG5cdFx0XHRhLnNpemUgPSAob2Zmc2V0IC8gdGhpcy5zaXplKSAqIHBlcmNlbnRhZ2U7XG5cdFx0XHRiLnNpemUgPSAocGVyY2VudGFnZSAtICgob2Zmc2V0IC8gdGhpcy5zaXplKSAqIHBlcmNlbnRhZ2UpKTtcblxuXHRcdFx0c2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHRoaXMuYUd1dHRlclNpemUpO1xuXHRcdFx0c2V0RWxlbWVudFNpemUoYi5lbGVtZW50LCBiLnNpemUsIHRoaXMuYkd1dHRlclNpemUpO1xuXHRcdH1cblxuXHRcdC8vIGRyYWcsIHdoZXJlIGFsbCB0aGUgbWFnaWMgaGFwcGVucy4gVGhlIGxvZ2ljIGlzIHJlYWxseSBxdWl0ZSBzaW1wbGU6XG5cdFx0Ly9cblx0XHQvLyAxLiBJZ25vcmUgaWYgdGhlIHBhaXIgaXMgbm90IGRyYWdnaW5nLlxuXHRcdC8vIDIuIEdldCB0aGUgb2Zmc2V0IG9mIHRoZSBldmVudC5cblx0XHQvLyAzLiBTbmFwIG9mZnNldCB0byBtaW4gaWYgd2l0aGluIHNuYXBwYWJsZSByYW5nZSAod2l0aGluIG1pbiArIHNuYXBPZmZzZXQpLlxuXHRcdC8vIDQuIEFjdHVhbGx5IGFkanVzdCBlYWNoIGVsZW1lbnQgaW4gdGhlIHBhaXIgdG8gb2Zmc2V0LlxuXHRcdC8vXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0Ly8gfCAgICB8IDwtIGEubWluU2l6ZSAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICBiLm1pblNpemUgLT4gfCAgICB8XG5cdFx0Ly8gfCAgICB8ICB8IDwtIHRoaXMuc25hcE9mZnNldCAgICAgIHx8ICAgICB0aGlzLnNuYXBPZmZzZXQgLT4gfCAgfCAgICB8XG5cdFx0Ly8gfCAgICB8ICB8ICAgICAgICAgICAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgfCAgICB8XG5cdFx0Ly8gfCAgICB8ICB8ICAgICAgICAgICAgICAgICAgICAgICAgIHx8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgfCAgICB8XG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0Ly8gfCA8LSB0aGlzLnN0YXJ0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZSAtPiB8XG5cdFx0ZnVuY3Rpb24gZHJhZyhlKSB7XG5cdFx0XHR2YXIgb2Zmc2V0O1xuXG5cdFx0XHRpZiAoIXRoaXMuZHJhZ2dpbmcpIHtcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR9XG5cblx0XHRcdC8vIEdldCB0aGUgb2Zmc2V0IG9mIHRoZSBldmVudCBmcm9tIHRoZSBmaXJzdCBzaWRlIG9mIHRoZVxuXHRcdFx0Ly8gcGFpciBgdGhpcy5zdGFydGAuIFN1cHBvcnRzIHRvdWNoIGV2ZW50cywgYnV0IG5vdCBtdWx0aXRvdWNoLCBzbyBvbmx5IHRoZSBmaXJzdFxuXHRcdFx0Ly8gZmluZ2VyIGB0b3VjaGVzWzBdYCBpcyBjb3VudGVkLlxuXHRcdFx0aWYgKCd0b3VjaGVzJyBpbiBlKSB7XG5cdFx0XHRcdG9mZnNldCA9IGUudG91Y2hlc1swXVtjbGllbnRBeGlzXSAtIHRoaXMuc3RhcnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvZmZzZXQgPSBlW2NsaWVudEF4aXNdIC0gdGhpcy5zdGFydDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgd2l0aGluIHNuYXBPZmZzZXQgb2YgbWluIG9yIG1heCwgc2V0IG9mZnNldCB0byBtaW4gb3IgbWF4LlxuXHRcdFx0Ly8gc25hcE9mZnNldCBidWZmZXJzIGEubWluU2l6ZSBhbmQgYi5taW5TaXplLCBzbyBsb2dpYyBpcyBvcHBvc2l0ZSBmb3IgYm90aC5cblx0XHRcdC8vIEluY2x1ZGUgdGhlIGFwcHJvcHJpYXRlIGd1dHRlciBzaXplcyB0byBwcmV2ZW50IG92ZXJmbG93cy5cblx0XHRcdGlmIChvZmZzZXQgPD0gZWxlbWVudHNbdGhpcy5hXS5taW5TaXplICsgc25hcE9mZnNldCArIHRoaXMuYUd1dHRlclNpemUpIHtcblx0XHRcdFx0b2Zmc2V0ID0gZWxlbWVudHNbdGhpcy5hXS5taW5TaXplICsgdGhpcy5hR3V0dGVyU2l6ZTtcblx0XHRcdH0gZWxzZSBpZiAob2Zmc2V0ID49IHRoaXMuc2l6ZSAtIChlbGVtZW50c1t0aGlzLmJdLm1pblNpemUgKyBzbmFwT2Zmc2V0ICsgdGhpcy5iR3V0dGVyU2l6ZSkpIHtcblx0XHRcdFx0b2Zmc2V0ID0gdGhpcy5zaXplIC0gKGVsZW1lbnRzW3RoaXMuYl0ubWluU2l6ZSArIHRoaXMuYkd1dHRlclNpemUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBY3R1YWxseSBhZGp1c3QgdGhlIHNpemUuXG5cdFx0XHRhZGp1c3QuY2FsbCh0aGlzLCBvZmZzZXQpO1xuXG5cdFx0XHQvLyBDYWxsIHRoZSBkcmFnIGNhbGxiYWNrIGNvbnRpbm91c2x5LiBEb24ndCBkbyBhbnl0aGluZyB0b28gaW50ZW5zaXZlXG5cdFx0XHQvLyBpbiB0aGlzIGNhbGxiYWNrLlxuXHRcdFx0aWYgKG9wdGlvbnMub25EcmFnKSB7XG5cdFx0XHRcdG9wdGlvbnMub25EcmFnKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2FjaGUgc29tZSBpbXBvcnRhbnQgc2l6ZXMgd2hlbiBkcmFnIHN0YXJ0cywgc28gd2UgZG9uJ3QgaGF2ZSB0byBkbyB0aGF0XG5cdFx0Ly8gY29udGlub3VzbHk6XG5cdFx0Ly9cblx0XHQvLyBgc2l6ZWA6IFRoZSB0b3RhbCBzaXplIG9mIHRoZSBwYWlyLiBGaXJzdCArIHNlY29uZCArIGZpcnN0IGd1dHRlciArIHNlY29uZCBndXR0ZXIuXG5cdFx0Ly8gYHN0YXJ0YDogVGhlIGxlYWRpbmcgc2lkZSBvZiB0aGUgZmlyc3QgZWxlbWVudC5cblx0XHQvL1xuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdC8vIHwgICAgICBhR3V0dGVyU2l6ZSAtPiB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuXHRcdC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuXHRcdC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgICAgICAgICAgICAgICAgICAgICAgfFxuXHRcdC8vIHwgICAgICAgICAgICAgICAgICAgICB8fHwgPC0gYkd1dHRlclNpemUgICAgICAgfFxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdC8vIHwgPC0gc3RhcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemUgLT4gfFxuXHRcdGZ1bmN0aW9uIGNhbGN1bGF0ZVNpemVzKCkge1xuXHRcdFx0Ly8gRmlndXJlIG91dCB0aGUgcGFyZW50IHNpemUgbWludXMgcGFkZGluZy5cblx0XHRcdHZhciBhID0gZWxlbWVudHNbdGhpcy5hXS5lbGVtZW50O1xuXHRcdFx0dmFyIGIgPSBlbGVtZW50c1t0aGlzLmJdLmVsZW1lbnQ7XG5cblx0XHRcdHRoaXMuc2l6ZSA9IGFbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl0gKyBiW2dldEJvdW5kaW5nQ2xpZW50UmVjdF0oKVtkaW1lbnNpb25dICsgdGhpcy5hR3V0dGVyU2l6ZSArIHRoaXMuYkd1dHRlclNpemU7XG5cdFx0XHR0aGlzLnN0YXJ0ID0gYVtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbcG9zaXRpb25dO1xuXHRcdH1cblxuXHRcdC8vIHN0b3BEcmFnZ2luZyBpcyB2ZXJ5IHNpbWlsYXIgdG8gc3RhcnREcmFnZ2luZyBpbiByZXZlcnNlLlxuXHRcdGZ1bmN0aW9uIHN0b3BEcmFnZ2luZygpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcdHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuXHRcdFx0dmFyIGIgPSBlbGVtZW50c1tzZWxmLmJdLmVsZW1lbnQ7XG5cblx0XHRcdGlmIChzZWxmLmRyYWdnaW5nICYmIG9wdGlvbnMub25EcmFnRW5kKSB7XG5cdFx0XHRcdG9wdGlvbnMub25EcmFnRW5kKCk7XG5cdFx0XHR9XG5cblx0XHRcdHNlbGYuZHJhZ2dpbmcgPSBmYWxzZTtcblxuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBzdG9yZWQgZXZlbnQgbGlzdGVuZXJzLiBUaGlzIGlzIHdoeSB3ZSBzdG9yZSB0aGVtLlxuXHRcdFx0Z2xvYmFsW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdtb3VzZXVwJywgc2VsZi5zdG9wKTtcblx0XHRcdGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuXHRcdFx0Z2xvYmFsW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCd0b3VjaGNhbmNlbCcsIHNlbGYuc3RvcCk7XG5cblx0XHRcdHNlbGYucGFyZW50W3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdtb3VzZW1vdmUnLCBzZWxmLm1vdmUpO1xuXHRcdFx0c2VsZi5wYXJlbnRbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cblx0XHRcdC8vIERlbGV0ZSB0aGVtIG9uY2UgdGhleSBhcmUgcmVtb3ZlZC4gSSB0aGluayB0aGlzIG1ha2VzIGEgZGlmZmVyZW5jZVxuXHRcdFx0Ly8gaW4gbWVtb3J5IHVzYWdlIHdpdGggYSBsb3Qgb2Ygc3BsaXRzIG9uIG9uZSBwYWdlLiBCdXQgSSBkb24ndCBrbm93IGZvciBzdXJlLlxuXHRcdFx0ZGVsZXRlIHNlbGYuc3RvcDtcblx0XHRcdGRlbGV0ZSBzZWxmLm1vdmU7XG5cblx0XHRcdGFbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG5cdFx0XHRhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcblx0XHRcdGJbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG5cdFx0XHRiW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcblxuXHRcdFx0YS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG5cdFx0XHRhLnN0eWxlLndlYmtpdFVzZXJTZWxlY3QgPSAnJztcblx0XHRcdGEuc3R5bGUuTW96VXNlclNlbGVjdCA9ICcnO1xuXHRcdFx0YS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cblx0XHRcdGIuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuXHRcdFx0Yi5zdHlsZS53ZWJraXRVc2VyU2VsZWN0ID0gJyc7XG5cdFx0XHRiLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcblx0XHRcdGIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuXG5cdFx0XHRzZWxmLmd1dHRlci5zdHlsZS5jdXJzb3IgPSAnJztcblx0XHRcdHNlbGYucGFyZW50LnN0eWxlLmN1cnNvciA9ICcnO1xuXHRcdH1cblxuXHRcdC8vIHN0YXJ0RHJhZ2dpbmcgY2FsbHMgYGNhbGN1bGF0ZVNpemVzYCB0byBzdG9yZSB0aGUgaW5pdGFsIHNpemUgaW4gdGhlIHBhaXIgb2JqZWN0LlxuXHRcdC8vIEl0IGFsc28gYWRkcyBldmVudCBsaXN0ZW5lcnMgZm9yIG1vdXNlL3RvdWNoIGV2ZW50cyxcblx0XHQvLyBhbmQgcHJldmVudHMgc2VsZWN0aW9uIHdoaWxlIGRyYWdnaW5nIHNvIGF2b2lkIHRoZSBzZWxlY3RpbmcgdGV4dC5cblx0XHRmdW5jdGlvbiBzdGFydERyYWdnaW5nKGUpIHtcblx0XHRcdC8vIEFsaWFzIGZyZXF1ZW50bHkgdXNlZCB2YXJpYWJsZXMgdG8gc2F2ZSBzcGFjZS4gMjAwIGJ5dGVzLlxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0dmFyIGEgPSBlbGVtZW50c1tzZWxmLmFdLmVsZW1lbnQ7XG5cdFx0XHR2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuXHRcdFx0Ly8gQ2FsbCB0aGUgb25EcmFnU3RhcnQgY2FsbGJhY2suXG5cdFx0XHRpZiAoIXNlbGYuZHJhZ2dpbmcgJiYgb3B0aW9ucy5vbkRyYWdTdGFydCkge1xuXHRcdFx0XHRvcHRpb25zLm9uRHJhZ1N0YXJ0KCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERvbid0IGFjdHVhbGx5IGRyYWcgdGhlIGVsZW1lbnQuIFdlIGVtdWxhdGUgdGhhdCBpbiB0aGUgZHJhZyBmdW5jdGlvbi5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0Ly8gU2V0IHRoZSBkcmFnZ2luZyBwcm9wZXJ0eSBvZiB0aGUgcGFpciBvYmplY3QuXG5cdFx0XHRzZWxmLmRyYWdnaW5nID0gdHJ1ZTtcblxuXHRcdFx0Ly8gQ3JlYXRlIHR3byBldmVudCBsaXN0ZW5lcnMgYm91bmQgdG8gdGhlIHNhbWUgcGFpciBvYmplY3QgYW5kIHN0b3JlXG5cdFx0XHQvLyB0aGVtIGluIHRoZSBwYWlyIG9iamVjdC5cblx0XHRcdHNlbGYubW92ZSA9IGRyYWcuYmluZChzZWxmKTtcblx0XHRcdHNlbGYuc3RvcCA9IHN0b3BEcmFnZ2luZy5iaW5kKHNlbGYpO1xuXG5cdFx0XHQvLyBBbGwgdGhlIGJpbmRpbmcuIGB3aW5kb3dgIGdldHMgdGhlIHN0b3AgZXZlbnRzIGluIGNhc2Ugd2UgZHJhZyBvdXQgb2YgdGhlIGVsZW1lbnRzLlxuXHRcdFx0Z2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZXVwJywgc2VsZi5zdG9wKTtcblx0XHRcdGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuXHRcdFx0Z2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCd0b3VjaGNhbmNlbCcsIHNlbGYuc3RvcCk7XG5cblx0XHRcdHNlbGYucGFyZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZW1vdmUnLCBzZWxmLm1vdmUpO1xuXHRcdFx0c2VsZi5wYXJlbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cblx0XHRcdC8vIERpc2FibGUgc2VsZWN0aW9uLiBEaXNhYmxlIVxuXHRcdFx0YVthZGRFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcblx0XHRcdGFbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXHRcdFx0YlthZGRFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcblx0XHRcdGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXG5cdFx0XHRhLnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG5cdFx0XHRhLnN0eWxlLndlYmtpdFVzZXJTZWxlY3QgPSAnbm9uZSc7XG5cdFx0XHRhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnbm9uZSc7XG5cdFx0XHRhLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cblx0XHRcdGIuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcblx0XHRcdGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICdub25lJztcblx0XHRcdGIuc3R5bGUuTW96VXNlclNlbGVjdCA9ICdub25lJztcblx0XHRcdGIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblxuXHRcdFx0Ly8gU2V0IHRoZSBjdXJzb3IsIGJvdGggb24gdGhlIGd1dHRlciBhbmQgdGhlIHBhcmVudCBlbGVtZW50LlxuXHRcdFx0Ly8gRG9pbmcgb25seSBhLCBiIGFuZCBndXR0ZXIgY2F1c2VzIGZsaWNrZXJpbmcuXG5cdFx0XHRzZWxmLmd1dHRlci5zdHlsZS5jdXJzb3IgPSBjdXJzb3I7XG5cdFx0XHRzZWxmLnBhcmVudC5zdHlsZS5jdXJzb3IgPSBjdXJzb3I7XG5cblx0XHRcdC8vIENhY2hlIHRoZSBpbml0aWFsIHNpemVzIG9mIHRoZSBwYWlyLlxuXHRcdFx0Y2FsY3VsYXRlU2l6ZXMuY2FsbChzZWxmKTtcblx0XHR9XG5cblx0XHQvLyA1LiBDcmVhdGUgcGFpciBhbmQgZWxlbWVudCBvYmplY3RzLiBFYWNoIHBhaXIgaGFzIGFuIGluZGV4IHJlZmVyZW5jZSB0b1xuXHRcdC8vIGVsZW1lbnRzIGBhYCBhbmQgYGJgIG9mIHRoZSBwYWlyIChmaXJzdCBhbmQgc2Vjb25kIGVsZW1lbnRzKS5cblx0XHQvLyBMb29wIHRocm91Z2ggdGhlIGVsZW1lbnRzIHdoaWxlIHBhaXJpbmcgdGhlbSBvZmYuIEV2ZXJ5IHBhaXIgZ2V0cyBhXG5cdFx0Ly8gYHBhaXJgIG9iamVjdCwgYSBndXR0ZXIsIGFuZCBpc0ZpcnN0L2lzTGFzdCBwcm9wZXJ0aWVzLlxuXHRcdC8vXG5cdFx0Ly8gQmFzaWMgbG9naWM6XG5cdFx0Ly9cblx0XHQvLyAtIFN0YXJ0aW5nIHdpdGggdGhlIHNlY29uZCBlbGVtZW50IGBpID4gMGAsIGNyZWF0ZSBgcGFpcmAgb2JqZWN0cyB3aXRoXG5cdFx0Ly8gICBgYSA9IGkgLSAxYCBhbmQgYGIgPSBpYFxuXHRcdC8vIC0gU2V0IGd1dHRlciBzaXplcyBiYXNlZCBvbiB0aGUgX3BhaXJfIGJlaW5nIGZpcnN0L2xhc3QuIFRoZSBmaXJzdCBhbmQgbGFzdFxuXHRcdC8vICAgcGFpciBoYXZlIGd1dHRlclNpemUgLyAyLCBzaW5jZSB0aGV5IG9ubHkgaGF2ZSBvbmUgaGFsZiBndXR0ZXIsIGFuZCBub3QgdHdvLlxuXHRcdC8vIC0gQ3JlYXRlIGd1dHRlciBlbGVtZW50cyBhbmQgYWRkIGV2ZW50IGxpc3RlbmVycy5cblx0XHQvLyAtIFNldCB0aGUgc2l6ZSBvZiB0aGUgZWxlbWVudHMsIG1pbnVzIHRoZSBndXR0ZXIgc2l6ZXMuXG5cdFx0Ly9cblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdC8vIHwgICAgIGk9MCAgICAgfCAgICAgICAgIGk9MSAgICAgICAgIHwgICAgICAgIGk9MiAgICAgICB8ICAgICAgaT0zICAgICB8XG5cdFx0Ly8gfCAgICAgICAgICAgICB8ICAgICAgIGlzRmlyc3QgICAgICAgfCAgICAgICAgICAgICAgICAgIHwgICAgIGlzTGFzdCAgIHxcblx0XHQvLyB8ICAgICAgICAgICBwYWlyIDAgICAgICAgICAgICAgICAgcGFpciAxICAgICAgICAgICAgIHBhaXIgMiAgICAgICAgICAgfFxuXHRcdC8vIHwgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICB8XG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0XHR2YXIgcGFpcnMgPSBbXTtcblx0XHRlbGVtZW50cyA9IGlkcy5tYXAoZnVuY3Rpb24oaWQsIGkpIHtcblx0XHRcdC8vIENyZWF0ZSB0aGUgZWxlbWVudCBvYmplY3QuXG5cdFx0XHR2YXIgZWxlbWVudCA9IHtcblx0XHRcdFx0ZWxlbWVudDogZWxlbWVudE9yU2VsZWN0b3IoaWQpLFxuXHRcdFx0XHRzaXplOiBzaXplc1tpXSxcblx0XHRcdFx0bWluU2l6ZTogbWluU2l6ZXNbaV0sXG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgcGFpcjtcblxuXHRcdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRcdC8vIENyZWF0ZSB0aGUgcGFpciBvYmplY3Qgd2l0aCBpdCdzIG1ldGFkYXRhLlxuXHRcdFx0XHRwYWlyID0ge1xuXHRcdFx0XHRcdGE6IGkgLSAxLFxuXHRcdFx0XHRcdGI6IGksXG5cdFx0XHRcdFx0ZHJhZ2dpbmc6IGZhbHNlLFxuXHRcdFx0XHRcdGlzRmlyc3Q6IChpID09PSAxKSxcblx0XHRcdFx0XHRpc0xhc3Q6IChpID09PSBpZHMubGVuZ3RoIC0gMSksXG5cdFx0XHRcdFx0ZGlyZWN0aW9uOiBkaXJlY3Rpb24sXG5cdFx0XHRcdFx0cGFyZW50OiBwYXJlbnQsXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gRm9yIGZpcnN0IGFuZCBsYXN0IHBhaXJzLCBmaXJzdCBhbmQgbGFzdCBndXR0ZXIgd2lkdGggaXMgaGFsZi5cblx0XHRcdFx0cGFpci5hR3V0dGVyU2l6ZSA9IGd1dHRlclNpemU7XG5cdFx0XHRcdHBhaXIuYkd1dHRlclNpemUgPSBndXR0ZXJTaXplO1xuXG5cdFx0XHRcdGlmIChwYWlyLmlzRmlyc3QpIHtcblx0XHRcdFx0XHRwYWlyLmFHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZSAvIDI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocGFpci5pc0xhc3QpIHtcblx0XHRcdFx0XHRwYWlyLmJHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZSAvIDI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBpZiB0aGUgcGFyZW50IGhhcyBhIHJldmVyc2UgZmxleC1kaXJlY3Rpb24sIHN3aXRjaCB0aGUgcGFpciBlbGVtZW50cy5cblx0XHRcdFx0aWYgKHBhcmVudEZsZXhEaXJlY3Rpb24gPT09ICdyb3ctcmV2ZXJzZScgfHwgcGFyZW50RmxleERpcmVjdGlvbiA9PT0gJ2NvbHVtbi1yZXZlcnNlJykge1xuXHRcdFx0XHRcdHZhciB0ZW1wID0gcGFpci5hO1xuXHRcdFx0XHRcdHBhaXIuYSA9IHBhaXIuYjtcblx0XHRcdFx0XHRwYWlyLmIgPSB0ZW1wO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIERldGVybWluZSB0aGUgc2l6ZSBvZiB0aGUgY3VycmVudCBlbGVtZW50LiBJRTggaXMgc3VwcG9ydGVkIGJ5XG5cdFx0XHQvLyBzdGF0aWNseSBhc3NpZ25pbmcgc2l6ZXMgd2l0aG91dCBkcmFnZ2FibGUgZ3V0dGVycy4gQXNzaWducyBhIHN0cmluZ1xuXHRcdFx0Ly8gdG8gYHNpemVgLlxuXHRcdFx0Ly9cblx0XHRcdC8vIElFOSBhbmQgYWJvdmVcblx0XHRcdGlmICghaXNJRTgpIHtcblx0XHRcdFx0Ly8gQ3JlYXRlIGd1dHRlciBlbGVtZW50cyBmb3IgZWFjaCBwYWlyLlxuXHRcdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0XHR2YXIgZ3V0dGVyRWxlbWVudCA9IGd1dHRlcihpLCBkaXJlY3Rpb24pO1xuXHRcdFx0XHRcdHNldEd1dHRlclNpemUoZ3V0dGVyRWxlbWVudCwgZ3V0dGVyU2l6ZSk7XG5cblx0XHRcdFx0XHRndXR0ZXJFbGVtZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZWRvd24nLCBzdGFydERyYWdnaW5nLmJpbmQocGFpcikpO1xuXHRcdFx0XHRcdGd1dHRlckVsZW1lbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoc3RhcnQnLCBzdGFydERyYWdnaW5nLmJpbmQocGFpcikpO1xuXG5cdFx0XHRcdFx0cGFyZW50Lmluc2VydEJlZm9yZShndXR0ZXJFbGVtZW50LCBlbGVtZW50LmVsZW1lbnQpO1xuXG5cdFx0XHRcdFx0cGFpci5ndXR0ZXIgPSBndXR0ZXJFbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNldCB0aGUgZWxlbWVudCBzaXplIHRvIG91ciBkZXRlcm1pbmVkIHNpemUuXG5cdFx0XHQvLyBIYWxmLXNpemUgZ3V0dGVycyBmb3IgZmlyc3QgYW5kIGxhc3QgZWxlbWVudHMuXG5cdFx0XHRpZiAoaSA9PT0gMCB8fCBpID09PSBpZHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRzZXRFbGVtZW50U2l6ZShlbGVtZW50LmVsZW1lbnQsIGVsZW1lbnQuc2l6ZSwgZ3V0dGVyU2l6ZSAvIDIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2V0RWxlbWVudFNpemUoZWxlbWVudC5lbGVtZW50LCBlbGVtZW50LnNpemUsIGd1dHRlclNpemUpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgY29tcHV0ZWRTaXplID0gZWxlbWVudC5lbGVtZW50W2dldEJvdW5kaW5nQ2xpZW50UmVjdF0oKVtkaW1lbnNpb25dO1xuXG5cdFx0XHRpZiAoY29tcHV0ZWRTaXplIDwgZWxlbWVudC5taW5TaXplKSB7XG5cdFx0XHRcdGVsZW1lbnQubWluU2l6ZSA9IGNvbXB1dGVkU2l6ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQWZ0ZXIgdGhlIGZpcnN0IGl0ZXJhdGlvbiwgYW5kIHdlIGhhdmUgYSBwYWlyIG9iamVjdCwgYXBwZW5kIGl0IHRvIHRoZVxuXHRcdFx0Ly8gbGlzdCBvZiBwYWlycy5cblx0XHRcdGlmIChpID4gMCkge1xuXHRcdFx0XHRwYWlycy5wdXNoKHBhaXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZWxlbWVudFxuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gc2V0U2l6ZXMobmV3U2l6ZXMpIHtcblx0XHRcdG5ld1NpemVzLmZvckVhY2goZnVuY3Rpb24obmV3U2l6ZSwgaSkge1xuXHRcdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0XHR2YXIgcGFpciA9IHBhaXJzW2kgLSAxXTtcblx0XHRcdFx0XHR2YXIgYSA9IGVsZW1lbnRzW3BhaXIuYV07XG5cdFx0XHRcdFx0dmFyIGIgPSBlbGVtZW50c1twYWlyLmJdO1xuXG5cdFx0XHRcdFx0YS5zaXplID0gbmV3U2l6ZXNbaSAtIDFdO1xuXHRcdFx0XHRcdGIuc2l6ZSA9IG5ld1NpemU7XG5cblx0XHRcdFx0XHRzZXRFbGVtZW50U2l6ZShhLmVsZW1lbnQsIGEuc2l6ZSwgcGFpci5hR3V0dGVyU2l6ZSk7XG5cdFx0XHRcdFx0c2V0RWxlbWVudFNpemUoYi5lbGVtZW50LCBiLnNpemUsIHBhaXIuYkd1dHRlclNpemUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdFx0cGFpcnMuZm9yRWFjaChmdW5jdGlvbihwYWlyKSB7XG5cdFx0XHRcdHBhaXIucGFyZW50LnJlbW92ZUNoaWxkKHBhaXIuZ3V0dGVyKTtcblx0XHRcdFx0ZWxlbWVudHNbcGFpci5hXS5lbGVtZW50LnN0eWxlW2RpbWVuc2lvbl0gPSAnJztcblx0XHRcdFx0ZWxlbWVudHNbcGFpci5iXS5lbGVtZW50LnN0eWxlW2RpbWVuc2lvbl0gPSAnJztcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChpc0lFOCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c2V0U2l6ZXM6IHNldFNpemVzLFxuXHRcdFx0XHRkZXN0cm95OiBkZXN0cm95LFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzZXRTaXplczogc2V0U2l6ZXMsXG5cdFx0XHRnZXRTaXplczogZnVuY3Rpb24gZ2V0U2l6ZXMoKSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50cy5tYXAoZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50LnNpemU7XG5cdFx0XHRcdH0pXG5cdFx0XHR9LFxuXHRcdFx0Y29sbGFwc2U6IGZ1bmN0aW9uIGNvbGxhcHNlKGkpIHtcblx0XHRcdFx0aWYgKGkgPT09IHBhaXJzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHZhciBwYWlyID0gcGFpcnNbaSAtIDFdO1xuXG5cdFx0XHRcdFx0Y2FsY3VsYXRlU2l6ZXMuY2FsbChwYWlyKTtcblxuXHRcdFx0XHRcdGlmICghaXNJRTgpIHtcblx0XHRcdFx0XHRcdGFkanVzdC5jYWxsKHBhaXIsIHBhaXIuc2l6ZSAtIHBhaXIuYkd1dHRlclNpemUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcGFpciQxID0gcGFpcnNbaV07XG5cblx0XHRcdFx0XHRjYWxjdWxhdGVTaXplcy5jYWxsKHBhaXIkMSk7XG5cblx0XHRcdFx0XHRpZiAoIWlzSUU4KSB7XG5cdFx0XHRcdFx0XHRhZGp1c3QuY2FsbChwYWlyJDEsIHBhaXIkMS5hR3V0dGVyU2l6ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZGVzdHJveTogZGVzdHJveSxcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIFNwbGl0O1xuXG59KSkpO1xuIiwiY29uc3QgdmVydGV4U2hhZGVyU291cmNlID0gYFxuYXR0cmlidXRlIHZlYzQgdmVydGV4UG9zaXRpb247XG5cbnZvaWQgbWFpbigpIHtcblx0Z2xfUG9zaXRpb24gPSB2ZXJ0ZXhQb3NpdGlvbjtcbn1cbmBcblxuY29uc3QgZnJhZ21lbnRTaGFkZXJTb3VyY2UgPSBgXG5wcmVjaXNpb24gaGlnaHAgZmxvYXQ7XG5cbnVuaWZvcm0gZmxvYXQgcmVhbE1pbjtcbnVuaWZvcm0gZmxvYXQgaW1hZ01pbjtcbnVuaWZvcm0gZmxvYXQgb3ZlckNhbnZhcztcbnVuaWZvcm0gYm9vbCBpc0p1bGlhO1xudW5pZm9ybSB2ZWMyIGpjb25zdGFudDtcbnVuaWZvcm0gaW50IG1heEl0ZXJhdGlvbnM7XG5jb25zdCBmbG9hdCBCQUlMT1VUX1JBRElVUyA9IDQuMDtcbmNvbnN0IGludCBOVU1fQ09MT1JTID0gNTEyO1xudW5pZm9ybSB2ZWM0IHBhbGV0dGVbTlVNX0NPTE9SU107XG5jb25zdCBmbG9hdCBHUkFESUVOVF9TQ0FMRSA9IGZsb2F0KE5VTV9DT0xPUlMpIC8gMzIuMDtcblxudmVjNCBnZXRGcmFjdGFsQ29sb3IodmVjMiB6KSB7XG5cdHZlYzIgelNxO1xuXHR2ZWMyIGM7XG5cdGlmIChpc0p1bGlhKVxuXHRcdGMgPSBqY29uc3RhbnQ7XG5cdGVsc2Vcblx0XHRjID0gejtcblxuXHRmb3IgKGludCBpID0gMDsgaSA8IDEwMDAwOyBpKyspIHtcblx0XHR6U3EgPSB2ZWMyKHoueCAqIHoueCwgei55ICogei55KTtcblx0XHR6ID0gdmVjMih6U3EueCAtIHpTcS55ICsgYy54LCAyLjAgKiB6LnggKiB6LnkgKyBjLnkpO1xuXG5cdFx0aWYgKHpTcS54ICsgelNxLnkgPiBCQUlMT1VUX1JBRElVUykge1xuXHRcdFx0Zm9yIChpbnQgaiA9IDA7IGogPCAzOyBqKyspIHtcblx0XHRcdFx0elNxID0gdmVjMih6LnggKiB6LngsIHoueSAqIHoueSk7XG5cdFx0XHRcdHogPSB2ZWMyKHpTcS54IC0gelNxLnksIDIuMCAqIHoueCAqIHoueSkgKyBjO1xuXHRcdFx0fVxuXG5cdFx0XHRmbG9hdCBtdSA9IGZsb2F0KGkpICsgMS4wIC0gbG9nMihsb2coelNxLnggKyB6U3EueSkgLyAyLjApO1xuXHRcdFx0aW50IGluZGV4ID0gaW50KG1vZChtdSAqIEdSQURJRU5UX1NDQUxFLCBmbG9hdChOVU1fQ09MT1JTKSkpO1xuXG5cdFx0XHRmb3IgKGludCBqID0gMDsgaiA8IE5VTV9DT0xPUlM7IGorKykge1xuXHRcdFx0XHRpZiAoaiA9PSBpbmRleCkge1xuXHRcdFx0XHRcdHJldHVybiBwYWxldHRlW2pdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGkgPiBtYXhJdGVyYXRpb25zKSByZXR1cm4gdmVjNCgwLCAwLCAwLCAxKTtcblx0fVxufVxuXG52b2lkIG1haW4oKSB7XG5cdGdsX0ZyYWdDb2xvciA9IGdldEZyYWN0YWxDb2xvcih2ZWMyKHJlYWxNaW4gKyBnbF9GcmFnQ29vcmQueCAqIG92ZXJDYW52YXMsIGltYWdNaW4gKyBnbF9GcmFnQ29vcmQueSAqIG92ZXJDYW52YXMpKTtcbn1cbmBcblxuY29uc3QgdmVydGljZXMgPSBbXG5cdFsxLCAxXSxcblx0WzEsIC0xXSxcblx0Wy0xLCAtMV0sXG5cdFstMSwgMV1cbl1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRHbCh7XG5cdGNhbnZhc1xufSkge1xuXHRjb25zdCBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIikgfHwgY2FudmFzLmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIilcblx0aWYgKCFnbCkge1xuXHRcdGFsZXJ0KFwiVW5hYmxlIHRvIGluaXRpYWxpemUgV2ViR0wuIFlvdXIgYnJvd3NlciBtYXkgbm90IHN1cHBvcnQgaXQuXCIpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXHRyZXR1cm4gZ2xcbn1cblxuZnVuY3Rpb24gZ2V0U2hhZGVyKGdsLCBuYW1lLCB0eXBlKSB7XG5cdGNvbnN0IHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcih0eXBlKVxuXG5cdGxldCBzb3VyY2Vcblx0aWYgKG5hbWUgPT09IFwiZnJhY3RhbC52ZXJ0XCIpIHtcblx0XHRzb3VyY2UgPSB2ZXJ0ZXhTaGFkZXJTb3VyY2Vcblx0fSBlbHNlIGlmIChuYW1lID09PSBcImZyYWN0YWwuZnJhZ1wiKSB7XG5cdFx0c291cmNlID0gZnJhZ21lbnRTaGFkZXJTb3VyY2Vcblx0fVxuXHRpZiAoIXNvdXJjZSkge1xuXHRcdGFsZXJ0KFwiQ291bGQgbm90IGZpbmQgc2hhZGVyIHNvdXJjZTogXCIgKyBuYW1lKVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXHRnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzb3VyY2UpXG5cdGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKVxuXG5cdGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG5cdFx0YWxlcnQoXCJBbiBlcnJvciBvY2N1cmVkIGNvbXBpbGluZyB0aGUgc2hhZGVyczogXCIgKyBnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikpXG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXG5cdHJldHVybiBzaGFkZXJcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRQcm9ncmFtKHtcblx0Z2xcbn0pIHtcblx0Y29uc3QgdmVydGV4U2hhZGVyID0gZ2V0U2hhZGVyKGdsLCBcImZyYWN0YWwudmVydFwiLCBnbC5WRVJURVhfU0hBREVSKVxuXHRjb25zdCBmcmFnbWVudFNoYWRlciA9IGdldFNoYWRlcihnbCwgXCJmcmFjdGFsLmZyYWdcIiwgZ2wuRlJBR01FTlRfU0hBREVSKVxuXG5cdGNvbnN0IHByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKClcblx0Z2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIHZlcnRleFNoYWRlcilcblx0Z2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKVxuXHRnbC5saW5rUHJvZ3JhbShwcm9ncmFtKVxuXG5cdGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRhbGVydChcIlVuYWJsZSB0byBpbml0aWFsaXplIHRoZSBzaGFkZXIgcHJvZ3JhbTogXCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyhwcm9ncmFtKSlcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cblx0Z2wudXNlUHJvZ3JhbShwcm9ncmFtKVxuXG5cdGNvbnN0IHZlcnRleFBvc2l0aW9uQXR0cmliID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgXCJ2ZXJ0ZXhQb3NpdGlvblwiKVxuXHRnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheSh2ZXJ0ZXhQb3NpdGlvbkF0dHJpYilcblxuXHRjb25zdCB2ZXJ0aWNlc0J1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpXG5cdGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0aWNlc0J1ZmZlcilcblx0Z2wudmVydGV4QXR0cmliUG9pbnRlcih2ZXJ0ZXhQb3NpdGlvbkF0dHJpYiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKVxuXHRnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgbmV3IEZsb2F0MzJBcnJheSh2ZXJ0aWNlcy5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MuY29uY2F0KHZhbCkpKSwgZ2wuU1RBVElDX0RSQVcpXG5cblx0cmV0dXJuIHByb2dyYW1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaWZvcm1zKHtcblx0Z2wsXG5cdHByb2dyYW1cbn0sIG5hbWVzKSB7XG5cdGNvbnN0IHVuaWZvcm1zID0ge31cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IG5hbWUgPSBuYW1lc1tpXVxuXHRcdHVuaWZvcm1zW25hbWVdID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIG5hbWUpXG5cdH1cblx0cmV0dXJuIHVuaWZvcm1zXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJHbChnbCkge1xuXHRnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKVxuXHRnbC5kcmF3QXJyYXlzKGdsLlRSSUFOR0xFX0ZBTiwgMCwgdmVydGljZXMubGVuZ3RoKVxufVxuIl19
