module.exports = grunt => {
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		browserify: {
			build: {
				files: {
					"build/fractal.js": "src/fractal.js"
				},
				options: {
					transform: [
						["babelify", {
							presets: "es2015"
						}]
					],
					browserifyOptions: {
						debug: true
					}
				}
			}
		},
		uglify: {
			dist: {
				files: {
					"public/js/fractal.min.js": "build/fractal.js"
				},
				options: {
					banner: "/*! <%= pkg.name %> v<%= pkg.version %> | <%= grunt.template.today('yyyy-mm-dd') %> | (c) <%= pkg.author %> | <%= pkg.repository.url %> */\n"
				}
			}
		},
		run: {
			your_target: {
				cmd: "node",
				args: [
					"index.js"
				]
			}
		}
	})

	grunt.loadNpmTasks("grunt-browserify")
	grunt.loadNpmTasks("grunt-contrib-uglify")
	grunt.loadNpmTasks("grunt-run")

	grunt.registerTask("default", [
		"browserify:build",
		"uglify",
		"run"
	])
}
