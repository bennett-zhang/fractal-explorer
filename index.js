"use strict"

const express = require("express")
const app = express()
const http = require("http").Server(app)
const port = process.env.PORT || 8080

app.use(express.static("public"))

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html")
})

http.listen(port, () => {
	console.log(`Listening on ${port}.`)
})
