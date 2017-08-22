export default function getPalette(colorStops, numColors) {
	const offsets = []
	const reds = []
	const greens = []
	const blues = []

	for (let i = 0; i < colorStops.length; i++) {
		const colorStop = colorStops[i]

		offsets.push(colorStop[0])

		const hexColor = colorStop[1]
		reds.push(hexColor >> 16 & 255)
		greens.push(hexColor >> 8 & 255)
		blues.push(hexColor & 255)
	}

	const redInterpolant = createInterpolant(offsets, reds)
	const greenInterpolant = createInterpolant(offsets, greens)
	const blueInterpolant = createInterpolant(offsets, blues)

	const palette = []
	const increment = 1 / numColors

	for (let i = 0; i < 1; i += increment) {
		palette.push(redInterpolant(i), greenInterpolant(i), blueInterpolant(i))
	}

	return new Uint8Array(palette)
}

// https://en.wikipedia.org/wiki/Monotone_cubic_interpolation
function createInterpolant(xs, ys) {
	const length = xs.length

	// Deal with length issues
	if (length !== ys.length) {
		throw "Need an equal count of xs and ys."
	}
	if (length === 0) {
		return () => 0
	}
	if (length === 1) {
		// Impl: Precomputing the result prevents problems if ys is mutated later and allows garbage collection of ys
		// Impl: Unary plus properly converts values to numbers
		const result = +ys[0]
		return () => result
	}

	// Rearrange xs and ys so that xs is sorted
	const indexes = []
	for (let i = 0; i < length; i++) {
		indexes.push(i)
	}
	indexes.sort((a, b) => xs[a] < xs[b] ? -1 : 1)
	const oldXs = xs,
		oldYs = ys
	// Impl: Creating new arrays also prevents problems if the input arrays are mutated later
	xs = []
	ys = []
	// Impl: Unary plus properly converts values to numbers
	for (let i = 0; i < length; i++) {
		xs.push(+oldXs[indexes[i]])
		ys.push(+oldYs[indexes[i]])
	}

	// Get consecutive differences and slopes
	const dys = [],
		dxs = [],
		ms = []
	for (let i = 0; i < length - 1; i++) {
		const dx = xs[i + 1] - xs[i],
			dy = ys[i + 1] - ys[i]
		dxs.push(dx)
		dys.push(dy)
		ms.push(dy / dx)
	}

	// Get degree-1 coefficients
	const c1s = [ms[0]]
	for (let i = 0; i < dxs.length - 1; i++) {
		const m = ms[i],
			mNext = ms[i + 1]
		if (m * mNext <= 0) {
			c1s.push(0)
		} else {
			const dx_ = dxs[i],
				dxNext = dxs[i + 1],
				common = dx_ + dxNext
			c1s.push(3 * common / ((common + dxNext) / m + (common + dx_) / mNext))
		}
	}
	c1s.push(ms[ms.length - 1])

	// Get degree-2 and degree-3 coefficients
	const c2s = [],
		c3s = []
	for (let i = 0; i < c1s.length - 1; i++) {
		const c1 = c1s[i],
			m_ = ms[i],
			invDx = 1 / dxs[i],
			common_ = c1 + c1s[i + 1] - m_ - m_
		c2s.push((m_ - c1 - common_) * invDx)
		c3s.push(common_ * invDx * invDx)
	}

	// Return interpolant function
	return x => {
		// The rightmost point in the dataset should give an exact result
		let i = xs.length - 1
		if (x === xs[i]) {
			return ys[i]
		}

		// Search for the interval x is in, returning the corresponding y if x is one of the original xs
		let low = 0,
			mid, high = c3s.length - 1
		while (low <= high) {
			mid = Math.floor((low + high) / 2)
			const xHere = xs[mid]
			if (xHere < x) {
				low = mid + 1
			} else if (xHere > x) {
				high = mid - 1
			} else {
				return ys[mid]
			}
		}
		i = Math.max(0, high)

		// Interpolate
		const diff = x - xs[i],
			diffSq = diff * diff
		return ys[i] + c1s[i] * diff + c2s[i] * diffSq + c3s[i] * diff * diffSq
	}
}
