comhall-webrtc
==============

WebRTC producer/consumer for Community Hall projects.

The package contains three modules: producer, consumer and node.js server.

Producer
===
Producer module is used for capturing media streams from connected media devices and making them accessible by remote consumers. Producer uses WebRTC for streaming.

1. Run [server](#server)
2. Run HTTP server (WebRTC does not allow access to the media sources from file:/// resources):
<pre>
$ python -m SimpleHTTPServer 8000
</pre>
3. Open [localhost:8000/producer](http://localhost:8000) page in browser (Chrome)

>Hint: while on producer's page, press 's' to see currently used device and change it if you need to

>Hint: while on producer's page, press 'l' to see the current log

Consumer
===
Consumer module is used for fetching media streams published by a remote producer.

1. Make sure the server is [running](#server)
2. Open [http://ether.remap.ucla.edu/step/commhall/consumer/](http://ether.remap.ucla.edu/step/commhall/consumer/) in the browser
3. Type server's IP address in the field and press 'Fetch'
4. Video stream should be received momentarily

>Hint: while on consumer's page, press 'l' to see the current log

Server
===
Server module is used for delivering signaling functionality between consumers and producer so that the WebRTC's negotiation process can be conducted.

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
