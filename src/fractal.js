import getPalette from "./color-gradient.js"
import {
	initGl,
	initProgram,
	getUniforms,
	initTexture,
	renderGl
} from "./webgl-utils.js"
import Split from "split.js"
import "hammerjs"

const $window = $(window)
const $html = $("html")

const $iterationText = $("#iteration-text")
const $jconstantText = $("#julia-constant-text")

const $controlsDialog = $("#controls-dialog")
$controlsDialog.dialog({
	width: "25em",
	buttons: [{
		text: "Got it!",
		click: () => {
			$controlsDialog.dialog("close")
		}
	}],
	autoOpen: false,
	resizable: false,
	show: "scale",
	hide: "puff"
}).tooltip()
setTimeout(() => {
	$controlsDialog.dialog("open")
}, 500)

const SCROLL_COEFF = 0.05
const ZOOM_COEFF = 1.1

let maxIterations = 200

const palette = getPalette([
	[0, 0x000000],
	[0.1, 0x440845],
	[0.2, 0x7d1a48],
	[0.3, 0xc66f37],
	[0.4, 0xf0e953],
	[0.5, 0xffffff],
	[0.6, 0x98e991],
	[0.7, 0x57c9ae],
	[0.8, 0x245b9a],
	[0.9, 0x071146],
	[1, 0x000000]
], 2048)

const Mandelbrot = initFractal("#mandelbrot-canvas", {
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
})

const Julia = initFractal("#julia-canvas", {
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
})

function initFractal(canvasSelector, bounds, jconstant) {
	const fractal = {}
	fractal.$canvas = $(canvasSelector)
	fractal.canvas = fractal.$canvas[0]
	fractal.gl = initGl(fractal)
	fractal.program = initProgram(fractal)
	fractal.uniforms = getUniforms(fractal, [
		"doublePrecision",
		"realMin",
		"realMinD",
		"imagMin",
		"imagMinD",
		"maxIterations",
		"isJulia",
		"jconstant",
		"overCanvas",
		"palette"
	])
	fractal.bounds = bounds
	if (jconstant) {
		fractal.gl.uniform1i(fractal.uniforms.isJulia, true)
		fractal.constant = jconstant
	}
	initTexture(fractal, palette)
	fractal.gl.uniform1i(fractal.uniforms.palette, 0)
	return fractal
}

function updateIterationText() {
	$iterationText.text(`Iteration count = ${maxIterations}`)
}
updateIterationText()

function updateJConstantText() {
	$jconstantText.text(`Julia set for c = ${Julia.constant.real} + ${Julia.constant.imag}i`)
}
updateJConstantText()

function resizeCanvas(fractal) {
	const {
		$canvas,
		canvas,
		gl
	} = fractal

	canvas.width = $canvas.width()
	canvas.height = $canvas.height()
	gl.viewport(0, 0, canvas.width, canvas.height)
	calculateBounds(fractal)
	render(fractal)
}

function resizeCanvases() {
	resizeCanvas(Mandelbrot)
	resizeCanvas(Julia)
}

function resize() {
	$html.css("font-size", 0.0075 * $html.width() + 6)
	$controlsDialog.dialog("option", "position", {
		my: "center",
		at: "center",
		of: window
	})
	$controlsDialog.dialog("option", "maxHeight", $html.height())
	resizeCanvases()
}
$(resize)
$window.resize(resize)

Split(["#mandelbrot-canvas-wrapper", "#julia-canvas-wrapper"], {
	minSize: 50,
	gutterSize: 13,
	direction: "horizontal",
	cursor: "col-resize",
	onDrag: resizeCanvases
})

