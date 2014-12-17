//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

var defaultProducerAddress = "127.0.0.1:3001";
var socket;
var pc;
var producerReady = false;
var id = '';
var localDescription;
var localStream;

function connect(address){
	trace('connecting to '+ address);
	socket = io('http://'+address);

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
				trace('setting remote ICE candidate');
				if (msg.candidate)
				{
					pc.addIceCandidate(
						new RTCIceCandidate({
							sdpMLineIndex: msg.sdpMLineIndex,
							candidate: msg.candidate
						}), 
						function (){
							trace('remote candidate added successfully')
						},
						function (){
							trace('error on adding remote candidate');
						});
				}
			}
		});

		socket.on('offer', function (offer){
			trace('got offer from producer');
			pc.setRemoteDescription(new RTCSessionDescription(offer),
				function (){
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

function waitUntilRemoteStreamStartsFlowing()
{
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