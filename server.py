from http.server import SimpleHTTPRequestHandler, HTTPServer
import mimetypes

# 添加 flac 格式的 MIME 类型
mimetypes.add_type('audio/flac', '.flac')
mimetypes.add_type('audio/x-flac', '.flac')

class CustomHandler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        mimetype, _ = mimetypes.guess_type(path)
        if not mimetype:
            if path.endswith('.flac'):
                return 'audio/flac'
            return 'application/octet-stream'
        return mimetype

if __name__ == '__main__':
    port = 8090
    server = HTTPServer(('0.0.0.0', port), CustomHandler)
    print(f'Server running at http://localhost:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
