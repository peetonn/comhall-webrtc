var app = require('express')();
var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var producerSocket;
var consumerIds = [];
var consumerSockets = [];
var consumerNo = 0;
var port = (process.argv.length == 3)?process.argv[2]:3001;
const recordingDir = 'recordings';
var activeRecordingName = undefined
var recordings = [];

// signaling sever API
// ---------------------
// signaling server API enables rendez-vous and coordination
// between WebRTC producer and WebRTC (or any other, e.g. iOS) 
// consumer(s)
// 
// socket.io is used for communication
// all API messages and their payloads are described below.
// 
//                                 msg            |       payload               
//  1. initial connection     --------------------+-----------------------------
//  1.1a producer -> server                       |
//                              'id'              |   "producer"
//  1.1b server -> everyone     'producer alive'  |   <none>
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  1.2a consumer -> server     'id'              |   "consumer"
//  1.2b server -> consumer     'id'              |   <consumer-id>
//  1.2c server -> consumer     'producer alive'  |   <none>
//  1.2d server -> producer     'new consumer'    |   { 
//                                                |     "from":<consumer-id>; 
//                                                |     "data":{}
//                                                |   }
// -----------------------------------------------+-----------------------------
//  2. producer handlers                          |
//  2.1a webrtc offer (producer->server)          |
//                               'offer'          |   {
//                                                |     "to":<consumer-id>;
//                                                |     "data":<webrtc-offer>
//                                                |   }
//  2.1b forward offer (server->consumer)         |
//                               'offer'          |   <webrtc-offer>
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  2.2a ice candidate (producer->server)         |
//                               'ice'            |   {
//                                                |     "to":<consumer-id>;
//                                                |     "data"<ice-candidates>
//                                                |   }
//  2.2b forward ice (server->consumer)           |
//                               'ice'            |   <ice-candidates>
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  2.3a disconnection (producer->server)         |
//                               'disconnect'     |   <none>
//  2.3b broadcast (server->everyone)             |
//                               'producer dead'  |   <none>
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  2.4 recording started (producer->server)      |
//                               'recstart'       |   <recording-index>
//  2.5 recording stopped (producer->server)      |
//                               'recstop'        |   <recording-index>
//  2.6 chunk received (producer->server)         |
//                               'recchunk'       |   <encoded-video-chunk>
// -----------------------------------------------+-----------------------------
//  3. consumer handlers                          |
//  3.1a webrtc answer (consumer->server)         |
//                               'answer'         |   <webrtc-answer> 
//  3.1b forward answer (server->producer)        |
//                               'answer'         |   {
//                                                |     "from":<consumer-id>;
//                                                |     "data":<webrtc-answer>
//                                                |   }
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  3.2a ice candidate (consumer->server)         |
//                               'ice'            |   <ice-candidates> 
//  3.2b forward ice (server->producer)           |
//                               'ice'            |   {
//                                                |     "from":<consumer-id>;
//                                                |     "data":<ice-candidates>
//                                                |   }
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  3.3a disconnection (consumer->server)         |
//                               'disconnect'     |   <none>
//  3.3b forward disconnect (server->producer)    |
//                               'bye'            |   {
//                                                |     "from":<consumer-id>
//                                                |   }
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  3.4a get recordings list (consumer->server)   |
//                               'reclist'        |   <none>
//  3.4b recordings list reply (server->consumer) |
//                               'reclist'        |   [ 
//                                                |     <recording-name1>,
//                                                |     <recording-name2>,
//                                                |     ...
//                                                |   ]
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  3.5a start recording (consumer->server)       |
//                               'recstart'       |   <none>
//  3.5b forward (server->producer)               |
//                               'recstart'       |   {
//                                                |     "from":<consumer-id>;
//                                                |     "data":{}
//                                                |   }
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~+~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//  3.6a stop recording (consumer->server)        |
//                               'recstop'        |   <none>
//  3.6b forward (server->producer)               |
//                               'recstop'        |   {
//                                                |     "from":<consumer-id>;
//                                                |     "data":{}
//                                                |   }

app.get('/', function(req, res){
  res.send('Use your local index.html');
});

// handle new socket connections - either producer or consumer 
//  (see "1. initial connection" in the table above)
io.on('connection', function(socket){
  socket.on('id', function(msg){
    if (msg == 'producer')
    {
      if (!producerSocket)
      {
        producerSocket = socket;
        io.emit('producer alive', {for: 'everyone'});
        console.log('producer connected');

        for (var key in consumerIds)
        {
          console.log('KEY '+key+' VALUE '+consumerIds[key]);
          producerSocket.emit('new consumer', {from:consumerIds[key], data:{}});
        }

        setProducerMessageHandlers(socket);
      }
      else
      {
        console.log('producer already connected. ignore');
      }
    } // if msg == 'producer'
    else // if msg == 'consumer'
    {	
      if (!consumerIds[socket.id])
      {
  		  var consumerId = 'consumer'+consumerNo; //Object.keys(consumerIds).length;
        consumerNo++;
        consumerIds[socket.id] = consumerId;
        consumerSockets[consumerId] = socket;
        socket.emit('id', consumerId);

        console.log(consumerId+' connected. total consumers: '+Object.keys(consumerIds).length);
        console.log('sending request to producer...');
      
        if (producerSocket)
        {
          socket.emit('producer alive', {});
          producerSocket.emit('new consumer', {from:consumerId, data:{}});
        }
        else
          console.log('producer is not connected yet');
      }
      else
      {
        socket.emit('id', consumerIds[socket.id]);
      }

      setConsumerMessageHandlers(socket);
    } // if msg == 'consumer'
  });
});

