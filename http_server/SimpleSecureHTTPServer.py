import BaseHTTPServer, SimpleHTTPServer
import ssl
import sys

address='localhost'
port=8000

if len(sys.argv) == 3:
	address = sys.argv[1]
	port = int(sys.argv[2])
	print 'starting on '+address+':'+str(port)

httpd = BaseHTTPServer.HTTPServer((address, port), SimpleHTTPServer.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket (httpd.socket, certfile='http_server/server.pem', server_side=True)
httpd.serve_forever()
