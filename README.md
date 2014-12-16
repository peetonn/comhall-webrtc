comhall-webrtc
==============

WebRTC producer/consumer for Community Hall projects

Producer
===
1. Run [server](#server)
2. Run HTTP server (WebRTC does not allow access to the media sources from file:/// resources):
<pre>
$ python -m SimpleHTTPServer 8000
</pre>
3. Open [localhost:8000/producer](http://localhost:8000) page in browser (Chrome)

Consumer
===
1. Open consumer/index.html

Server
===
1. Install [node.js](http://nodejs.org/download/)
2. Get [express](http://expressjs.com/) package:
<pre>
$ npm install --save express@4.10.2
</pre>
3. Get [socket.io](http://socket.io/) package:
<pre>
$ npm install --save socket.io
</pre>
4. Run server:
<pre>
$ node server/index.js
</pre>