http.listen(port, function(){
  console.log('listening on *:'+port);
});

// sets up handlers for messages, reevied from consumers
//  (see "3. consumer handlers" in the table above
function setConsumerMessageHandlers(socket){
  socket.on('answer', function(msg){
    console.log('sending answer from '+consumerIds[socket.id]+': '+JSON.stringify(msg));
    if (producerSocket)
      producerSocket.emit('answer', {from: consumerIds[socket.id], data: msg});
  });

  socket.on('ice', function(msg){
    console.log('received ICE from '+consumerIds[socket.id]+': '+msg);
    if (producerSocket)
      producerSocket.emit('ice', {from: consumerIds[socket.id], data: msg});
  });  

  socket.on('disconnect', function(){
    consumerId = consumerIds[this.id];
    if (consumerId)
    {
      console.log('user '+consumerId+' disconnected ');   
      if (producerSocket) 
        producerSocket.emit('bye', {from:consumerId, data:{}});

      delete consumerIds[this.id]
      delete consumerSockets[consumerId]
    }
  });

  socket.on('reclist', function() {
    consumerId = consumerIds[this.id];
    var recordingList = [];

    console.log('searching records directory '+recordingDir);
    var files = fs.readdirSync('./'+recordingDir);
    files.forEach(file => {
        if (path.extname(file) == '.mp4')
        {
          console.log('found recording '+file);
          recordingList.push(recordingDir + '/' + file);
        }
    });
    
    console.log('sending list of recordings for '+consumerId+' '+recordingList);
    this.emit('reclist', recordingList);
  });

  socket.on('recstart', function(msg) {
    console.log("sending request to start recording ("+ msg['recname'] +") from " + consumerIds[socket.id] + ': ' + JSON.stringify(msg));
    if(producerSocket)
    {
      activeRecordingName = msg['recname'];
      producerSocket.emit('recstart', {from: consumerIds[socket.id], data: {}});
    }
    else
      console.log('error: no producer socket. is producer connected?');
  });

  socket.on('recstop', function(msg) {
    console.log("sending request to stop recording from " + consumerIds[socket.id] + ': ' + JSON.stringify(msg));
    if(producerSocket)
      producerSocket.emit('recstop', {from: consumerIds[socket.id], data: {}});
    else
      console.log('error: no producer socket. is producer connected?');
  });
}

// sets up handlers for messages, received from producer
//  (see "2. producer handlers" in the table above
function setProducerMessageHandlers(socket){
  socket.on('offer', function(msg){
    console.log('received offer from producer '+JSON.stringify(msg.data));
    sendToConsumer(msg.to, 'offer', msg.data);
  });

  socket.on('ice', function(msg){
    console.log('received ICE from producer');
    sendToConsumer(msg.to, 'ice', msg.data);
  });

  socket.on('disconnect', function(){
    console.log('producer disconnected');
    io.emit('producer dead', {for: 'everyone'});
    producerSocket = null;
  });

  socket.on('recstart', function(msg){
    console.log('start receiving recording for '+msg);
    recordings[msg] = [];
  });

  socket.on('recstop', function(msg){
    console.log('recording #'+msg+' completed');

    if (recordings[msg]){
      var recordingBuffer = Buffer.concat(recordings[msg]);
      var tempFileName = recordingDir+'/'+['recording_', (new Date() + '').slice(4, 24).replace(/[ :]/g, '_'), '-', msg, '.mp4'].join('');
      var fileName = (activeRecordingName == undefined ? tempFileName : recordingDir+'/'+activeRecordingName+'.mp4');

      fs.writeFile(fileName, recordingBuffer, 'binary', function(err){
        if (err)
          console.log('error saving file '+err);
        else
          console.log('successfully saved video '+fileName);
      });
    }
  });

  socket.on('recchunk', function(msg){
    if (recordings[msg.id])
    {
      var b = Buffer.from(msg.data)
      console.log('recording #'+msg.id+', chunk size '+b.length + ' bytes');
      recordings[msg.id].push(b);
    }
  });
}

function sendToConsumer(consumerId, type, data){
  var consumerSocket = consumerSockets[consumerId];
  
  if (consumerSocket)
    consumerSocket.emit(type, data);
}
