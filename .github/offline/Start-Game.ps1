param([int]$Port = 18728, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public sealed class SgxrPortableServer : IDisposable {
    readonly string root;
    readonly TcpListener listener;
    volatile bool running = true;
    public int Port { get { return ((IPEndPoint)listener.LocalEndpoint).Port; } }
    public SgxrPortableServer(string folder, int firstPort) {
        root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        for (int port = firstPort; port < firstPort + 20; port++) {
            var candidate = new TcpListener(IPAddress.Loopback, port);
            try { candidate.Start(64); listener = candidate; break; }
            catch (SocketException) { candidate.Stop(); }
        }
        if (listener == null) throw new IOException("No free local port. Close an older game window and try again.");
        var accept = new Thread(Accept); accept.IsBackground = true; accept.Start();
    }
    void Accept() {
        while (running) {
            try { var client = listener.AcceptTcpClient(); ThreadPool.QueueUserWorkItem(o => Handle((TcpClient)o), client); }
            catch (SocketException) { if (!running) return; }
            catch (ObjectDisposedException) { return; }
        }
    }
    static void Headers(Stream stream, string status, long length, string type, string extra) {
        var bytes = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + "\r\nContent-Length: " + length + "\r\nContent-Type: " + type + "\r\nConnection: close\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nAccept-Ranges: bytes\r\n" + extra + "\r\n");
        stream.Write(bytes, 0, bytes.Length);
    }
    static string Mime(string file) {
        switch (Path.GetExtension(file).ToLowerInvariant()) {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "application/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".webp": return "image/webp";
            case ".svg": return "image/svg+xml";
            case ".ogg": return "audio/ogg";
            case ".wav": return "audio/wav";
            case ".mp4": return "video/mp4";
            case ".woff2": return "font/woff2";
            default: return null;
        }
    }
    void Handle(TcpClient client) {
        using (client) {
            try {
                client.ReceiveTimeout = 5000; client.SendTimeout = 15000;
                using (var stream = client.GetStream())
                using (var reader = new StreamReader(stream, Encoding.ASCII, false, 4096, true)) {
                    string line = reader.ReadLine(); if (line == null || line.Length > 8192) return;
                    var request = line.Split(' '); if (request.Length != 3) { Headers(stream,"400 Bad Request",0,"text/plain",""); return; }
                    string range = null;
                    for (int n = 0; n < 64; n++) {
                        line = reader.ReadLine(); if (String.IsNullOrEmpty(line)) break;
                        if (line.Length > 8192 || n == 63) return;
                        if (line.StartsWith("Range:",StringComparison.OrdinalIgnoreCase)) range = line.Substring(6).Trim();
                    }
                    bool head = request[0] == "HEAD";
                    if (request[0] != "GET" && !head) { Headers(stream,"405 Method Not Allowed",0,"text/plain","Allow: GET, HEAD\r\n"); return; }
                    string relative = Uri.UnescapeDataString(request[1].Split('?')[0]).TrimStart('/').Replace('/',Path.DirectorySeparatorChar);
                    if (relative.Length == 0) relative = "index.html";
                    string file = Path.GetFullPath(Path.Combine(root,relative));
                    if (!file.StartsWith(root,StringComparison.OrdinalIgnoreCase)) { Headers(stream,"403 Forbidden",0,"text/plain",""); return; }
                    string mime = Mime(file);
                    if (mime == null || !File.Exists(file)) { Headers(stream,"404 Not Found",0,"text/plain",""); return; }
                    using (var input = File.Open(file,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                        long total = input.Length, start = 0, end = total - 1;
                        bool partial = !head && range != null;
                        if (partial) {
                            bool valid = range.StartsWith("bytes=",StringComparison.OrdinalIgnoreCase) && range.IndexOf(',') < 0;
                            var parts = valid ? range.Substring(6).Split('-') : new string[0];
                            valid = valid && parts.Length == 2;
                            if (valid && parts[0].Length == 0) {
                                long suffix; valid = Int64.TryParse(parts[1],out suffix) && suffix > 0;
                                if (valid) start = Math.Max(0,total - suffix);
                            } else if (valid) {
                                valid = Int64.TryParse(parts[0],out start);
                                if (valid && parts[1].Length > 0) valid = Int64.TryParse(parts[1],out end);
                            }
                            end = Math.Min(end,total - 1);
                            if (!valid || start < 0 || start >= total || end < start) { Headers(stream,"416 Range Not Satisfiable",0,mime,"Content-Range: bytes */" + total + "\r\n"); return; }
                        }
                        long remaining = end - start + 1;
                        Headers(stream,partial ? "206 Partial Content" : "200 OK",remaining,mime,partial ? "Content-Range: bytes " + start + "-" + end + "/" + total + "\r\n" : "");
                        if (head) return;
                        input.Position = start; var buffer = new byte[65536];
                        while (remaining > 0) { int count = input.Read(buffer,0,(int)Math.Min(buffer.Length,remaining)); if (count == 0) break; stream.Write(buffer,0,count); remaining -= count; }
                    }
                }
            } catch (IOException) { } catch (SocketException) { } catch (ArgumentException) { }
        }
    }
    public void Dispose() { running = false; listener.Stop(); }
}
'@
$server = $null
try {
    $server = [SgxrPortableServer]::new($PSScriptRoot, $Port)
    $url = 'http://127.0.0.1:' + $server.Port + '/'
    Write-Host 'STEINS;GATE - Offline Story Player'
    Write-Host $url
    Write-Host 'Keep this window open while playing. Close it or press Ctrl+C to stop.'
    if (!$NoBrowser) { Start-Process $url }
    while ($true) { Start-Sleep -Milliseconds 500 }
} finally {
    if ($null -ne $server) { $server.Dispose() }
}
