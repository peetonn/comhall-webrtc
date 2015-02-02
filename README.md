comhall-webrtc
==============

WebRTC producer/consumer for Community Hall projects.

The package contains four modules: producer, consumer, node.js server and secure HTTP server.

Producer
===
Producer module is used for capturing media streams from connected media devices and making them accessible by remote consumers. Producer uses WebRTC for streaming.

1. Run [secure HTTP server](#secure-http-server) (WebRTC does not allow access to the media sources from file:/// resources).
2. Run [node server](#node-server)
3. Depending on which port you used in Step 2 and which IP address and port used in Step 1, actual producer link may vary. In general, it looks like this:
<pre>
https:// &lt;ip_address&gt;:&lt;http_port&gt;/producer/index.html?port=&lt;node_port&gt;
</pre>
As of 1/22/2014, default link to open in a browser is
[https://192.168.100.122:8000/producer/index.html?port=3001](https://192.168.100.122:8000/producer/index.html?port=3001).

>Hint: while on producer's page, press 's' to show/hide **custom settings panel**

>Hint: while on producer's page, press 'l' to show/hide current log

Consumer
===
Consumer module is used for fetching media streams published by a remote producer.

1. Make sure [node server](#node-server) and [http secure server](#secure-http-server) are running.
2. Make sure server is accessible through your network:
<pre>
	$ ping 192.168.100.122
</pre> 
3. Open [https://192.168.100.122:8000/consumer/index.html?port=3001](https://192.168.100.122:8000/consumer/index.html?port=3001) in the browser
>Note: IP adress, http port and node port numbers may vary depending on [previous steps](#producer)
4. Allow access to all media devices asked (this needs to be done just once).
5. Type server's IP address (192.168.100.122) in the field and press 'Fetch'
5. Video stream should be received momentarily

>Hint: while on consumer's page, press 'l' to see the current log

Node server
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
    $ node server/index.js &lt;port_number&gt;
</pre>
>Note: Default port number if 3001

Secure HTTP server
===
When producer page is loading, it gathers information about currently connected media devices in order to present them to a user in human-readable way. This involves calling [`getUserMedia`](http://www.html5rocks.com/en/tutorials/getusermedia/intro/#toc-history)  for each media device which results in asking explictily for the user permission to access a device. In cases when user has a lot of devices connected, she has to allow access to all of them each time the page is refresh, which is not a good UX in the end. In order to avoid this unpleasant scenario, Chrome can remember user's choice and never ask for permissions again on future page loadings. I.e. user will have to allow all the devices once at the first loading of the page. However, Chrome implements this feature only for webpages served using HTTPS. That's why `SimpleSecureHTTPServer.py` module was implemented.

To start secure server:
1. Generate private key and certificate for your server (**need to be done only once**):
<pre>
    $ openssl req -new -x509 -keyout http_server/server.pem -out http_server/server.pem -days 365 -nodes
</pre>
>Note: When you'll be asked for *Common Name*, type IP address of the machine you're planning to run the server on.
2. Start secure server:
<pre>
    $ python http_server/SimpleSecureHTTPServer.py &lt;ip_address&gt; 8000
</pre>
>Note: `<ip_address>` should be the same as you specified in the previous step. Default address is *localhost* and port *8000*.

Multiple cameras support
===
There is a possibility to publish media streams from different cameras/microphones simultaneusly on one machine. In this case, independent pairs of [node server](#node-server)-[producer](#producer) should be launched on different ports.
One should note which port number was used to start each [node server](#node-server) and use it as a parameter in [producer](#producer) and [consumer](#consumer) URLs. [Secure HTTP server](#secure-http-server) should be launched just **once**.

For example: 
- 1st pair: 
 - run [node server](#node-server) on port **3001** 
 - producer URL: https:// &lt;ip_address>:&lt;http_port>/producer/index.html?port=3001
- 2nd pair: 
 - run [node server](#node-server) on port **3002** 
 - producer URL: https:// &lt;ip_address>:&lt;http_port>/producer/index.html?port=3002

## PTZ and WebCamera (Community Hall)
1. Make sure [secure HTTP server](#secure-http-server) is running
2. Run PTZ camera node server:
<pre>
$ node server/index.js 3001
</pre>
3. In separate Terminal window, run WebCamera node server:
<pre>
$ node server/index.js 3002
</pre>
4. Open [https://192.168.100.122:8000/producer/index.html?port=3001](https://192.168.100.122:8000/producer/index.html?port=3001) page in **first** browser tab
    - Allow access to all devices asked
    - Configure producer to acquire video from PTZ camera by choosing appropriate device from the list
5. Open [https://192.168.100.122:8000/producer/index.html?port=3002](https://192.168.100.122:8000/producer/index.html?port=3002) page in **second** browser tab
    - Allow access to all devices asked
    - Configure producer to acquire video from web camera by choosing appropriate device from the list
6. Open consumer at [https://192.168.100.122:8000/consumer/index.html?port=3001](https://192.168.100.122:8000/consumer/index.html?port=3001)
7. Open consumer at [https://192.168.100.122:8000/consumer/index.html?port=3002](https://192.168.100.122:8000/consumer/index.html?port=3002)
