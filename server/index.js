var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var producerSocket;
var consumerIds = [];
var consumerSockets = [];
var consumerNo = 0;
var port = (process.argv.length == 3)?process.argv[2]:3001;

app.get('/', function(req, res){
  res.send('Use your local index.html');
});

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
}

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
}

http.listen(port, function(){
  console.log('listening on *:'+port);
});

function sendToConsumer(consumerId, type, data){
  var consumerSocket = consumerSockets[consumerId];
  
  if (consumerSocket)
    consumerSocket.emit(type, data);
}
