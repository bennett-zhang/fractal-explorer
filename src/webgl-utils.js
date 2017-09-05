const vertexShaderSource = `
attribute vec4 vertexPosition;

void main() {
	gl_Position = vertexPosition;
}
`

const fragmentShaderSource = `
precision highp float;

uniform bool doublePrecision;
uniform float realMin;
uniform vec2 realMinD;
uniform float imagMin;
uniform vec2 imagMinD;
uniform float overCanvas;
uniform int maxIterations;
const float BAILOUT_RADIUS = 4.0;
uniform bool isJulia;
uniform vec2 jconstant;
uniform sampler2D palette;
const float GRADIENT_SCALE = 0.03125;

// http://andrewthall.org/papers/df64_qf128.pdf
vec2 set(float a) {
	return vec2(a, 0.0);
}

int cmp(vec2 a, vec2 b) {
	if (a.x < b.x)
		return -1;
	if (a.x > b.x)
		return 1;
	if (a.y < b.y)
		return -1;
	if (a.y > b.y)
		return 1;
	return 0;
}

vec2 quickTwoSum(float a, float b) {
	float s = a + b;
	float e = b - (s - a);
	return vec2(s, e);
}

vec4 twoSumComp(vec2 a_ri, vec2 b_ri) {
	vec2 s = a_ri + b_ri;
	vec2 v = s - a_ri;
	vec2 e = (a_ri - (s - v)) + (b_ri - v);
	return vec4(s.x, e.x, s.y, e.y);
}

vec2 add(vec2 a, vec2 b) {
	vec4 st = twoSumComp(a, b);
	st.y += st.z;
	st.xy = quickTwoSum(st.x, st.y);
	st.y += st.w;
	st.xy = quickTwoSum(st.x, st.y);
	return st.xy;
}

vec2 sub(vec2 a, vec2 b) {
	return add(a, -1.0 * b);
}

vec4 splitComp(vec2 c) {
	const float split = 4097.0;
	vec2 t = c * split;
	vec2 c_hi = t - (t - c);
	vec2 c_lo = c - c_hi;
	return vec4(c_hi.x, c_lo.x, c_hi.y, c_lo.y);
}

vec2 twoProd(float a, float b) {
	float p = a * b;
	vec4 s = splitComp(vec2(a, b));
	float err = s.x * s.z - p
				+ s.x * s.w + s.y * s.z
				+ s.y * s.w;
	return vec2(p, err);
}

vec2 mul(vec2 a, vec2 b) {
	vec2 p = twoProd(a.x, b.x);
	p.y += a.x * b.y;
	p.y += a.y * b.x;
	p = quickTwoSum(p.x, p.y);
	return p;
}

vec4 setZ(vec2 a) {
	return vec4(a.x, 0, a.y, 0);
}

vec4 addZ(vec4 a, vec4 b) {
	return vec4(add(a.xy, b.xy), add(a.zw, b.zw));
}

vec4 getFractalColor(vec2 z) {
	vec2 zSq;
	vec2 c;
	if (isJulia)
		c = jconstant;
	else
		c = z;

	for (int i = 0; i < 10000; i++) {
		zSq = vec2(z.x * z.x, z.y * z.y);
		z = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;

		if (zSq.x + zSq.y > BAILOUT_RADIUS) {
			for (int j = 0; j < 3; j++) {
				zSq = vec2(z.x * z.x, z.y * z.y);
				z = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;
			}

			float mu = float(i) + 1.0 - log2(log(zSq.x + zSq.y) / 2.0);
			return texture2D(palette, set(mu * GRADIENT_SCALE));
		}

		if (i > maxIterations) return vec4(0, 0, 0, 1);
	}
}

vec4 getFractalColorD(vec4 z) {
	vec4 zSq;
	vec4 c;
	if (isJulia)
		c = setZ(jconstant);
	else
		c = z;

	for (int i = 0; i < 10000; i++) {
		zSq = vec4(mul(z.xy, z.xy), mul(z.zw, z.zw));
		z = addZ(vec4(sub(zSq.xy, zSq.zw), mul(set(2.0), mul(z.xy, z.zw))), c);

		if (cmp(add(zSq.xy, zSq.zw), set(BAILOUT_RADIUS)) > 0) {
			for (int j = 0; j < 3; j++) {
				zSq = vec4(mul(z.xy, z.xy), mul(z.zw, z.zw));
				z = addZ(vec4(sub(zSq.xy, zSq.zw), mul(set(2.0), mul(z.xy, z.zw))), c);
			}

			float mu = float(i) + 1.0 - log2(log(add(zSq.xy, zSq.zw).x / 2.0));
			return texture2D(palette, set(mu * GRADIENT_SCALE));
		}

		if (i > maxIterations) return vec4(0, 0, 0, 1);
	}
}

void main() {
	if (doublePrecision) {
		gl_FragColor = getFractalColorD(vec4(add(realMinD, set(gl_FragCoord.x * overCanvas)), add(imagMinD, set(gl_FragCoord.y * overCanvas))));
	} else {
		gl_FragColor = getFractalColor(vec2(realMin + gl_FragCoord.x * overCanvas, imagMin + gl_FragCoord.y * overCanvas));
	}
}
`

const vertices = [
	[1, 1],
	[1, -1],
	[-1, -1],
	[-1, 1]
]

export function initGl({
	canvas
}) {
	const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser may not support it.")
		return null
	}
	return gl
}

function getShader(gl, name, type) {
	const shader = gl.createShader(type)

	let source
	if (name === "fractal.vert") {
		source = vertexShaderSource
	} else if (name === "fractal.frag") {
		source = fragmentShaderSource
	}
	if (!source) {
		alert("Could not find shader source: " + name)
		return null
	}

	gl.shaderSource(shader, source)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("An error occured compiling the shaders: " + gl.getShaderInfoLog(shader))
		return null
	}

	return shader
}

export function initProgram({
	gl
}) {
	const vertexShader = getShader(gl, "fractal.vert", gl.VERTEX_SHADER)
	const fragmentShader = getShader(gl, "fractal.frag", gl.FRAGMENT_SHADER)

	const program = gl.createProgram()
	gl.attachShader(program, vertexShader)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(program))
		return null
	}

	gl.useProgram(program)

	const vertexPositionAttrib = gl.getAttribLocation(program, "vertexPosition")
	gl.enableVertexAttribArray(vertexPositionAttrib)

	const verticesBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer)
	gl.vertexAttribPointer(vertexPositionAttrib, 2, gl.FLOAT, false, 0, 0)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.reduce((acc, val) => acc.concat(val))), gl.STATIC_DRAW)

	return program
}

export function getUniforms({
	gl,
	program
}, names) {
	const uniforms = {}
	for (let i = 0; i < names.length; i++) {
		const name = names[i]
		uniforms[name] = gl.getUniformLocation(program, name)
	}
	return uniforms
}

export function initTexture({
	gl
}, palette) {
	const texture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, palette.length / 3, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, palette)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	return texture
}

export function renderGl(gl) {
	gl.clear(gl.COLOR_BUFFER_BIT)
	gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length)
}
