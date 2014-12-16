var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var producerSocket;
var consumerIds = [];
var consumerSockets = [];
var consumerNo = 0;

app.get('/', function(req, res){
  res.send('Use your local index.html');
});

io.on('connection', function(socket){

	socket.on('disconnect', function(){
    consumerId = consumerIds[this.id];
    if (consumerId)
    {
      console.log('user '+consumerId+' disconnected ');    
      producerSocket.emit('bye', {from:consumerId, data:{}});

      delete consumerIds[this.id]
      delete consumerSockets[consumerId]
    }
    else
    {
      console.log('producer disconnected');
      io.emit('producer dead', {for: 'everyone'});
    }
  });

  socket.on('id', function(msg){
    if (msg == 'producer')
    {
     producerSocket = socket;
     io.emit('producer alive', {for: 'everyone'});
     console.log('producer connected');
   }
   else
   {	
    if (!consumerIds[socket.id])
    {
  		var consumerId = 'consumer'+consumerNo; //Object.keys(consumerIds).length;
      consumerNo++;
      consumerIds[socket.id] = consumerId;
      consumerSockets[consumerId] = socket;
      socket.emit('id', consumerId);

      if (producerSocket)
        socket.emit('producer alive', {});

      console.log('new consumer '+consumerId+' connected. total consumers: '+Object.keys(consumerIds).length);
    }
    else
    {
      socket.emit('id', consumerIds[socket.id]);
    }
  }
});

  socket.on('offer', function(msg){
    console.log('received offer from '+consumerIds[socket.id]+': '+JSON.stringify(msg));
    producerSocket.emit('offer', {from: consumerIds[socket.id], data: msg});
  });

  socket.on('answer', function(msg){
    if (socket == producerSocket)
    {
      console.log('answer from producer to '+msg.to+': '+JSON.stringify(msg.data));
      sendToConsumer(msg.to, 'answer', msg.data);
    }
    else
      console.error('violation: got answer msg from consumer');
  });

  socket.on('ice', function(msg){
    if (socket == producerSocket)
    {
      console.log('received ICE from producer');
      sendToConsumer(msg.to, 'ice', msg.data);
    }
    else
    {
      console.log('received ICE from '+consumerIds[socket.id]+': '+msg);
      producerSocket.emit('ice', {from: consumerIds[socket.id], data: msg});
    }
  });

});

http.listen(3001, function(){
  console.log('listening on *:3001');
});

function sendToConsumer(consumerId, type, data){
  var consumerSocket = consumerSockets[consumerId];
  
  if (consumerSocket)
    consumerSocket.emit(type, data);
}