function calculateBounds({
	canvas,
	bounds
}) {
	bounds.real.range = Math.abs(bounds.real.range)
	bounds.imag.range = Math.abs(bounds.imag.range)

	const boundsRatio = bounds.real.range / bounds.imag.range
	const canvasRatio = canvas.width / canvas.height

	if (boundsRatio < canvasRatio)
		bounds.real.range = bounds.imag.range * canvasRatio
	else if (boundsRatio > canvasRatio)
		bounds.imag.range = bounds.real.range / canvasRatio

	bounds.real.min = bounds.real.mid - bounds.real.range / 2
	bounds.real.max = bounds.real.mid + bounds.real.range / 2
	bounds.imag.min = bounds.imag.mid - bounds.imag.range / 2
	bounds.imag.max = bounds.imag.mid + bounds.imag.range / 2

	bounds.overCanvas = bounds.real.range / canvas.width
}

function render({
	gl,
	uniforms,
	bounds,
	constant
}) {
	if (bounds.overCanvas > 2.38418579e-7) {
		gl.uniform1i(uniforms.doublePrecision, false)
		gl.uniform1f(uniforms.realMin, bounds.real.min)
		gl.uniform1f(uniforms.imagMin, bounds.imag.min)
	} else {
		gl.uniform1i(uniforms.doublePrecision, true)
		gl.uniform2f(uniforms.realMinD, bounds.real.min, bounds.real.min - Math.fround(bounds.real.min))
		gl.uniform2f(uniforms.imagMinD, bounds.imag.min, bounds.imag.min - Math.fround(bounds.imag.min))
	}
	gl.uniform1f(uniforms.overCanvas, bounds.overCanvas)
	gl.uniform1i(uniforms.maxIterations, maxIterations)
	if (constant)
		gl.uniform2f(uniforms.jconstant, constant.real, constant.imag)

	renderGl(gl)
}

function getZFromPixel({
	bounds
}, x, y) {
	return {
		real: bounds.real.min + x * bounds.overCanvas,
		imag: bounds.imag.max - y * bounds.overCanvas
	}
}

function initPan(fractal) {
	const {
		$canvas,
		canvas,
		bounds
	} = fractal

	const h = new Hammer(canvas)
	h.get("pan").set({
		pointers: 0,
		threshold: 0,
		direction: Hammer.DIRECTION_ALL
	})

	let shiftKey

	const pdelta = {
		x: null,
		y: null
	}

	$canvas.mousedown(evt => {
		evt.preventDefault()
		shiftKey = evt.shiftKey
	})

	h.on("panstart", evt => {
		evt.preventDefault()

		if (!shiftKey) {
			pdelta.x = evt.deltaX
			pdelta.y = evt.deltaY
		}
	})

	h.on("pan", evt => {
		evt.preventDefault()

		if (!shiftKey) {
			bounds.real.mid -= (evt.deltaX - pdelta.x) * bounds.overCanvas
			bounds.imag.mid += (evt.deltaY - pdelta.y) * bounds.overCanvas

			pdelta.x = evt.deltaX
			pdelta.y = evt.deltaY

			calculateBounds(fractal)
			render(fractal)
		}
	})
}
initPan(Mandelbrot)
initPan(Julia)

function initPinch(fractal) {
	const {
		$canvas,
		canvas,
		bounds
	} = fractal

	const h = new Hammer(canvas)
	h.get("pinch").set({
		enable: true
	})

	let offset

	const prange = {
		real: null,
		imag: null
	}

	h.on("pinchstart", evt => {
		evt.preventDefault()

		offset = $canvas.offset()

		prange.real = bounds.real.range
		prange.imag = bounds.imag.range
	})

	h.on("pinch", evt => {
		evt.preventDefault()

		bounds.real.range = prange.real / evt.scale
		bounds.imag.range = prange.imag / evt.scale

		const centerX = evt.center.x - offset.left
		const centerY = evt.center.y - offset.top

		const pcenterZ = getZFromPixel(fractal, centerX, centerY)

		calculateBounds(fractal)

		const centerZ = getZFromPixel(fractal, centerX, centerY)

		bounds.real.mid += pcenterZ.real - centerZ.real
		bounds.imag.mid += pcenterZ.imag - centerZ.imag

		calculateBounds(fractal)
		render(fractal)
	})
}
initPinch(Mandelbrot)
initPinch(Julia)

