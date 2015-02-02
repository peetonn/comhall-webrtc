//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

var defaultProducerAddress = getCookie('serverIp') || "127.0.0.1";
var port = (getChosenCamera() == 'ptz')?ptzCameraPort:webCameraPort;
var socket;
var pc;
var producerReady = false;
var id = '';
var localDescription;
var localStream;

function connect(address){
	setCookie('serverIp', address, 30);
	
	trace('connecting to '+ address+':'+port);
	socket = io('http://'+address+':'+port);

	socket.on('connect', function(){
		trace('connected');
		socket.emit('id','consumer');

		socket.on('id', function(data){
			trace('got id '+data);
			id = data;
			document.title = id;
		});

		socket.on('producer dead', function(){
			trace('producer is dead');
			producerReady = false;
			stopSession();
		});

		socket.on('producer alive', function(){
			trace('producer is alive');
			producerReady = true;
			startSession();
		});

		socket.on('ice', function(msg){
			if (!pc) 
			{

				logError('got ICE candidate but peer connection is not ready');
				return;
			}
			else
			{
				trace('setting remote ICE candidate: '+JSON.stringify(msg));
				if (msg.candidate)
				{
					if (allowSettingRemoteIce)
						addIce(pc, msg);
					else
						pendingIce[pendingIce.length] = msg;
				}
			}
		});

		socket.on('offer', function (offer){
			trace('got offer from producer: '+offer.sdp);
			pc.setRemoteDescription(new RTCSessionDescription(offer),
				function (){
					allowSettingRemoteIce = true;
					setPendingRemoteIce(pc);

					trace('creating answer...');
					pc.createAnswer(function (sessionDescription){
						pc.setLocalDescription(sessionDescription);
						trace('sending answer to producer');
						socket.emit('answer', sessionDescription);
					});
				},
				function (error){
					trace('error setting remote description');
				});
		});
	});
}

function startSession(){
	trace('waiting for offer...');
	pc = new RTCPeerConnection(
		{ "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] },
		{ 'optional': [{DtlsSrtpKeyAgreement: true}] });

	pc.onaddstream = function (obj){
		trace('new stream added '+' video tracks: '+obj.stream.getVideoTracks().length+
			' audio tracks: '+obj.stream.getAudioTracks().length);
		var videoElement = document.getElementById('remote-video');
		attachMediaStream(videoElement, obj.stream);
		waitUntilRemoteStreamStartsFlowing();
	}

	pc.onicecandidate = function (event){
		trace('new ICE candidate '+JSON.stringify(event.candidate));
		socket.emit('ice', event.candidate);
	}
}

function waitUntilRemoteStreamStartsFlowing(){
	var remote_video = document.getElementById('remote-video');
	if (!(remote_video.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA 
		|| remote_video.paused || remote_video.currentTime <= 0)) 
	{
		trace('receiving remote stream data...');
	} 
	else
	{
		trace('waiting for remote stream to start...');
		setTimeout(waitUntilRemoteStreamStartsFlowing, 50);
	}
}

function stopSession(){
	trace('closing connection');
	if (pc)
	{
		pc.close();
		pc = null;
	}
}

function disconnect(){
	if (socket)
		socket.disconnect();
}

document.onkeypress = function (event){
	switch (String.fromCharCode(event.charCode)){
		case 'l': 
		toggleElement(document.getElementById('log'));
		break;
		default:
		break;
	}
}

// video-to-canvas magic...
// see more on http://html5hub.com/using-the-getusermedia-api-with-the-html5-video-and-canvas-elements/
function setupVideoToCanvasProcessing(){
	var isStreaming = false,
	v = document.getElementById('remote-video'),
	c = document.getElementById('video-canvas'),
	w = 600, 
    h = 420,
	con = c.getContext('2d');

	v.addEventListener('canplay', function(e) {
		if (!isStreaming) {
      		// videoWidth isn't always set correctly in all browsers
      		if (v.videoWidth > 0) h = v.videoHeight / (v.videoWidth / w);
      		c.setAttribute('width', w);
      		c.setAttribute('height', h);
      		isStreaming = true;
  		}
	}, false);
	
	v.addEventListener('play', function() {
   		// Every 33 milliseconds copy the video image to the canvas
   		setInterval(function() {
   			if (v.paused || v.ended) return;
   			con.fillRect(0, 0, w, h);
   			con.drawImage(v, 0, 0, w, h);
   		}, 33);
	}, false);
} // end of magic =(
