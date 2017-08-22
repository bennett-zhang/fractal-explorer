const vertexShaderSource = `
attribute vec4 vertexPosition;

void main() {
	gl_Position = vertexPosition;
}
`

const fragmentShaderSource = `
precision highp float;

uniform float realMin;
uniform float imagMin;
uniform float overCanvas;
uniform int maxIterations;
const float BAILOUT_RADIUS = 4.0;
uniform bool isJulia;
uniform vec2 jconstant;
uniform sampler2D palette;
const float GRADIENT_SCALE = 0.03125;

vec4 getFractalColor(vec2 z) {
	vec2 zSq;
	vec2 c;
	if (isJulia)
		c = jconstant;
	else
		c = z;

	for (int i = 0; i < 10000; i++) {
		zSq = vec2(z.x * z.x, z.y * z.y);
		z = vec2(zSq.x - zSq.y + c.x, 2.0 * z.x * z.y + c.y);

		if (zSq.x + zSq.y > BAILOUT_RADIUS) {
			for (int j = 0; j < 3; j++) {
				zSq = vec2(z.x * z.x, z.y * z.y);
				z = vec2(zSq.x - zSq.y, 2.0 * z.x * z.y) + c;
			}

			float mu = float(i) + 1.0 - log2(log(zSq.x + zSq.y) / 2.0);
			return texture2D(palette, vec2(mu * GRADIENT_SCALE, 0.0));
		}

		if (i > maxIterations) return vec4(0, 0, 0, 1);
	}
}

void main() {
	gl_FragColor = getFractalColor(vec2(realMin + gl_FragCoord.x * overCanvas, imagMin + gl_FragCoord.y * overCanvas));
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