function initMouseDown(fractal) {
	const {
		$canvas,
		bounds
	} = fractal

	$canvas.mousedown(downevt => {
		downevt.preventDefault()

		const offset = $canvas.offset()

		if (downevt.shiftKey) {
			const mouseX = downevt.clientX - offset.left
			const mouseY = downevt.clientY - offset.top

			Julia.constant = getZFromPixel(fractal, mouseX, mouseY)
			updateJConstantText()
			render(Julia)

			$html.addClass("alias")
		} else
			$html.addClass("all-scroll")

		function mousemove(moveevt) {
			moveevt.preventDefault()

			const mouseX = moveevt.clientX - offset.left
			const mouseY = moveevt.clientY - offset.top

			Julia.constant = getZFromPixel(fractal, mouseX, mouseY)
			updateJConstantText()
			render(Julia)
		}
		if (downevt.shiftKey)
			$window.mousemove(mousemove)

		function mouseup(upevt) {
			upevt.preventDefault()

			$window.off("mousemove", mousemove)
			$window.off("mouseup", mouseup)

			$html.removeClass("alias all-scroll")
		}
		$window.mouseup(mouseup)
	})
}
initMouseDown(Mandelbrot)
initMouseDown(Julia)

function initWheel(fractal) {
	const {
		$canvas,
		bounds
	} = fractal

	$canvas.on("wheel", evt => {
		evt.preventDefault()

		const deltaY = evt.originalEvent.deltaY

		if (deltaY < 0) {
			bounds.real.range /= ZOOM_COEFF
			bounds.imag.range /= ZOOM_COEFF
		} else {
			bounds.real.range *= ZOOM_COEFF
			bounds.imag.range *= ZOOM_COEFF
		}

		const offset = $canvas.offset()
		const mouseX = evt.clientX - offset.left
		const mouseY = evt.clientY - offset.top

		const pmouseZ = getZFromPixel(fractal, mouseX, mouseY)

		calculateBounds(fractal)

		const mouseZ = getZFromPixel(fractal, mouseX, mouseY)

		bounds.real.mid += pmouseZ.real - mouseZ.real
		bounds.imag.mid += pmouseZ.imag - mouseZ.imag

		calculateBounds(fractal)
		render(fractal)
	})
}
initWheel(Mandelbrot)
initWheel(Julia)

function initKeydownBounds(fractal) {
	const {
		bounds
	} = fractal

	$window.keydown(evt => {
		switch (evt.which) {
			case 38: // up
			case 87: // w
				if (evt.shiftKey) {
					bounds.real.range /= ZOOM_COEFF
					bounds.imag.range /= ZOOM_COEFF
				} else
					bounds.imag.mid += bounds.imag.range * SCROLL_COEFF
				break
			case 37: // left
			case 65: // a
				bounds.real.mid -= bounds.real.range * SCROLL_COEFF
				break

			case 40: // down
			case 83: // s
				if (evt.shiftKey) {
					bounds.real.range *= ZOOM_COEFF
					bounds.imag.range *= ZOOM_COEFF
				} else
					bounds.imag.mid -= bounds.imag.range * SCROLL_COEFF

				break
			case 39: // right
			case 68: // d
				bounds.real.mid += bounds.real.range * SCROLL_COEFF
				break
		}

		calculateBounds(fractal)
		render(fractal)
	})
}
initKeydownBounds(Mandelbrot)
initKeydownBounds(Julia)

function initKeydownIterations() {
	$window.keydown(evt => {
		switch (evt.which) {
			case 49:
			case 50:
			case 51:
			case 52:
			case 53:
			case 54:
			case 55:
			case 56:
			case 57: // 1-9
				maxIterations = 100 * Math.pow(2, evt.which - 51)
				break
			case 189: // -
				maxIterations -= 100
				maxIterations = Math.max(maxIterations, 0)
				break
			case 187: // +
				maxIterations += 100
				break
		}

		updateIterationText()
		render(Mandelbrot)
		render(Julia)
	})
}
initKeydownIterations()
